# ClientIQ / Banking Client 360: Troubleshooting & Incident Runbook

_Last reviewed: 2026-07-02. Source of truth: application code_

## Purpose / Overview

This runbook is for operators and on-call support diagnosing runtime problems in ClientIQ (a.k.a. Banking Client 360), the on-prem banking customer-360 CRM. It covers the app process, the reverse-proxy / TLS tier, the SQL Server database, SAML SSO, and performance.

Before you follow any step, internalize four facts about how ClientIQ actually runs. Most stale-doc mistakes come from assuming otherwise.

- **Runtime is `tsx watch` from TypeScript source, not a compiled build.** Every environment (dev, test, preprod, prod, prod2) is launched by a generated `C:\ClientIQ\Start-Server.ps1` that runs `npx tsx watch --clear-screen=false server/index.ts` (`PipelineTemplates/start-script.yml:48`). There is no `dist/server/index.js` in production; commands that reference it will fail.
- **`NODE_ENV=development` on every deployed server** (`PipelineTemplates/start-script.yml:16`). Consequences: the app serves via **Vite dev middleware** (not `serveStatic`), the session cookie is **not** `secure`, the main SQL pool sets `trustServerCertificate=true`, log level defaults to `debug`, dev-only debug routes are active, and if `SAML_ENABLED` is not `true` the app falls into **mock auth** (`req.employeeId = 1`, "Sarah Johnson, System Admin", `server/index.ts:56-61`).
- **Database is Microsoft SQL Server only**, in every environment. Search is a case-insensitive `LIKE` substring match.
- **The TLS terminator / reverse proxy in front of the Node app is IIS** (Internet Information Services on Windows Server). IIS terminates TLS and reverse-proxies to the Node process on plain HTTP port `5000`. The exact IIS site bindings, ARR configuration, and certificate paths are **not** in this repo. See [CONFIRM] flags below.

### Environments and SSO

| Env | App servers | SSO (SAML) | `SAML_ROLE_ENV` | Deploy branch (Azure DevOps) |
|-----|-------------|------------|-----------------|------------------------------|
| dev | 1 | **off** (`SAML_ENABLED=false`, mock auth) | `DEV` | `develop` |
| test | 1 | **off** (`SAML_ENABLED=false`, mock auth) | `TST` | `test` |
| preprod | 1 | **on** | `STG` | `preprod` |
| prod | 2 (`Deploy_Prod` + `Deploy_Prod2`) | **on** | `PRD` | `prod` |

CI/CD is **Azure DevOps**, deploying via PowerShell Remoting to a **Windows Service** on each target host. Pushing GitHub `main` deploys nowhere. Prod runs two app servers.

> **[CONFIRM]** Exact prod load-balancer / topology fronting `Deploy_Prod` and `Deploy_Prod2`, and how the IIS tier or LB distributes traffic across them.

---

## 1. Quick diagnostics

### 1.1 Health check

The app exposes `GET /api/health` (`server/routes.ts:3133`). It returns:

```json
{ "status": "healthy", "timestamp": "2026-07-02T…Z", "service": "Banking Customer API" }
```

Note the `service` string is literally `"Banking Customer API"`, not `"ClientIQ"`.

```powershell
# Direct to the Node process (bypasses IIS), run on the app server
Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method GET

# Through IIS / TLS from a client
Invoke-RestMethod -Uri "https://<clientiq-fqdn>/api/health" -Method GET
```

> **[CONFIRM]** The real external FQDN for each environment (used in the second command).

**Auth gate caveat (preprod/prod).** When SAML is enabled, the global `authGate` only exact-allowlists the path `/health` (plus `/favicon.ico`) and the prefixes `/api/auth/`, `/saml/`, `/assets/`, `/IdPServlet` (`server/middleware/authGate.ts:9-16`). `/api/health` is **not** on the exact allowlist. It is treated as an API path, so an unauthenticated caller receives a `401` JSON response rather than the health payload. If you need an unauthenticated liveness probe under SSO, the guaranteed-open path is `/health` at the IIS/infra layer; confirm what (if anything) is wired there.

