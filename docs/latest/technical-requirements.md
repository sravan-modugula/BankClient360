# ClientIQ / Banking Client 360: Technical Requirements

*Last reviewed: 2026-07-02 - Source of truth: application code*

## Purpose / Overview

This document is the EPIC / feature / user-story technical requirements specification for **ClientIQ** (product name "Banking Client 360"), an on-prem banking customer-360 CRM. It defines the data model, search, authentication, RBAC, audit, and infrastructure behavior that the application actually implements, organized into EPICs.

Every requirement below is scoped to behavior that exists in the codebase. Features that are modeled in the schema but have **no implementing code**, or that appear only in the non-production dev seed, are explicitly labeled. Aspirational compliance features (SAR/FinCEN filing, OFAC/AML screening, automated health monitoring) are called out as **Not implemented** so they are not mistaken for delivered scope.

### Technology stack (as built)

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript, Vite, **Material UI (MUI) primary**. Radix/shadcn primitives and Tailwind exist as scaffolding but are largely unused in active screens. |
| Backend | Node.js + Express + TypeScript |
| Database | **Microsoft SQL Server only** (production and all environments) |
| Data access | Raw `mssql` queries in `server/storage/sqlServer*`. Drizzle ORM is used for TypeScript type generation and Zod insert-schema derivation, not as the runtime query layer. |
| Validation | Zod (`shared/schema.ts`), React Hook Form on the client |
| State | TanStack React Query |
| Auth | SAML SSO (RSA SecurID via the F&M Bank portal) in preprod/prod; local mock auth in dev/test |
| Timezone | Process TZ and all display formatting forced to `America/Los_Angeles` (Pacific) |

> **[CONFIRM]** Document owner, version number, and review cadence. These are governance facts not derivable from code.

### Environments

Four environments: **dev, test, preprod, prod**. See EPIC 10 for the deployment and infrastructure model. SAML SSO is enabled only in preprod and prod; dev and test run local/mock auth.

---

# EPIC 1: Customer Management

## Overview

Customer Management provides a unified view of individual and business/trust customers with a polymorphic customer record, profile management, and Jack Henry core-banking linkage. Conditional name requirements are enforced in **application code** (Zod), not by a database constraint.

## Data Model: `customer` (`shared/schema.ts:100-163`)

- Polymorphic record: individual fields (`first_name`, `last_name`, `middle_name`, `preferred_name`, `date_of_birth`, etc.) and business fields (`business_name`).
- `full_name` varchar(200), a generated/denormalized column used for unified search (omitted from the insert schema, `shared/schema.ts:901`).
- `tax_identifier` varchar(20) **UNIQUE**; `government_id`, `government_id_type`, `citizenship`.
- `customer_type` varchar(20) NOT NULL, **default `"regular"`** (`shared/schema.ts:122`).
- `customer_status` varchar(20) default `"active"`; `customer_since` date default now.
- Compliance fields: `kyc_status`, `kyc_last_updated`, `risk_rating`.
- Core-banking keys: `jack_henry_cif_number`, `silverlake_customer_id`.
- Flags: `is_employee`, `vip_customer`, `is_deceased` (all default false).
- FK `branch_id` → `branch`.

### Validation: application-level, not a DB constraint

`insertCustomerSchema` is a **Zod discriminated union on `customerType`** (`shared/schema.ts:907-929`):

| `customerType` values | Required | Forbidden |
|---|---|---|
| `individual`, `premium`, `regular` | non-empty `first_name` + `last_name` | `business_name` |
| `business` | non-empty `business_name` | `first_name`, `last_name` |
| `trust` | non-empty `business_name` | `first_name`, `last_name` |

There is **no** `customer_name_type_check` database CHECK constraint and **no** name-validation database trigger anywhere in the repo. `estate` is **not** an accepted `customerType`; an estate insert fails validation. (The dev faker seed does generate an `"estate"` value, but that path targets the non-production seed, not the validated API.)

## FEATURE 1.1: Polymorphic Customer Registration

**US-1.1.1: Register individual customer**
- Acceptance criteria:
  - [ ] API validates `first_name` and `last_name` as required for `individual`/`premium`/`regular` (Zod union).
  - [ ] `business_name` must be null/empty for individual types.
  - [ ] `tax_identifier` is UNIQUE at the DB level.
  - [ ] `customer_type` defaults to `regular` when not supplied.
  - [ ] `full_name` is a generated column, not client-supplied.

**US-1.1.2: Register business customer**
- Acceptance criteria:
  - [ ] API validates `business_name` as required for `customerType='business'`; first/last name forbidden.
  - [ ] `tax_identifier` (EIN) UNIQUE.

**US-1.1.3: Register trust customer**
- Acceptance criteria:
  - [ ] `customerType='trust'` requires non-empty `business_name` (e.g. "Smith Family Trust"); first/last name forbidden.
  - [ ] `estate` is **not** a supported validated type. > **[CONFIRM]** whether an `estate` customer type is a roadmap item.

