# Roles & Permissions

BankClient360 uses a hybrid **RBAC + ABAC** (Role-Based + Attribute-Based Access Control) system with numeric privilege levels, audit logging, and SAML integration.

---

## Privilege Levels

| Level | Name           | Description                                      |
|-------|----------------|--------------------------------------------------|
| 4     | System Admin   | Full system access. Can manage users, roles, and all permissions. |
| 3     | Senior Manager | Wide departmental/branch authority. Most operational permissions. |
| 2     | Manager        | Team/section management. Limited user management. |
| 1     | Teller/Officer | Basic customer and account operations. No user management. |
| 0     | Basic User     | Minimal access. View-only on most resources.     |

Privilege levels are hierarchical: a user at level 3 automatically inherits all permissions that require level 3 or below.

---

## Permission Codes

Permissions follow a `resource.action` naming convention.

### Customer & Account Permissions

| Permission Code                     | Resource   | Action             | Description                        |
|-------------------------------------|------------|--------------------|------------------------------------|
| `accounts.view`                     | accounts   | view               | View customer accounts and details |
| `transaction.view`                  | transaction| view               | View transaction history           |
| `customer.view.relationship_summary`| customer   | view               | View customer relationship summaries |
| `customer.view.recent_activity`     | customer   | view               | View recent customer activity      |
| `customer.view.deposits`            | customer   | view               | View deposit information           |
| `household.view`                    | household  | view               | View household relationships       |

### Administration Permissions

| Permission Code                | Resource         | Action       | Description                        |
|--------------------------------|------------------|--------------|------------------------------------|
| `users.view`                   | users            | view         | View user list and details         |
| `users.assign_roles`           | users            | assign_roles | Assign or remove roles from users  |
| `user_management.view`         | user_management  | view         | View SAML role mappings            |
| `user_management.assign_roles` | user_management  | assign_roles | Create, update, delete SAML role mappings |

---

## Protected API Routes

| Route                                      | Method   | Required Permission              | Notes                              |
|--------------------------------------------|----------|----------------------------------|------------------------------------|
| `/api/customers/:id/accounts`              | GET      | `accounts.view`                  | ABAC: checks customer context      |
| `/api/accounts/:accountId/transactions`    | GET      | `transaction.view`               | ABAC: checks employee-customer flag|
| `/api/customers/:customerId/transactions`  | GET      | `transaction.view`               | ABAC: checks customer context      |
| `/api/admin/users`                         | GET      | `users.view`                     |                                    |
| `/api/admin/users/:id`                     | GET      | `users.view`                     |                                    |
| `/api/admin/users/:id/roles`               | POST     | `users.assign_roles`             |                                    |
| `/api/admin/users/:id/roles/:roleId`       | DELETE   | `users.assign_roles`             |                                    |
| `/api/admin/users/:id/roles/manual`        | POST     | `users.assign_roles`             |                                    |
| `/api/admin/roles`                         | GET      | `users.view`                     |                                    |
| `/api/admin/saml-mappings`                 | GET      | `user_management.view`           |                                    |
| `/api/admin/saml-mappings`                 | POST     | `user_management.assign_roles`   |                                    |
| `/api/admin/saml-mappings/:id`             | PATCH    | `user_management.assign_roles`   |                                    |
| `/api/admin/saml-mappings/:id`             | DELETE   | `user_management.assign_roles`   |                                    |

---

## Attribute-Based Access Control (ABAC)

Some permissions support fine-grained, attribute-based checks beyond simple role membership. This is configured via `attributeConfig` on individual permissions.

### How It Works

1. A permission is marked `isAttributeBased = true` with an `attributeConfig` containing conditions.
2. When the permission is checked, a **context** is built from the request (e.g., the customer being accessed).
3. Each condition is evaluated against the context.
4. If a condition matches and `denyIfMatch = true`, access is denied — unless the user's privilege level meets the `minPrivilegeOverride` threshold.

### Condition Operators

| Operator       | Description                         |
|----------------|-------------------------------------|
| `equals`       | Exact match                         |
| `not_equals`   | Not equal                           |
| `in`           | Value is in a list                  |
| `not_in`       | Value is not in a list              |
| `greater_than` | Numeric greater than                |
| `less_than`    | Numeric less than                   |

### Example: Employee Customer Protection

The `transaction.view` permission uses ABAC to restrict access to employee customer accounts. When a customer has `isEmployee = true`, a condition denies access unless the user has a sufficiently high privilege level (e.g., level 3+).