> **[CONFIRM]** Whether a `/health` endpoint is served by IIS or an infra probe, since the app itself only defines `/api/health`.

### 1.2 Service and process status

The app runs as a **Windows Service** whose name is a pipeline variable `$(serviceName)` (`PipelineTemplates/deploy-nodejs.yml:9-11,22,36`). It is **not** literally named `ClientIQ`.

> **[CONFIRM]** The actual Windows Service name per host (the `$(serviceName)` value). Substitute it for `<ClientIQ-Service>` everywhere below.

```powershell
# Service state
Get-Service -Name "<ClientIQ-Service>" | Format-List Name, Status, StartType

# The Node process backing it
Get-Process -Name "node" | Select-Object Id, StartTime, @{n='WS_MB';e={[math]::Round($_.WorkingSet64/1MB)}}, CPU

# Confirm the listener is up on 5000
Test-NetConnection -ComputerName localhost -Port 5000
```

### 1.3 Log locations

The generated `Start-Server.ps1` redirects **stderr only** to a single file (`PipelineTemplates/start-script.yml:48`): `... 2> C:\ClientIQ\logs\errors.log`. There is no `stdout.log`/`stderr.log` split.

| Component | Path | Notes |
|-----------|------|-------|
| App errors (stderr) | `C:\ClientIQ\logs\errors.log` | Only file the start script writes. |
| App stdout | (not redirected) | Goes to the service/console host unless separately captured. |
| Windows events | Event Viewer → Windows Logs → Application | Service start/stop failures land here. |
| IIS logs | (IIS-managed) | For 502/504/TLS at the proxy tier, see §4. |