## FEATURE 1.2: Customer 360 Dashboard

**US-1.2.1: Customer overview**
- Acceptance criteria:
  - [ ] Dashboard shows personal/business info, linked accounts, household relationships, debit cards, recent activity, and assigned officer, subject to the RBAC guards in EPIC 8.
  - [ ] Balances and dates are formatted in Pacific time (see EPIC 4).
  - [ ] VIP and employee badges are driven by the `vip_customer` and `is_employee` flags (`shared/schema.ts:149-151`). > **[CONFIRM]** exact chip hex colors against `client/src/components/CustomerOverview.tsx`.

## FEATURE 1.3: KYC & Risk fields

**US-1.3.1: KYC / risk data capture**
- Acceptance criteria:
  - [ ] `kyc_status`, `kyc_last_updated`, and `risk_rating` are stored on the customer record.
  - [ ] These are stored fields; there is **no** implemented KYC-expiry alerting, renewal workflow, or automated risk-review job in the codebase. Treat alerting/workflow items as roadmap. > **[CONFIRM]** roadmap for KYC alerting.

---

# EPIC 2: Account Management

## Overview

Account Management covers multi-type accounts, multi-owner (joint) support, and balance/status tracking. Accounts and ownership are loaded from Jack Henry sources by the SQL Server ETL; the application is primarily a read/display surface over core-banking data.

## Data Model

- **`account`** (`shared/schema.ts:188-219`): `account_number` varchar(50) UNIQUE; `account_type`, `account_subtype`; `account_status` default `"active"`; `balance` / `available_balance` decimal(15,2); `interest_rate`, `credit_limit`; core-banking keys `jack_henry_account_id`, `silverlake_account_structure`; FK `branch_id`.
- **`account_ownership`** (`shared/schema.ts:271-286`): customer↔account M:N. `ownership_type`, `ownership_percentage` (default 100.00), `is_primary_owner`, `signing_authority`, `can_view_statements`, `can_make_transactions`, `transaction_limit`, `is_active`.

Account types observed in application logic include `checking`, `deposit checking`, `savings`, `money_market`, `cd`, `business_checking` (`server/routes.ts:1387,2048`). > **[CONFIRM]** the authoritative closed list of account types and any minimum-opening-deposit / interest-rate business rules. These are not encoded in the application code reviewed.

## FEATURE 2.1: Account & ownership display

**US-2.1.1: View customer accounts**
- Acceptance criteria:
  - [ ] `GET /api/customers/:id/accounts` returns the customer's accounts, gated by `accounts.view` (EPIC 8).
  - [ ] Joint accounts surface all owners via `account_ownership`.
  - [ ] Balance and interest-rate columns are additionally gated by `account.view.balances`.

> **[CONFIRM]** Account creation, closure, hold-management, and status-transition workflows described in earlier drafts are not evidenced as implemented server features. Confirm whether account lifecycle mutation is in scope for ClientIQ or handled entirely in the Jack Henry core.

---

# EPIC 3: Debit Card Management

## Overview

Debit cards are displayed as read-only data sourced from the core banking system. Cards are associated with checking-type accounts and a card-holding customer.

## Data Model: `debit_card` (`shared/schema.ts:451-484`)

Columns: `card_id` (PK), `account_id` (FK, NOT NULL), `customer_id` (FK, NOT NULL), `limit_profile_id` (FK, nullable), `card_type`, `card_status`, `last_four_digits` (PCI: last 4 only), `card_brand`, `expiry_month`, `expiry_year`, `cardholder_name`, `jack_henry_card_id`, `silverlake_card_token`.

Insert validation: `insertDebitCardSchema` enforces `expiry_month` 1-12 and `expiry_year >= current year` (`shared/schema.ts:1117-1124`).

### Limit profiles: dev-seed only, not the production model

- The shared schema definition includes a `debit_card_limit_profile` table and a `limit_profile_id` FK on `debit_card`.
- The **8 named limit profiles** (Standard Individual, Premium Individual, Business Standard, Business Premium, VIP Elite, Employee Banking, Student Banking, Senior Banking) exist **only in the dev faker seed** (`scripts/seed.ts:559-632`).
- The **production SQL Server ETL** (`Insert Queries/debit_card.sql`) has **no `limit_profile_id`**; production cards carry inline limit columns (e.g. `daily_withdrawal_limit`). The named-profile model is not the production reality.

### Business-rule enforcement: comment-documented, DDL not in repo

A schema comment block (`shared/schema.ts:430-450`) states that DB triggers enforce (a) cards only for `checking`/`business_checking` accounts and (b) that the cardholder is a valid account owner. **The trigger DDL is not present in the repo.** Application code independently restricts card-eligible account types (`server/routes.ts:2046-2048`: `checking`, `deposit checking`, `business_checking`).

> **[CONFIRM]** Whether the checking-only and ownership triggers actually exist in the production SQL Server database.