```
Condition:
  attribute:            customer.isEmployee
  operator:             equals
  value:                true
  denyIfMatch:          true
  minPrivilegeOverride: 3
  reason:               "Employee customer records require elevated access"
```

### Available Context Objects

| Context Key | Type     | Description                           |
|-------------|----------|---------------------------------------|
| `customer`  | Customer | The customer being accessed           |
| `account`   | Account  | The account being accessed            |
| `note`      | Note     | The note being accessed               |

---

## How Permissions Are Resolved

When a request hits a protected route:

1. **Authentication** — `req.employeeId` must be set (401 if missing).
2. **Load permissions** — The user's active roles are fetched, along with all permissions granted by those roles and by the user's maximum privilege level.
3. **Privilege level check** — If `minPrivilegeLevel` is set on the middleware, the user's max privilege level is compared.
4. **Permission code check** — If `requireAll`, `requireAny`, or `permissionCode` is set, the user's permission list is checked.
5. **ABAC evaluation** — If the permission is attribute-based, the context is built and conditions are evaluated.
6. **Audit logging** — Both grants and denials are emitted as audit events (`AUTHZ_PERMISSION_GRANTED` / `AUTHZ_PERMISSION_DENIED`).

Permission denials are also logged to the `permission_denial_log` table for compliance.

---

## Database Schema

### Core Tables

| Table                   | Purpose                                           |
|-------------------------|---------------------------------------------------|
| `privilege_level`       | Defines numeric levels (0-4) with names           |
| `role`                  | Role definitions with privilege level and metadata |
| `permission`            | Permission codes with optional ABAC config        |
| `role_permission`       | Maps roles to permissions (many-to-many)          |
| `employee_role`         | Assigns roles to employees with effective/expiration dates |

### Audit & Compliance Tables

| Table                     | Purpose                                         |
|---------------------------|-------------------------------------------------|
| `role_audit_log`          | Tracks all role assignment changes              |
| `permission_denial_log`   | Records every denied permission check           |
| `employee_status_history` | Tracks employee status changes                  |
| `employee_role_history`   | Full history of role assignments                |
| `role_change_request`     | Workflow for role change approvals              |

### SAML Integration

| Table              | Purpose                                              |
|--------------------|------------------------------------------------------|
| `saml_role_mapping` | Auto-assigns roles based on SAML identity attributes |

---

## Frontend Usage

### Permission Hooks

```tsx
import { useHasPermission, useHasAnyPermission, useMinPrivilegeLevel } from "@/hooks/usePermissions";

// Single permission check
const canViewUsers = useHasPermission("users.view");

// Any of multiple permissions
const canManage = useHasAnyPermission(["users.view", "users.assign_roles"]);

// Privilege level check
const isManager = useMinPrivilegeLevel(2);
```

### PermissionGuard Component

Conditionally renders children based on permissions:

```tsx
import { PermissionGuard } from "@/components/PermissionGuard";

<PermissionGuard permissionCode="users.assign_roles" fallback={<p>Access denied</p>}>
  <RoleAssignmentForm />
</PermissionGuard>

<PermissionGuard minPrivilegeLevel={3}>
  <SeniorManagerDashboard />
</PermissionGuard>

<PermissionGuard requireAny={["users.view", "user_management.view"]}>
  <AdminPanel />
</PermissionGuard>
```

---

## Role Testing (Non-Production)

The system includes a role testing feature that lets developers simulate different roles without changing actual assignments. Controlled by:

- **Environment variable:** `ROLE_TESTING_ENABLED` (defaults to `true`, set to `false` to disable)
- **Production guard:** Always disabled in `NODE_ENV=production`

When active, a user can temporarily override their role to see the application as that role would experience it. The override replaces (not merges) the user's permissions with the test role's permissions.

---

## Key Files

| File                                          | Description                           |
|-----------------------------------------------|---------------------------------------|
| `shared/schema.ts`                            | Type definitions and table schemas    |
| `server/middleware/permissions.ts`             | Express permission middleware         |
| `server/services/permissionService.ts`        | Core permission checking logic        |
| `server/services/roleTestService.ts`          | Role testing/override service         |
| `server/storage/roleManagement/`              | Data access layer (Postgres + SQL Server) |
| `client/src/hooks/usePermissions.ts`          | React permission hooks                |
| `client/src/components/PermissionGuard.tsx`   | Declarative permission guard component|