> **[CONFIRM]** The IIS site log directory (default `%SystemDrive%\inetpub\logs\LogFiles\`) and whether stdout is captured anywhere (e.g. by the service wrapper).

### 1.4 Log level and app logging

Logging is the app's own structured logger (`server/services/logger.ts`), thresholded by `LOG_LEVEL` (`server/services/loggerConfig.ts:7`). Default is `debug` when `NODE_ENV=development` (which is every deployed server) and `info` otherwise. To raise verbosity, set `LOG_LEVEL=debug` in the environment; there is **no** `DEBUG=passport:*,saml:*` knob. No code reads a `debug`-package `DEBUG` variable.

```powershell
# Tail app errors
Get-Content "C:\ClientIQ\logs\errors.log" -Tail 50 -Wait

# Aggregate error/warn lines by level
Get-Content "C:\ClientIQ\logs\errors.log" |
    Select-String -Pattern "\b(error|warn)\b" |
    Group-Object { $_.Matches.Value } |
    Sort-Object Count -Descending
```

### 1.5 Database connectivity

```powershell
# Network reachability to SQL Server (default port 1433)
Test-NetConnection -ComputerName "<sql-server-host>" -Port 1433

# Round-trip query (use the app's DB login)
Invoke-Sqlcmd -ServerInstance "<sql-server-host>" -Database "<db-name>" -Query "SELECT 1 AS ok"
```

Connection parameters come from `MSSQL_SERVER` / `MSSQL_DATABASE` / `MSSQL_USER` / `MSSQL_PASSWORD` (with `DB_*` fallbacks). Defaults when unset: server `localhost`, database `ClientIQ` (`server/dbConnection.ts:23-26`). The main pool sets `connectTimeout=30000` and `requestTimeout=30000` ms (`server/dbConnection.ts`).

> **[CONFIRM]** The real SQL Server host/instance and database name per environment. In dev the local script points at `HUB-SQL1TST-LIS` / `ClientIQdev`; production values come from ADO variable groups and are not in the repo.


---

## 2. Application issues

### 2.1 `'NODE_ENV' is not recognized` (Windows)

**Symptom:** `'NODE_ENV' is not recognized as an internal or external command`.

**Cause:** Unix-style inline env syntax (`NODE_ENV=development npm run dev`) does not work in PowerShell or cmd.

**Fix (PowerShell):**

```powershell
$env:NODE_ENV = "development"
npm run dev
```

**Fix (cmd):**

```bat
set NODE_ENV=development && npm run dev
```

In practice you rarely run `npm run dev` on a server; deployed hosts are launched by `C:\ClientIQ\Start-Server.ps1`, which sets `NODE_ENV` itself.

### 2.2 `ENOTSUP: operation not supported on socket 0.0.0.0:5000`

**Symptom:**

```
Error: listen ENOTSUP: operation not supported on socket 0.0.0.0:5000
  code: 'ENOTSUP', syscall: 'listen', address: '0.0.0.0', port: 5000
```

**Cause:** The Windows network stack on this host rejects binding to `0.0.0.0:5000`.

**Important: `HOST` is a dead env var.** The listen host is hard-coded to `"0.0.0.0"` in `server/index.ts:99-102`; the process never reads `process.env.HOST`. Setting `HOST=127.0.0.1` (as the start scripts do) has **no effect** on the bind. The old "set `HOST=127.0.0.1`" workaround does not work here.

**Fix options:**

1. Resolve the host-level cause (Winsock/network provider conflict, a filtering LSP, or a stale reservation). Check for a conflicting reservation: `netsh interface ipv4 show excludedportrange protocol=tcp`.
2. Free port 5000 if another process holds it (see §2.4, `EADDRINUSE`).
3. If binding to `0.0.0.0` genuinely cannot be supported on this host, the bind address must be changed in code (`server/index.ts` listen block); `HOST` cannot do it. Escalate to Development rather than editing production source in place.

### 2.3 Application won't start / process exits immediately

**Symptoms:** service fails to start, or the Node process exits right after launch.

**Diagnostic steps:**

```powershell
# 1. Service detail
Get-Service -Name "<ClientIQ-Service>" | Format-List *

# 2. Error log
Get-Content "C:\ClientIQ\logs\errors.log" -Tail 80

# 3. Reproduce manually from the install root (matches the deploy launch)
Set-Location "C:\ClientIQ"
npx tsx server/index.ts
```

Running `npx tsx server/index.ts` in the foreground surfaces the startup exception directly. Do **not** run `node dist/server/index.js`; that path does not exist in this deployment (the app runs from TypeScript source via `tsx`).

**Common causes:**

| Error | Cause / fix |
|-------|-------------|
| `Cannot find module …` | `node_modules` missing. It is **excluded from the build artifact** and only reinstalled on deploy when the commit message contains the literal string `npm ci` (`PipelineTemplates/deploy-nodejs.yml:25-32`). Remediate by running `npm ci --prefer-offline` in `C:\ClientIQ` (the deploy uses the private Nexus registry; the generated `.npmrc` is removed after install). |
| `EADDRINUSE :5000` | Port 5000 already in use, see §2.4. |
| `SAML_CERT is required when SAML is enabled` | `SAML_CERT` unset while `SAML_ENABLED=true` (`server/auth/samlStrategy.ts:16-19`). Set it to `./saml_cert.pem` (deploy default) or an inline PEM. |
| `SAML_CALLBACK_URL` / `SAML_ENTRYPOINT` undefined at startup | Required (non-null asserted) when SAML is on (`server/auth/samlStrategy.ts:129-130`). Missing values crash strategy construction. |
| `SESSION_SECRET` missing under SSO | Required (non-null asserted) when SAML is on (`server/auth/session.ts:34`). |
| Database connection failed | See §3. |
| `ENOTSUP` | See §2.2. |

### 2.4 Port 5000 already in use (`EADDRINUSE`)

```powershell
# Find the PID holding 5000
Get-NetTCPConnection -LocalPort 5000 -State Listen |
    Select-Object LocalAddress, LocalPort, OwningProcess

# Identify and (if it's a stale ClientIQ node) stop it
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000 -State Listen).OwningProcess
```

Port 5000 is the only un-firewalled port and serves both API and client (`server/index.ts:94-104`); all other ports are firewalled at the host/infra level.

### 2.5 High memory usage

**Symptoms:** Node working set climbing well past normal; app becomes sluggish or unresponsive.

**There is no `nssm`** in this deployment; do not use `nssm set … AppParameters`. The app is a plain Windows Service launched through `C:\ClientIQ\Start-Server.ps1`, which runs `tsx watch server/index.ts`.

```powershell
# Watch working set over time
while ($true) {
    Get-Process -Name "node" | Select-Object @{n='WS_MB';e={[math]::Round($_.WorkingSet64/1MB)}}, CPU
    Start-Sleep -Seconds 60
}
```

If you must cap the V8 heap, apply it via `NODE_OPTIONS` in the environment the service uses, e.g. add `NODE_OPTIONS=--max-old-space-size=2048` to the generated `Start-Server.ps1` (regenerated by the pipeline on next deploy, so make the change in `PipelineTemplates/start-script.yml` for persistence). Do **not** point Node at `dist/server/index.js`.

> **[CONFIRM]** Any per-host memory ceiling / capacity expectations for the app tier.

### 2.6 Slow API responses

**Symptoms:** API calls take seconds; occasional timeouts. Note the SQL pool aborts requests after 30 s (`requestTimeout=30000`, `server/dbConnection.ts`), so "Execution Timeout Expired" from the DB layer maps to that 30 s cap.

```powershell
# 1. Scan app logs for slow/timeout/error markers
Select-String -Path "C:\ClientIQ\logs\errors.log" -Pattern "slow|timeout|error" -Context 2,5
```

For the reverse-proxy view of request timing, inspect the **IIS** logs (§4).

Then check SQL Server (these DMV queries are valid against SQL Server):

```sql
-- Top 10 slowest cached queries by average elapsed time
SELECT TOP 10
    qs.total_elapsed_time / qs.execution_count AS avg_us,
    qs.execution_count,
    SUBSTRING(st.text, 1, 200) AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY avg_us DESC;