## FEATURE 3.1: Card display

**US-3.1.1: List cards on an account/customer**
- Acceptance criteria:
  - [ ] Cards are shown only for eligible account types (`checking` / `deposit checking` / `business_checking`).
  - [ ] Only `last_four_digits`, `card_brand`, and token references are stored/shown (PCI-DSS).

### Not implemented (roadmap)

Card **activation, PIN set, block/unblock, replacement + replacement fees, fraud freeze, and expiry auto-reissue** described in prior drafts are **not implemented**. Seeded card statuses are `active` / `inactive` / `blocked` / `expired` and seeded card types are `standard` / `gold` / `platinum` / `business` (`scripts/seed.ts:672-722`); `frozen` and `canceled` are not part of the seeded set. > **[CONFIRM]** whether card lifecycle mutation is a roadmap item or out of scope (core-banking-owned).

---

# EPIC 4: Transaction Management

## Overview

Transaction Management displays financial transaction history per account. All transaction data originates from the Jack Henry ETL; the application reads and formats it. All timestamps are **displayed** in Pacific time.

## Data Model: `financial_transaction` (`shared/schema.ts:380-425`)

- `transaction_id` (PK). `account_id` FK is **nullable**; the ETL no longer reliably populates it, so joins and filters pivot on the denormalized `account_number` column (`shared/schema.ts:382-383`, `Insert Queries/Schema Changes/financial_transaction_add_account_number.sql`).
- `amount` decimal(15,2) NOT NULL; `transaction_code`, `transaction_type`, `status`.
- `transaction_date` timestamp NOT NULL; **`posting_date`** timestamp NOT NULL (the column is `posting_date`, not `posted_date`).
- `description`, `reference_number`, `merchant_name`, `merchant_category_code`; FK `category_id` → `transaction_category`.
- Balance columns: `ledger_balance_after`, `available_balance_after` (both NOT NULL); there is no generic `running_balance`.
- `transfer_group_id` (uniqueidentifier), `counterparty_account_id` (FK), `source_system` default `"jack_henry"`, `source_transaction_id`, `raw_payload` (JSON).
- Dedup UNIQUE key: `(account_id, source_system, source_transaction_id)`.

### Timezone

The application **forces the process timezone** to `America/Los_Angeles` at startup (`server/utils/timezone.ts`) and the frontend formats dates in Pacific time. This is a process/display convention. Storage columns are `timestamp` / `DATETIME2` and do **not** carry an intrinsic "stored in PST" guarantee.

### Load window

The production ETL loads only the **last 13 months** of transactions (`Insert Queries/financial_transaction.sql`). Date-range requirements older than 13 months will return no data.

## FEATURE 4.1: Transaction history

**US-4.1.1: View account transactions**
- Acceptance criteria:
  - [ ] `GET /api/accounts/:accountId/transactions` returns transactions for the account, gated by `transaction.view` with the employee-record ABAC restriction (EPIC 8).
  - [ ] `GET /api/customers/:customerId/transactions` returns transactions across the customer's accounts, same guard.
  - [ ] Dates are displayed in Pacific time.
  - [ ] Only the last ~13 months of history is available (ETL window).

### Not implemented (roadmap)

Transaction **posting/settlement jobs, auto-categorization, dispute filing, and reversal workflows** described in prior drafts are not evidenced as implemented mutation features (ClientIQ is read-oriented over the core). > **[CONFIRM]** roadmap vs out-of-scope.

---

# EPIC 5: Search & Discovery

## Overview

Global customer search is a **case-insensitive substring `LIKE` match** against SQL Server. There is no full-text, phonetic, or similarity-scored fuzzy matching in the production search path.

## Production search behavior: `searchCustomersSqlServer` (`server/storage/sqlServerCustomerSearch.ts:103-126`)

The production query wraps the term as a `%term%` pattern and matches with `COLLATE Latin1_General_CI_AS LIKE` across:

- `first_name`, `last_name`, `business_name`, `full_name`
- `tax_identifier`, `silverlake_customer_id`
- `CONCAT(first_name, ' ', last_name)`

Results are ordered by `last_name, first_name` and paginated with `OFFSET / FETCH NEXT`. There is no relevance score, no configurable similarity threshold, and no phonetic fallback.

Routing:
- `GET /api/customers/search`: smart search with ID auto-detection (`server/routes.ts:99`).
- `POST /api/customers/search`: advanced search, delegates to `storage.smartSearchCustomers` (`server/routes.ts:162,190`).
- The storage layer dispatches customer search to `searchCustomersSqlServer` (`server/storage.ts:599-605`).

> A `SqlServerSearchProvider` adapter that references `STRING_SIMILARITY`/`SOUNDEX` exists under `server/adapters/search/` alongside other unused search-provider adapters. **None of these is the wired production customer-search path.** They are part of a dormant abstraction and must not be documented as production behavior.

## FEATURE 5.1: Customer search

