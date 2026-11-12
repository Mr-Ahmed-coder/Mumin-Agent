# Task 03 — Financial movement foundation

## Release status

Development ledger implementation; **not a completed production cutover**. Expanded closing remains blocked. The owner explicitly deferred Cash UGX → Wallet USD, Wallet USD → Wallet USD, and Cash USD → Wallet USD because their fee rules are unclear. These flows are rejected by the posting service; no zero-fee or 1% assumption is made for them.

Supported posting flows: Wallet USD → Cash UGX and Cash USD → Cash UGX. Direction is from the shop's perspective: the incoming account receives the customer's money (IN), and the outgoing account pays the customer (OUT).

## Ledger design

`FinancialOperation` is an append-only operation containing all movement legs. Each leg has a stable account ID, currency, positive integer minor-unit amount (USD cents or whole UGX), and IN/OUT direction. Shared operation fields supply operation/reference ID, category, shift, cashier, recorded-by actor, timestamp, reason and applicable exchange-rate snapshot to every leg.

Both exchange legs are inserted together. MongoDB `withTransaction` also includes shift write serialization, customer deposit/credit updates, expense records and audit entries. Failure rolls back the entire posting; there is no non-transaction fallback. A replica set or sharded MongoDB deployment supporting transactions is required.

Unique `(cashierId, requestKey)` plus a canonical request fingerprint handles retries. Reusing a key for different data is rejected. Unique reference keys prevent duplicate references per incoming account/shift; a unique reversal target prevents double refunds. Required unique indexes are checked before posting. Shift revision writes serialize balance checks; outgoing accounts cannot become negative.

Only the shift owner may post in an OPEN expanded shift. Adjustments require Manager/Admin. Cashier exchange reversals require ownership and the existing 30-minute window. Posting/reversal in closed shifts is rejected. Original events are retained; reversals append opposite legs at the original rate and negative fee metadata.

## Fee policy

New USD-to-UGX exchanges use 1%, including the existing legacy quote/create APIs. Old tier records and historical transaction values remain unchanged, but those tiers no longer override new USD-to-UGX exchanges. The fee-rules screen explains this.

For USD A at rate R: gross UGX = round(A × R); fee UGX = round(A × R × 1%); payout = gross UGX − fee UGX. Rounding is half-up to whole UGX. Calculations in the new engine use integer ratios to avoid floating-point conversion drift. USD inputs accept cents, rates up to six decimals. Exact USD fee metadata can include four decimals; the actual fee retained is the separately stored whole-UGX deduction. Fee metadata is not an additional IN/OUT entry, so it is not counted twice. Legacy quote/create calculations use the same helper.

## Development API

Registered only when backend NODE_ENV is development; route middleware and posting/reversal services also refuse production. All routes require authentication and ADMIN/MANAGER/CASHIER authorization.

- POST `/api/v1/account-operations`
- POST `/api/v1/account-operations/reverse`
- GET `/api/v1/account-operations/shift/:id` (cashiers only their own shift; managers/admins may inspect)

Example exchange request (use real selected account/shift/rate IDs; this example is not executed):

```json
{
  "requestKey": "unique-client-request-001",
  "shiftId": "<shift ObjectId>",
  "category": "WALLET_USD_TO_CASH_UGX",
  "accountId": "HORMUUD_EVC_PLUS",
  "outgoingAccountId": "CASH_UGX",
  "amount": 100,
  "exchangeRateId": "<active ExchangeRate ObjectId>",
  "reference": "provider-reference-001"
}
```

Use category CASH_USD_TO_CASH_UGX and accountId CASH_USD for the second confirmed flow. All accounts must be present in the shift's immutable opening snapshots; custom configured wallets are supported without enum changes.