```

See §3.4 for missing-index and blocking diagnostics.

---

## 3. Database issues (Microsoft SQL Server)

### 3.1 Connection refused (`ECONNREFUSED` / "Cannot connect to SQL Server")

```powershell
# Reachability
Test-NetConnection -ComputerName "<sql-server-host>" -Port 1433
```

Checklist:

1. SQL Server service is running on the target host.
2. Firewall allows TCP 1433 from the app server.
3. SQL Server has TCP/IP enabled (SQL Server Configuration Manager).
4. `MSSQL_SERVER` / `MSSQL_DATABASE` (or `DB_SERVER` / `DB_NAME` fallbacks) point at the right instance (`server/dbConnection.ts:23-26`).

> **[CONFIRM]** SQL Server host/instance names and 1433-vs-named-instance ports per environment.

### 3.2 Authentication failed (`Login failed for user`, error 18456)

```sql
-- Confirm the login exists and is enabled (substitute the real login)
SELECT name, is_disabled FROM sys.sql_logins WHERE name = '<DBUser>';

-- Check database-level permissions
USE [<db-name>];
SELECT dp.name, dp.type_desc, p.permission_name
FROM sys.database_principals dp
JOIN sys.database_permissions p ON dp.principal_id = p.grantee_principal_id
WHERE dp.name = '<DBUser>';
```

The DB login is the pipeline variable `$(DBUser)`, **not** hard-coded as `svc_clientiq`. In the dev launch script it is `ClientIQ`; production values come from ADO variable groups.

> **[CONFIRM]** The real SQL login name(s) per environment and the credential/rotation owner before resetting any password.

### 3.3 Query timeout ("Execution Timeout Expired")

The pool's `requestTimeout` is 30 s (`server/dbConnection.ts`), so a request exceeding it aborts. Diagnose the slow statement:

### 3.4 Missing indexes and blocking

```sql
-- Missing-index suggestions for this database
SELECT
    'CREATE INDEX [IX_' + OBJECT_NAME(mid.object_id) + '] ON ' +
    mid.statement + ' (' + ISNULL(mid.equality_columns, '') + ')' AS create_stmt,
    migs.avg_user_impact
FROM sys.dm_db_missing_index_groups mig
JOIN sys.dm_db_missing_index_group_stats migs ON mig.index_group_handle = migs.group_handle
JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
WHERE mid.database_id = DB_ID('<db-name>')
ORDER BY migs.avg_user_impact DESC;

