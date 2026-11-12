# Task 01 — Feature audit and simplification

Audit date: 2026-11-03. Source-code audit; production balances and live Atlas records were not inspected. Existing uncommitted changes were preserved. No financial formulas or backend code were changed by this task.

## Feature inventory

| Feature / page | Decision | Reason and next simplification |
| --- | --- | --- |
| Login, refresh, logout, role checks | KEEP | Essential access control. Preserve Admin/Manager/Cashier restrictions. |
| Dashboard | SIMPLIFY | Prioritize shift status, separate currencies, transactions and closing. Remove duplicated administration shortcuts; preserve loading/error states and user-specific caches. |
| Cash Sessions and session details | KEEP / SIMPLIFY | Core opening, cash adjustments, actual balances, reconciliation history and authorized reopening. Use plain labels and prioritize closing. |
| New Transaction | KEEP / SIMPLIFY | Existing wallet USD receipt to UGX payout workflow, fee calculation, reference and rate snapshot. Preserve validation and confirmation. |
| Transaction ledger/details/cancellation | KEEP | Financial history and controlled corrections; preserve ownership and cancellation restrictions. |
| Customers and profiles | SIMPLIFY | Needed by transactions and customer history. Keep search and records; reduce secondary statistics later. |
| Exchange Rate | KEEP | Active USD/UGX rate plus rate history; management-only updates. |
| Fee Rules | KEEP pending business confirmation | Transaction calculation depends on this service. Cannot remove or replace with a blanket percentage. |
| Reports, print, CSV and Excel | KEEP / SIMPLIFY | Preserve history, filters and exports. Prioritize daily closing and explicit currencies; reduce optional ranking panels only after review. |
| Staff | KEEP / SIMPLIFY | Essential account/status/role management. Keep Manager restrictions around Admin accounts. |
| Audit Logs | KEEP | Admin-only security trail. Preserve backend audit events even if UI is simplified. |
| Internet Credit | KEEP, secondary navigation | UGX receivables and repayment history; removal may strand outstanding debts. |
| Customer Deposits | KEEP, secondary navigation | Customer-owned UGX balances and withdrawal ledger; removal may strand liabilities. Never count as income. |
| Expenses API (no dedicated frontend page) | RETAIN pending impact review | Session-linked records exist in the model/controller. Usage and balances are unknown; cannot infer unused from absence of a page. |
| Development reset tools | RETAIN development-only | Not part of production workflows. Never execute for this audit. Removal is a separate maintenance decision. |
| Root redirect / shared navigation / header | KEEP / SIMPLIFY | Essential entry point and navigation. Settings are existing Exchange Rate/Fee Rules/Staff pages; no separate Settings page was found. |

## Core requirement gaps — do not consider closing fully complete

1. Opening accounts currently consist of physical UGX cash, Hormuud EVC Plus USD, and ONE selected USD Mobile Money provider. There is no separate USD physical cash account and no arbitrary collection of individual wallet opening balances.
2. Opening requests do not capture exchange rates. Transactions take a snapshot of the active USD/UGX rate. Whether an opening rate must remain fixed throughout a shift needs confirmation.
3. The transaction model implements USD wallet receipts and UGX payouts, not general transfers between arbitrary cash/wallet accounts or multiple exchange directions.
4. FeeService uses configured fixed/percentage tiers with a fallback of USD 1 up to 100, USD 2.50 up to 500, USD 5 up to 1,000, then 1%. This is not a uniform 1% policy. The discovered 1% USD-to-UGX rule must be confirmed against existing rules before a separate formula change; no formula was changed here.
5. Reconciliation currently uses opening UGX + cash additions - cash withdrawals - completed transaction payouts; digital accounts use opening USD + matching provider receipts. It does not independently aggregate expenses, deposit movements or credit repayments. Confirm whether these movements use the same drawer and how to avoid double-counting manual cash adjustments before implementing changes.
6. General reports summarize exchanges and fees; session details hold per-account closing records. A single daily report combining all required accounts is not yet established.
7. Report date handling mixes local dates and ISO conversions; exports use window.open against authenticated API routes. Review business timezone boundaries and export authorization in a separate functional task before relying on daily totals/exports operationally.

## Safe cleanup performed

- Sidebar grouped into Daily work, Customer accounts and Administration, using the same routes and role arrays.
- Shifts & Closing appears before customer modules; Reports moved into management daily work.
- Cash Session(s) renamed Shifts & Closing; User Staff renamed Staff.
- Removed the duplicate Staff & Configuration dashboard card section. The same destinations remain in the sidebar.
- Shortened dashboard/report explanatory copy. No fields, filters, totals, ledgers, permissions or endpoints were removed.

## Removal recommendations and impact

| Candidate | Dependency / risk | Approval boundary |
| --- | --- | --- |
| Duplicate dashboard administration cards | Sidebar retains all three links; no data dependency | Presentation-only removal completed |
| Optional customer/cashier rankings and decorative dashboard hero elements | Management convenience; confirm actual usage | Consider hiding/collapsing later; retain underlying data and APIs |
| Duplicate fee/profit presentation | Current profitUSD equals serviceFeeUSD; labels can imply unsupported net profit | Review labels and remove duplicate display only after checking report/export consumers; preserve stored fields |
| Internet Credit / Customer Deposits | Active balances, repayment/withdrawal ledgers, audit history | No permanent removal without balance/history impact assessment and explicit approval |
| Fee-rule engine, legacy aliases, expenses API | Transactions, historic documents, reports, tests and possible external clients | No deletion until callers and production data are checked; migration/compatibility plan and approval required |

No whole module is proven safe for permanent deletion by this source audit. No database access, reset, migration, collection deletion, commit, push or deployment was performed.

## Verification scope

Backend build and all 37 automated tests passed during this audit, covering authorization, shift ownership, closing, currency separation, deposits, credit and dashboard scoping. Frontend TypeScript (`npx tsc --noEmit`) and `git diff --check` passed after cleanup. `npm run build` stalled after the Next.js version banner without compilation output and was stopped; production build success remains unverified. No claim is made that the stall's root cause has been diagnosed. These checks do not replace live production or browser acceptance testing, which was not performed in this task.
