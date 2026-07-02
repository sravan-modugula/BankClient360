# ClientIQ Documentation Modernization — Consolidated Gap Report

**Application:** ClientIQ / Banking Client 360 (on-prem banking customer-360 CRM)
**Repo:** `/Users/sravanmodugula/code/BankClient360`
**Scope:** 17 documents audited against the live codebase
**Report date:** 2026-07-01

---

## 1. Executive Summary

The ClientIQ documentation set is **substantially out of date** and, in several documents, actively misleading. Across 17 audited documents the average staleness score is roughly **63/100**, with the worst offenders (UI file-usage guide, database ERD, environment-variables reference) scoring **80+**. The single most damaging cross-cutting defect is that a large fraction of the docs still frame ClientIQ as a **live dual-database (PostgreSQL + SQL Server) platform with trigram/fuzzy search**, when in reality **SQL Server is the only production engine**, production search is a plain case-insensitive `LIKE` substring match, and the PostgreSQL/Drizzle-pg layer is a non-runtime abstraction that throws if invoked. Compounding this, the docs describe **infrastructure that does not exist** (an Nginx reverse proxy, an SSIS/stored-procedure ETL, a `dev→UAT→prod` Git pipeline, numbered Drizzle migrations `0001–0014`, a CI/CD governance/pre-commit framework) while **omitting what does exist** (the Azure DevOps four-branch deploy model, the `tsx watch` / `NODE_ENV=development` runtime, the SAML/RSA + AD-group RBAC subsystem, the 40-table schema, and the required SQL Server bootstrap scripts).

The good news: the **structural skeletons are mostly reusable**. Feature narratives, domain groupings, governance/process frameworks, and DBA mechanics are largely sound. The failures are concentrated in **load-bearing technical specifics** — engine, search, auth, deploy topology, schema counts, env vars, and file/route wiring — which is exactly the material readers rely on. Nearly every doc also carries **unverifiable governance metadata** (owners, "last updated" dates, SLAs, hostnames) that only a human can confirm.

**Net recommendation:** treat this as a re-baseline, not a touch-up. Two documents (`enterprise-architecture.txt`, the aspirational blueprint; and the stale routing/UI guide) are divergent enough to retire or fully regenerate rather than edit.

---

## 2. Cross-Cutting Themes

These issues recur across many documents and should be fixed **consistently, app-wide**, not piecemeal per doc.

### 2.1 PostgreSQL / dual-database framing must be removed everywhere (the #1 theme)
Appears in **at least 9 docs** (overview, architecture, database-design, database-erd, roles-and-permissions, saml-configuration, environment-variables, technical-requirements, and implicitly others).
- **Reality:** `server/dbConnection.ts` is "MS SQL Server only"; `getPgDatabase()` throws `not available — this deployment uses MS SQL only` (dbConnection.ts:74-79). The `pgTable` schema, `drizzle.config` (`dialect=postgresql`), and the default-Postgres branches of `dbConfig`/`SearchProviderFactory` are a **portability abstraction, not a live second backend**.
- **Fix pattern:** State SQL Server (MSSQL_* env vars) is the sole production engine. Where the Drizzle-pg abstraction is mentioned at all, label it clearly as type-generation/dev tooling with a non-runtime Postgres path. Remove "dual-database," "vendor-neutral," "switch databases without code changes," and Neon/serverless-Postgres claims.

### 2.2 Search is `LIKE`, not trigram / full-text / phonetic
Appears in overview, architecture, database-design, database-erd, technical-requirements.
- **Reality:** production customer search is case-insensitive substring `LIKE` with `COLLATE Latin1_General_CI_AS` across name/business/full_name/tax id/silverlake id/`CONCAT(first,last)` (server/storage/sqlServerCustomerSearch.ts:103-126). There is **no** `pg_trgm`/GIN, **no** SQL Server Full-Text Search (`CONTAINS`/`CONTAINSTABLE`), and **no** `SOUNDEX`/`STRING_SIMILARITY` on the wired production path. (A `SqlServerSearchProvider` with `STRING_SIMILARITY`/`SOUNDEX` exists in an adapter but is not what the production endpoint runs.)
- **Fix pattern:** Delete all trigram/FTS/phonetic/"Smyth finds Smith 33%" claims; describe substring `LIKE` and the actual nonclustered indexes in `scripts/create_performance_indexes.sql`.

### 2.3 Schema is 40 tables — RBAC/Notes/Audit domains are undocumented
Appears in database-design (claims 39 / RBAC 5-10), database-erd (~19 tables depicted), roles-and-permissions, technical-requirements.
- **Reality:** `shared/schema.ts` defines **40 `pgTable` objects**. Entire domains are missing from the design/ERD docs: the **Notes module** (note, note_category, note_version, note_audit_log), the **full RBAC set** (privilege_level, role, permission, role_permission, employee_role, saml_role_mapping, role_audit_log, permission_denial_log), **User Management** history/approval tables (employee_status_history, employee_role_history, role_change_request), **audit_event**, **region**, and **account_sic_code**.
- **Fix pattern:** Regenerate the ERD/design from `shared/schema.ts` (Mermaid), grouped by domain; document `employee_role.assigned_by` provenance; flag `role_change_request`/`role_audit_log`/`employee_status_history` as defined-but-unimplemented.

### 2.4 No numbered migrations, no consolidated schema script — SQL Server is script-managed
Appears in database-design (migrations 0001-0014), database-erd (migration graph), sql-server-dba-setup (points to a nonexistent `sqlserver-schema-v3.sql`), architecture, technical-requirements.
- **Reality:** no `migrations/` or `drizzle/` directory exists; `drizzle-kit`/`db:push` targets Postgres and is **not** the production path. SQL Server schema is applied via standalone idempotent scripts under `scripts/*.sql` and `Insert Queries/Schema Changes/*.sql`.
- **Fix pattern:** Replace all fictional migration inventories with the real script list. Call out the **prerequisite** scripts (`create_sessions_table.sql`, `create_audit_event_table.sql`, `ensure_branch_manager_role.sql`, `ensure_rbac_provenance_columns.sql`, `widen_employee_last_seen_saml_role.sql`, `create_performance_indexes.sql`, and the `financial_transaction`/`note` denormalization scripts).

### 2.5 Deploy model: Azure DevOps four-branch, NOT GitHub main / UAT
Appears in architecture, on-premises-deployment, deployment-plan, dev-test-server-setup, windows-server-setup, troubleshooting, sql-server-dba-setup.
- **Reality:** ADO pipeline triggers on **develop / test / preprod / prod** branches (no `uat`, no `main`, no `release/x.y`). Deploy is **PowerShell Remoting → Windows Service** (copy artifact → Stop-Service → optional `npm ci` gated on the literal `npm ci` commit message → Start-Service). **Prod deploys to two servers** (Deploy_Prod + Deploy_Prod2). SonarQube SAST runs on `develop` only; OWASP ZAP DAST runs after the Test deploy and fails the build on any high finding. **Pushing GitHub `main` does not reach preprod/prod.**
- **Fix pattern:** Replace all UAT/`main`/`release` branch models and blue-green/K8s/Docker/Helm claims with the real four-branch ADO model.

### 2.6 The deployed runtime runs `tsx watch` from source with `NODE_ENV=development`
Appears in architecture, on-premises-deployment, deployment-plan, dev-test/windows-server setup, troubleshooting, sql-server-dba-setup.
- **Reality:** the pipeline-generated `Start-Server.ps1` launches `npx tsx watch --clear-screen=false server/index.ts` with `NODE_ENV=development` for **every** environment (start-script.yml:15-16,48). Consequences: Vite dev middleware (not compiled `dist/`), **mock/dev auth unless `SAML_ENABLED=true`**, non-secure session cookies, main-pool `trustServerCertificate=true`, debug log level, dev-only debug routes active. The compiled entry, when built, is `dist/index.js` (never `dist/server/index.js`), and the client bundle lands in `dist/public`.
- **Fix pattern:** Document the dev-mode runtime and its security implications everywhere a "production build" is implied.

### 2.7 No Nginx anywhere — an external TLS terminator is expected but unspecified
Appears in architecture, on-premises-deployment, dev-test/windows-server setup, ssl-dns-setup, troubleshooting.
- **Reality:** there is **no** Nginx (or IIS/web.config) config, service, or reference in the repo. The Node app listens on **plain HTTP `0.0.0.0:5000`**. TLS termination is expected (SAML URLs are https) but its product is not defined in-repo. The only in-repo reverse proxy is the app's Express Streamlit proxy at `/streamlit`.
- **Fix pattern:** Remove all `C:\nginx\...` paths, `nginx.conf` snippets, and `nginx.exe`/`Restart-Service Nginx` commands. Reframe as "external TLS terminator (product TBD, confirm with infra)."

### 2.8 SAML/AD-group role mapping is code-based; the `saml_role_mapping` table is dormant
Appears in architecture, roles-and-permissions, active-directory-groups, saml-configuration, environment-variables, technical-requirements.
- **Reality:** login-time role assignment uses a **convention-based AD-group-name mapper** (`server/auth/adGroupRoleMap.ts`, pattern `<PREFIX>_<ENV>_APP_ClientIQ_<RoleToken>_<Access>`), scoped by **`SAML_ROLE_ENV`**, with **enforced per-login revoke** of AD-derived roles (`assigned_by IS NULL`) and a guaranteed **"Branch Manager" fallback**. The `saml_role_mapping` DB table is **admin-CRUD only and not on the login path** (`processSamlRole` is never called). IdP is **RSA SecurID Access** (F&M Bank portal, tile-launched, Response-wrapper signed → `wantAssertionsSigned=false`). Note the AD map emits a **`BRS`** role that `scripts/seed.ts` does not create.
- **Fix pattern:** Document the AD-group convention, `SAML_ROLE_ENV`, provenance/revoke behavior, the fallback role, RSA specifics, and demote `saml_role_mapping` to "not used at login."

### 2.9 Environment variables: many documented vars are dead; the real ones are missing
Appears in environment-variables, saml-configuration, windows-server/dev-test setup, sql-server-dba-setup, on-premises-deployment.
- **Reality:** dead/unread vars include `HOST`, `MSSQL_PORT`, `SAML_ATTR_*`, `SAML_LOGOUT_URL`, `SAML_DECRYPT_KEY`, `SESSION_TIMEOUT`, all `SESSION_COOKIE_*` (except the hard-coded name), `DB_POOL_*`, `LOG_FORMAT`, `DEBUG`, `CORS_ORIGIN`, `RATE_LIMIT_*`, `ENABLE_AUDIT_LOGGING`, `ENABLE_PERFORMANCE_MONITORING`, `SAML_ENTITY_ID`, `SAML_IDP_INITIATED_URL`. Missing-but-real vars: `SAML_ENABLED`, `SAML_ROLE_ENV`, `SAML_DEFAULT_ROLE_NAME`, `RSA_PORTAL_URL`, `DB_VENDOR`, the `DB_*` fallback chain, `ROLE_TESTING_ENABLED`, `SESSION_SECRET`, `LOG_LEVEL`. `MSSQL_ENCRYPT`/`MSSQL_TRUST_SERVER_CERTIFICATE` affect **only the session store** (main pool hard-codes `encrypt:true` + NODE_ENV-based trust). App forces `TZ=America/Los_Angeles` at startup. Config is delivered via **PowerShell env exports, not a `.env` file** (no dotenv).
- **Fix pattern:** Rebuild every env-var table against actual `process.env` reads; mark dead vars explicitly.