-- Current blocking chains
SELECT blocking_session_id, session_id, wait_type, wait_time / 1000 AS wait_seconds
FROM sys.dm_exec_requests
WHERE blocking_session_id <> 0;
```

Treat index changes as reviewed schema changes, not ad-hoc production edits.

---

## 4. Reverse proxy / TLS tier (IIS)

IIS terminates TLS and reverse-proxies to the Node process on `http://<app-host>:5000`. If clients see 502/504 or certificate errors, the fault is either the Node app (down / slow) or the IIS site configuration.

The exact IIS bindings, ARR rewrite rules, timeouts, and certificate store/paths are configured on the Windows hosts and are **not** in this repo.

> **[CONFIRM]** IIS site name, host-header bindings, ARR/URL-Rewrite reverse-proxy rules, request/response timeout settings, and the TLS certificate store location and thumbprint per environment.

### 4.1 502 Bad Gateway

IIS cannot reach the Node app on port 5000.

```powershell
# 1. Is the app actually listening?
Test-NetConnection -ComputerName localhost -Port 5000
Invoke-RestMethod -Uri "http://localhost:5000/api/health"

# 2. Is the service running?
Get-Service -Name "<ClientIQ-Service>"
```

If the app is up and healthy on 5000 but IIS still returns 502, the ARR rewrite/farm target is wrong or the app-pool worker is failing; inspect the IIS site's reverse-proxy rule and the IIS logs.

### 4.2 504 Gateway Timeout

IIS timed out waiting for the app. Usual causes: a slow SQL query (see §3.3 to §3.4) or a blocked request. If the app response genuinely needs longer, raise the IIS/ARR proxy timeout (a server-config change on the IIS host, not a repo change).

### 4.3 TLS / certificate errors

Browsers show `ERR_CERT_*` or a certificate warning.

```powershell
# Inspect the served certificate over the wire
$fqdn = "<clientiq-fqdn>"
$tcp = [System.Net.Sockets.TcpClient]::new($fqdn, 443)
$ssl = [System.Net.Security.SslStream]::new($tcp.GetStream(), $false, ({ $true }))
$ssl.AuthenticateAsClient($fqdn)
$ssl.RemoteCertificate | Format-List Subject, Issuer, NotBefore, NotAfter
$ssl.Dispose(); $tcp.Dispose()
```

| Symptom | Fix |
|---------|-----|
| Certificate expired | Renew and re-bind in IIS. |
| Name mismatch | CN/SAN must match the FQDN clients use; re-issue or correct the binding host header. |
| Untrusted CA | Install the intermediate chain in the host's certificate store. |

> **[CONFIRM]** Certificate owner, renewal process, and the store/thumbprint the IIS binding references. The in-repo cert is only the SAML **signing** cert (`./saml_cert.pem`), which is unrelated to the IIS TLS cert.

---

## 5. SAML / SSO issues (preprod and prod only)

SSO is on only in **preprod** and **prod**. IdP is RSA SecurID Access via the F&M Bank portal. If you see SSO symptoms in dev/test, remember those environments run mock auth (`SAML_ENABLED=false`); the symptom is almost certainly a misconfigured environment rather than a real SSO fault.

Useful facts for triage:

- The strategy sets `signatureAlgorithm = 'sha256'` but `wantAssertionsSigned = false` and `wantAuthnResponseSigned = false` (`server/auth/samlStrategy.ts:138-140`), because RSA signs the **Response wrapper**, not the Assertion. It also sets `audience = false` and `validateInResponseTo = never` (`:142-143`). So "signature validation failed" is almost always a **stale/wrong IdP cert in `SAML_CERT`**, not an algorithm mismatch.
- On startup the strategy logs the loaded cert's **SHA-256 fingerprint**, subject, issuer, and `validFrom`/`validTo` (`server/auth/samlStrategy.ts:49-88`); use these lines to confirm the right cert is loaded.
- The session cookie is named **`clientiq.sid`** with `sameSite: 'lax'` (`server/auth/session.ts:44-45`).

### 5.1 Redirect loop / "too many redirects"

**Checklist:**