**US-5.1.1: Search customers by name / ID / tax-ID**
- Acceptance criteria:
  - [ ] Numeric input is auto-detected and can match on customer ID.
  - [ ] Name/business-name/tax-ID/Silverlake-ID matching uses case-insensitive substring `LIKE`.
  - [ ] Results are paginated (validated `limit` max 100, `smartSearchParamsSchema`).
  - [ ] Tax-ID/PII lookups are audited via route audit middleware + `audit_event` (EPIC 8/9).

## FEATURE 5.2: PII masking on search results

**US-5.2.1: Mask tax identifiers in responses**
- Acceptance criteria:
  - [ ] The customer adapter masks the tax identifier to `XXX-XX-<last4>` in DTOs (`server/adapters/customerAdapter.ts:17-20,58`).

### Not implemented / correction

Prior claims of a similarity-scored "fuzzy match with 30% threshold" (e.g. "Smyth finds Smith at 33% similarity"), special search indexes, and cross-engine search parity are **not** part of production search. Notes/tax-ID "role-based access, compliance-only" claims are inaccurate for the code as-is (search endpoints are authentication-gated; see EPIC 8 for exact per-route guards). A 7-year audit retention is a governance policy, not a coded guarantee. > **[CONFIRM]** search-audit retention policy.

---

# EPIC 6: Household & Relationship Management

## Overview

Households group related customers, including a B2B/subsidiary hierarchy. Relationship role is a free-form varchar plus structured B2B ownership fields, not a fixed enum.

## Data Model

- **`household`** (`shared/schema.ts:165-186`): `household_name`, `household_type` default `"family"`, `total_assets`/`total_liabilities`, FK `relationship_manager_id` → `employee`, self-reference FK **`parent_household_id`** → `household`, `consolidation_method` default `"equity"`.
- **`household_membership`** (`shared/schema.ts:249-269`): FK `household_id`, FK `customer_id`; **`relationship_role`** varchar(50) NOT NULL; `is_primary_member`, `is_head_of_household`; `rollup_accounts` (default true), `rollup_percentage` (default 100.00); B2B fields **`ownership_percentage`** decimal(5,2) NOT NULL default 0, `control_type` default `"none"`.

There is **no** schema-enforced enum of relationship types (spouse/child/etc.); `relationship_role` is convention-only.

## FEATURE 6.1: Household grouping

**US-6.1.1: View household membership**
- Acceptance criteria:
  - [ ] The Household tab is gated by `household.view` (EPIC 8).
  - [ ] Membership rows expose `relationship_role`, `ownership_percentage`, and head-of-household flag.
  - [ ] B2B/subsidiary hierarchy is supported via `parent_household_id` + `consolidation_method`.

> **[CONFIRM]** Whether household creation/edit is a user-facing write feature or ETL-loaded only. Note: the dev seed has a known defect writing malformed household-membership rows (`scripts/seed.ts:450`), relevant only to dev fixtures, not production.

---

# EPIC 7: Branch, Employee & Officer Administration

## Overview

Branches, employees, and officer-to-customer assignments. The `employee` table is also the SAML/SSO identity record (EPIC 8).

## Data Model

- **`branch`** (`shared/schema.ts:32-43`): `branch_code` UNIQUE, `branch_name`, `branch_type`, FK `address_id`, FK `region_id`, `is_active`, `opened_date`.
- **`employee`** (`shared/schema.ts:45-66`): `employee_number` UNIQUE, `first_name`/`last_name`, `title`/`position`, `officer_code` UNIQUE, `department`, `hire_date`. SAML/SSO fields: `sso_subject` UNIQUE, `email`, `last_seen_saml_role` (widened to NVARCHAR(MAX) on SQL Server), `last_login_at`. Soft-delete `deleted_at`.
- **`employee_branch`** (`shared/schema.ts:288-304`): employee↔branch M:N, UNIQUE `(employee_id, branch_id)`.
- **`customer_officer_assignment`** (`shared/schema.ts:306-317`): FK `customer_id`; **`officer_code`** varchar(20) NOT NULL, a **string code, not an FK to `employee`**; natural composite UNIQUE key `(customer_id, officer_code)` (no separate PK). `relationship_type` constrained by Zod to `['primary','secondary']` (`shared/schema.ts:983-986`).

## FEATURE 7.1: Officer assignment

**US-7.1.1: Officer-to-customer linkage**
- Acceptance criteria:
  - [ ] Officer assignment is keyed on `officer_code` (string), matched against `employee.officer_code`.
  - [ ] `relationship_type` is limited to `primary` / `secondary`.
  - [ ] The officer adapter derives `isPrimary` from `relationship_type === 'primary'` and sorts primary-first (`server/adapters/officerAdapter.ts:44-45,79-86`).

> **[CONFIRM]** Branch/employee/officer administrative CRUD scope, capacity limits ("max customers per officer"), and org-hierarchy features. These are not evidenced as implemented mutation features.

---

# EPIC 8: Authentication, RBAC & Authorization

## Overview

