# Task 02 — Expanded opening balances (development preview)

The expanded account workflow is deliberately **development only**. It is not a completed or production-ready closing workflow. Production continues using the existing opening form and closing behavior.

## Implemented

- Authenticated development endpoints: GET `/api/v1/cash-sessions/opening-accounts`, POST `/api/v1/cash-sessions/open-accounts`. Registered only for development; handlers also reject production directly. ADMIN, MANAGER and CASHIER only.
- Separate USD Cash and Shilling Cash (UGX), plus optional USD wallets: Telesom, Hormuud, Salaam Bank, Golis, M-Pesa, E-Dahab and Mobile Money.
- Configure providers with optional backend `OPENING_ACCOUNTS_JSON`: a JSON array of `{ "id": "CUSTOM_BANK", "name": "Custom Bank", "kind": "WALLET", "currency": "USD" }` definitions. The array replaces defaults and must also include `{ "id": "CASH_USD", "name": "USD Cash", "kind": "CASH", "currency": "USD" }` and `{ "id": "CASH_UGX", "name": "Shilling Cash", "kind": "CASH", "currency": "UGX" }`. Existing transaction provider enums remain unchanged. IDs must remain stable and must never be reused for a different account. Names/currencies/amounts are snapshotted in each shift, so catalog changes do not rewrite history.
- Mobile-responsive form: Cash Balances, Wallet Balances, Exchange Rate, Review & Confirm. Zero amounts are valid; blank, non-finite, negative and fractional UGX amounts are rejected. USD supports cents.
- Rate confirmation uses the existing active USD/UGX ExchangeRate record and saves an immutable snapshot. Cashiers cannot change the global rate; management can use the existing Exchange Rate page. A stale rate ID is rejected and must be reviewed again. Opening does not change transaction rates or fee calculations.
- Shift metadata records cashier, opening time and audit actor. Request bodies cannot choose another cashier. No update endpoint for opening snapshots was added.
- Additive `openingVersion`, `accountOpenings`, `openingExchangeRate` fields. Legacy `openingBalances`, openingCash and closing history remain intact.
- Sparse unique `activeShiftKey` index prevents concurrent newly-created shifts for one cashier, in addition to the existing active-shift lookup. New legacy openings also receive this key; closing clears it and reopening restores it. Existing records are not backfilled. Ensure the index is created when deploying (no deletion/migration is performed here). A pre-upgrade running server does not write the key, so mixed-version concurrent opening requires a separate rollout check.
- Reconciliation input identity now uses stable opening subdocument IDs, with a deterministic type/provider/currency fallback for old records. Frontend input state and submitted actuals use this identity. Existing clients without accountId can still close unambiguous legacy sessions. Wrong IDs, currencies, duplicated inputs and reused actual balances are rejected.

## USD Cash reconciliation and release gate

Inspection: Transaction records describe USD wallet receipts and UGX cash payouts. CashSession additions/withdrawals are UGX only. Expense records do not identify a currency/account. These records cannot establish a complete USD Cash movement ledger.

`reconcileUSDCash` prepares the approved rule using integer cents: opening + recorded inflows - recorded outflows (authorized positive/negative adjustments are represented with IN/OUT), then actual - expected. It rejects other currencies/accounts, duplicate references and unauthorized/invalid movements. It refuses to calculate if ledger completeness is not established. This function is tested but is intentionally not wired to invented movement records.

All version-2 development shifts are blocked from closing by the backend BEFORE any transaction query or closing-history write. The UI shows the blocking reason; no account is silently marked balanced. Session retrieval returns opening snapshots and no fabricated reconciliation preview. Such a test shift remains open until a complete movement workflow is implemented; do not open one for real shop operations. Existing non-version-2 sessions retain their working closing behavior.

## Following-task dependencies (not implemented automatically)

1. Account-linked, currency-specific USD Cash inflow/outflow/authorized adjustment ledger, with references, actor, timestamps, idempotency and ownership checks.
2. Transaction routing to stable account IDs for all configurable wallets; new catalog providers are not automatically added to the legacy transaction enum.
3. Reconciliation for all selected accounts from complete confirmed movements. Define how expenses, deposits and credit repayments map to accounts without double counting manual adjustments.
4. Replace the version-2 closing gate only after these ledgers and account calculations are verified, then add the consolidated daily closing report.
5. Production rollout/migration/index review and full browser/Atlas acceptance testing. Do not enable this preview in production merely by changing a flag.

## Verification

Automated checks cover default/custom catalogs, zero/invalid amounts, distinct currencies, immutable snapshots and rate persistence, stable ID matching across multiple wallets and reordered actuals, legacy matching, USD Cash balance/shortage/overage, incomplete/unauthorized ledger rejection, production handler rejection, authenticated ownership and existing-shift prevention. Existing authorization and historical-session regression suites remain in place. No live Atlas data was written by tests. Controller tests use isolated stubs; a live concurrent MongoDB integration test and browser acceptance test have not been performed.

Frontend production build was attempted: it stalled after the Next.js 14.2.35 banner, before the optimized-build/compilation stage, with no compiler error output, and was stopped. `.next` and its cache/server/static/types directories have Windows ReparsePoint attributes; the build root cause has not been established. No cache/source deletion was performed. Final frontend TypeScript and diff checks passed. Final backend build and all 46 tests passed. No commit, push, deployment, data reset or Task 03 implementation was performed.

## Files changed in Task 02

- backend/src/services/openingAccounts.service.ts (new)
- backend/src/services/reconciliation.service.ts
- backend/src/models/CashSession.ts
- backend/src/controllers/cash.controller.ts
- backend/src/routes/cash.routes.ts
- backend/src/dtos/cash.dto.ts
- backend/src/tests/expandedOpening.test.ts (new)
- frontend/src/components/cash-sessions/ExpandedOpeningForm.tsx (new)
- frontend/src/components/cash-sessions/OpeningBalancesGrid.tsx
- frontend/src/components/cash-sessions/ReconciliationAccounts.tsx
- frontend/src/lib/reconciliation.ts (new)
- frontend/src/app/cash-sessions/page.tsx
- frontend/src/app/dashboard/page.tsx
- frontend/src/types/index.ts
- TASK_02_HANDOVER.md (new)