1. `SAML_CALLBACK_URL` (the ACS URL, `.../saml/acs`) must exactly match what the IdP posts to.
2. Confirm the `clientiq.sid` cookie is actually being set (browser DevTools → Application → Cookies). Because deployed servers run `NODE_ENV=development`, the cookie is **not** `secure`; that is expected here and is not the cause.
3. The cookie must not be `sameSite: 'strict'`; the code uses `lax` deliberately so the cookie survives the cross-site POST→ACS→redirect chain (`server/auth/session.ts:42`). If IIS or a policy rewrites cookie attributes, the loop can return.
4. IIS must forward the correct scheme/host so the app builds `https://` callback URLs. Ensure the proxy sets `X-Forwarded-Proto`/`X-Forwarded-Host` (or equivalent ARR server-variable) so the app does not mint `http://` redirects.

> **[CONFIRM]** The IIS/ARR forwarded-header configuration for each SSO environment.

### 5.2 "Signature validation failed"

**Primary cause: wrong or expired IdP signing cert in `SAML_CERT`.** The deploy sets `SAML_CERT=./saml_cert.pem` (relative to `C:\ClientIQ`).

```powershell
# Inspect the cert the app is configured to load
$pem = Get-Content "C:\ClientIQ\saml_cert.pem" -Raw
$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    [Text.Encoding]::ASCII.GetBytes($pem))
$cert | Format-List Subject, Issuer, NotBefore, NotAfter, Thumbprint
```

Then compare against the startup log's cert fingerprint / `validTo` line. Fixes:

1. Replace `saml_cert.pem` with the current IdP signing cert; restart the service.
2. Ensure the PEM has both `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----` markers (the loader validates this and throws otherwise, `server/auth/samlStrategy.ts:42-47`). BOM/CRLF are tolerated.
3. Do **not** chase "SHA-256 vs SHA-1"; the algorithm is fixed at `sha256` in code, and a mismatch here does not present as this error.

### 5.3 Missing SAML attributes / user created without expected data

The AD group list arrives in the SAML **`role`** attribute; RSA sends **short attribute names**, with the long-form claim URLs as fallback (`server/auth/samlStrategy.ts:159-169`). Login fails outright only if no email/nameID resolves (`'SAML profile missing email/nameID'`, `:176-179`).

**Diagnose:**

1. Raise app verbosity with `LOG_LEVEL=debug` (there is **no** `DEBUG=passport:*,saml:*` variable). The app already logs attribute extraction and role-sync detail on each login.
2. Compare the attribute names/URIs the IdP sends against `ATTRIBUTE_MAP` (`server/auth/samlStrategy.ts:95-103`): `employeeid`, `employeenumber`, `givenname`, `surname`, `emailaddress`, `department`, `role`.
3. If the login itself succeeds but the user has no data, the SAML assertion is missing the expected short-name attributes; coordinate with the IdP team.

### 5.4 SSO user stuck on "Awaiting Role Assignment"

This is the most common real SSO break/fix cluster. A user authenticates successfully but lands on "Awaiting Role Assignment" (or roles silently fail to sync). Work through these causes in order:

**(a) `sessions.sid` column too narrow.**
First login throws SQL error `"String or binary data would be truncated … column 'sid'"`. The `connect-mssql-v2` store needs `sid NVARCHAR(255)`; a prior bad `CREATE` can produce `sid NVARCHAR(1)`.
**Fix:** run `scripts/fix_sessions_table.sql`; it drops and recreates the table with the correct schema when `sid` is under 255 (safe; sessions are not durable data).

**(b) `employee.last_seen_saml_role` overflow.**
The IdP sends the user's full AD group list (multi-kilobyte) in the role attribute; a `varchar(255)` column throws SQL error **2628** ("String or binary data would be truncated"), which aborts the employee upsert and strands the user.
**Fix:** run `scripts/widen_employee_last_seen_saml_role.sql`; it widens the column to `NVARCHAR(MAX)` (idempotent).