Authentication is **SAML SSO** (RSA SecurID via the F&M Bank portal) in preprod/prod, with local mock auth in dev/test. Authorization is a **privilege-level + role-permission RBAC model** enforced server-side by middleware, with one attribute-based (ABAC) rule. This EPIC replaces the earlier "AML/OFAC/SAR compliance" EPIC, which described features that do not exist in the code.

## 8.1 Authentication model

- **SAML enabled** by `SAML_ENABLED=true` (preprod/prod). When enabled, Express sessions are stored in a SQL Server **`sessions`** table via `connect-mssql-v2` (`server/auth/session.ts`), and `passport-saml` (`server/auth/samlStrategy.ts`) handles the assertion.
- **Login flow**: IdP → `POST /saml/acs` (`server/routes/auth.ts:264-476`) → `upsertEmployeeFromSamlSqlServer()` finds/creates the employee → enforced AD-group role sync → session populated with `roles` (names) and `permissions` (codes).
- **Dev/test fallback**: with `SAML_ENABLED=false`, the app uses mock auth (`req.employeeId = 1`).

### `sessions` table is DDL-only

The session store table is created by `scripts/create_sessions_table.sql` (repaired by `fix_sessions_table.sql`); it is **not** in `shared/schema.ts`. It is a prerequisite for SAML login.

**US-8.1.1: SAML login and session**
- Acceptance criteria:
  - [ ] With SAML enabled, an unauthenticated request to a non-allowlisted path is redirected to login (`server/middleware/authGate.ts`; allowlist includes `/api/auth/`, exact `/health`, `/favicon.ico`).
  - [ ] Employee is auto-provisioned from the SAML assertion (RSA already gates who can authenticate).
  - [ ] Session carries the user's resolved roles and permission codes.

## 8.2 AD-group → role mapping (code-based)

- Role assignment is driven by AD group names following the convention `<PREFIX>_<ENV>_APP_ClientIQ_<RoleToken>_<Access>` (`server/auth/adGroupRoleMap.ts:5-15`). The access suffix (RO/RW/MOD/ADM/EXEC) is ignored; the RoleToken selects the role.
- Mapping is **application code** (`AD_GROUP_TOKEN_TO_ROLE`, `adGroupRoleMap.ts:41-58`) resolved against `role.role_name` rows, **not** the `saml_role_mapping` DB table (that table is admin-CRUD-only and off the login path).
- **Environment scoping**: `SAML_ROLE_ENV` (DEV/TST/STG/PRD, with aliases like "PreProd"→STG) makes each deployment honor only its own environment's AD groups. Unset = honor all environments.
- **Provenance rule** (`scripts/ensure_rbac_provenance_columns.sql:7-9`): `employee_role.assigned_by IS NULL` → AD/system-derived (enforced sync may revoke); `assigned_by IS NOT NULL` → admin-assigned (never auto-revoked).
- **Default/fallback role**: `SAML_DEFAULT_ROLE_NAME` (default **"Branch Manager"**). If AD yields no role, or sync errors, ACS applies a fallback so the user is not stranded (`server/routes/auth.ts:412-424`).

**US-8.2.1: Per-login role sync**
- Acceptance criteria:
  - [ ] On each login, AD-derived roles are reconciled: no-longer-desired AD roles (`assigned_by IS NULL`) are revoked; newly desired roles are assigned with `assigned_by = NULL`.
  - [ ] Admin-assigned roles (`assigned_by` non-null) are never auto-revoked.
  - [ ] Users with no resolvable role receive Branch Manager as the default.

> **[CONFIRM]** The AD-group map references a **`BRS`** role name (`businessbanker`/`assistantmanager` → `BRS`) that no in-repo seed or migration creates; the seed instead has "Business Banker" and "Assistant Manager". Confirm the production `role` rows match every name the AD map can emit, or those users fall back to Branch Manager.

## 8.3 Privilege levels, roles, permissions

**Five privilege levels (0-4)** (`scripts/seed.ts:107-113`):

| Level | Name |
|---|---|
| 0 | Read-Only (defined but unused by any role) |
| 1 | Staff |
| 2 | Manager |
| 3 | Senior/Branch |
| 4 | System Admin |

**Nine seeded roles** (`scripts/seed.ts:117-127`): System Admin (4), Branch Manager (3), Assistant Manager (2), Loan Officer (2), Business Banker (2), Teller (1), Customer Service Rep (1), Risk Analyst (1), Compliance Officer (1).

**Eleven seeded permissions** (`scripts/seed.ts:133-154`): `accounts.view`, `account.view.balances`, `transaction.view` (ABAC), `customer.view.relationship_summary`, `customer.view.recent_activity`, `customer.view.deposits`, `household.view`, `users.view`, `users.assign_roles`, `user_management.view`, `user_management.assign_roles`.

### Two-tier permission resolution