### 2.10 Enforcement gaps: Notes and deposit-summary/trend are auth-only (not permission-gated)
Appears in roles-and-permissions, architecture, technical-requirements, data-grooming.
- **Reality:** there is **no `notes.*` permission** anywhere; all `/api/notes*` CRUD and `/api/customers/:id/deposit-summary` + `/deposit-trend` are authentication-only with no `requirePermission` and no `PermissionGuard`. The `transaction.view` ABAC employee-customer rule is **a no-op in SQL Server production mode** (`permissionService.checkPermission` returns `allowed:true` when `db` is null), and the frontend (`level < 2`) and backend seed (`minPrivilegeOverride: 3`) thresholds **disagree**.
- **Fix pattern:** Document these as known enforcement gaps rather than implying uniform permission gating.

### 2.11 Pervasive governance-metadata drift (owners, dates, hostnames, versions)
Nearly every doc carries contradictory "last updated" stamps (e.g. body "Dec 2024" vs header "Apr 14, 2026"), placeholder hostnames (`yourbank.com` vs real `portal.fmb.com` / `*-clientiq.fmb.com`), and doc-version vs app-version confusion (`package.json` is `1.0.0`). These are collected in the **Docs Needing Human Input** callout (§5).

---

## 3. Ranking Table (most-stale first)

| Doc | Purpose | Staleness | #Critical | #High | Headline issue | Proposed new filename |
|---|---|---|---|---|---|---|
| database-erd | Entity-relationship / data-model reference | 82 | 3 | 3 | Dual-engine framing; documents FKs/tables that don't exist; ~19 of 40 tables shown | database-erd.md |
| ui-file-usage | Which UI files are active vs dead | 82 | 2 | 5 | Routing, app shell, and active/unused classification all obsolete | ui-file-usage.md |
| environment-variables | Env-var reference | 80 | 5 | 4 | Many documented vars are dead; real vars missing; invented `.env`/validation | environment-variables.md |
| architecture | System architecture reference | 72 | 5 | 5 | Nginx/FTS/UAT-pipeline/SSIS invented; enterprise blueprint is fiction | architecture.md |
| windows-server-setup | Windows host install/run guide | 72 | 3 | 3 | Compiled-service + Nginx premise wrong; runtime is `tsx watch` dev-mode | windows-server-setup.md |
| ssl-dns-setup | SSL/DNS/TLS runbook | 72 | 1 | 2 | Entire doc built on a nonexistent Nginx; wrong hostname + health path | ssl-dns-setup.md |
| troubleshooting | Runtime/incident runbook | 72 | 2 | 4 | Nginx section + compiled-service commands would fail during an incident | troubleshooting.md |
| roles-and-permissions | RBAC + ABAC model | (38) | 0 | 3 | ABAC threshold split; SQL-Server ABAC no-op; enforcement gaps undocumented | roles-and-permissions.md |
| database-design | SQL Server schema reference | 68 | 4 | 5 | PG-parity framing; wrong `full_name`/FK/constraint facts; fictional migrations | database-design.md |
| saml-configuration | SAML SSO operator guide | 68 | 2 | 5 | Role mapping via dormant table; multiple nonexistent env vars + wrong config values | saml-configuration.md |
| technical-requirements | EPIC/feature spec | 68 | 4 | 4 | Dual-DB/trigram framing; DB-CHECK constraint fiction; SAR/OFAC/health unbuilt | technical-requirements.md |
| dev-test-server-setup | Dev/test host setup | 62 | 0 | 3 | Nginx + wrong build path + wrong SAML ACS URL + dead env vars | dev-test-server-setup.md |
| sql-server-dba-setup | DBA runbook | 62 | 2 | 4 | Points to nonexistent schema/test-data scripts; omits prerequisite scripts | sql-server-dba-setup.md |
| clientiq-overview | Product/architecture overview | 58 | 2 | 4 | Dual-DB/trigram; wrong counts/colors; invented CI/CD governance; omits SAML/RBAC | clientiq-overview.md |
| database-to-ui-field-mapping | DB column → UI mapping | 58 | 0 | 4 | Wrong endpoints, masks, and maps to unwired/commented-out components | database-to-ui-field-mapping.md |
| on-premises-deployment | On-prem deploy overview/index | 55 | 3 | 4 | Nginx premise; omits ADO pipeline; dev-mode runtime | on-premises-deployment.md |
| data-grooming | Data-load recipe (FK order) | 48 | 0 | 4 | Conflates faker seed vs SQL Server ETL; lists tables with no ETL loader | data-grooming.md |
| deployment-plan | Deployment governance/process | 45 | 1 | 3 | Wrong branch model; "same build Test→Prod" contradicts pipeline | deployment-plan.md |
| active-directory-groups | AD security-group registry | 45 | 0 | 2 | No role-mapping column; omits naming convention, env-scoping, PRD groups | active-directory-groups.md |

*(roles-and-permissions has the lowest staleness score at 38 but is placed among the high-severity docs for its 3 High findings; the table is otherwise ordered by staleness score descending, then by critical/high counts.)*

---

## 4. Per-Document Findings

Findings are grouped by severity within each document. Ordering: most-stale first.

---

### 4.1 database-erd.md — Staleness 82

**Purpose:** Entity-Relationship Diagram / data-model reference: tables, columns, FKs, cardinality, constraints, indexes, and migration/growth guidance.

**Summary:** Badly out of date and materially wrong. Framed as dual-engine (PostgreSQL 14+ | SQL Server 2019+) when SQL Server is the only production engine. Documents a `debit_card_id` FK and a `debit_card→financial_transaction` relationship that do not exist, plus an `account.sic_code` FK that does not exist. Omits entire current domains (Notes, RBAC, User Management, audit_event, region, account_sic_code) — 40 pgTables vs ~19 depicted. Should be regenerated from `shared/schema.ts` as a Mermaid ER diagram.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | postgres-reference | Header "Database Engines: PostgreSQL 14+ \| SQL Server 2019+" | **Says:** co-equal dual-engine model. **Actual:** SQL Server only; `getPgDatabase()` throws (dbConnection.ts:74-79); pgTable + drizzle.config are type/tooling only. **Change:** "Database Engine: SQL Server 2019+ (production)"; note pgTable is for type generation only. |
| Critical | wrong-fact | Financial-transaction / debit-card boxes; 1:M table; FK/index maps | **Says:** `financial_transaction.debit_card_id → debit_card`, 1:M `debit_card→financial_transaction`, `ON DELETE SET NULL`, index `(debit_card_id, posting_date DESC)`. **Actual:** no `debit_card_id` column/FK/index (schema.ts:380-425); FKs are only account_id, category_id, counterparty_account_id. **Change:** remove all `debit_card_id` references; if a link is desired, flag as a gap. |
| Critical | wrong-fact | ACCOUNT box "FK sic_code"; constraint map | **Says:** `account.sic_code → sic_code`. **Actual:** account has only `branch_id` FK (schema.ts:188-219); SIC linkage is the `account_sic_code` junction (schema.ts:348-363). **Change:** remove `FK sic_code`; add `account_sic_code` M:N. |
| High | obsolete-section | Whole ERD body / module diagrams | **Says:** ~19 tables. **Actual:** 40 pgTables; missing Notes, RBAC, User Management, audit_event, region, account_sic_code. **Change:** regenerate as a Mermaid erDiagram covering all 40, grouped by domain. |
| High | postgres-reference | Index Strategy Map / Customer Search Flow (pg_trgm GIN) | **Says:** GIN index on `full_name` via `pg_trgm % term`. **Actual:** pg_trgm lives only in the non-production PostgresSearchProvider; prod uses SqlServerSearchProvider (STRING_SIMILARITY 2022+ / SOUNDEX 2019). **Change:** reframe around SqlServerSearchProvider; mark pg_trgm/GIN non-production. |
| High | obsolete-section | Migration Dependency Graph 0001–0014 | **Says:** ordered drizzle migration chain. **Actual:** no `migrations/`/`drizzle/` dir; prod schema via standalone `scripts/*.sql` + `Insert Queries/Schema Changes/*.sql`. **Change:** delete the graph; document the script-based model. |
| High | wrong-fact | Business Rule Enforcement Map (CUSTOMER/DEBIT_CARD constraints) | **Says:** `customer_name_type_check`, `customer_full_name_trigger`, debit-card expiry CHECKs. **Actual:** enforced in Zod (schema.ts:906-929, 1117-1124); only DB CHECK is `note.check_note_one_target` (schema.ts:598-601). **Change:** attribute to the Zod layer; add the note CHECK. |
| Medium | wrong-fact | Index Strategy (SQL Server full-text `CONTAINS()`) | **Says:** full-text index + `CONTAINS()`. **Actual:** STRING_SIMILARITY/SOUNDEX over `full_name`; nonclustered B-tree indexes (create_performance_indexes.sql). **Change:** remove full-text claim. |
| Medium | wrong-fact | Debit-card triggers ("Triggers: 2") | **Says:** PG + SQL Server triggers. **Actual:** described only in a schema comment (schema.ts:433-450); no trigger DDL in repo; only SQL Server variant is prod-relevant; `customer_id` NOT NULL FK omitted. **Change:** drop PG trigger; note trigger DDL is external; add customer_id/limit_profile_id. |
| Medium | wrong-fact | CUSTOMER `full_name` (trigger/computed) | **Says:** PG trigger + SQL Server persisted computed. **Actual:** plain `varchar(200)` omitted from inserts (schema.ts:114, 902); exact SQL Server mechanism unverified. **Change:** remove PG-trigger; confirm SQL Server mechanism. |
| Medium | postgres-reference | Performance Monitoring (`pg_tables` bloat query) | **Says:** PG bloat query as co-equal. **Actual:** prod is SQL Server (`dbo`, not `public`). **Change:** remove PG query; keep `sys.dm_db_index_physical_stats`. |
| Medium | stale | Summary Statistics (25+ tables, Triggers 2, CHECK 4…) | **Actual:** 40 pgTables; one explicit CHECK. **Change:** recompute all metrics after regeneration. |
| Medium | stale | Online Banking / contact_history boxes | **Actual:** `contact_history` has denormalized `employee_name`, nullable `employee_id`; login_event has `idx_login_event_result`. **Change:** regenerate from schema. |
| Low | stale | financial_transaction box (omits account_number) | **Actual:** `account_id` nullable; joins pivot on `account_number varchar(50)`; dedup `(account_id, source_system, source_transaction_id)`. **Change:** add account_number; mark account_id nullable. |
| Low | needs-human-input | Table Size & Growth Projections | **Actual:** capacity estimates not derivable from code. **Change:** have data/ops owner confirm; mark illustrative. |
| Low | missing | entity_contact box | **Actual:** omits `contact_type_cached` (schema.ts:246); polymorphic `entity_id` has no FK. **Change:** include on regeneration. |

---

### 4.2 ui-file-usage.md — Staleness 82

**Purpose:** Developer guide classifying which `client/src` UI files are active vs demo/unused, and the import chain from the app root.