**(c) `SAML_ROLE_ENV` scoping mismatch.**
The bank runs one on-prem AD, so a user carries the ClientIQ groups for *every* environment. Each env sets `SAML_ROLE_ENV` (`DEV`/`TST`/`STG`/`PRD`) so only groups whose env segment matches are honored (`server/auth/adGroupRoleMap.ts`). If preprod's `SAML_ROLE_ENV` is wrong (e.g. unset or set to `PRD`), a user's groups get ignored or the wrong env's groups get honored, and no role maps.
**Fix:** verify the running server's `SAML_ROLE_ENV` against the expected value (`STG` for preprod, `PRD` for prod). The strategy logs `SAML_ROLE_ENV_received` vs `SAML_ROLE_ENV_resolved` on startup (`server/auth/samlStrategy.ts:109-113`); check those lines.

**(d) Default "Branch Manager" role missing from the DB.**
When AD groups map to no role, the app falls back to `SAML_DEFAULT_ROLE_NAME` (default `Branch Manager`). If that role row does not exist in the `role` table, even the fallback fails and the session sets `defaultRoleMissing = true` (`server/routes/auth.ts:428-430`).
**Fix:** run `scripts/ensure_branch_manager_role.sql` (idempotent; inserts/reactivates the role at privilege level 3). The app also logs the full list of available active role names when the default is not found, so you can correct `SAML_DEFAULT_ROLE_NAME` or seed the role.

**(e) A mapped role token has no matching `role` row.**
The AD-group→role convention maps some tokens to a role named **`BRS`** (`businessbanker`, `assistantmanager` → `BRS`), among others. Role names on the right-hand side of the map must exist in the `role` table (case-insensitive). If `BRS` (or another mapped role) was never seeded, those users get no role from AD and fall to the default.
**Fix:** confirm every role name referenced by the map exists as an active row in `role`: System Admin, Branch Manager, BRS, Teller, Loan Officer, Risk Analyst, Compliance Officer.

```sql
SELECT role_name, is_active FROM [dbo].[role] ORDER BY role_name;
```

**Provenance prerequisite.** Role sync only reconciles system-derived rows (`assigned_by IS NULL`); admin-granted roles are never revoked. If the `employee_role.assigned_by` provenance columns were never migrated, the enforced sync path can misbehave. The "bulletproof" ACS fallback (`ensureEmployeeHasDefaultRoleSqlServer`) is deliberately column-safe and still assigns the default role, but verify the schema matches `shared/schema.ts`.

---

## 6. Performance

### 6.1 Slow page load

```powershell
# Client → server network latency (through IIS/TLS)
Test-NetConnection -ComputerName "<clientiq-fqdn>" -Port 443
```

```sql
-- Direct DB response time for a representative read
SET STATISTICS TIME ON;
SELECT TOP 1 * FROM customer WHERE customer_id = 1;
SET STATISTICS TIME OFF;
```

For request-timing at the proxy tier, use IIS logs (§4). Remember the deployed server serves the client through **Vite dev middleware** (because `NODE_ENV=development`), which transforms assets per request; this is heavier than static serving and is expected in this configuration.

### 6.2 Memory exhaustion ("JavaScript heap out of memory")

As in §2.5: there is no `nssm`. Apply a heap cap via `NODE_OPTIONS=--max-old-space-size=4096` in the environment that launches the service, and make it durable in `PipelineTemplates/start-script.yml`. Do not reference `dist/server/index.js`.

---

## 7. Log analysis

### 7.1 Representative log lines

These strings are illustrative of what the structured logger emits; treat them as patterns, not exact literals. SAML login and role-sync events are logged on every authentication, and the DB layer logs `SQL Server connection initialized` on pool startup (`server/dbConnection.ts`).

```
# SAML: look for the ACS/role-sync diagnostic lines (roleEnv, group count,
# desired/assigned/revoked roles, usedFallback, unmatched, ignoredOtherEnv)

# Startup cert diagnostics (SHA-256 fingerprint, validFrom/validTo) from samlStrategy

# Errors to watch for
Database connection failed: ECONNREFUSED
Signature validation failed
Request timeout after 30000ms
```

### 7.2 Aggregate errors