Auxiliary categories: CASH_ADDED, CASH_WITHDRAWN, ADJUSTMENT, EXPENSE, CUSTOMER_DEPOSIT, CUSTOMER_WITHDRAWAL and CREDIT_REPAYMENT. Supply accountId, amount, reason, reference and requestKey. ADJUSTMENT additionally requires direction IN/OUT. Deposit/withdrawal/repayment movements use CASH_UGX. Withdrawals/repayments require recordId. A new deposit profile can instead supply customerName and phone. Each domain balance/ledger and account event are committed together. Creating Internet Credit itself does not fabricate a cash outflow; service stock/cost treatment needs separate confirmed rules.

Reversal request: `{ "requestKey": "unique-refund-001", "operationId": "<operation ObjectId>", "reason": "Customer refund" }`. Deposit, withdrawal, credit-repayment and expense corrections are blocked from generic cash-only reversal because their domain ledgers also require explicit compensating events. Those correction workflows remain a dependency.

## Historical safety and remaining dependencies

- Only expanded shifts created after ledger capture was introduced have immutable `ledgerVersion: 1`. Older version-2 shifts and legacy shifts cannot post into this ledger or claim complete current balances. No historical USD Cash movement is invented or backfilled.
- Expanded shifts cannot bypass account posting through legacy transaction, cash adjustment, expense, deposit or repayment endpoints. The existing production/legacy workflow otherwise remains available for compatibility.
- **Legacy create/cancel and other legacy write paths have not been migrated to the new atomic ledger.** Legacy cancellation still uses its existing status/audit mechanism; do not claim the whole application has complete append-only movement coverage. Production cutover requires an explicit migration/compatibility strategy for known existing wallet/UGX records, without inventing USD Cash history.
- New account operations are stored separately from legacy Transaction records. Their ledger endpoint returns account balances and net fee totals, but existing transaction lists, dashboard analytics and report exports are not yet unified with them. The expanded current-session API exposes accountBalances and ledger-based current UGX cash. Older UI summary fields still describe legacy transactions. The new posting API has no full transaction-entry UI yet.
- Confirm domain correction/reversal rules, finish the unified UI/report adapters, confirm all money paths and account mapping, then verify ledger completeness before replacing Task 02's closing gate. No Task 04 workflow was activated.
- Confirm fees for the three explicitly deferred flows before enabling them. No generalization from USD-to-UGX is permitted.

## Tests and environment checks

Regression tests cover both confirmed exchange flows, multiple wallets, USD/UGX separation, 1% fee/payout arithmetic, all three deferred-flow rejections, balance checks, reversal symmetry, immutable history, production rejection, cashier/shift restrictions, request-key mismatch, idempotent retry, rollback orchestration, cash additions, expenses, deposits/withdrawals and credit repayments. Existing historical/authorization/closing suites remain.

Atomic orchestration tests use isolated database stubs; they do **not** prove real concurrent MongoDB replica-set behavior. A disposable non-production replica-set integration test, concurrent retries/double-spend tests, and browser acceptance testing remain release requirements. No production Atlas data was written or queried in this task.

## Frontend build investigation

In the sandbox, Next.js 14.2.35 stalls AFTER create-dist-dir and BEFORE the optimized-build message. Instrumenting filesystem failures found hundreds of EPERM results for rmdir on generated `.next` subdirectories. Installed Next.js recursive-delete.js retries via `unlinkPath(p, isDir, t++)`, passing the old counter repeatedly, causing endless retries for these errors. Running the unchanged `npm run build` outside the sandbox successfully cleaned the output and built all 17 routes. Evidence supports sandbox cleanup permissions plus the retry loop; reparse-point attributes alone were not proof of a OneDrive cause. No dependencies or Next.js internals were edited.

No commit, push, deploy, production data reset or Task 04 work was performed.

## Main files

New: models/FinancialOperation.ts, services/movementMath.service.ts, services/movementLedger.service.ts, services/legacyMovementGuard.service.ts, routes/accountOperations.routes.ts, tests/movementLedger.test.ts (under backend/src).

Modified: backend app registration, CashSession/Transaction/Expense models, cash/transaction/fee/deposit/credit/expense controllers, FeeService; frontend fee-rules and new-transaction pages. Existing uncommitted work is preserved.