**Summary:** Describes a much earlier frontend. Routing is entirely obsolete (old `/household/*` routes commented out; current `/ciq/*`, `/account/:accountId`, `/rbr` missing), the app shell is described as `TopBar` when it is actually `Header + Navbar`, and many "ACTIVE" components (RiskCompliance, HouseholdRelationships, AccountCard, TotalRelationshipSummary) are unused or in dead branches while many current ones (Middle, AccountDetailOption2, AccountList, header/navbar shells) are undocumented.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | wrong-fact | Pages table + Routing (App.tsx) | **Says:** routes `/`, `/household/:id`, `/household/option1|2`, etc. **Actual:** App.tsx:166-180 → `/`→`/ciq/client`, `/ciq/household`, `/ciq/:tabView`, `/admin/users`, `/account/:accountId`, `/rbr`; old household routes commented out. **Change:** replace the entire routing block; mark HouseholdPageOption1/2 UNUSED. |
| Critical | wrong-fact | TopBar row + import-chain tree | **Says:** `App.tsx → TopBar`. **Actual:** App.tsx imports `Header` + `Navbar` (App.tsx:22-23); TopBar is legacy/unused. **Change:** move TopBar to legacy; document header/Header.tsx + navbar/Navbar.tsx shell. |
| High | wrong-fact | RiskCompliance.tsx (ACTIVE) | **Says:** active, imported by CustomerDashboard. **Actual:** no non-example import; only `examples/RiskCompliance.tsx`. **Change:** reclassify UNUSED. |
| High | wrong-fact | HouseholdRelationships.tsx (ACTIVE) | **Says:** active household member component. **Actual:** imported only in the unreachable household-tab branch (CustomerDashboard.tsx:793); real screen is HouseholdPage.tsx. **Change:** reclassify dead-branch/UNUSED. |
| High | wrong-fact | TotalRelationshipSummary.tsx (ACTIVE) | **Says:** active summary. **Actual:** import present but render commented out (CustomerDashboard.tsx:849-855); replaced by Middle.tsx. **Change:** reclassify UNUSED; document Middle.tsx. |
| High | wrong-fact | AccountCard.tsx (ACTIVE) | **Says:** imported by AccountList/Deposits. **Actual:** only imported by the also-unused AccountSummary.tsx. **Change:** reclassify UNUSED. |
| High | missing | Active-components table | **Actual:** omits Middle, AccountDetailOption2, header/navbar shells, MaintenanceItems, SectionLabel, PanelTitle, BackButton, ErrorBoundary, RBRShell; CustomerSearch renders in Header. **Change:** add these with real importers. |
| High | missing | Alternative/Unused table | **Actual:** many more unused files (AccountDetailOption1/3, type-specific detail variants, AccountBalanceTrends, NotesTab, RiskCompliance, TopBar, HouseholdRelationships, TotalRelationshipSummary, AccountCard, HouseholdPageOption1/2). **Change:** expand the list. |
| Medium | wrong-fact | shadcn UI section ("50+ ACTIVE") | **Actual:** 47 files; app is MUI-primary; ui/* largely unused scaffolding (only Toaster/TooltipProvider wired). **Change:** correct count; reclassify. |
| Medium | wrong-fact | CustomerDashboard importer/route rows | **Actual:** mounted at `/ciq/:tabView`, not `/`; on-page tab strip commented out; tabs via URL + navbar. **Change:** update route and tab mechanism. |
| Medium | stale | Status counts + "safe to delete" list | **Actual:** counts keyed to obsolete classification; ui/ is 47 not 50+. **Change:** recompute after reclassification. |
| Medium | missing | Scope / TOC (header/, navbar/, RBR) | **Actual:** header/ and navbar/ subdirs form the shell (data-driven from projects.tsx); RBRShell env-gated. **Change:** add a shell section. |
| Low | stale | Version footer | **Actual:** body reflects pre-`/ciq` era; active files modified through Jul 2026; footer "Dec 2024" contradicts header "Apr 2026". **Change:** update; confirm version string. |
| Low | needs-human-input | "Safe to delete" rationale | **Actual:** delete-vs-retain is a team decision. **Change:** flag as team decision; confirm with frontend owner. |

---

### 4.3 environment-variables.md — Staleness 80

**Purpose:** Complete reference for every environment variable consumed by the app, with defaults, required/optional status, and a production example.

**Summary:** Reads like an idealized config guide. A large fraction of documented vars are never read; nearly all real vars are omitted; it invents a dotenv `.env` location and a `[Config]` startup-validation sequence; and it still frames PostgreSQL/`DATABASE_URL` as first-class.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | wrong-fact | Configuration File Location | **Says:** `.env` in root / `C:\ClientIQ\config\.env`. **Actual:** no dotenv; config via PowerShell env exports (Start-Dev.ps1 / generated Start-Server.ps1). **Change:** replace `.env` framing with PowerShell exports; state no `.env` is read. |
| Critical | missing | SAML section (no `SAML_ENABLED`) | **Actual:** `SAML_ENABLED` is the master SSO gate (index.ts:21); exact string `'true'`. **Change:** add as primary SAML var. |
| Critical | missing | SAML (`SAML_ROLE_ENV`, `SAML_DEFAULT_ROLE_NAME`) | **Actual:** role-env scoping + fallback role default "Branch Manager". **Change:** add both. |
| Critical | wrong-fact | Optional SAML Settings | **Says:** `SAML_LOGOUT_URL`, `SAML_LOGOUT_CALLBACK_URL`, `SAML_DECRYPT_KEY`, `SAML_SIGNATURE_ALGORITHM`, `SAML_DIGEST_ALGORITHM`, `SAML_CLOCK_SKEW_MS`. **Actual:** none read; real logout knob is `RSA_PORTAL_URL`. **Change:** delete the table; add `RSA_PORTAL_URL`. |
| Critical | wrong-fact | Custom Attribute Mapping (`SAML_ATTR_*`) | **Actual:** none read; mapping is hard-coded `ATTRIBUTE_MAP` (samlStrategy.ts:95-103). **Change:** remove section. |
| High | postgres-reference | `DATABASE_DIALECT` + PostgreSQL vars | **Says:** default `postgresql`; `DATABASE_URL` required. **Actual:** deploys set `sqlserver`; `DATABASE_URL` required only by drizzle-kit CLI, not the running server. **Change:** state SQL-Server-only; demote PG to legacy note. |
| High | wrong-fact | Connection Pool Settings (`DB_POOL_*`) | **Actual:** none read; pool hard-coded (max:10, min:0, idle:30000). **Change:** delete section. |
| High | missing | SQL Server vars (DB_* fallback, `DB_VENDOR`) | **Actual:** MSSQL_* fall back to DB_USER/DB_PASSWORD/DB_SERVER/DB_NAME; `DB_VENDOR` selects the search provider. **Change:** add them. |
| High | wrong-fact | `MSSQL_ENCRYPT`/`TRUST`/`PORT` | **Actual:** ENCRYPT/TRUST honored only by the session store; main pool hard-codes encrypt:true + NODE_ENV trust; `MSSQL_PORT` never read. **Change:** clarify scope; mark PORT dead. |
| High | obsolete-section | Validation (`[Config]` startup) | **Actual:** no such validation; missing vars fail at use. **Change:** delete/rewrite. |
| Medium | wrong-fact | `HOST` | **Actual:** never read; listen host hard-coded `0.0.0.0`. **Change:** mark dead. |
| Medium | wrong-fact | Session vars (`SESSION_TIMEOUT`, `SESSION_COOKIE_*`) | **Actual:** none read; hard-coded (1h maxAge, `clientiq.sid`, secure from NODE_ENV); only `SESSION_SECRET` is real. **Change:** remove; keep SESSION_SECRET. |
| Medium | wrong-fact | Logging (`LOG_FORMAT`, `DEBUG`) | **Actual:** not read; only `LOG_LEVEL` (default debug/info). **Change:** remove; keep LOG_LEVEL. |
| Medium | wrong-fact | Security/Feature flags (CORS, RATE_LIMIT, ENABLE_*) | **Actual:** none read; real flag is `ROLE_TESTING_ENABLED`. **Change:** delete sections; add ROLE_TESTING_ENABLED. |
| Medium | missing | App settings (TZ) | **Actual:** app forces `TZ=America/Los_Angeles` at startup (timezone.ts). **Change:** note it's app-set, not an input. |
| Medium | wrong-fact | Production example `NODE_ENV=production` | **Actual:** deploy writes `NODE_ENV=development` for all envs. **Change:** correct or flag the mismatch + security implications. |
| Low | stale | `SAML_ISSUER` / `SAML_CERT` | **Actual:** ISSUER defaults to `ClientIQ-Production`; CERT is inline-PEM or file path (`./saml_cert.pem`). **Change:** mark ISSUER optional; document CERT dual behavior. |
| Low | needs-human-input | Security Best Practices | **Actual:** repo commits plaintext secrets in Start-Dev.ps1; rotation/ownership are governance. **Change:** have owner confirm; reconcile committed secrets. |

---

### 4.4 architecture.md — Staleness 72

**Purpose:** System architecture reference: deployment topology, layered components, ETL, security (SAML + RBAC/ABAC), schema, tech stack, CI/CD.

**Summary:** Right shape, wrong on many load-bearing specifics. Claims SQL Server Full-Text Search when prod uses `LIKE`; invents an Nginx proxy, a `dev→UAT→prod` / `develop-uat-main` pipeline, blue-green deploys, and SSIS stored-proc ETL; and gets schema/session/permission details wrong. The `enterprise-architecture.txt` blueprint (dual-DB, Redis, K8s, RabbitMQ, OAuth2/OIDC, CQRS, event sourcing, multi-region DR, OFAC/AML) is aspirational fiction and should be retired.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | postgres-reference | enterprise-arch: dual-DB / adapter / ADR-001 | **Says:** dual PostgreSQL+SQL Server, pg_trgm, separate migration dirs, "switch DBs without code changes." **Actual:** SQL Server only; getPgDatabase throws; no split migrations. **Change:** remove all dual-DB/PG framing; delete ADR-001 claim. |
| Critical | wrong-fact | V2.2 §4.2 Full-Text Search | **Says:** SQL Server FTS with `CONTAINS`/`CONTAINSTABLE`/`FULLTEXT INDEX`. **Actual:** case-insensitive `LIKE` (sqlServerCustomerSearch.ts:42-43,103-120); no FTS anywhere. **Change:** replace §4.2 with the LIKE model. |
| Critical | wrong-fact | V2.2 §6.2/6.3 CI/CD; enterprise §7 | **Says:** Dev/UAT/Prod, `develop/uat/main`, blue-green xcopy, K8s/Helm/k6/GitHub Actions. **Actual:** ADO develop/test/preprod/prod, PowerShell-Remoting Windows Service, two prod servers. **Change:** rewrite to the four-branch ADO model. |
| Critical | obsolete-section | enterprise-arch whole doc (Redis/K8s/RabbitMQ/OAuth2/CQRS/DR/OFAC) | **Actual:** none exist; auth is RSA SAML; sessions in SQL Server; single Windows Service. **Change:** retire the blueprint or mark every element "future/not implemented." |
| Critical | wrong-fact | V2.2 Nginx reverse proxy | **Says:** Nginx HA TLS terminator. **Actual:** no Nginx; app listens HTTP:5000; external terminator unspecified. **Change:** remove Nginx specifics; flag for human input. |
| High | postgres-reference | V2.2 §4.3/4.4 schema; enterprise ERD | **Says:** `customer_type DEFAULT 'individual'`, `CK_customer_name_type`, `debit_card.limit_profile_id` FK. **Actual:** default `'regular'`; no such CHECK (only `note.check_note_one_target`); Zod union over individual/premium/regular/business/trust; SQL Server debit_card uses inline limit columns. **Change:** correct default; remove fabricated constraint; note debit-card divergence. |
| High | wrong-fact | V2.2 SQL Server Session Store | **Says:** `sessions(session_id/session_data/expires_at…)`, cleanup proc, 24h TTL. **Actual:** `sid/session/expires` (connect-mssql-v2); no cleanup proc (15-min auto-remove); TTL 12h, 1h rolling cookie `clientiq.sid`, sameSite lax. **Change:** correct schema/TTL/cookie. |
| High | wrong-fact | V2.2 §2.2/4.1/4.5 ETL (SSIS/staging/2AM) | **Says:** SSIS + `stg_*` + `usp_load_*` MERGE, daily 2AM. **Actual:** hand-run `Insert Queries/*.sql` from Jack Henry views, FK-ordered, no orchestrator; 13-month tx window. **Change:** replace with the manual-SQL flow; flag SSIS as unverified. |
| High | wrong-fact | V2.2 §1.4/7.1 "every request validated" + branch ABAC | **Actual:** Notes and deposit-summary/trend are auth-only; no `notes.*` permission; seeded ABAC is `transaction.view` employee-customer (priv ≥3); SQL Server store uses branch/region and the PG ABAC no-ops when db is null. **Change:** soften; document the gap. |
| High | wrong-fact | V2.2 §5.1 Backend table | **Says:** "npm saml", bcryptjs, mssql 12.0.0, pool max 100. **Actual:** `@node-saml/passport-saml ^5.1.0`; no bcrypt (SSO-only); pool max:10. **Change:** correct all; re-verify mssql version. |
| Medium | wrong-fact | Version matrix (MUI 7 vs 5) | **Actual:** the two docs disagree; re-derive from package.json. **Change:** reconcile; don't publish unverified pins. |
| Medium | wrong-fact | §7.1 Audit (`audit_log`) | **Actual:** real table is `audit_event` (schema.ts:854-887) + `permission_denial_log`; no `audit_log`/`event_store`. **Change:** replace with audit_event taxonomy; note role_audit_log/role_change_request unimplemented. |
| Medium | wrong-fact | §5.2 API Versioning (`/api/v1`) | **Actual:** routes unversioned. **Change:** remove or mark aspirational. |
| Medium | wrong-fact | §6.1 Topology (3 envs, `.fmb.internal`) | **Actual:** four envs, `*-clientiq.fmb.com`, named SQL clusters, LB app tier CIQ-APP01/02. **Change:** replace with real topology. |
| Medium | missing | §7.1 auth model | **Actual:** AD-group convention map, `SAML_ROLE_ENV`, enforced revoke + provenance, Branch Manager fallback, `saml_role_mapping` dormant, RSA specifics. **Change:** add a real auth section. |
| Medium | wrong-fact | §1.4/4.6/7.1 Data protection (TDE/TLS1.3/masking) | **Actual:** MSSQL_ENCRYPT=false/trust=true in scripts; masking is `XXX-XX-<last4>`; TDE/TLS/PCI are ops claims. **Change:** mark ops claims for confirmation; correct masking. |
| Medium | needs-human-input | Version/Date/Owner header | **Actual:** self-contradicts (V2.2/Apr 2026 vs "Version 1.0"/Nov 2025). **Change:** reconcile with owner. |
| Low | stale | Runtime/prod-config (compiled dist / Winston) | **Actual:** runs `tsx watch` from source, NODE_ENV=development; logger is custom, not confirmed Winston; single port 5000. **Change:** add the dev-mode note; verify logger. |

---

### 4.5 windows-server-setup.md — Staleness 72

**Purpose:** Operator guide for installing/running the Node app on Windows Server (Node install, app dir, env, service, firewall, logs, verification, troubleshooting).

**Summary:** Two load-bearing premises are wrong: it describes running the compiled build (`dist/server/index.js`) as a hand-installed NSSM service with `NODE_ENV=production`, but the pipeline runs `npx tsx watch` from source with `NODE_ENV=development`; and it says the app runs behind Nginx, which does not exist. Multiple concrete details (build output path, health shape, env vars) are also false.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | wrong-fact | Overview (behind Nginx) | **Actual:** no Nginx; app listens HTTP:5000; external terminator unspecified. **Change:** remove Nginx claim. |
| Critical | wrong-fact | Step 5 (NSSM `dist/server/index.js`) | **Actual:** build emits `dist/index.js`; pipeline runs `tsx watch server/index.ts`. **Change:** correct path; document tsx-watch runtime. |
| Critical | stale | Step 5/8 (`NODE_ENV=production`) | **Actual:** generated Start-Server.ps1 sets `NODE_ENV=development` for all envs → Vite middleware, mock auth unless SAML on, non-secure cookies, trust-any-cert, debug logs. **Change:** document dev-mode reality. |
| High | wrong-fact | Step 3 (dist\client / dist\server) | **Actual:** client → `dist/public`; server → `dist/index.js`. **Change:** update tree. |
| High | wrong-fact | Step 8 (health response) | **Actual:** `{status:'healthy', timestamp, service:'Banking Customer API'}`; no DB check. **Change:** correct expected response. |
| High | obsolete-section | Step 5 (manual NSSM/node-windows) | **Actual:** ADO PowerShell-Remoting deploy → existing Windows Service. **Change:** rewrite to match pipeline. |
| High | wrong-fact | Step 4/5 (`.env` + `DOTENV_CONFIG_PATH`) | **Actual:** no dotenv; env set inline by generated Start-Server.ps1. **Change:** replace `.env` approach. |
| Medium | wrong-fact | Step 4 (`SAML_LOGOUT_URL`) | **Actual:** not read; logout from `RSA_PORTAL_URL`/`SAML_ENTRYPOINT`. **Change:** remove. |
| Medium | missing | Step 4 (DB/SAML) | **Actual:** omits `DB_VENDOR`, `SAML_ROLE_ENV`, `SAML_DEFAULT_ROLE_NAME`, `RSA_PORTAL_URL`, `SAML_ENABLED`. **Change:** add. |
| Medium | wrong-fact | Step 4 (`MSSQL_PORT`/`ENCRYPT`/`TRUST`) | **Actual:** PORT dead; ENCRYPT/TRUST session-store only; deploy sets false/true. **Change:** clarify; align values. |
| Medium | missing | Step 6 (firewall) | **Actual:** also needs outbound HTTPS to RSA IdP + Streamlit host (pyt-tstapp01.fmb.com). **Change:** add egress rules. |
| Medium | wrong-fact | Step 3 (`npm ci --production`) | **Actual:** runtime needs tsx/vite; pipeline runs `npm ci --prefer-offline` gated on commit message. **Change:** drop `--production`. |
| Low | wrong-fact | Step 4 (`SAML_CERT` base64 blob) | **Actual:** inline PEM (must contain BEGIN CERTIFICATE) or file path (`./saml_cert.pem`). **Change:** show PEM or path. |
| Low | stale | Step 3 (clientiq-v2.0.0.zip) | **Actual:** package.json is 1.0.0; artifact named by repo. **Change:** version-agnostic name. |
| Low | stale | Step 6 (loopback bind) | **Actual:** binds `0.0.0.0`; HOST inert; exposure controlled by firewall. **Change:** clarify. |
| Low | needs-human-input | Header ownership | **Actual:** ownership/NSSM history unverifiable. **Change:** confirm with ops. |

---

### 4.6 ssl-dns-setup.md — Staleness 72

**Purpose:** Operator runbook for obtaining/installing SSL/TLS certs, DNS, terminating TLS in Nginx on Windows, and cert renewal.

**Summary:** A generic Nginx-on-Windows runbook whose core premise is unsupported — there is no Nginx (or IIS/web.config) anywhere. The app is Node/Express on plain HTTP:5000; a TLS terminator is expected but its identity is undefined in-repo. Hostname `clientiq.fmb.com` appears nowhere; the health-check URL `/health` is not a real route (`/api/health` is).

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | wrong-fact | Whole doc premise (Nginx TLS) | **Says:** certs under `C:\nginx\conf\ssl`, `nginx.conf`, `nginx.exe -s reload`. **Actual:** no Nginx; app is a Windows Service running `tsx watch`, HTTP `0.0.0.0:5000`. **Change:** reframe as "TLS terminator (product TBD)"; remove all nginx paths/commands; mark needs-human-input. |
| High | wrong-fact | DNS + cert CN/SAN (`clientiq.fmb.com`) | **Actual:** hostname absent from repo; SP host is ADO `$(SAMLHost)`; only `portal.fmb.com` (IdP) is real. **Change:** use `<app-fqdn>`/`$(SAMLHost)` placeholders; confirm per-env FQDNs. |
| High | wrong-fact | Verify SSL (`/health`) | **Actual:** only `/api/health` returns health JSON; `/health` is allowlisted but unhandled. **Change:** use `/api/health`. |
| Medium | missing | Secure cookies / forwarded headers | **Actual:** cookie `secure` = NODE_ENV==='production', but deploys run development → secure off; no `trust proxy`/HSTS in app. **Change:** note TLS terminates upstream; HSTS/secure-cookie must be at terminator; flag for security review. |
| Medium | stale | Reload Nginx (`Restart-Service Nginx`) | **Actual:** only the ClientIQ app Windows Service exists. **Change:** remove nginx reload steps or gate behind infra confirmation. |
| Low | needs-human-input | Cert options / renewal ownership | **Actual:** internal CA/wildcard/renewal ownership not in repo. **Change:** confirm with PKI/DNS owners. |
| Low | missing | SAML signing cert vs TLS cert | **Actual:** SAML uses `SAML_CERT` (`./saml_cert.pem`), distinct from TLS cert. **Change:** add a "not the same cert" note. |

---

### 4.7 troubleshooting.md — Staleness 72

**Purpose:** Operator/support runbook for diagnosing app, reverse-proxy, DB, SAML, and performance issues, with health checks, log locations, and escalation.

**Summary:** Describes an architecture that doesn't match the repo. Its two biggest problems: an entire Nginx section (502/504/SSL, `C:\nginx\logs`) with no basis in code, and a runtime model built on a compiled service (`nssm`, `node dist/server/index.js`, `NODE_ENV=production`) when the app deploys as `npx tsx watch` from source with `NODE_ENV=development`. Log paths, restart commands, health path, and SAML guidance are wrong.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | obsolete-section | Nginx Issues (502/504/SSL) + log locations | **Actual:** no nginx anywhere; app HTTP:5000; external terminator unspecified. **Change:** rename to "Reverse Proxy/TLS (external)"; remove nginx commands/paths; flag for confirmation. |
| Critical | wrong-fact | App won't start (`node dist/server/index.js`, `npm ci --production`) | **Actual:** runs `tsx watch server/index.ts`; compiled entry is `dist/index.js`; install is `npm ci` gated on commit message. **Change:** correct start command + remedy. |
| High | wrong-fact | High memory (nssm + dist/server) | **Actual:** no nssm; Windows Service via Start/Stop-Service; heap cap must go on the tsx/node invocation. **Change:** remove nssm; fix path. |
| High | wrong-fact | Log locations (stdout.log/stderr.log + nginx) | **Actual:** deploy redirects stderr → `C:\ClientIQ\logs\errors.log`; no split logs; no nginx logs. **Change:** replace with errors.log; remove nginx rows. |
| High | wrong-fact | Health check + dialect log | **Actual:** `/api/health` returns `service:'Banking Customer API'`; with SAML on the exact allowlist is `/health`; DB log strings illustrative. **Change:** correct; add SAML allowlist caveat. |
| High | wrong-fact | SAML Invalid Signature (SHA-256 required) | **Actual:** `wantAssertionsSigned=false`, `wantAuthnResponseSigned=false`, `audience=false`, `validateInResponseTo=never`; RSA signs the Response wrapper; failures usually mean a wrong `SAML_CERT`. **Change:** reframe around cert mismatch. |
| Medium | wrong-fact | Missing attributes (`DEBUG=passport:*,saml:*`) | **Actual:** no DEBUG usage; use `LOG_LEVEL=debug`. **Change:** replace tip. |
| Medium | missing | Runtime mode (NODE_ENV) | **Actual:** deployed NODE_ENV=development; mock auth unless SAML on; Vite middleware. **Change:** add prominent note. |
| Medium | missing | SSO failure modes | **Actual:** "Awaiting Role Assignment" from sessions.sid width (fix_sessions_table.sql), last_seen_saml_role overflow (error 2628 → widen script), `SAML_ROLE_ENV` mismatch, missing Branch Manager/BRS role. **Change:** add SSO-stuck subsection. |
| Medium | wrong-fact | Emergency/DB (`Restart-Service ClientIQ`, config\.env, svc_clientiq, backups) | **Actual:** service name is `$(serviceName)`; env inline in generated Start-Server.ps1 (deleted after start); DB user `$(DBUser)`; no in-repo backups scheme. **Change:** correct; flag names for confirmation. |
| Low | stale | Slow API (30s timeout + nginx timing) | **Actual:** 30s requestTimeout is correct; nginx log steps invalid; DMV queries valid. **Change:** keep DMV/timeout; remove nginx timing. |
| Low | stale | ENOTSUP (`HOST=127.0.0.1`) | **Actual:** HOST not read; bind hard-coded `0.0.0.0`; PORT honored. **Change:** note HOST inert. |
| Low | needs-human-input | Escalation contacts/hostnames | **Actual:** placeholders; real hints are portal.fmb.com, HUB-SQL1TST-LIS, F&M Bank. **Change:** confirm with ops. |

---

### 4.8 roles-and-permissions.md — Staleness 38

**Purpose:** Explains the hybrid RBAC + ABAC model: roles, privilege levels, permission codes, UI visibility, protected routes, ABAC, permission resolution, schema, hooks, testing, key files.

**Summary:** Largely accurate on the core model (5 privilege levels, 9 roles, 11 permissions, two-tier resolution, protected admin/account routes). Main problems: it presents the ABAC employee-customer restriction as one coherent, always-enforced control when there's a real frontend/backend threshold split and a SQL Server no-op; it omits enforcement gaps (Notes and deposit-summary/trend are auth-only); it presents `role_change_request`/`role_audit_log` as live when they have no writer; and it retains a Postgres reference and omits `audit_event`.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| High | wrong-fact | ABAC intro + table (`< 2`) | **Says:** restriction is `maxPrivilegeLevel < 2` (levels 0-1); Level 2 = full access. **Actual:** frontend uses `< 2` (CustomerDashboard.tsx:490); backend seed uses `minPrivilegeOverride: 3` (seed.ts:142) → denies 0-2; the doc's own example quotes 3. **Change:** split into two enforcement points with true thresholds; fix the table. |
| High | wrong-fact | "Enforced at both layers" + resolution step 5 | **Says:** backend denies on isEmployee. **Actual:** SQL Server mode no-ops (`permissionService.ts:32-36` returns allowed:true when db null); SQL Server store uses branch/region, not isEmployee. **Change:** add caveat; flag prod enforcement gap. |
| High | missing | Protected routes (enforcement gaps) | **Actual:** Notes CRUD and deposit-summary/trend have no `requirePermission`; no `notes.*` permission; Notes UI has no PermissionGuard. **Change:** add an "Enforcement gaps" subsection. |
| Medium | stale | Audit tables (role_audit_log, role_change_request) | **Actual:** defined but no writer/implementing code; real audit via audit_event + employee_role_history + permission_denial_log. **Change:** annotate as unimplemented. |
| Medium | missing | Schema (audit_event stream) | **Actual:** unified `audit_event` (schema.ts:854-887) + taxonomy (auditEvents.ts) backs the grant/deny events the doc references. **Change:** add audit_event + auditService. |
| Medium | missing | Roles table / SAML (BRS + AD map) | **Actual:** login uses code-based AD-group map (adGroupRoleMap.ts); `BRS` role is referenced but not seeded. **Change:** document the live AD map; flag BRS gap. |
| Low | postgres-reference | Key Files (roleManagement Postgres+SQL) | **Actual:** SQL Server is production (sqlServer.ts); postgres.ts is unused abstraction. **Change:** clarify. |
| Low | stale | Resolution step 6 (permission_denial_log) | **Actual:** two mechanisms; SQL Server insert uses `reason`/`denied_at` vs schema `denial_reason`/`created_at`. **Change:** note the divergence. |
| Low | stale | Role Testing (production guard) | **Actual:** guard only fires if runtime NODE_ENV==='production', but deploys set development; overrides in-memory. **Change:** add caveat. |
| Low | needs-human-input | Header metadata | **Actual:** ownership/review cadence not in code. **Change:** confirm owner + last-reviewed date. |

---

### 4.9 database-design.md — Staleness 68

**Purpose:** SQL Server schema reference for data engineers: tables, relationships, indexes, constraints, triggers, query patterns.

**Summary:** Broadly correct on the core banking tables and correctly targets SQL Server DDL, but undermined by a pervasive "PostgreSQL parity / dual-database" framing. Several concrete claims are false (`full_name` PERSISTED computed; `account.sic_code` FK; `financial_transaction.account_id` NOT NULL; a `debit_card_id` FK that doesn't exist), and the audit relies on fictional migrations `0001-0014` and full-text DDL. Whole domains (Notes, RBAC/audit set, region, SIC junctions) are missing.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | postgres-reference | PostgreSQL Parity Notes | **Says:** complete parity with PostgreSQL; pg_trgm/PL-pgSQL comparisons. **Actual:** SQL Server only; getPgDatabase throws. **Change:** reframe as single SQL Server design; delete the parity section. |
| Critical | wrong-fact | customer `full_name` (PERSISTED computed) | **Actual:** plain `varchar(200)` populated by ETL (schema.ts:114-115; customer.sql:9); no PERSISTED DDL. **Change:** plain column populated on write. |
| Critical | obsolete-section | Migration History 0001-0014 | **Actual:** no migrations/drizzle dir; scripts under `scripts/` + `Insert Queries/Schema Changes/`. **Change:** replace with real inventory. |
| Critical | postgres-reference | Full-Text Search (catalog/index/CONTAINS) | **Actual:** no FTS DDL; SqlServerSearchProvider uses STRING_SIMILARITY/SOUNDEX over `full_name`. **Change:** remove FTS; document real mechanism. |
| High | wrong-fact | account `sic_code` column + FK/index | **Actual:** no such column; SIC via `account_sic_code`/`customer_sic_code` junctions. **Change:** remove; document junctions. |
| High | wrong-fact | financial_transaction `account_id NOT NULL` | **Actual:** nullable; ETL pivots on `account_number` (schema.ts:382-384). **Change:** BIGINT NULL + rationale. |
| High | missing | financial_transaction (no account_number) | **Actual:** `account_number varchar(50)` + `idx_transaction_account_number`; the primary join key. **Change:** add column/index/explanation. |
| High | wrong-fact | financial_transaction `debit_card_id` FK/index | **Actual:** no such column/FK/index (only a stale comment). **Change:** remove or flag as not-implemented. |
| High | missing | Notes tables (none defined) | **Actual:** note/note_version/note_category/note_audit_log + `check_note_one_target` + cif_number. **Change:** add a Notes Module section. |
| High | missing | RBAC coverage (only 5) | **Actual:** larger set incl. saml_role_mapping, role_audit_log, permission_denial_log, history tables, audit_event; `employee_role.assigned_by`. **Change:** add missing tables + provenance. |
| Medium | missing | region table / branch.region_id | **Actual:** region exists; branch has `region_id` FK. **Change:** add region + FK. |
| Medium | wrong-fact | customer `customer_name_type_check` CHECK | **Actual:** enforced in Zod, not a DB CHECK. **Change:** attribute to validation layer. |
| Medium | missing | customer columns | **Actual:** omits language_preference/occupation/employer_name/dba_name/banking codes. **Change:** add them. |
| Medium | missing | employee SSO fields | **Actual:** sso_subject/email/phone/last_seen_saml_role (NVARCHAR(MAX))/deleted_at/modified_by. **Change:** add; fix last_seen type. |
| Medium | wrong-fact | RBAC permission-check query | **Actual:** two-tier (privilege-level inheritance ∪ explicit grants). **Change:** correct resolution model. |
| Medium | wrong-fact | debit_card (no customer_id; 5 profiles; trigger) | **Actual:** NOT NULL `customer_id` FK + indexes; 8 seed profiles; SQL Server ETL uses inline columns; trigger comment-only. **Change:** add customer_id; note two data paths; correct count; mark trigger unverified. |
| Medium | wrong-fact | FK referential actions | **Actual:** `debit_card_id` SET NULL doesn't apply; real CASCADEs on notes module, role_permission, employee_role, saml_role_mapping, history tables; rest NO ACTION. **Change:** list real CASCADEs. |
| Medium | missing | junction/session tables | **Actual:** household_membership B2B fields; entity_contact contact_type_cached; DDL-only sessions table. **Change:** add them. |
| Low | wrong-fact | "39 tables" | **Actual:** 35 pgTables + DDL-only sessions; buckets don't sum. **Change:** recount; fix buckets/date. |
| Low | stale | Query patterns (join on account_id) | **Actual:** join on account_number (account_id nullable). **Change:** update examples + warning. |
| Low | needs-human-input | Compliance/PCI/companion guides | **Actual:** PCI/encryption/consent are governance; last-4 storage is confirmed. **Change:** owner confirms. |

---

### 4.10 saml-configuration.md — Staleness 68

**Purpose:** Operator/admin guide for configuring SAML 2.0 SSO between ClientIQ (SP) and the RSA IdP: env setup, IdP metadata/attributes, role sync, attribute mapping, testing, security, troubleshooting.

**Summary:** Structurally sound and the SP env-var basics are correct, but core sections are materially wrong. The biggest defect is role assignment: it presents the `saml_role_mapping` table with sync modes as THE login mechanism, but that table is dormant and the real path is the convention-based AD-group-name map. Several documented env vars don't exist, and concrete config values (NameID format, `wantAssertionsSigned`, clock skew, an endpoint path) contradict the code.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | obsolete-section | Step 4 Role Mapping (saml_role_mapping table + sync modes) | **Actual:** dormant; `processSamlRole` never called; login uses `mapAdGroupsToRoleNames` (adGroupRoleMap.ts). **Change:** rewrite Step 4 around the AD-group convention; demote the table. |
| Critical | missing | Step 4 (no AD convention / `SAML_ROLE_ENV`) | **Actual:** login depends on `CLIENTIQ_GROUP_RE`, `SAML_ROLE_ENV` scoping, and the "Branch Manager" fallback. **Change:** add these sections. |
| High | wrong-fact | Step 5 (`SAML_ATTR_*` overrides) | **Actual:** none read; hard-coded `ATTRIBUTE_MAP`. **Change:** remove; describe hard-coded map. |
| High | wrong-fact | Step 2 (`SAML_LOGOUT_URL`/`_CALLBACK_URL`/`SAML_DECRYPT_KEY`) | **Actual:** none read; logout derives from `RSA_PORTAL_URL`/`SAML_ENTRYPOINT`; fixed `/saml/logout/callback`. **Change:** remove; document real logout config. |
| High | wrong-fact | Security (Signature Verification) | **Actual:** `wantAssertionsSigned:false`, `wantAuthnResponseSigned:false`; RSA signs the Response wrapper; no `digestAlgorithm`. **Change:** correct. |
| High | wrong-fact | Security (Audience + Clock Skew) | **Actual:** `audience:false`; `acceptedClockSkewMs:10000` (10s); `validateInResponseTo` never. **Change:** correct. |
| High | wrong-fact | Endpoints (`/api/auth/session`) | **Actual:** it's `/api/auth/status`. **Change:** fix path + fields. |
| High | wrong-fact | Security (`SESSION_TIMEOUT`) | **Actual:** not read; 1h rolling cookie + 12h store TTL; only `SESSION_SECRET`. **Change:** remove; state hard-coded. |
| Medium | wrong-fact | Step 3 (NameID emailAddress) | **Actual:** `identifierFormat: persistent`. **Change:** update or document mismatch. |
| Medium | postgres-reference | Step 4 (saml_role_mapping SQL examples) | **Actual:** pgTable; dormant; prod SQL Server. **Change:** flag as PG-abstraction admin table not used at login. |
| Medium | stale | Endpoints (`/saml/login`) + test flow | **Actual:** primary login is `/api/auth/login` static page → RSA portal tile; no in-app SSO button. **Change:** clarify entry points. |
| Medium | missing | Step 2 (missing real vars) | **Actual:** `RSA_PORTAL_URL`, `SAML_ROLE_ENV`, `SAML_DEFAULT_ROLE_NAME`, `SESSION_SECRET`, `SAML_ENABLED`. **Change:** add. |
| Low | stale | Overview/Prereqs (SLO URL) | **Actual:** logout derives from RSA_PORTAL_URL/SAML_ENTRYPOINT; no logout URL var. **Change:** note SLO optional. |
| Low | stale | Troubleshooting (numeric employeeId) | **Actual:** auto-provisioned on first login by sso_subject/email/employee_number. **Change:** update. |
| Low | needs-human-input | Header byline | **Actual:** not verifiable. **Change:** confirm owner/date. |

---

### 4.11 technical-requirements.md — Staleness 68

**Purpose:** EPIC/feature/user-story technical requirements spec across 9 EPICs (data model, search, RBAC, compliance, infrastructure).

**Summary:** Structurally sound (9 EPICs map to real domains) but cross-cutting architecture claims are badly outdated. Largest defect is the dual-database/PostgreSQL framing (trigram search, pg_trgm/GIN, DB_VENDOR provider swap, vendor-parallel migration dirs). Concrete facts are wrong: the customer name rule is Zod (not a DB CHECK), production search is `LIKE`, and the "8 named debit-card limit profiles" exist only in the faker seed. Many EPIC 7 (SAR/OFAC/dispute), EPIC 3 (activation/PIN/fee), and EPIC 9 (health endpoint, migration dirs, rollback scripts) requirements have no code backing.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | postgres-reference | Header/Overview (dual-DB stack) | **Actual:** SQL Server only; getPgDatabase throws. **Change:** SQL Server (production); drop dual-DB framing. |
| Critical | obsolete-section | EPIC 9 (Dual-Database & Infrastructure) | **Actual:** runtime hard-wired to SQL Server; both vendor detectors default to Postgres; no live PG path. **Change:** rewrite as SQL-Server-only infra EPIC. |
| Critical | wrong-fact | EPIC 1 + Appendix (`customer_name_type_check` CHECK/trigger) | **Actual:** Zod discriminated union (schema.ts:907-929). **Change:** attribute to app-level validation. |
| Critical | postgres-reference | EPICs 1/5/9 (trigram / STRING_SIMILARITY / SOUNDEX / 30%) | **Actual:** production is case-insensitive `LIKE` (sqlServerCustomerSearch.ts:103-126). **Change:** rewrite search AC; remove trigram/similarity examples. |
| High | postgres-reference | EPIC 5/9 (pg_trgm GIN; /migrations/postgres + /sqlserver; rollback scripts) | **Actual:** SQL Server DDL scripts; no paired migration dirs; drizzle targets Postgres. **Change:** document the real script workflow. |
| High | wrong-fact | EPIC 3 (8 limit profiles; debit-card triggers) | **Actual:** 8 profiles only in faker seed; SQL Server ETL uses inline limit columns; trigger DDL not in repo. **Change:** scope to dev seed; soften trigger claims. |
| High | wrong-fact | EPIC 1 (trust/estate types; default individual) | **Actual:** Zod accepts individual/premium/regular/business/trust (no estate); default `'regular'`. **Change:** correct type set + default. |
| High | missing | EPIC 7 (compliance machinery) | **Actual:** real surface is RBAC (5 levels/9 roles/11 permissions), audit_event, permission_denial_log, SAML provisioning; no SAR/OFAC/AML code. **Change:** document real RBAC/audit/SAML; mark SAR/OFAC aspirational. |
| High | missing | Whole doc (no SAML/SSO section) | **Actual:** SAML SSO via RSA SecurID, sessions table, AD-group role sync. **Change:** add an Authentication & SSO EPIC. |
| Medium | wrong-fact | EPIC 9 (`/health/database`) | **Actual:** only `/health` allowlisted; no such endpoint/scheduler/metrics. **Change:** remove or mark unimplemented. |
| Medium | wrong-fact | EPIC 4 (timestamps "stored in PST") | **Actual:** process TZ forced to America/Los_Angeles; PST is display, not storage; column is `posting_date`. **Change:** reword; fix column name. |
| Medium | missing | EPIC 4 (financial_transaction) | **Actual:** account_id nullable; account_number pivot; 13-month window; ledger/available_balance_after; source_system/raw_payload/transfer_group_id. **Change:** document. |
| Medium | stale | EPIC 6 (household) | **Actual:** relationship_role + ownership_percentage/control_type/is_head_of_household/parent_household_id/consolidation_method. **Change:** update model. |
| Medium | wrong-fact | EPIC 8 (officer assignment FK) | **Actual:** keyed on `officer_code` string, natural key (customer_id, officer_code); relationship_type ∈ primary/secondary. **Change:** clarify. |
| Medium | wrong-fact | Architecture Summary (Neon PG; shadcn/Tailwind; Drizzle dual) | **Actual:** SQL Server only; MUI-primary; Drizzle is tooling; raw mssql queries. **Change:** correct. |
| Medium | missing | EPIC 3 (card status/type values) | **Actual:** seed statuses active/inactive/blocked/expired; types standard/gold/platinum/business; frozen/canceled not seeded. **Change:** align. |
| Low | wrong-fact | US-1.3.1 badge colors | **Actual:** hex codes unconfirmed (green is #1b4d20, not #2e7d32). **Change:** verify against CustomerOverview.tsx. |
| Low | missing | Search/audit retention / notes | **Actual:** notes auth-only (no RBAC); 7-year retention is policy; role_change_request/role_audit_log unimplemented. **Change:** correct notes; mark retention governance. |
| Low | needs-human-input | Document Control / traceability | **Actual:** metadata governance; several stories map to unbuilt features. **Change:** owner confirms; recompute matrix. |

---

### 4.12 dev-test-server-setup.md — Staleness 62

**Purpose:** Step-by-step guide to stand up a dev/test instance on Windows Server (dev-mode Node via tsx, SQL Server, nginx reverse proxy + TLS, Windows service via NSSM).

**Summary:** Directionally correct on the big picture and correctly avoids Postgres, but built around a nonexistent Nginx proxy and gets several copy-pasteable details wrong: production build output path, SAML ACS URL, `SAML_CERT` format, and several dead env vars. Also omits any DB migration/seed step and `DB_VENDOR`.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| High | wrong-fact | Nginx config (Steps 1-4) | **Actual:** no nginx; ADO PowerShell-Remoting → Windows Service; app HTTP:5000. **Change:** reframe as optional/external terminator; remove prescriptive nginx.conf. |
| High | wrong-fact | Prod-mode `dist/server/index.js` | **Actual:** build → `dist/index.js`; `npm start` runs it. **Change:** correct path; note client → dist/public. |
| High | wrong-fact | SAML ACS `/api/auth/saml/acs` + nginx `/api/auth/saml/` | **Actual:** ACS at top-level `/saml/acs`. **Change:** correct callback URL + proxy location. |
| Medium | wrong-fact | `SAML_CERT` base64 | **Actual:** inline PEM or file path (`./saml_cert.pem`). **Change:** describe correctly. |
| Medium | wrong-fact | `SESSION_COOKIE_SECURE`/`LOG_FORMAT` | **Actual:** not read; secure from NODE_ENV; use LOG_LEVEL. **Change:** remove/mark unused. |
| Medium | wrong-fact | `HOST`/`MSSQL_PORT` + ENOTSUP remedy | **Actual:** both dead; bind hard-coded `0.0.0.0`. **Change:** flag unused; rewrite ENOTSUP remedy. |
| Medium | wrong-fact | NSSM `AppEnvironmentExtra` per-line | **Actual:** single multi-string value; separate calls overwrite. **Change:** set once with newline-separated pairs or use Start-Server.ps1. |
| Medium | wrong-fact | `MSSQL_ENCRYPT=true` | **Actual:** scripts set false; ENCRYPT/TRUST session-store only; main pool encrypt:true + NODE_ENV trust. **Change:** align + clarify scope. |
| Medium | wrong-fact | "NODE_ENV Not Recognized" workaround | **Actual:** repo uses `npx tsx watch server/index.ts`, not `npm run dev`. **Change:** point to Start-Dev.ps1. |
| Medium | missing | No DB schema/migration/seed step | **Actual:** db:push targets Postgres; SQL Server schema/seed is separate. **Change:** add provisioning step. |
| Low | missing | No `DB_VENDOR` | **Actual:** scripts set `DB_VENDOR=mssql`; drives search provider. **Change:** add. |
| Low | stale | nginx `/health` + X-XSS-Protection | **Actual:** real route is `/api/health`; X-XSS deprecated. **Change:** fix if proxy documented. |
| Low | stale | "hot reloading disabled (tsx, not watch)" | **Actual:** deploy uses `tsx watch`. **Change:** align or state deviation. |
| Low | stale | dev.bat vs `npm run dev` | **Actual:** dev.bat tsx-watch is correct; mixes two methods. **Change:** standardize. |
| Low | needs-human-input | Header/version/assumptions | **Actual:** DNS/cert/SQL host/SAML-enable are infra. **Change:** confirm against VG-Test. |

---

### 4.13 sql-server-dba-setup.md — Staleness 62

**Purpose:** DBA runbook for installing, securing, backing up, and maintaining the ClientIQ database on SQL Server.

**Summary:** Correct that SQL Server is production, and the generic DBA mechanics are reusable. But the ClientIQ-specific steps point to nonexistent scripts (`sqlserver-schema-v3.sql`, `sqlserver-test-data-v3.sql`), the table count (39) is wrong (40), the connection string/env block contradict the deploy scripts (Encrypt/Trust inverted, `DB_VENDOR` missing), and it omits every ClientIQ prerequisite script.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | wrong-fact | Step 2 (`database-scripts/v3/schema/sqlserver-schema-v3.sql`) | **Actual:** no such file/dir; schema from manual DDL + `scripts/*.sql` + `Insert Queries/Schema Changes/*.sql`; shared/schema.ts is the type source. **Change:** replace with the real process. |
| Critical | wrong-fact | Step 3 (`sqlserver-test-data-v3.sql`) | **Actual:** no such file; data via `Insert Queries/*.sql` ETL (FK order) or faker seed.ts (Postgres, dev). **Change:** replace with real options. |
| High | wrong-fact | Step 2 ("Expected: 39") | **Actual:** 40 pgTables. **Change:** correct to 40 / list authoritative set. |
| High | wrong-fact | Step 9 (Encrypt=true; TrustServerCertificate=false) | **Actual:** main pool hard-codes encrypt:true + NODE_ENV trust; deploy sets ENCRYPT=false/TRUST=true; those vars affect session store only. **Change:** correct + flag security implication. |
| High | wrong-fact | Step 9 (env block: MSSQL_PORT; no DB_VENDOR) | **Actual:** MSSQL_PORT dead; `DB_VENDOR` needed separately (defaults to Postgres). **Change:** add DB_VENDOR; mark PORT informational. |
| High | missing | Prerequisite scripts | **Actual:** create_sessions_table.sql, create_audit_event_table.sql, create_performance_indexes.sql; sessions user needs db_datareader/writer/ddladmin. **Change:** add a prerequisite-scripts section. |
| High | missing | SAML/RBAC bootstrap | **Actual:** ensure_branch_manager_role.sql, ensure_rbac_provenance_columns.sql, widen_employee_last_seen_saml_role.sql (error 2628); role rows must exist for adGroupRoleMap names. **Change:** add an RBAC/SAML bootstrap section. |
| Medium | missing | Schema-change migrations | **Actual:** financial_transaction add/backfill account_number; note_add_cif_number; account_id nullable. **Change:** add migrations subsection. |
| Medium | stale | Overview/Step 9 (deployment model) | **Actual:** Windows Service, tsx watch, NODE_ENV=development, port 5000, trust-any-cert; deploys from ADO branches. **Change:** add "how the app connects" note. |
| Low | stale | Step 4 (read-only role nesting) | **Actual:** example DDL, backwards nesting. **Change:** simplify. |
| Low | stale | Step 4 (RLS example) | **Actual:** app enforces RBAC/ABAC in code, not SQL RLS; predicate conflates region/branch. **Change:** mark illustrative. |
| Low | needs-human-input | Support/maintenance/drive paths | **Actual:** governance/infra. **Change:** owner confirms. |

---

### 4.14 clientiq-overview.md — Staleness 58

**Purpose:** Product/architecture overview wiki: core features, search, data model, tech stack, design system, test data, differentiators.

**Summary:** The feature narrative is broadly accurate, but the doc is badly outdated on infrastructure and data facts: it frames the system as a live dual-database platform with trigram fuzzy search; several numbers/claims are wrong (505 vs 1200 seed customers, primary color #2e7d32 vs #1b4d20, "PostgreSQL triggers," a nonexistent CI/CD governance section); and it omits the SAML/AD-group RBAC system.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | postgres-reference | Intelligent Hybrid Search / examples | **Says:** trigram/phonetic fuzzy ("Smyth"→"Smith" 33%). **Actual:** case-insensitive `LIKE` substring (sqlServerCustomerSearch.ts:103-126). **Change:** replace with real behavior; remove the example. |
| Critical | postgres-reference | Dual-database support / Key Differentiator #5 | **Actual:** SQL Server only; getPgDatabase throws. **Change:** reframe as internal abstraction; delete #5. |
| High | postgres-reference | Data Quality (PG triggers / GIN) | **Actual:** SQL Server computed/persisted columns, nonclustered indexes, SQL Server triggers. **Change:** replace. |
| High | wrong-fact | Test Data (505; 90+ days) | **Actual:** seed generates 1200 across individual/business/trust/estate; ETL loads 13 months. **Change:** correct counts/window; add estate. |
| High | wrong-fact | CI/CD Governance / Key Differentiator #6 | **Actual:** no pre-commit/npm-audit/contract/architecture framework; real is ADO + SonarQube + OWASP ZAP. **Change:** rewrite to real CI/CD. |
| High | missing | Architecture (no Auth/RBAC/SAML) | **Actual:** SAML SSO, AD-group→role, 5 levels/9 roles/11 permissions, requirePermission, PermissionGuard, audit_event. **Change:** add a Security/Access-Control section. |
| Medium | wrong-fact | Color palette (#2e7d32) | **Actual:** primary is #1b4d20 (theme.ts:7,13); secondary #936b06 correct. **Change:** fix primary. |
| Medium | stale | Frontend (MUI + shadcn co-equal) | **Actual:** MUI-primary; shadcn mostly unused scaffolding. **Change:** clarify. |
| Medium | stale | QoQ analytics (90-day; hard-coded figures) | **Actual:** feature real; figures illustrative; window unverified; tx spans 13 months. **Change:** mark placeholders; cite window. |
| Low | wrong-fact | Account types (Credit cards) | **Actual:** debit-card seeded; credit-card unverified. **Change:** verify or mark planned. |
| Low | stale | State Mgmt/Routing (React Query) | **Actual:** TanStack Query v5; Wouter fine. **Change:** optional rename. |
| Low | needs-human-input | Header metadata | **Actual:** date/owner unverifiable. **Change:** confirm; re-baseline. |

---

### 4.15 database-to-ui-field-mapping.md — Staleness 58

**Purpose:** Maps `shared/schema.ts` columns to the React/MUI components, endpoints, transformations, calculated fields, and formatters that display them.

**Summary:** Structurally sound and covers the right domains, but a large fraction of concrete details have drifted: wrong endpoints (engagement, deposit-analytics), wrong masking formats, wrong primary components (maps to unwired/commented-out AccountCard/TotalRelationshipSummary/HouseholdRelationships), a stale line count, and multiple stale field/function names. No PostgreSQL claims. Reliable as a map of *what* is displayed, unreliable on *where/by-what-name*.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| High | wrong-fact | ClientEngagement endpoint | **Says:** `/engagement`. **Actual:** `/client-engagement` (ClientEngagement.tsx:48; routes.ts:1740). **Change:** replace everywhere. |
| High | wrong-fact | Deposits endpoint | **Says:** `/deposit-analytics` + analytics.balanceByType. **Actual:** `/deposit-summary` + `/deposit-trend`, summary.balanceByType. **Change:** update; note legacy route. |
| High | obsolete-section | TotalRelationshipSummary section | **Actual:** render commented out; live band is Middle.tsx consuming `/relationship-summary`. **Change:** re-point to Middle.tsx. |
| High | wrong-fact | Household → HouseholdRelationships | **Actual:** rendered by pages/HouseholdPage.tsx; HouseholdRelationships not on an active route. **Change:** re-attribute. |
| Medium | wrong-fact | taxIdentifier mask (`****-**-XXXX` @237) | **Actual:** UI `***-**-<last4>` (CustomerOverview.tsx:271); adapter `XXX-XX-<last4>`. **Change:** correct format + line. |
| Medium | wrong-fact | accountNumber mask (`****1234` in AccountCard) | **Actual:** `***`+last 5 (AccountList.tsx:188-190). **Change:** fix mask + relocate helpers. |
| Medium | wrong-fact | Account fields → AccountCard | **Actual:** AccountCard unwired; live are AccountList/AccountSummaryTableVersion/AccountDetailOption2. **Change:** re-attribute. |
| Medium | wrong-fact | averageBalance → Deposits | **Actual:** rendered in AccountDetailOption2.tsx:282. **Change:** re-attribute. |
| Medium | wrong-fact | createdByEmployeeName | **Actual:** `authorEmployeeName` on note_version (schema.ts:612). **Change:** rename. |
| Medium | wrong-fact | Officer fields | **Actual:** Officers.tsx renders only name/title/department/isPrimary. **Change:** trim; document isPrimary derivation. |
| Medium | wrong-fact | transactionIcon (type/categoryId) | **Actual:** keyed on `transactionCode` (TransactionHistory.tsx:106-150). **Change:** fix source. |
| Medium | stale | Aggregation code (lines 164-172) | **Actual:** lines 170-178; `\|\| 0` guard; labels Deposits/Spending/Net. **Change:** update snippet + labels. |
| Medium | stale | getPieData (lines 111-134) | **Actual:** lines 182-207; summary.balanceByType. **Change:** update. |
| Medium | wrong-fact | Formatters (formatCompactDate; 4.25%) | **Actual:** no formatCompactDate; formatPercentage defaults 4 decimals (`4.2500%`); add formatDateTimeWithTZ/formatCurrencyCompact. **Change:** fix. |
| Low | stale | Formatter location / utilities | **Actual:** formatCurrency/formatPercentage also in helpers.tsx; mask helpers in AccountList.tsx. **Change:** note dual location. |
| Low | wrong-fact | financialTransaction lines 378-419 | **Actual:** 380-425. **Change:** update. |
| Low | missing | Transaction field mappings | **Actual:** account_number pivot; counterparty/transfer_group/source_system/raw_payload. **Change:** note pivot + operational cols. |
| Low | stale | householdMembership lines 248-268 | **Actual:** ~249-269. **Change:** update. |
| Low | wrong-fact | Schema line count (1,512) | **Actual:** 1,599. **Change:** update. |
| Low | wrong-fact | NotesTab / NoteVersionHistoryModal | **Actual:** NotesTab not imported; live is NotesSection. **Change:** drop NotesTab. |
| Low | needs-human-input | Version footer | **Actual:** "Dec 2024" vs "Apr 2026"; "v3" unverifiable. **Change:** reconcile. |

---

### 4.16 on-premises-deployment.md — Staleness 55

**Purpose:** Operator overview/index for on-prem deployment to Windows Server + SQL Server: architecture, doc index, checklist/steps, requirements, ports, contacts.

**Summary:** Broadly correct on the stack but wrong/silent on how the app is actually run and fronted: presents Nginx as the reverse proxy (none exists); omits the ADO/branch-based deploy model and the `tsx watch`/`NODE_ENV=development` runtime; misnames the RSA IdP; and omits key operational realities (session-table DDL prerequisite, out-of-band SQL scripts).

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | wrong-fact | Architecture (Nginx SSL termination) | **Actual:** no nginx; HTTP:5000; external terminator unspecified; only in-repo proxy is `/streamlit`. **Change:** remove nginx; reframe. |
| Critical | missing | Application Deployment step | **Actual:** ADO pipeline, deploy from ADO branches (not GitHub main), PowerShell-Remoting, `npm ci` commit-gate, two prod servers. **Change:** add an ADO pipeline section. |
| Critical | wrong-fact | Production run of Node app | **Actual:** `npx tsx watch` from source, NODE_ENV=development; Vite middleware; mock auth unless SAML on. **Change:** call out the dev-mode runtime + consequences. |
| High | wrong-fact | RSA IdP name | **Actual:** RSA SecurID Access (portal.fmb.com), tile-launched, Response-wrapper signed. **Change:** correct name + specifics. |
| High | missing | Database Setup step | **Actual:** schema via standalone scripts; create_sessions_table.sql required for SAML; ensure/widen scripts for RBAC/SAML. **Change:** add SQL Server provisioning subsection. |
| High | missing | SAML role-mapping detail | **Actual:** AD-group convention, `SAML_ROLE_ENV` per env, Branch Manager fallback, `saml_role_mapping` dormant. **Change:** add. |
| High | missing | Env-var reference caveats | **Actual:** dead vars (HOST/MSSQL_PORT/SAML_ENTITY_ID/SAML_IDP_INITIATED_URL); ENCRYPT/TRUST session-store only. **Change:** add caveats. |
| Medium | missing | Security-scanning step | **Actual:** SonarQube SAST (develop), OWASP ZAP DAST (post-Test), private Nexus. **Change:** add. |
| Medium | stale | Port 5000 (127.0.0.1) | **Actual:** binds `0.0.0.0`; HOST ignored; isolation via firewall. **Change:** correct. |
| Medium | needs-human-input | Version History (2.0.0) | **Actual:** app is package.json 1.0.0. **Change:** clarify doc vs app version. |
| Low | needs-human-input | Support contacts / `yourbank.com` | **Actual:** real org is F&M Bank (portal.fmb.com). **Change:** replace placeholders. |
| Low | missing | Streamlit integration | **Actual:** `/streamlit` proxy (auth guard commented out). **Change:** document or scope out. |

---

### 4.17 data-grooming.md — Staleness 48

**Purpose:** Instructs the Data team which tables to populate (FK order, copy-paste SQL) so RBAC-gated and relationship features work in a test environment.

**Summary:** The RBAC core (Steps 1-5) is accurate against seed.ts/schema.ts. Main weakness: one generic "load everything" recipe that conflates the faker/dev seed (Postgres abstraction) with the real SQL Server ETL (`Insert Queries/*.sql` → ClientIQPreProd), and many listed tables have no SQL Server ETL loader. It also omits that RBAC must be bootstrapped separately, misstates the debit_card model for SQL Server, and overstates what "employee customer protection" enforces.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| High | missing | Whole doc (one generic recipe) | **Actual:** two disjoint paths — faker seed.ts (Postgres) vs `Insert Queries/*.sql` (SQL Server). **Change:** add an up-front distinction; point to the real ETL files. |
| High | missing | 32-step load order (tables with no ETL) | **Actual:** region, sic_code family, debit_card_limit_profile, entity_contact, note/note_version, online_banking_*, employee_branch have no SQL Server loader. **Change:** mark each "no ETL"; keep only loaded tables. |
| High | missing | Priority 0 RBAC bootstrap | **Actual:** ETL never touches RBAC; needs ensure_branch_manager_role.sql, ensure_rbac_provenance_columns.sql, widen_employee_last_seen_saml_role.sql. **Change:** add bootstrap note. |
| High | wrong-fact | debit_card_limit_profile dependency | **Actual:** SQL Server debit_card uses inline limit columns, no limit_profile_id (debit_card.sql:7-9). **Change:** remove dependency for SQL Server path. |
| Medium | stale | Employee-customer protection scenario | **Actual:** rule attaches only to `transaction.view` (priv ≥3); SQL Server enforcement likely gapped; no is_employee data generated. **Change:** narrow + warn; note manual is_employee. |
| Medium | missing | permission attributeConfig payload | **Actual:** transaction.view meaning lives in its conditions JSON. **Change:** document payload; note SQL Server `conditions` vs `attribute_config` divergence. |
| Medium | stale | transaction_category key columns | **Actual:** `category_code` is the load/join key (financial_transaction.sql:40-41); SQL-Server-only column. **Change:** add category_code. |
| Medium | missing | Notes RBAC gating | **Actual:** no `notes.*` permission; notes auth-only; note/note_version have no ETL loader. **Change:** note auth-only + missing loaders. |
| Low | missing | financial_transaction (time-box + account_number) | **Actual:** last 13 months; add/backfill account_number Schema Changes are prerequisites. **Change:** add. |
| Low | stale | region row | **Actual:** region not loaded; branch.region_id left NULL. **Change:** clarify. |
| Low | stale | Header date/reference | **Actual:** referenced files exist; markdown vs PDF dates diverge. **Change:** reconcile; keep references. |
| Low | needs-human-input | employee_role manual inserts | **Actual:** SAML/AD-group sync drives roles by name; `BRS` not seeded. **Change:** note; flag BRS role decision. |

---

### 4.18 deployment-plan.md — Staleness 45

**Purpose:** Governance/process deployment plan defining the Dev→Test→Pre-Prod→Prod flow, gates, roles, branching, per-env deploy/rollback, and required docs.

**Summary:** A solid process framework; much of it (cadence, roles, gates, rollback philosophy, required docs) still holds. But concrete technical claims are out of date: the branching model (`develop`/`release/x.y`/`main`) does not match the pipeline (`develop`/`test`/`preprod`/`prod`), and the "same commit/build promoted Test→Prod" rule contradicts the ADO pipeline (fresh build per branch; Prod deploys from the `prod` branch). Several realities are undocumented (SQL Server only, two prod servers, tsx-watch/dev runtime, `npm ci` commit gate, SonarQube/OWASP ZAP).

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| Critical | wrong-fact | §4 branching (develop/release/main) | **Actual:** develop/test/preprod/prod (azure-pipelines.yml:106,131,177,203,229); no release/main. **Change:** replace table; note GitHub main is not a deploy source. |
| High | wrong-fact | §4 Key Rule ("same build Test→Prod") | **Actual:** each branch triggers its own build; Prod from `prod` branch, rebuilt per branch. **Change:** correct or note pipeline doesn't build-once. |
| High | missing | §2 (DB engine not named) | **Actual:** SQL Server only; per-env MSSQL_* dbs. **Change:** name SQL Server explicitly. |
| High | stale | §6/8/11 (migrations) | **Actual:** no pipeline DB-migration step; drizzle-kit targets Postgres; SQL Server changes out-of-band. **Change:** clarify how SQL Server schema changes are applied. |
| Medium | missing | §8 (single prod target) | **Actual:** two prod stages (Deploy_Prod + Deploy_Prod2, VG-Prod/VG-Prod2). **Change:** document two-node deploy. |
| Medium | missing | §3/6 (SAST/DAST tools) | **Actual:** SonarQube (develop), OWASP ZAP (post-Test, zero-high gate). **Change:** name tools + placement. |
| Medium | missing | §5/6/8 (deploy target/runtime) | **Actual:** Windows Service in C:\ClientIQ via PowerShell Remoting; `tsx watch`; port 5000. **Change:** add technical note. |
| Medium | stale | §9 (redeploy prior artifact) | **Actual:** node_modules excluded; deps refreshed only on `npm ci` commit. **Change:** add rollback caveat. |
| Medium | missing | §5/6/8 (dependency install) | **Actual:** `npm ci` gated on commit message; private Nexus. **Change:** document convention. |
| Low | wrong-fact | §2 Pre-Prod ("Entry into TEST") | **Actual:** copy-paste label. **Change:** rename to PRE-PROD. |
| Low | stale | §6 (duplicate criterion) | **Change:** remove duplicate. |
| Low | stale | §7 heading mismatch | **Change:** rename to Pre-Deployment Checklist. |
| Medium | needs-human-input | §1/3/7 (cadence, RACI, CAB) | **Actual:** governance not in code. **Change:** owner confirms. |
| Low | needs-human-input | §2 (data masking) | **Actual:** masking/prod-data policy is data governance. **Change:** data governance confirms. |

---

### 4.19 active-directory-groups.md — Staleness 45

**Purpose:** Operational registry of the AD security groups that grant access to ClientIQ, listing each pre-prod group's name, purpose, data classification, and business owner.

**Summary:** The group names are largely accurate and match the code's convention-based mapper, so it's not badly wrong — but substantially incomplete. It never explains how a group maps to a role, omits the naming convention, `SAML_ROLE_ENV` scoping, access-suffix meaning, and the GEN entitlement, and omits the production (PRD) group set. There's a naming inconsistency around the admin group and it obscures that DataAnalyst/BusinessBanker don't get their own app roles.

| Severity | Category | Location | Doc says → Actual → Recommended change |
|---|---|---|---|
| High | missing | Whole doc (no role-mapping column) | **Actual:** convention mapper AD_GROUP_TOKEN_TO_ROLE (adGroupRoleMap.ts:41-58). **Change:** add resolved role + privilege per group. |
| High | missing | No naming-convention/env-scoping | **Actual:** `<PREFIX>_<ENV>_APP_ClientIQ_<RoleToken>_<Access>`; suffix ignored; `SAML_ROLE_ENV` scopes per deploy (STG for preprod). **Change:** add a convention/scoping section. |
| Medium | missing | Production group set | **Actual:** prod honors PRD-segment groups (SAML_ROLE_ENV=PRD). **Change:** add Production Groups or scope the page to pre-prod. |
| Medium | wrong-fact | AppAdmin_ADM group name | **Actual:** admin token is APPSVCS in preprod (CTRL_PRE_..._APPSVCS_ADM), AppAdmin elsewhere; both → System Admin. **Change:** reconcile; document both tokens. |
| Medium | stale | DataAnalyst_RO | **Actual:** dataanalyst → Teller (priv 1). **Change:** clarify. |
| Medium | stale | BusinessBanker_RW | **Actual:** → BRS (priv 2); BRS not seeded → fallback if absent. **Change:** state role + dependency. |
| Low | missing | IAM RSA GEN_EXEC | **Actual:** GEN is access-only, maps to no role → default fallback. **Change:** explain. |
| Low | missing | Default-role/unmatched behavior | **Actual:** unmatched → default fallback (Branch Manager). **Change:** add note. |
| Low | needs-human-input | Owner / Data Classification | **Actual:** governance, not in code. **Change:** IAM/AD governance confirms. |

---

## 5. Docs Needing Human Input

The following items are **governance/ownership/infrastructure facts that cannot be derived from code** and must be confirmed by their owners before publication:

- **Document metadata (nearly every doc):** reconcile contradictory "last updated" dates (e.g. body "Dec 2024" vs header "Apr 14, 2026"), confirm owners/approvers, and set a "last reviewed against code" date. Confirm the "ClientIQ v3" / doc-version-2.0.0 strings against the real app version (`package.json` = 1.0.0).
- **Reverse proxy / TLS terminator (architecture, on-premises-deployment, ssl-dns-setup, windows-server-setup, dev-test-server-setup, troubleshooting):** confirm what actually fronts port 5000 (the repo has no Nginx/IIS config) and the internal CA, wildcard-cert availability, and cert renewal ownership.
- **Per-environment FQDNs / DNS (ssl-dns-setup, architecture):** confirm the real `*-clientiq.fmb.com` hostnames bound to `$(SAMLHost)` per env; replace `yourbank.com`/`.fmb.internal` placeholders.
- **Support contacts & SLAs (on-premises-deployment, troubleshooting, sql-server-dba-setup):** confirm escalation tiers, on-call SLAs, and email aliases.
- **Deployment governance (deployment-plan):** confirm cadence, rotating Release Lead, CAB applicability, DBA/App-Services segregation of duties, and Bank Security sign-off. Confirm data-masking posture per environment (compliance-sensitive).
- **DBA infrastructure (sql-server-dba-setup):** confirm drive layout (D:/E:/F:), backup cadence, and Always-On/AG topology on the real hosts.
- **AD group governance (active-directory-groups):** confirm group Owners and Data Classification, the preprod admin-group token (APPSVCS vs AppAdmin), and whether a `BRS` role row must be created in SQL Server (not created by seed).
- **Capacity/growth projections (database-erd):** confirm row-count and growth estimates.
- **Compliance posture (database-design, technical-requirements):** confirm PCI-DSS/encryption-at-rest/consent claims and the 7-year audit-retention policy; validate companion-doc references.
- **NODE_ENV in production (multiple):** confirm whether the Windows service overrides `NODE_ENV=development` at the service level — this cannot be verified from the repo and has real security implications (secure cookies, cert trust, mock-auth gating).

---

## 6. Next Step

On approval, each document will be **rewritten to `docs/latest/<name>.md`** (per the proposed filenames in the ranking table) with the corrections above applied and grounded in code citations, then **generated as a `.docx`** for distribution. Two artifacts — the aspirational `enterprise-architecture.txt` blueprint and the stale routing/UI guide — are recommended for **retirement or full regeneration** rather than incremental edits. The structured findings backing this report are saved to `docs/latest/gaps.json` for the rewrite phase to consume.
