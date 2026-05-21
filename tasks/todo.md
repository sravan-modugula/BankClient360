# Client Engagement empty on on-prem (2026-05-21)

## Problem
Client Engagement card shows "No transactions in the last 30 days" for customers
who clearly have transactions visible on the Accounts page (e.g. customerId
8523990, Mastercard ****5843 — 100 transactions, recent dates in May 2026).

## Root cause
`getClientEngagementSqlServer` (server/storage/sqlServerDashboard.ts:105-116) uses
an INNER JOIN to `transaction_category` and filters `tc.group_code IS NOT NULL`.
In FMB's on-prem DB either `financial_transaction.category_id` is NULL or
`transaction_category.group_code` is not populated with the 10 expected English
labels. The Accounts "Recent Transactions" UI works because it selects
`financial_transaction` directly with no category join.

`financial_transaction.transaction_type` *is* populated with values like
`ACH Credit`, `ACH Debit`, `POS Debit - DDA`, `POS Credit - DDa`,
`POS SETTLEMENT Debit - DDA`, `Check\SERIAL` — visible in the AccountDetail
chips (client/src/components/AccountDetailOption2.tsx:556).

## Plan
1. **server/storage/sqlServerDashboard.ts** — change the activity query to
   `LEFT JOIN transaction_category` and also project `ft.transaction_type` and
   `ft.transaction_code`. Group by all three; remove the `group_code IS NOT NULL`
   filter. Index on `(account_id, transaction_date)` is already present.

2. **shared/constants.ts** — add `TRANSACTION_TYPE_PATTERNS`: an ordered list of
   `{ pattern: RegExp, activity: ActivityType }` rules covering the patterns
   above (ACH, POS / debit card, wire, zelle, ATM / withdrawal, check
   deposit vs check payment, transfer, lockbox, deposit catch-all).

3. **server/storage/sqlServerDashboard.ts** — in the result loop:
   - Try `group_code` lookup first (preserves existing behavior).
   - On miss, try matching `transaction_type` then `transaction_code` against
     `TRANSACTION_TYPE_PATTERNS`.
   - If still unmapped, increment `unmappedCount` and capture a sample so the
     existing `info` log surfaces the unknown value.

4. **Verify** with `npm run check` (typecheck) and `npm test` if engagement has
   tests.

## Out of scope
- Backfilling `financial_transaction.category_id` in the on-prem DB.
- Frontend changes — the same DTO shape is preserved.

## Review
- `shared/constants.ts`: added `TRANSACTION_TYPE_PATTERNS` (ordered RegExp list)
  and `activityFromTransactionType()` resolver. `Check Deposit` is matched
  before bare `Check` so check-payment doesn't swallow deposits; bare `Deposit`
  is last so it doesn't shadow `Check Deposit`.
- `server/storage/sqlServerDashboard.ts`: switched the activity query to
  `LEFT JOIN transaction_category`, projects `transaction_type` /
  `transaction_code`, drops `group_code IS NOT NULL`. Bucketing tries
  group_code first, then falls back to `transaction_type`/`transaction_code`
  via `activityFromTransactionType`. Unmapped rows now log a deduped sample
  list at `info` so unknown FMB types surface in logs.
- `server/storage.ts`: same change for the Postgres path (LEFT JOIN, project
  type/code, fallback resolver).
- Typecheck: pre-existing `db is null` / implicit-any warnings remain; no new
  errors introduced by this change.
- No engagement test suite exists to update.
