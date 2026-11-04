# Task 03B — Financial ledger integration

## Development integration

- Wallet USD → Shilling Cash (UGX) and USD Cash → Shilling Cash (UGX) use the confirmed 1% fee. The saved rate, gross USD received, fee and net UGX payout are linked to one exchange transaction and one movement event. A fee does not create a second cash outflow.
- The development legacy transaction create/cancel, cash add/withdraw, customer deposit/withdrawal, repayment and expense endpoints use the same atomic ledger service. An expense requires the actual cash account; deposit/withdrawal and repayment postings are for UGX drawer cash only. Creating an unpaid Internet Credit does not move money.
- Requests use idempotency keys; payment references are unique per shift/account. Balances are checked inside a serialized shift write, and domain updates, audit records and ledger entries roll back together. Browser retries reuse keys in the active tab; operators should check the transaction reference/history before re-entering an uncertain request from another tab or after reload.
- Corrections append compensating movements and retain the original events. Authorized management can reverse deposit, repayment, expense and other open-shift movements. Cashier cancellation remains scoped to their own open shift and the existing 30-minute window. Closed-shift and unlinked historical corrections require a separate policy/review.
- Shift details and the dashboard read recorded drawer balances for ledger-enabled shifts. The management report separates cash movements from exchange turnover and fees. Deposit principal and repayments are not exchange revenue. CSV and Excel still export transaction rows; they are not reconciliation statements.

## Not activated

- UGX Cash → USD Wallet: confirm reverse exchange-rate source and USD payout rounding, and whether a fee applies; if so, confirm amount or percentage, currency and side charged.
- USD Wallet → USD Wallet and USD Cash → USD Wallet: confirm whether each fee is zero, fixed or percentage-based, and if charged, in which currency and on which side.
- Expanded closing remains blocked. Confirm other tender accounts if used, post-closing corrections, and review unlinked historical records before any production cutover.

## Read-only migration inventory

`GET /api/v1/account-operations/migration/dry-run` is development-only and Admin-only. It counts historical shifts, unlinked transactions by status, ledger-only exchange operations and domain records without structured links. Counts are review inventory, not a claim of reconstructability. No entries are synthesized, linked or written. Run against a disposable database or a separately authorized copy, not production Atlas.

## Verification commands

Run `npm test` in the backend. To opt in to the local replica fixture from PowerShell, run:

```powershell
$env:RUN_LEDGER_REPLICA_TESTS = '1'
node --test dist/tests/ledgerReplica.test.js
Remove-Item Env:RUN_LEDGER_REPLICA_TESTS
```

The fixture starts and stops an isolated loopback-only MongoDB replica. The first opt-in run may download the MongoDB test binary. No Atlas credentials are needed. Frontend checks: `npx tsc --noEmit --incremental false` and `npm run build`. Run `git diff --check` from the root.