A user's effective permissions are the **union** of:
1. **Privilege-level inheritance**: every active permission whose `min_privilege_level <= user's maxPrivilegeLevel` (`server/storage/roleManagement/sqlServer.ts:379-397`). Consequence: level ≥2 roles inherit all view permissions with no `role_permission` row.
2. **Explicit `role_permission` grants**: seeded only for level-1 roles (`scripts/seed.ts:159-188`): Teller and CSR get 7 permissions each; Risk Analyst and Compliance Officer get 6 (read-only, no `transaction.view`).

**US-8.3.1: Effective permission set**
- Acceptance criteria:
  - [ ] `getUserPermissions()` returns the deduplicated union of inherited + explicitly granted permissions and the max privilege level.
  - [ ] Only System Admin (level 4) has `users.assign_roles` and `user_management.*`.
  - [ ] `users.view` requires level ≥3 (Branch Manager, System Admin).

## 8.4 ABAC: employee-customer transaction restriction

The single ABAC permission is `transaction.view` (`scripts/seed.ts:136-145`): viewing the transactions of a customer who is themselves a bank employee (`customer.isEmployee = true`) is **denied unless the viewer has privilege level ≥3**.

> **[CONFIRM]** In the SQL Server production path this specific `customer.isEmployee` + `minPrivilegeOverride` rule may not fire: the shared `permissionService.checkPermission` short-circuits to `allowed:true` when its non-runtime DB handle is null, and the SQL Server store's own `checkPermission` implements branch/region conditions rather than the employee-record rule. Verify whether the production `permission.conditions` data encodes this restriction.

## 8.5 Server-side enforcement

`requirePermission()` middleware (`server/middleware/permissions.ts:26-148`) gates routes; every grant and deny emits an `audit_event` (EPIC 9). Enforced routes include:

| Route | Guard |
|---|---|
| `GET /api/customers/:id/accounts` | `accounts.view` |
| `GET /api/accounts/:accountId/transactions` | `transaction.view` + owner-employee ABAC |
| `GET /api/customers/:customerId/transactions` | `transaction.view` |
| `GET /api/admin/users`, `/api/admin/users/:id`, `/api/admin/roles` | `users.view` |
| `POST/DELETE /api/admin/users/:id/roles[...]` | `users.assign_roles` |
| `GET /api/admin/saml-mappings` | `user_management.view` |
| `POST/PATCH/DELETE /api/admin/saml-mappings[...]` | `user_management.assign_roles` |

### Known enforcement gaps

- **Notes** are authentication-only; there is **no `notes.*` permission** anywhere. Any authenticated employee can read/write notes regardless of role (`rbac.md §7.1`).
- **Deposit summary/trend** endpoints (`GET /api/customers/:id/deposit-summary`, `/deposit-trend`) have **no** `requirePermission` guard, unlike the sibling recent-transactions route.

> **[CONFIRM]** Whether notes and deposit-summary/trend are intended to be permission-gated. Documented here as a known gap.

## 8.6 Client-side gating (presentation only)

`PermissionGuard` + `usePermissions` mirror the guards on the client (Household, Accounts, Account Summary tabs; balance columns; admin links) and fail closed while permissions load. Client gates are UX only; the server routes above are the real enforcement.

## 8.7 Schema-only / unimplemented RBAC tables

These tables exist in `shared/schema.ts` but have **no implementing code** and must not be documented as working features:

- `role_change_request`: approval workflow table, no routes/services (`rbac.md §9.4`).
- `role_audit_log`: no writer in server code (auditing uses `audit_event` instead).
- `employee_status_history`: `updateUserStatus` is a "Not implemented yet" placeholder.

---

# EPIC 9: Audit & Compliance Logging

## Overview

The implemented compliance surface is an **audit and access-logging** capability, not AML/OFAC/SAR. This EPIC documents what exists. **SAR-to-FinCEN filing, OFAC sanctions screening, and AML transaction-threshold monitoring are NOT implemented** anywhere in the codebase.

## 9.1 Unified audit event stream: `audit_event` (`shared/schema.ts:854-887`)

- Physical SQL Server table created by `scripts/create_audit_event_table.sql` (the shared schema definition is not applied to production; production DDL is script-managed).
- Categories (`shared/auditEvents.ts:10-20`): `authentication`, `authorization`, `pii_access`, `financial_data`, `data_modification`, `admin_action`, `navigation`, `search`, `error`.
- Severities: `critical`, `high`, `medium`, `low`.
- Emitted by `auditService.emitAuditEvent()` and by the permission middleware for every grant/deny; correlation IDs attached per request (`server/middleware/correlationId.ts`).

## 9.2 Route-level access audit: `server/middleware/routeAudit.ts`

Maps specific routes to event/resource types, so customer/account/PII access (e.g. tax-ID, gov-ID, CIF lookups) is audited independently of RBAC grant events.

## 9.3 Permission denial log: `permission_denial_log` (`shared/schema.ts:765-778`)

Every denied permission check is recorded (employee, permission code, resource, reason, context).

