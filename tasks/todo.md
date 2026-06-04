# Pivot transaction queries off `ft.account_id` onto `ft.account_number` (2026-06-04)

## Goal
The upstream ETL no longer populates `financial_transaction.account_id` reliably. Every transaction read on the Client page (Deposits Recent Activity, Deposits Balance Trend, Client Engagement) and the Account page (TransactionHistory grid, Account Detail) had to be re-pointed onto the denormalized `account_number` column added in commit `e51fbea`. URLs, React Query keys, and ABAC contexts stay unchanged so the client layer is untouched.

## Prerequisites — must run on every environment before deploy
- [x] Backfill script — `Insert Queries/Schema Changes/financial_transaction_backfill_account_number.sql`. Idempotent. Run before deploying the application changes; otherwise every query returns zero rows.
- [x] Schema relaxation — `financialTransaction.accountId` is now nullable to match ETL reality (rows can arrive without it).

## Changes by surface

### Shared
- [x] `shared/schema.ts` — `financialTransaction.accountId.notNull().references(...)` → `.references(...)` (nullable). Comment explains why.
- [x] `server/storage/sqlServerTransaction.ts` — rewrite:
  - `mapTransactionFromDb` now returns `accountNumber`.
  - `getTransactionsSqlServer` accepts `accountNumber` and `accountNumbers` (named-param binding for the IN list).
  - `getTransactionsByAccountSqlServer(accountNumber, …)` and `getTransactionsByCustomerSqlServer(accountNumbers, …)` signature change.
- [x] `server/storage.ts` facade — `getTransactions`, `getTransactionsByAccount`, `getTransactionsByCustomer` and the `IBankingStorage` interface all repointed onto `accountNumber` / `accountNumbers`. PG paths updated in lockstep.
- [x] `server/storage/sqlServerAccount.ts` — `mapTransactionFromDb` (the local copy in this file) now returns `accountNumber`.

### Account page
- [x] `GET /api/accounts/:accountId/transactions` (`server/routes.ts`) — handler resolves `accountId → accountNumber` via `storage.getAccount`, then calls `storage.getTransactionsByAccount(account.accountNumber, …)`. ABAC contextBuilder unchanged. Duplicate route definition removed.
- [x] `GET /api/customers/:customerId/transactions` (`server/routes.ts`) — handler resolves `customerId → [accountNumber]` via `storage.getCustomerAccounts`, then calls `storage.getTransactionsByCustomer(accountNumbers, …)`. Row enrichment now keyed on `accountNumber`.
- [x] `GET /api/transactions` (`server/routes.ts`) — query-string `accountId` / `customerId` translated to `accountNumber` / `accountNumbers` before storage call.
- [x] `GET /api/diagnostics/transactions/:customerId` — internal SQL repointed; now also reports `null_account_numbers` / `null_account_ids` so the diagnostic actually tells you whether the backfill is healthy.
- [x] `GET /api/accounts/:id/balance-history` — PG + SQL Server paths both resolve `accountId → accountNumber` once, then filter `ft.account_number = @accountNumber`.

### Client page
- [x] **Deposits Recent Activity** — SQL Server path (`getDepositRecentTransactionsSqlServer` in `server/storage/sqlServerDashboard.ts`) and PG path (`storage.getDepositRecentTransactions`) both rewritten as a two-step query: resolve the customer's deposit accounts to account numbers first, then `WHERE ft.account_number IN (…)`. Account type joined back in TS.
- [x] **Deposits Balance Trend** — SQL Server `getDepositTrendSqlServer` and PG `getDepositTrend` use the `DEPOSIT_ACCOUNTS_SUBQUERY` (now also emits `account_number`); both feed the trend helper. PG inline trend SQL in `/api/customers/:id/deposit-analytics` rewritten on `depositAccountNumbers`.
- [x] `server/storage/depositsTrendHelper.tsx` — internal field rename `account_id` → `account_number`. Pure identity key; no behavioral change.
- [x] **Client Engagement** — `getClientEngagementSqlServer` rewritten as a three-way join (ft → account on account_number → account_ownership on account_id). PG twin in `storage.getClientEngagement` swapped to filter on `financialTransaction.accountNumber`.
- [x] **Relationship Summary** — historical balance CTEs in both PG `storage.getRelationshipSummary` and SQL Server `getRelationshipSummarySqlServer` repointed onto `account_number`.

### Optional / out of scope
- Performance index `scripts/create_performance_indexes.sql` (still keyed on `account_id`) — follow-up DB-ops PR.
- Reference SQL in `Insert Queries/financial_transaction.sql` — Operations reference template, tracked separately.
- Write path — no application code currently inserts financial_transaction rows; the new mapper and storage methods note that future writers must populate `account_number`.

## Verification
- `npm run check` — net **-1** errors versus baseline (fixed two pre-existing `accountNumber missing in mapper` bugs; introduced one `'db' is possibly null'` matching the codebase's existing pattern). No new regressions.
- DB-side: `SELECT COUNT(*) FROM financial_transaction WHERE account_number IS NULL` post-backfill. Any remaining nulls are orphan rows (`account_id` also NULL) — a separate ETL repair, not this PR's concern.
- App-side smoke (run after deploy): Client tab → Deposits Recent Activity / Balance Trend / Client Engagement all render. Accounts tab → TransactionHistory loads. Drill into an account → AccountDetailOption2 transactions populate.

## Lessons captured
- See `tasks/lessons.md` — captured the "every place that joins financial_transaction" inventory pattern for future ETL pivots.