```powershell
Get-Content "C:\ClientIQ\logs\errors.log" |
    Select-String -Pattern "\b(error|warn)\b" |
    Group-Object { $_.Matches.Value } |
    Sort-Object Count -Descending
```

---

## 8. Emergency procedures

### 8.1 Application unresponsive

```powershell
# 1. Restart the service (substitute the real service name)
Restart-Service -Name "<ClientIQ-Service>" -Force

# 2. If still stuck, stop the orphaned node process, then start the service
Get-Process -Name "node" | Stop-Process -Force
Start-Service -Name "<ClientIQ-Service>"

# 3. Check for host resource exhaustion
Get-Counter '\Memory\Available MBytes', '\Processor(_Total)\% Processor Time'
```

### 8.2 Database emergency (kill blocking chains)

```sql
DECLARE @kill VARCHAR(8000) = '';
SELECT @kill = @kill + 'KILL ' + CAST(session_id AS VARCHAR) + '; '
FROM sys.dm_exec_requests
WHERE blocking_session_id = 0
  AND session_id IN (SELECT blocking_session_id FROM sys.dm_exec_requests);
EXEC(@kill);
```

Use with care in production; prefer resolving the root blocker where possible.

### 8.3 Rollback a deployment

There is **no** in-repo `C:\ClientIQ\backups\...` scheme and **no** `config\.env` file. Env vars are written inline into the generated `C:\ClientIQ\Start-Server.ps1` (`PipelineTemplates/start-script.yml:13-51`), which the deploy deletes after the service starts (`PipelineTemplates/deploy-nodejs.yml:36`). Rollback = **redeploy the prior artifact through Azure DevOps** from the appropriate branch, which regenerates the start script and restarts the service.

Manual restart of the service alone (§8.1) does not roll back code; it only bounces the current artifact.

> **[CONFIRM]** The team's documented rollback runbook (which prior ADO build/release to redeploy, and the approval path for a prod rollback across `Deploy_Prod` and `Deploy_Prod2`).

---

## 9. Support escalation

**Escalate when:** the app is down > 15 minutes, data corruption is suspected, there is a security incident, or performance degradation affects all users.

**Gather first:** exact error text, timestamps, affected users/features, recent changes/deploys, and log excerpts from `C:\ClientIQ\logs\errors.log` plus relevant IIS and SQL Server logs.

> **[CONFIRM]** L1/L2/L3 escalation contacts, on-call rotation, and response-time SLAs. These are governance data not derivable from the repo. Real infra identifiers found in code are the IdP host `portal.fmb.com` and (dev only) the SQL host `HUB-SQL1TST-LIS`; the org is Farmers & Merchants Bank.

---

## Appendix A: Command corrections vs. the legacy guide

| Legacy guide said | Correct for this system |
|-------------------|-------------------------|
| `Get-Service` for a bundled reverse-proxy service | `Get-Service -Name "<ClientIQ-Service>"`; the reverse proxy is **IIS** (an IIS site, not a Windows service). |
| Manual start: `node dist/server/index.js` | `npx tsx server/index.ts` from `C:\ClientIQ`. |
| `Cannot find module` → `npm ci --production` | `npm ci --prefer-offline` in `C:\ClientIQ` (node_modules excluded from artifact). |
| `nssm set ClientIQ AppParameters …` | No `nssm`; use `NODE_OPTIONS` in `Start-Server.ps1`. |
| Logs at `stdout.log` / `stderr.log` / a bundled-proxy log dir | `C:\ClientIQ\logs\errors.log` (stderr); reverse-proxy logs are the IIS logs. |
| `DEBUG=passport:*,saml:*` | `LOG_LEVEL=debug` (no `DEBUG` package var is read). |
| Signature error → "SHA-256 required" | Almost always a wrong/expired cert in `SAML_CERT`. |
| Set `HOST=127.0.0.1` to fix `ENOTSUP` | `HOST` is never read; bind is hard-coded `0.0.0.0`. |
| Rollback by copying `C:\ClientIQ\backups\…` | Redeploy the prior artifact via Azure DevOps. |
| DB login `svc_clientiq` | Login is the ADO `$(DBUser)` variable; confirm per environment. |