**US-9.1.1: Auditable access trail**
- Acceptance criteria:
  - [ ] Login success/failure, permission grant/deny, PII access, and financial-data access emit `audit_event` rows.
  - [ ] Denied permission checks also write `permission_denial_log`.
  - [ ] Role assign/revoke (SAML and manual) write `employee_role_history`.

> **[CONFIRM]** Audit retention period and immutability/WORM posture. These are governance/ops facts, not encoded in the schema. (No coded 7-year retention exists.)

### Not implemented (explicit)

- **KYC expiry alerting / renewal workflow**: no implementing code.
- **AML transaction-threshold monitoring** (e.g. >$10k, structuring): no implementing code.
- **SAR filing / FinCEN submission**: no implementing code.
- **OFAC / sanctions screening** (customer or transaction): no implementing code.
- **Compliance dashboard** (SAR volume, OFAC stats, exam-readiness score): no implementing code.

> **[CONFIRM]** Whether AML/OFAC/SAR/KYC-alerting are on the ClientIQ roadmap or are owned by a separate enterprise compliance system.

---

# EPIC 10: Infrastructure & Deployment

## Overview

ClientIQ is an on-prem Node/Express application fronted by **IIS**, backed by **Microsoft SQL Server**, deployed by **Azure DevOps** to a Windows Service. This EPIC replaces the earlier multi-engine infrastructure EPIC; SQL Server is the only runtime engine and there is no automatic database-vendor-swap capability in production.

## 10.1 Web/proxy tier: IIS

IIS (on Windows Server) terminates TLS and reverse-proxies to the Node process over HTTP on port **5000** (`PORT` default).

> **[CONFIRM]** IIS site bindings, ARR/reverse-proxy configuration, certificate paths, and cert owners, not in the repo.

## 10.2 Database tier: SQL Server only

- The runtime connection manager talks to **MS SQL Server only** (`server/dbConnection.ts:1-4`). `getPgDatabase()` is a stub that throws "not available, this deployment uses MS SQL only" (`server/dbConnection.ts:74-79`).
- Connection config (`server/dbConnection.ts:22-39`): `MSSQL_USER`/`_PASSWORD`/`_SERVER`/`_DATABASE` (with `DB_*` fallbacks; database defaults to `ClientIQ`); `encrypt: true`; `trustServerCertificate` only in development; pool `max: 10`.

### Type/schema tooling note

`shared/schema.ts` is the single source of the application's TypeScript entity types and Zod insert schemas, and the Drizzle definitions there are used only for **type generation and developer tooling**, not as the production query layer. All production data access is raw `mssql` queries in `server/storage/sqlServer*`. Deployments explicitly set `DATABASE_DIALECT=sqlserver` and `DB_VENDOR=mssql` so the search-provider and config subsystems select SQL Server behavior. There is no production capability to switch the database engine at runtime.

## 10.3 SQL Server schema management (not drizzle-kit)

Production schema is managed by **idempotent standalone `.sql` scripts** plus manual DDL, not by an ORM migration CLI and not by paired per-engine migration directories (those do not exist). Key scripts:

| Script | Purpose |
|---|---|
| `scripts/create_sessions_table.sql` / `fix_sessions_table.sql` | SAML session store table |
| `scripts/create_audit_event_table.sql` | Audit event table + indexes |
| `scripts/create_performance_indexes.sql` | Post-load performance indexes on transactions/accounts/customers |
| `scripts/ensure_branch_manager_role.sql` | Guarantees the default fallback role exists |
| `scripts/ensure_rbac_provenance_columns.sql` | Adds `assigned_by` provenance columns for AD-group sync |
| `scripts/widen_employee_last_seen_saml_role.sql` | Widens the SAML role column to NVARCHAR(MAX) |
| `Insert Queries/Schema Changes/*.sql` | Adds/backfills denormalized `financial_transaction.account_number` and `note.cif_number` |

## 10.4 CI/CD: Azure DevOps

- The Azure DevOps pipeline triggers per branch: `develop` → dev, `test` → test, `preprod` → preprod, `prod` → prod. **Pushing GitHub `main` deploys nowhere.**
- Deployment writes a `Start-Server.ps1` on the target host under `C:\ClientIQ` and runs the app as a Windows Service via PowerShell remoting.
- Per-stage `SAML_ROLE_ENV` is set from the pipeline (`DEV` / `TST` / `STG` / `PRD`).

### Topology

- **dev, test, preprod**: each a single app server + single SQL Server database.
- **prod**: the HA tier, where the pipeline deploys to two app servers (`Deploy_Prod` + `Deploy_Prod2`).

> **[CONFIRM]** Exact prod load-balancer/topology, host FQDNs, and how requests are distributed across the two prod app servers.

## 10.5 Runtime configuration

Key environment variables (see the environment-variable reference for the full list):

