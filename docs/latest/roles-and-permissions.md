# Roles and Permissions

*Last reviewed: 2026-07-01 · Source of truth: application code (ClientIQ / Banking Client 360).*

## Purpose

ClientIQ (Banking Client 360) authorizes access through a hybrid model: **Role-Based Access Control (RBAC)** layered with **Attribute-Based Access Control (ABAC)**. Users are assigned one or more named roles; each role carries a numeric **privilege level** (0 to 4); permissions are resolved as the union of privilege-level inheritance and explicit role grants. A single permission (`transaction.view`) additionally carries an attribute-based rule intended to protect employee-customer records.

This document describes the roles, privilege levels, permission codes, how permissions resolve, what each role sees in the UI, which API routes are enforced, and, critically, the **known enforcement gaps** where the model as designed does not match what the running code enforces. Those gaps are called out inline and summarized in [Known Enforcement Gaps](#known-enforcement-gaps).

Data is stored in Microsoft SQL Server in every environment. The production authorization read/write path is the SQL Server role store (`server/storage/roleManagement/sqlServer.ts`, `server/storage/sqlServerEmployee.ts`).

> **[CONFIRM]** Document owner and review cadence for this page (the prior wiki copy attributed authorship to an individual editor; that governance metadata cannot be derived from code). Doc version tracks the application `package.json` version (`1.0.0`). **[CONFIRM]** an independent doc-version scheme if one is required.

---

## Roles

Roles are stored in the `role` table and seeded by `scripts/seed.ts:117-127`. Nine roles ship in the seed, all `isSystemRole: true` and `isActive: true`. Each role maps to exactly one privilege level (`role.privilegeLevel`, a NOT NULL FK to `privilege_level.level`, `shared/schema.ts:665`).

| Role                 | Privilege Level | Description                                              |
|----------------------|-----------------|---------------------------------------------------------|
| System Admin         | 4               | Full system access. Manages users, roles, SAML mappings. |
| Branch Manager       | 3               | Branch-level authority. Can view employee customer data. |
| Assistant Manager    | 2               | Team management. Limited user management.               |
| Loan Officer         | 2               | Lending operations. Account and customer access.        |
| Business Banker      | 2               | Business relationship management.                       |
| Teller               | 1               | Day-to-day customer and account operations.             |
| Customer Service Rep | 1               | Basic customer lookup and service.                      |
| Risk Analyst         | 1               | Risk monitoring and review.                             |
| Compliance Officer   | 1               | Compliance monitoring.                                  |

> **Note:** Roles are database-managed. New roles can be created in the `role` table (via the SQL Server DB or admin tooling). The list above reflects the seed script; the running deployment may differ.

### The AD-provisioned role set is not identical to the seed

In preprod and prod, roles are assigned automatically from Active Directory group membership on each SSO login (see [SAML / AD-Group Role Provisioning](#saml--ad-group-role-provisioning)). The AD-group → role-name mapping (`server/auth/adGroupRoleMap.ts:41-58`) does **not** resolve to the seed roles one-for-one:

- Both the `businessbanker` and `assistantmanager` AD tokens map to a role named **`BRS`** ("Business Relationship Specialist", privilege 2), `adGroupRoleMap.ts:48-49`.
- **`BRS` is not created by `scripts/seed.ts` or any in-repo migration.** For AD-driven users to receive it, a `BRS` row must exist in the SQL Server `role` table out-of-band. If it is absent, the sync flags the name as unresolved and the user falls back to the default role (Branch Manager).
- `dataanalyst` → `Teller`; `risk` → `Risk Analyst`; `compliance` → `Compliance Officer`; `appsvcs` / `appadmin` → `System Admin`; the `gen` token grants app access with no role.

> **[CONFIRM]** Whether a `BRS` role has been created in each SQL Server database (preprod, prod), and its owner / privilege level, since it is not seeded by the repo.

---

## Privilege Levels

Privilege levels are **hierarchical** and seeded by `scripts/seed.ts:107-113`. A user's effective privilege is the maximum across their active roles. Any permission whose `min_privilege_level` is less than or equal to that maximum is inherited automatically (see [How Permissions Resolve](#how-permissions-resolve)).

| Level | Tier          | Authority                                                          |
|-------|---------------|-------------------------------------------------------------------|
| 4     | System Admin  | Everything. User/role management, SAML config, all data.          |
| 3     | Senior/Branch | Can view employee customer records. Most operational access.        |
| 2     | Manager       | Team management. Standard operational access.                      |
| 1     | Staff         | Basic customer and account operations. No admin access.            |
| 0     | Read-Only     | Minimal access. View-only on permitted resources.                  |

> **Note:** Level 0 ("Read-Only") exists as a privilege tier but **no seeded role uses it**; the lowest-privilege seeded role is level 1.

---

## Permission Codes

Permissions follow a `resource.action` naming convention and are seeded by `scripts/seed.ts:133-154` (11 permissions). Each permission has a `min_privilege_level` used for inheritance, and one is attribute-based.

### Customer and account permissions

| Permission Code                       | Min Privilege | ABAC | Gates                                              |
|---------------------------------------|:-------------:|:----:|----------------------------------------------------|
| `accounts.view`                       | 2             | no   | Accounts tab, account list and details             |
| `account.view.balances`               | 2             | no   | Balance and interest-rate columns                  |
| `transaction.view`                    | 2             | yes  | Transaction history (employee-customer ABAC rule)  |
| `customer.view.relationship_summary`  | 1             | no   | Relationship summary card                          |
| `customer.view.recent_activity`       | 1             | no   | Recent activity card                               |
| `customer.view.deposits`              | 1             | no   | Deposits section (UI region only, see gaps)        |
| `household.view`                      | 2             | no   | Household tab and relationships                    |

### Administration permissions

| Permission Code                | Min Privilege | Gates                                     |
|--------------------------------|:-------------:|-------------------------------------------|
| `users.view`                   | 3             | View user list, user details, roles list  |
| `users.assign_roles`           | 4             | Assign / remove roles from users          |
| `user_management.view`         | 4             | View SAML role mappings                   |
| `user_management.assign_roles` | 4             | Create / update / delete SAML role mappings |

> There is **no `notes.*` permission** anywhere in the schema, seed, or database. Notes access is therefore not permission-gated. See [Known Enforcement Gaps](#known-enforcement-gaps).

---

## How Permissions Resolve

A user's effective permission set is the **union** of two sources, deduplicated in `getUserPermissions()` (`server/storage/roleManagement/sqlServer.ts:114-118`):

1. **Privilege-level inheritance**: every active permission whose `min_privilege_level <= user's max privilege level` is granted automatically. Production query: `getPrivilegeLevelPermissions()` (`sqlServer.ts:379-397`).
2. **Explicit role grants**: every permission in `role_permission` for any of the user's active roles. Production query: `getRolePermissions()` (`sqlServer.ts:355-377`).

A consequence of the `min_privilege_level` design: **roles at level 2 or higher inherit all view permissions automatically, with no `role_permission` row.** Only level-1 roles need explicit grants. The seed encodes exactly this: `seed.ts:159-188` grants permissions only to the level-1 roles:

- **Teller** and **Customer Service Rep** each receive 7 permissions (`seed.ts:164-173`): `accounts.view`, `account.view.balances`, `transaction.view`, the three `customer.view.*` codes, and `household.view`.
- **Risk Analyst** and **Compliance Officer** each receive 6 permissions (`seed.ts:176-185`), the same set **minus `transaction.view`** (read-only, no transaction history).

Total seeded explicit grants: `(2 × 7) + (2 × 6) = 26` rows.

### Effective permission matrix

| Role (priv) | accounts.view | account.view.balances | transaction.view | customer.view.* (3) | household.view | users.view | users.assign_roles | user_management.* (2) |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| System Admin (4)       | inherited | inherited | inherited | inherited | inherited | inherited | inherited | inherited |
| Branch Manager (3)     | inherited | inherited | inherited | inherited | inherited | inherited | no | no |
| Assistant Manager (2)  | inherited | inherited | inherited | inherited | inherited | no | no | no |
| Loan Officer (2)       | inherited | inherited | inherited | inherited | inherited | no | no | no |
| Business Banker (2)    | inherited | inherited | inherited | inherited | inherited | no | no | no |
| Teller (1)             | grant | grant | grant | grant | grant | no | no | no |
| Customer Service Rep (1) | grant | grant | grant | grant | grant | no | no | no |
| Risk Analyst (1)       | grant | grant | no | grant | grant | no | no | no |
| Compliance Officer (1) | grant | grant | no | grant | grant | no | no | no |

- "inherited" = granted via `min_privilege_level`; "grant" = explicit `role_permission` row.
- The three `customer.view.*` codes have `min_privilege_level = 1`, so **every role inherits them** (they are also granted explicitly to level-1 roles).
- `users.view` requires privilege ≥ 3, so **Branch Manager and System Admin can view users**; only **System Admin (level 4)** can assign roles or manage SAML mappings.

### Request-time enforcement flow

The gate is `requirePermission(options)` in `server/middleware/permissions.ts:26-148`:

1. **401** if `req.employeeId` is missing.
2. Load `getUserPermissions(employeeId)`; attach `req.permissions` and `req.privilegeLevel`.
3. `minPrivilegeLevel` check → **403 `INSUFFICIENT_PRIVILEGE`** on failure.
4. `requireAll` → **403 `MISSING_PERMISSIONS`** if any code is absent.
5. `requireAny` → **403 `MISSING_PERMISSIONS`** if none present.
6. `permissionCode` → builds context via `contextBuilder`, calls `permissionService.checkPermission()` → **403 `PERMISSION_DENIED`** with a reason.
7. On success, emits `AUTHZ_PERMISSION_GRANTED` and calls `next()`.

Every deny path emits an `AUTHZ_PERMISSION_DENIED` audit event with route, code, and reason; grants emit `AUTHZ_PERMISSION_GRANTED`. Both flow into the unified audit stream (see [Audit and Denial Logging](#audit-and-denial-logging)).

---

## Attribute-Based Access Control (ABAC)

Exactly one seeded permission is attribute-based: **`transaction.view`** (`seed.ts:136-145`). Its intent is to protect the financial records of customers who are themselves bank employees.

### The seeded rule (as designed)

```
attributeConfig.conditions = [{
  attribute:            "customer.isEmployee",
  operator:             "equals",
  value:                true,
  denyIfMatch:          true,
  minPrivilegeOverride: 3,
  reason:               "Employee customer records require Level 3+ access"
}]
```

Interpreted by the in-app attribute evaluator, this means: **viewing transactions of a customer flagged `isEmployee = true` is denied unless the viewer's privilege level is ≥ 3** (Branch Manager or System Admin). The evaluator lives in `server/services/permissionService.ts`; `evaluateAttributeConditions()` (`:109-135`) applies `denyIfMatch` unless `minPrivilegeOverride` is met; supported operators are `equals`, `not_equals`, `in`, `not_in`, `greater_than`, `less_than` (`:137-160`).

### Two enforcement points that use different thresholds

The model as designed uses one threshold (level 3), but the running code enforces two different, disagreeing thresholds:

| Layer | File / line | Threshold | Effect |
|---|---|---|---|
| Backend seed rule (as designed) | `scripts/seed.ts:142` (`minPrivilegeOverride: 3`) | level **≥ 3** required | Would deny levels 0, 1, **and 2** |
| Frontend tab hiding | `client/src/components/CustomerDashboard.tsx:490` (`const isLevel1User = maxPrivilegeLevel < 2`) | level **≥ 2** required | Hides Accounts / Account Summary tabs for levels 0-1 only |

So a **level-2 role (e.g. Assistant Manager) is treated as unrestricted by the frontend** (tabs stay visible) even though the backend ABAC rule as seeded would restrict any viewer below level 3. This mismatch is a documented gap. See [Known Enforcement Gaps](#known-enforcement-gaps).

### ABAC context builders

The transaction routes build the employee-customer context that the rule reads:

- `GET /api/accounts/:accountId/transactions` (`server/routes.ts:2345-2371`): resolves **all** account owners; if any owner is an employee customer, that customer is passed as ABAC context.
- `GET /api/customers/:customerId/transactions` (`server/routes.ts:2399-2412`): passes the single customer as context.
- `GET /api/customers/:id/deposit-recent-transactions` (`server/routes.ts:1319-1330`): same pattern.

### Available context objects

| Context key | Type     | Description                 |
|-------------|----------|-----------------------------|
| `customer`  | Customer | The customer being accessed |
| `account`   | Account  | The account being accessed  |
| `note`      | Note     | The note being accessed     |

> **The ABAC deny may not fire in production.** The `customer.isEmployee` / `minPrivilegeOverride` rule is evaluated only by the `permissionService.checkPermission()` code path. In the running SQL Server configuration that method returns `{ allowed: true }` early, because it short-circuits when its ORM handle is null (`server/services/permissionService.ts:32-36`). The production SQL Server role store's own `checkPermission` (`sqlServer.ts:168-211`) implements **branch-level / region-level** restrictions read from a `conditions` object, **not** the employee-customer restriction. The routes still build the employee context, but the deny decision short-circuits to allow. See [Known Enforcement Gaps](#known-enforcement-gaps).

---

## What Each Role Sees in the App

Client-side gating uses the same permission codes, fetched from `GET /api/auth/permissions` via `client/src/hooks/usePermissions.ts`. The `PermissionGuard` component (`client/src/components/PermissionGuard.tsx:20-59`) renders children only if the check passes; while permissions are still loading it renders the fallback (**fail-closed on load**). Client-side gating is presentation only; the server routes are the real enforcement, except where noted in the gaps section.

### Customer dashboard tabs

`client/src/components/CustomerDashboard.tsx`:

| UI section          | Permission required | Guard @ | Level 4 | Level 3 | Level 2 | Level 1 | Level 0 |
|---------------------|---------------------|---------|:-------:|:-------:|:-------:|:-------:|:-------:|
| Client tab          | *(always visible)*  | n/a     | Yes | Yes | Yes | Yes | Yes |
| Household tab       | `household.view`    | `:742-802` | Yes | Yes | Yes | * | * |
| Accounts tab        | `accounts.view`     | `:887-920` | Yes | Yes | Yes | * | * |
| Account Summary tab | `accounts.view`     | `:922-979` | Yes | Yes | Yes | * | * |

\* Level 1 depends on the explicit `role_permission` grant (Teller and Customer Service Rep have `accounts.view` and `household.view`; Risk Analyst and Compliance Officer do too). Level 0 has no seeded role. Because `household.view` and `accounts.view` are `min_privilege_level = 2`, level-2+ roles always inherit them.

For an **employee customer** (`isEmployee = true`), the frontend additionally hides the Accounts and Account Summary tabs and auto-redirects to the Client tab when the viewer is below level 2 (`CustomerDashboard.tsx:488-495`).

### Client tab sections

| UI section                | Permission required                   | Guard @                       |
|---------------------------|---------------------------------------|-------------------------------|
| Relationship Summary card | `customer.view.relationship_summary`  | `CustomerDashboard.tsx:838-842` |
| Recent Activity card      | `customer.view.recent_activity`       | `CustomerDashboard.tsx:856-860` |
| Deposits section          | `customer.view.deposits`              | `CustomerDashboard.tsx:872-876` |
| Notes section             | **none, always rendered**             | `CustomerDashboard.tsx:863-869` |

If the user lacks the permission, the guarded section is hidden. The Notes section is **not guarded**. See the gaps section.

### Account table columns

`account.view.balances` gates balance and interest-rate columns (not whole tabs). Used in `AccountList.tsx:495`, `HouseholdPage.tsx:192`, `CustomerSearch.tsx:133`, `AccountDetailOption2.tsx:153`. Without it, the account list is visible but balance/rate columns and the total-balance summary row are hidden.

### Administration

| UI element                       | Permission required            | Gate |
|----------------------------------|--------------------------------|------|
| "Manage users" link (TopBar)     | `users.view`                   | `client/src/components/TopBar.tsx:120` |
| System-admin navigation (Navbar) | privilege level ≥ 4            | `client/src/components/navbar/Navbar.tsx:73` (`useMinPrivilegeLevel(4)`) |
| View user list and details       | `users.view`                   | server-enforced |
| Assign / remove roles            | `users.assign_roles`           | server-enforced |
| View SAML role mappings          | `user_management.view`         | server-enforced |
| Create / edit / delete SAML maps | `user_management.assign_roles` | server-enforced |

---

## Protected API Routes

Enforced via `requirePermission` in `server/routes.ts` and `server/routes/auth.ts`:

| Route                                              | Method | Required permission                    | @ |
|----------------------------------------------------|--------|----------------------------------------|---|
| `/api/customers/:id/accounts`                      | GET    | `accounts.view` (+ customer context)   | `routes.ts:1233-1246` |
| `/api/customers/:id/deposit-recent-transactions`   | GET    | `transaction.view` (+ customer context)| `routes.ts:1319-1330` |
| `/api/accounts/:accountId/transactions`            | GET    | `transaction.view` (+ owner-employee ABAC context) | `routes.ts:2345-2371` |
| `/api/customers/:customerId/transactions`          | GET    | `transaction.view` (+ customer context)| `routes.ts:2399-2412` |
| `/api/admin/users`                                 | GET    | `users.view`                           | `routes.ts:2946` |
| `/api/admin/users/:id`                             | GET    | `users.view`                           | `routes.ts:2963` |
| `/api/admin/users/:id/roles`                       | POST   | `users.assign_roles`                   | `routes.ts:2978` |
| `/api/admin/users/:id/roles/:roleId`               | DELETE | `users.assign_roles`                   | `routes.ts:2994` |
| `/api/admin/users/:id/roles/manual`                | POST   | `users.assign_roles`                   | `routes.ts:3102` |
| `/api/admin/roles`                                 | GET    | `users.view`                           | `routes.ts:3011` |
| `/api/admin/saml-mappings`                         | GET    | `user_management.view`                 | `routes.ts:3025` |
| `/api/admin/saml-mappings`                         | POST   | `user_management.assign_roles`         | `routes.ts:3036` |
| `/api/admin/saml-mappings/:id`                     | PATCH  | `user_management.assign_roles`         | `routes.ts:3064` |
| `/api/admin/saml-mappings/:id`                     | DELETE | `user_management.assign_roles`         | `routes.ts:3083` |

---

## Known Enforcement Gaps

These are places where the running code does **not** enforce what the RBAC/ABAC model implies. They are documented so operators do not over-trust the model.

### 1. Notes are authentication-only, not permission-gated

There is no `notes.*` permission defined anywhere (schema, seed, or database), and none of the notes endpoints carry `requirePermission`. The notes surface is gated **only** by authentication (`req.employeeId` presence):

- `GET /api/note-categories` (`routes.ts:2512`), `GET /api/customers/:id/notes` (`routes.ts:2524`), `GET /api/accounts/:id/notes` (`routes.ts:2541`), `GET /api/notes/:id` (`routes.ts:2558`)
- `POST /api/notes` (`routes.ts:2579`, auth-only check `:2582-2585`), `PATCH /api/notes/:id` (`routes.ts:2605`), `DELETE /api/notes/:id` (`routes.ts:2644`), `POST /api/notes/:id/restore` (`routes.ts:2671`), `POST /api/notes/:id/pin` (`routes.ts:2698`), `GET /api/notes/:id/versions` (`routes.ts:2729`), `GET /api/notes/search` (`routes.ts:2745`)
- The Notes UI (`NotesSection`) is rendered with **no `PermissionGuard`** (`CustomerDashboard.tsx:863-869`).

**Effect:** any authenticated employee can read, create, edit, and delete notes regardless of role or privilege level.

### 2. Deposit summary/trend endpoints are auth-only

`GET /api/customers/:id/deposit-summary` (`routes.ts:1271`) and `GET /api/customers/:id/deposit-trend` (`routes.ts:1293`) carry **no** `requirePermission`, even though the sibling `deposit-recent-transactions` route requires `transaction.view`. The `customer.view.deposits` permission gates only the Deposits UI region client-side; it is **not enforced on these two server endpoints.**

### 3. `transaction.view` ABAC employee-customer deny may not fire in production

As detailed under [ABAC](#attribute-based-access-control-abac): in the running SQL Server configuration `permissionService.checkPermission()` returns `{ allowed: true }` early (`permissionService.ts:32-36`), so the seeded `customer.isEmployee` / `minPrivilegeOverride: 3` deny is a no-op. The SQL Server role store's own `checkPermission` (`sqlServer.ts:168-211`) enforces a **branch/region** model instead. Whether the employee-customer protection actually fires depends on the `permission.conditions` data physically present in the SQL Server database.

> **[CONFIRM]** Whether the SQL Server `permission.conditions` data for `transaction.view` (or any equivalent) encodes the employee-customer restriction, so the "employee transactions require level 3+" control is actually enforced server-side in preprod and prod.

### 4. Frontend/backend ABAC threshold mismatch

The frontend restricts employee-customer tabs at level `< 2` (`CustomerDashboard.tsx:490`); the seeded backend rule uses `minPrivilegeOverride: 3` (`seed.ts:142`). A level-2 user is treated differently by the two layers. Reconcile the intended threshold before relying on either.

### 5. Schema tables defined but not implemented

- **`role_change_request`** (`shared/schema.ts:825-848`) models an approval workflow but has **no implementing code**; a repo-wide search finds no references outside `schema.ts`. Role changes today happen through the direct admin assign/remove endpoints and the automated SAML/AD sync, **not** an approval request.
- **`role_audit_log`** (`shared/schema.ts:744-762`) has **no writer** in server code. Actual audit persistence uses `audit_event`, `employee_role_history`, and `permission_denial_log`.
- **`employee_status_history`** writes are unimplemented; `updateUserStatus()` in the SQL Server store is a `throw new Error('Not implemented yet')` placeholder (`sqlServer.ts:713-720`).

---

## SAML / AD-Group Role Provisioning

> Applies to **preprod and prod only.** In dev and test, SSO is off (`SAML_ENABLED=false`) and the app uses the local/mock auth path, so AD-driven provisioning does not run.

Where SSO is enabled, roles are assigned automatically from Active Directory group membership on each login, not from the `saml_role_mapping` table.

### Login and reconciliation flow

On a successful SAML assertion, `POST /saml/acs` (`server/routes/auth.ts:264-476`):

1. `upsertEmployeeFromSamlSqlServer()` finds or creates the employee row from SAML attributes (`auth.ts:335-343`).
2. **Enforced AD-group role sync** (`auth.ts:352-383`): AD groups from the SAML `role` claim are mapped to role names via `server/auth/adGroupRoleMap.ts`, then `syncEmployeeRolesFromAdGroupsSqlServer()` (`server/storage/sqlServerEmployee.ts:355-468`) reconciles the employee's roles.
3. The session is populated with role names and permission codes from `getUserPermissions()` (`auth.ts:404-435`).

### Provenance rule (which roles the sync may revoke)

- `employee_role.assigned_by IS NULL` → **AD/system-derived**; the enforced sync may revoke it when the AD groups no longer justify it.
- `employee_role.assigned_by IS NOT NULL` → **admin-assigned**; **never auto-revoked** by the sync.

Each login the sync revokes AD-derived roles no longer desired (`is_active=0`, sets `expiration_date`, logs `source:'saml'`) and assigns newly-desired roles (reactivating an inactive row or inserting a new one with `assigned_by=NULL`). It is idempotent; unchanged group membership performs no writes.

### AD group naming convention and environment scoping

Group names follow `<PREFIX>_<ENV>_APP_ClientIQ_<RoleToken>_<Access>` (`adGroupRoleMap.ts:5-15`). The role token drives the mapping; the access suffix is ignored. Because a single on-prem AD carries groups for every environment, `SAML_ROLE_ENV` (DEV / TST / STG / PRD, with aliases such as "PreProd" → STG normalized in `adGroupRoleMap.ts:78-86`) makes each deployment honor only its own environment's groups. Groups from other environments are ignored.

### Default / fallback role guarantee

- `SAML_DEFAULT_ROLE_NAME` (default **"Branch Manager"**) is applied when AD yields no role (`auth.ts:357`, `sqlServerEmployee.ts:359`).
- If the sync resolves nothing, ACS applies a bulletproof fallback: when the resolved role list is empty, `ensureEmployeeHasDefaultRoleSqlServer()` grants Branch Manager (`auth.ts:412-424`, `sqlServerEmployee.ts:208-290`). `scripts/ensure_branch_manager_role.sql` idempotently ensures a Branch Manager row exists so this fallback can succeed.
- If even Branch Manager cannot be applied (role missing from the `role` table), `req.session.defaultRoleMissing` is set and surfaced via `/api/auth/status` (`auth.ts:428-430`, `auth.ts:209,217`), a genuine misconfiguration.

### Two SAML mechanisms: which one is live

- The **AD-group convention map** (`adGroupRoleMap.ts`) is **code-based** and is what the ACS login flow actually calls.
- The DB-driven **`saml_role_mapping`** table (`shared/schema.ts:728-741`) maps a single `saml_role_key` → `role_id` and is managed by admins through the `/api/admin/saml-mappings` CRUD endpoints. It is **not** what the enforced per-login role assignment uses.

> **[CONFIRM]** The owners of the ClientIQ AD groups (per environment) and the process for adding a user to the correct group, since group membership is the effective role-assignment mechanism in preprod/prod.

---

## Audit and Denial Logging

Authorization decisions are recorded in two complementary places.

### Unified audit-event stream

The `audit_event` table (`shared/schema.ts:854-887`) is the unified stream. Its taxonomy is defined in `shared/auditEvents.ts` and events are emitted/persisted by `server/services/auditService.ts`.

- **Categories:** `authentication`, `authorization`, `pii_access`, `financial_data`, `data_modification`, `admin_action`, `navigation`, `search`, `error`.
- **Severities:** `critical`, `high`, `medium`, `low`.
- **Authorization event types include:** `authz.permission.granted` / `authz.permission.denied`, `authz.role.assigned` / `authz.role.removed`, `authz.role.test.start` / `authz.role.test.end`.

Every `requirePermission` grant and deny emits an event here; the auth flow and route-audit middleware add PII/financial/navigation events, correlated per request by `server/middleware/correlationId.ts`.

### `permission_denial_log`

Denials are additionally written to `permission_denial_log`. The SQL Server insert (`sqlServer.ts:238-269`) uses columns `reason` and `denied_at`, while the type-only schema definition names `denial_reason` and `created_at` (`schema.ts:771,774`). For the SQL Server insert to succeed, the physical table must have `reason` / `denied_at` columns, a known schema-vs-code divergence.

### Role-change history

`employee_role_history` (`schema.ts:802-822`) is written by `logRoleHistorySqlServer()` (`sqlServerEmployee.ts:305-341`) on every assign/revoke, both SAML and manual, recording `action`, `source` (`'saml'` | `'manual'`), `assigned_by`, and `saml_role_attribute` (truncated to 255 chars).

---

## Role Testing (Non-Production)

`server/services/roleTestService.ts` lets a user temporarily assume another role's permission set to preview the UI/access it would grant.

- **Feature flag:** enabled unless `ROLE_TESTING_ENABLED === 'false'` (`roleTestService.ts:13-15`).
- **Production guard:** `setOverride` throws if `NODE_ENV === 'production'` (`roleTestService.ts:19-22`).
- Overrides are stored **in-memory** (a `Map` keyed by employee id, `roleTestService.ts:10`), not persisted, lost on restart.
- The override **replaces** (does not merge) the user's permissions with the test role's grants plus its privilege-level inheritance (`roleTestService.ts:64-132`), and returns `isRoleTesting: true`.
- Routes: `GET /api/auth/role-test/options`, `POST /api/auth/role-test/activate`, `POST /api/auth/role-test/reset` (`routes.ts:2867-2940`), all return 403 when the feature is disabled. `GET /api/auth/permissions` applies the override transparently when role testing is enabled.

> **[CONFIRM]** The runtime `NODE_ENV` value in preprod and prod. The production guard only engages if `NODE_ENV` is actually `'production'`; if the Windows Service environment sets a different value, role testing could remain enabled in a deployed higher environment.

---

## Data Model

RBAC tables are defined in `shared/schema.ts`. The **production** read/write path uses the SQL Server role store (`server/storage/roleManagement/sqlServer.ts`, `server/storage/sqlServerEmployee.ts`) with parameterized SQL Server queries.

### Core tables

| Table              | Purpose                                                     |
|--------------------|-------------------------------------------------------------|
| `privilege_level`  | Numeric privilege tiers 0 to 4 with names                   |
| `role`             | Role definitions, each with one privilege-level FK          |
| `permission`       | Permission codes, `min_privilege_level`, and ABAC config    |
| `role_permission`  | Explicit role → permission grants (many-to-many)            |
| `employee_role`    | Employee role assignments (effective/expiration dates, `assigned_by` provenance) |
| `saml_role_mapping`| Admin-managed `saml_role_key` → role mapping (see SAML note above) |

### Audit and history tables

| Table                     | Purpose                                              | Status |
|---------------------------|------------------------------------------------------|--------|
| `audit_event`             | Unified audit-event stream (grants, denials, PII, admin, etc.) | Active: backing store for authorization events |
| `permission_denial_log`   | Records denied permission checks                     | Active |
| `employee_role_history`   | Full assign/revoke history (SAML + manual)           | Active |
| `role_audit_log`          | Role-change audit table                              | Defined in schema, **no writer in code** |
| `role_change_request`     | Role-change approval workflow                        | Defined in schema, **not implemented** |
| `employee_status_history` | Employee status-change trail                         | Defined in schema, **writes unimplemented** |

> **Note on the data-access layer:** The production RBAC data-access layer is `server/storage/roleManagement/sqlServer.ts`, backed by Microsoft SQL Server. `shared/schema.ts` provides the table and type definitions as a type-only artifact; it is not itself a runtime data path and does not imply a second live database engine.

---

## Key Files

| File | Role |
|------|------|
| `shared/schema.ts` | Table and type definitions (privilege levels, roles, permissions, audit tables) |
| `scripts/seed.ts` | Seeds privilege levels, roles, permissions, and level-1 role grants |
| `server/middleware/permissions.ts` | `requirePermission` enforcement middleware |
| `server/services/permissionService.ts` | Permission-check facade (attribute-rule evaluator; deny short-circuits to allow in the running SQL Server configuration) |
| `server/storage/roleManagement/sqlServer.ts` | **Production** RBAC read/write path (permissions, roles, denial log) |
| `server/storage/sqlServerEmployee.ts` | Employee upsert, SAML/AD role sync, role-history writes |
| `server/auth/adGroupRoleMap.ts` | AD-group → role-name convention map (live SSO provisioning) |
| `server/services/roleTestService.ts` | Role-testing override service (non-production) |
| `server/services/auditService.ts` | Emits and persists `audit_event` records |
| `shared/auditEvents.ts` | Audit event taxonomy (categories, severities, event types) |
| `client/src/hooks/usePermissions.ts` | React permission hooks |
| `client/src/components/PermissionGuard.tsx` | Declarative permission guard component |
| `client/src/components/CustomerDashboard.tsx` | Tab/section visibility and employee-customer tab hiding |
| `client/src/components/AccountList.tsx` | Account table with column-level permission gating |
