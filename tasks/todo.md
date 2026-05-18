# Household Aggregated Accounts — match Client Accounts table (2026-05-18)

## Goal
Make the Household page's "Aggregated Accounts" section behave and look like the Client page's "Accounts" table:
- Columns: Type (icon + label), Account # (masked), Product, Balance, Interest Rate, Status
- Toggle: All / Deposits / Loans
- Search box (account # or type)
- Sortable: Balance, Status
- Default sort: Status asc → ACTIVE rows surface first
- Pagination (10/25/50/100), shown only when > 10 rows
- Total row across all filtered accounts

## Approach
Reuse the existing `AccountList` component instead of duplicating the UI. `AccountList` is currently hard-coupled to a `customerId` (it fetches `/api/customers/:id/accounts`). HouseholdPage already has aggregated accounts from `/api/households/:id/accounts` — we just need a way to feed them in.

## Steps

1. **Refactor `client/src/components/AccountList.tsx`** to be reusable:
   - Make `customerId` optional.
   - Add optional `accounts` prop — when supplied, skip the internal query and use it directly.
   - Keep `useQuery` enabled only when `customerId` is set AND `accounts` is not provided.
   - Add optional `onRowClick` prop to override default navigation (so household can navigate with `customerId` per-account).
   - Add optional `title` prop (default `"Accounts"`).

2. **Update `client/src/pages/HouseholdPage.tsx`**:
   - Remove the inline "Aggregated Accounts" `Card` table block.
   - Replace with `<AccountList accounts={allAccounts} onRowClick={...} title="Aggregated Accounts" />`.
   - Drop now-unused state (`accountTab`) and helpers (`filteredAccounts`, `filteredAccountsTotal`). Keep `depositAccounts`/`loanAccounts` — they still feed hero card metrics and Deposits Overview.

3. **Verify**:
   - Type check: `npm run check`
   - Visually confirm at `/ciq/household?householdId=511`:
     - Default sort = Status asc, ACTIVE first
     - Search filter works
     - All/Deposits/Loans toggle works
     - Pagination shows when > 10 accounts
     - Row click navigates to account detail with the correct customerId

## Files touched
- `client/src/components/AccountList.tsx` — make reusable
- `client/src/pages/HouseholdPage.tsx` — swap inline table for `<AccountList />`

## Notes
- `AccountList` masks account numbers (`***00005`); Household currently shows full numbers (`CD000000005`). After this change household will mirror Client. Per user request ("same as clients page").
- Open Date / MTD Avg / Commitment columns from the old household table will be removed (not present on Client page). User asked for parity with Client.