| Variable | Purpose | Notes |
|---|---|---|
| `NODE_ENV` | Mode switch (mock vs SAML auth, cookie/TLS behavior, log level) | Deploy scripts set `development` across environments; flag for verification |
| `PORT` | HTTP listen port | Default `5000` |
| `SAML_ENABLED` | Enables SAML SSO | `true` in preprod/prod; `false` in dev/test |
| `SAML_ENTRYPOINT` / `SAML_CALLBACK_URL` / `SAML_ISSUER` / `SAML_CERT` | SAML strategy config | Required when SAML enabled |
| `SAML_ROLE_ENV` | Scopes AD-group role mapping to one environment | Unset = all environments honored |
| `SAML_DEFAULT_ROLE_NAME` | Fallback role | Default `Branch Manager` |
| `SESSION_SECRET` | Session signing secret | Required when SAML enabled |
| `MSSQL_*` (`USER`/`PASSWORD`/`SERVER`/`DATABASE`) | SQL Server connection | DB defaults to `ClientIQ` |
| `TZ` | Forced to `America/Los_Angeles` by the app | Not an operator input |

> **[CONFIRM]** Whether prod overrides `NODE_ENV` to `production` via the Windows Service environment; the committed deploy templates set `development` for all stages. Also confirm secret management (the repo's `Start-Dev.ps1` contains plaintext dev credentials).

## 10.6 Health check: minimal, not a monitoring endpoint

The only health endpoint is `GET /api/health` (`server/routes.ts:3133`), which returns a static JSON payload (`status: "healthy"`, `timestamp`, `service`). It does **not** check DB connectivity, query performance, or disk space, is not on a 60-second scheduler, and exports no metrics. The `authGate` also allowlists an exact `/health` path so the login flow stays reachable.

> **[CONFIRM]** Whether a richer `/health/database` connectivity/performance check is a roadmap item. It does not exist today.

---

## Requirements Traceability

| EPIC | Domain | Status |
|---|---|---|
| 1 Customer Management | Polymorphic customer, 360 view, KYC fields | Implemented (KYC alerting: not implemented) |
| 2 Account Management | Accounts, ownership, balances | Implemented (read/display); lifecycle mutation unconfirmed |
| 3 Debit Card Management | Card display, PCI last-4 | Implemented (display); lifecycle mutation not implemented |
| 4 Transaction Management | Transaction history, Pacific display | Implemented (read; 13-month window) |
| 5 Search & Discovery | Case-insensitive `LIKE` search, PII masking | Implemented (no similarity-scored fuzzy match) |
| 6 Household & Relationship | Household grouping, B2B hierarchy | Implemented (model + display) |
| 7 Branch/Employee/Officer | Branch, employee, officer_code assignment | Implemented (data + display) |
| 8 Auth, RBAC & Authorization | SAML SSO, privilege+role RBAC, ABAC, enforcement | Implemented (with documented gaps) |
| 9 Audit & Compliance Logging | audit_event, denial log, route audit | Implemented (AML/OFAC/SAR: not implemented) |
| 10 Infrastructure & Deployment | IIS, SQL Server, Azure DevOps, Windows Service | Implemented (as described) |

---

## Appendix A: Corrections from prior draft

The previous `technical-requirements.md` contained the following inaccuracies, corrected in this revision:

| Prior claim | Correction |
|---|---|
| Multi-engine database with runtime vendor swap and serverless option | Microsoft SQL Server only; the Drizzle definitions are type-tooling, not a runtime engine |
| Similarity-scored fuzzy search with a 30% threshold | Case-insensitive substring `LIKE` (`Latin1_General_CI_AS`) |
| `customer_name_type_check` DB constraint + name trigger | Zod discriminated union in application code |
| `estate` customer type | Not a validated type (only individual/premium/regular/business/trust) |
| Customer type defaults to "individual" | Defaults to `regular` |
| 8 named debit-card limit profiles as production model | Dev-seed only; production uses inline limit columns |
| `posted_date` column | Column is `posting_date` |
| `running_balance` column | `ledger_balance_after` / `available_balance_after` |
| Customer Officer Assignment = FK to employee | `officer_code` string key; `(customer_id, officer_code)` natural key |
| AML/OFAC/SAR/KYC-alert EPIC as delivered | Not implemented; replaced by the real RBAC + audit EPICs |
| `/health/database` connectivity/perf endpoint, 60s scheduler | Only a static `GET /api/health`; no DB/perf/disk checks |
| External-webserver reverse-proxy tier | IIS on Windows Server |

## Appendix B: Open confirmations

All items flagged `> **[CONFIRM]**` above require human/operator input and are not derivable from code: document ownership/version/review cadence; IIS bindings and certificate paths; prod load-balancer topology and host FQDNs; account-type list and opening-deposit rules; debit-card and account lifecycle scope; existence of production debit-card triggers; the `BRS` role in production; SQL Server ABAC `conditions` data for the employee-record rule; audit retention/immutability policy; whether `NODE_ENV` is overridden to `production` in prod; and the AML/OFAC/SAR/KYC-alerting roadmap.
