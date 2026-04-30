# Household Page Enhancements (2026-04-30)

Source: enhancement spreadsheet (image), screenshots of test-clientiq.fmb.com/household/945515.

## Section: Top header

- [x] **Customer Tags** — removed the household-type chip beside the name.
- [x] **Active chip** — removed.
- [x] **Net Worth (top right)** — removed.
- [x] **Accounts Total tile** — split into "X Deposits" and "Y Loans" count chips.
- [x] **Balances Total tile** — removed.

## Section: Household Overview

- [x] **Total Assets** → renamed to **Total Deposits**, computed from sum of deposit account balances.
- [x] **Add Deposit WAIR** — weighted by balance.
- [x] **Total Liabilities** → renamed to **Total Loan Balances**, computed from loan account balances.
- [x] **Add Loan WAIR** — weighted by balance.
- [x] **Net Worth (overview)** — removed.
- [ ] **Branch (of household)** — DEFERRED. No clean data source — household has `relationshipManagerId` (employee) but no direct branch reference. Need clarification on whether this should pull from primary member's `customer.branchId` or from the relationship manager's branch.
- [ ] **Officer (of household)** — DEFERRED. Would resolve `household.relationshipManagerId` → employee name. Needs a new server endpoint or join.

## Section: Household Members

- [x] **Primary chip** — relabeled to "Head of Household" (now driven by `isHeadOfHousehold` OR `isPrimaryMember`).
- [x] **Role & Control** column — removed.
- [x] **Ownership** column — removed.
- [x] **Status** column — removed.
- [ ] **Branch (of client)** column — DEFERRED. Requires new join with `branch` table in members query.
- [x] **Since** → renamed to **Open Date** (still pulls `customerSince` which is the CIF ORIG_DT).
- [x] **Backend fix** — SQL Server `getHouseholdMembersSqlServer` now selects `c.customer_since`, `hm.is_head_of_household`, `hm.control_type`, `hm.membership_start_date`, `hm.membership_end_date`; mapper and `HouseholdMemberView` interface extended to match.

## Section: Aggregated Accounts

- [x] **Deposits / Loans tabs** — added All | Deposits | Loans toggle.
- [ ] **Client (primary owner)** column — DEFERRED. Requires per-account ownership lookup; not in current `/api/households/:id/accounts` payload.
- [x] **Account Number** — moved to first column.
- [x] **Account Type** → renamed to **Product**, value pulls `accountSubtype` (title-cased, falls back to type).
- [x] **Status** column — removed (backend already filters out closed accounts).
- [x] **Open Date** — added column from `account.openedDate`.
- [x] **MTD Average Balance** — added column (pulls `account.averageBalance`; assumed to be MTD avg).
- [x] **Interest Rate** — added column (formatted as percent).
- [x] **Clickable rows** — onClick navigates to `/account/{accountId}`.
- [x] **Loans tab Commitment** — when on Loans tab, MTD Avg column is replaced by Commitment (pulls `creditLimit` as proxy — schema has no dedicated `commitment` field).

## Section: Deposits Overview

- [x] **Loan widget** — removed; `depositsByType` is now built from deposit accounts only.
- [x] **Capitalization** — type labels are now title-cased ("deposit checking" → "Deposit Checking").

## Open questions / clarifications for next pass

1. **Branch / Officer of household** — what's the source of truth? Primary member's branch + customer-officer assignment? Or household.relationshipManagerId → employee?
2. **Branch column on members** — pull from `customer.branchId` join to `branch.branch_name`?
3. **Client / primary owner column on accounts** — fetch via `account_ownership` (1 query per account, or a batched join in the household-accounts endpoint)?
4. **MTD Avg Balance** — is `account.averageBalance` truly month-to-date, or do we need a separate snapshot field?
5. **Commitment** — for term loans, is `creditLimit` the right proxy, or should we add a dedicated `commitment` column to the loan schema?

## Files modified

- `server/storage/sqlServerHousehold.ts` — query, mapper, `HouseholdMemberView` interface
- `client/src/pages/HouseholdPage.tsx` — Account interface, helpers, derived totals, top section, Household Overview, Members table, Aggregated Accounts (with tabs), Deposits Overview
