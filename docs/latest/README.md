# ClientIQ / Banking Client 360: Documentation Index

*Last reviewed: 2026-07-02. Source of truth: application code (ClientIQ / Banking Client 360).*

## Purpose

Modernized ClientIQ documentation, regenerated against the live codebase. The platform is Microsoft SQL Server only, fronted by IIS on Windows Server, across four environments (dev, test, preprod, prod). SAML SSO (RSA SecurID) is enabled in preprod and prod only; dev and test use local mock auth. CI/CD is Azure DevOps. The ClientIQ database is loaded daily from the core banking pipeline SOR to VAULT to SPOT.

## Table of Contents

| Document | File | What it covers |
|---|---|---|
| clientiq-overview | [`clientiq-overview.md`](clientiq-overview.md) | Product and platform overview |
| architecture | [`architecture.md`](architecture.md) | System architecture: layers, deployment topology, SOR/VAULT/SPOT data pipeline, RBAC, SAML |
| technical-requirements | [`technical-requirements.md`](technical-requirements.md) | EPIC and feature technical requirements (as built) |
| database-design | [`database-design.md`](database-design.md) | SQL Server schema design guide for data engineers |
| database-erd | [`database-erd.md`](database-erd.md) | Entity relationship model (Mermaid ER diagrams) |
| database-to-ui-field-mapping | [`database-to-ui-field-mapping.md`](database-to-ui-field-mapping.md) | Database column to UI component field mapping |
| data-grooming | [`data-grooming.md`](data-grooming.md) | Data load and grooming recipe (FK order, SPOT feed) |
| roles-and-permissions | [`roles-and-permissions.md`](roles-and-permissions.md) | RBAC and ABAC model: roles, permissions, gating |
| active-directory-groups | [`active-directory-groups.md`](active-directory-groups.md) | Active Directory security group to role mapping |
| saml-configuration | [`saml-configuration.md`](saml-configuration.md) | SAML 2.0 SSO operator guide (RSA SecurID) |
| environment-variables | [`environment-variables.md`](environment-variables.md) | Environment variable reference |
| on-premises-deployment | [`on-premises-deployment.md`](on-premises-deployment.md) | On-premises deployment overview |
| deployment-plan | [`deployment-plan.md`](deployment-plan.md) | Deployment governance and process |
| dev-test-server-setup | [`dev-test-server-setup.md`](dev-test-server-setup.md) | Dev and test server setup guide |
| windows-server-setup | [`windows-server-setup.md`](windows-server-setup.md) | Windows Server host setup guide |
| sql-server-dba-setup | [`sql-server-dba-setup.md`](sql-server-dba-setup.md) | SQL Server DBA runbook |
| ssl-dns-setup | [`ssl-dns-setup.md`](ssl-dns-setup.md) | TLS certificate and DNS runbook (IIS) |
| ui-file-usage | [`ui-file-usage.md`](ui-file-usage.md) | Active vs unused client/src UI files |
| troubleshooting | [`troubleshooting.md`](troubleshooting.md) | Runtime and incident runbook |

Companion artifacts in this folder: `GAP-REPORT.md` (the audit that drove this rewrite) and `gaps.json` (structured findings).

## Consolidated `[CONFIRM]` Checklist

Items below are facts that live outside the codebase (hostnames, certificates, SLAs, owners, capacity, compliance posture). Resolve them with the named owners. Line numbers reference the current `.md` files.

### clientiq-overview.md (8)

- L11: Document owner, last-published date, and doc version. The `package.json` version is `1.0.0`; treat the doc version as unconfirmed until a human sets it.
- L42: The historical-comparison window used for QoQ (an earlier overview stated "90-day snapshots"; no server calculation in the reviewed code confirms a specific window). Note that the SQL Server transaction ETL loads only the **last 13 month...
- L55: The full set of `account_type` values present in preprod/prod data (sourced from the Jack Henry views), and whether credit-card accounts are loaded in production. Card *management* in the application is specifically **debit cards** (see...
- L88: Whether AML transaction monitoring, OFAC screening, or an automated compliance-review calendar are in scope. Earlier documentation listed "AML monitoring," "OFAC screening," and "next review scheduling"; the reviewed schema and code expo...
- L112: The `BRS` ("Business Relationship Specialist") role. The AD-group map (`adGroupRoleMap.ts:48-49`) maps the `businessbanker` and `assistantmanager` tokens to a role named `BRS`, but no seed or in-repo migration creates a `BRS` row (the se...
- L114: AD group owners and the exact AD group names provisioned per environment.
- L143: Whether the employee-customer ABAC restriction fires in the SQL Server production path. The rule is evaluated in the ORM-abstraction permission service, which is a no-op in SQL Server mode; the SQL Server permission store implements bran...
- L221: IIS site bindings, ARR/reverse-proxy configuration, TLS certificate owners and paths, real hostnames/FQDNs, the exact prod load-balancer topology across the two app servers, backup cadence, SLAs, support contacts, and compliance posture....

### architecture.md (13)

- L28: Document version and owner. `package.json` reports version `1.0.0`; treat the published doc version, owner, approvers, and distribution list as organizational metadata a human must supply. Reconcile against any existing governance record.
- L160: application code. See the `[CONFIRM]` block below.
- L164: Real host FQDNs, cluster membership, load-balancer product/config for the prod app pair (`CIQ-APP01` / `CIQ-APP02`), IIS site bindings and ARR/reverse-proxy configuration, TLS certificate owners and paths, and the exact prod database top...
- L180: IIS binding specifics (site names, host headers, ports), the TLS certificate (issuer, owner, path, renewal), and ARR/URL-Rewrite rules that forward `clientiq.fmb.com` traffic to `http://127.0.0.1:5000`.
- L203: Whether the Windows Service definition (or a service wrapper env) overrides `NODE_ENV`/`SAML_ENABLED` for preprod/prod at runtime. The service-to-script binding is configured outside this repository.
- L280: SQL Server TDE (encryption at rest), enforced TLS for DB connections, backup cadence/retention, and Always On availability-group configuration, all ops-layer facts not present in the repository.
- L472: That a `BRS` role row exists in each SQL Server environment (or that the AD map should instead resolve to the seeded `Business Banker` / `Assistant Manager` roles). If `BRS` is absent, affected users fall back to Branch Manager.
- L541: Whether an out-of-repo SSIS/SQL-Agent job (or any scheduled orchestration) drives these loads on a cadence in preprod/prod, and the actual refresh schedule. The repository shows only manually executed SQL files; any automated schedule is...
- L591: Whether the `customer.isEmployee` (level-3) ABAC control actually fires in the SQL Server production path. The two ABAC implementations diverge (employee-record vs branch/region), and the employee-record control may not be enforced unles...
- L644: Monitoring/alerting, SLA targets, and whether an external health probe is expected (and if a `/health` endpoint should be added). These are ops concerns not defined in the repository.
- L654: SQL Server TDE, TLS 1.3 enforcement, HSM/tokenization, PCI DSS posture, GLBA/Reg retention schedules, and the 7-year retention claims. These are compliance/ops assertions that cannot be verified from the codebase.
- L684: | Runtime | Node.js | see `[CONFIRM]` below |
- L699: The target Node.js runtime version. `package.json` does not pin an `engines.node` value; the ADO build agent's `NodeTool` version (declared in pipeline variables) is the effective version; confirm with FMB ops.

### technical-requirements.md (22)

- L24: Document owner, version number, and review cadence. These are governance facts not derivable from code.
- L80: - [ ] `estate` is **not** a supported validated type. > **[CONFIRM]** whether an `estate` customer type is a roadmap item.
- L88: - [ ] VIP and employee badges are driven by the `vip_customer` and `is_employee` flags (`shared/schema.ts:149-151`). > **[CONFIRM]** exact chip hex colors against `client/src/components/CustomerOverview.tsx`.
- L95: - [ ] These are stored fields; there is **no** implemented KYC-expiry alerting, renewal workflow, or automated risk-review job in the codebase. Treat alerting/workflow items as roadmap. > **[CONFIRM]** roadmap for KYC alerting.
- L110: Account types observed in application logic include `checking`, `deposit checking`, `savings`, `money_market`, `cd`, `business_checking` (`server/routes.ts:1387,2048`). > **[CONFIRM]** the authoritative closed list of account types and a...
- L120: Account creation, closure, hold-management, and status-transition workflows described in earlier drafts are not evidenced as implemented server features. Confirm whether account lifecycle mutation is in scope for ClientIQ or handled enti...
- L146: Whether the checking-only and ownership triggers actually exist in the production SQL Server database.
- L157: Card **activation, PIN set, block/unblock, replacement + replacement fees, fraud freeze, and expiry auto-reissue** described in prior drafts are **not implemented**. Seeded card statuses are `active` / `inactive` / `blocked` / `expired`...
- L196: Transaction **posting/settlement jobs, auto-categorization, dispute filing, and reversal workflows** described in prior drafts are not evidenced as implemented mutation features (ClientIQ is read-oriented over the core). > **[CONFIRM]**...
- L240: Prior claims of a similarity-scored "fuzzy match with 30% threshold" (e.g. "Smyth finds Smith at 33% similarity"), special search indexes, and cross-engine search parity are **not** part of production search. Notes/tax-ID "role-based acc...
- L265: Whether household creation/edit is a user-facing write feature or ETL-loaded only. Note: the dev seed has a known defect writing malformed household-membership rows (`scripts/seed.ts:450`), relevant only to dev fixtures, not production.
- L290: Branch/employee/officer administrative CRUD scope, capacity limits ("max customers per officer"), and org-hierarchy features. These are not evidenced as implemented mutation features.
- L330: The AD-group map references a **`BRS`** role name (`businessbanker`/`assistantmanager` → `BRS`) that no in-repo seed or migration creates; the seed instead has "Business Banker" and "Assistant Manager". Confirm the production `role` rows...
- L364: In the SQL Server production path this specific `customer.isEmployee` + `minPrivilegeOverride` rule may not fire: the shared `permissionService.checkPermission` short-circuits to `allowed:true` when its non-runtime DB handle is null, and...
- L385: Whether notes and deposit-summary/trend are intended to be permission-gated. Documented here as a known gap.
- L428: Audit retention period and immutability/WORM posture. These are governance/ops facts, not encoded in the schema. (No coded 7-year retention exists.)
- L438: Whether AML/OFAC/SAR/KYC-alerting are on the ClientIQ roadmap or are owned by a separate enterprise compliance system.
- L452: IIS site bindings, ARR/reverse-proxy configuration, certificate paths, and cert owners, not in the repo.
- L488: Exact prod load-balancer/topology, host FQDNs, and how requests are distributed across the two prod app servers.
- L506: Whether prod overrides `NODE_ENV` to `production` via the Windows Service environment; the committed deploy templates set `development` for all stages. Also confirm secret management (the repo's `Start-Dev.ps1` contains plaintext dev cre...
- L512: Whether a richer `/health/database` connectivity/performance check is a roadmap item. It does not exist today.
- L554: All items flagged `> **[CONFIRM]**` above require human/operator input and are not derivable from code: document ownership/version/review cadence; IIS bindings and certificate paths; prod load-balancer topology and host FQDNs; account-ty...

### database-design.md (5)

- L24: Document version and owner. This reference is derived from application code; there is no authoritative version string in the code. `package.json` reports application version `1.0.0`.
- L839: The debit-card validation triggers referenced in the schema comment are not present as DDL in this repository. Confirm whether the account-type and ownership triggers are actually deployed on the SQL Server database, and, if so, where th...
- L1332: `scripts/validate-schema.js` (a schema-drift guard) checks a "critical tables" list of `person`, `account`, `transaction`, `online_banking_user`, `contact_history` and queries `information_schema` for a `public` schema. Two of those tabl...
- L1491: The following are governance/ownership statements not verifiable from the repository code and require a human owner to confirm: - Whether `tax_identifier` / `government_id` are encrypted at rest (the code masks for display but does not e...
- L1501: Environment-specific connection details (SQL Server hostnames/FQDNs, instance names, service accounts, certificate owners and paths) for dev, test, preprod, and prod are not in the repository and must be confirmed with the DBA/infrastruc...

### database-erd.md (7)

- L157: Location and current text of the SQL Server trigger(s) that enforce the debit-card business rules (`account_type IN ('checking','business_checking')` and cardholder-is-account-owner). The rules are documented in a code comment (`schema.t...
- L291: A card↔transaction linkage does **not** exist in the current schema. If the business requires attributing transactions to a specific `debit_card`, treat it as a known data-model gap to be scoped, not as existing behavior.
- L583: The exact SQL Server mechanism that maintains `customer.full_name` (persisted computed column vs. trigger vs. application-populated). `shared/schema.ts` only marks it as a derived column; the production DDL for this column was not locate...
- L601: | Debit-card allowed account type; cardholder is a valid account owner | SQL Server trigger(s) | External DDL (see the [CONFIRM] under Core Banking) |
- L649: The authoritative ordering/runbook for applying the `scripts/` and `Insert Queries/Schema Changes/` DDL to a fresh SQL Server database, and which scripts are baseline vs. incremental.
- L688: Expected row-count and growth-rate projections per table (e.g. for `customer`, `financial_transaction`, `contact_history`, `audit_event`). These are capacity-planning inputs that are not derivable from code and must be supplied and dated...
- L706: Documentation version. `package.json` reports application version `1.0.0`; a separate doc-version has not been established for this ERD.

### database-to-ui-field-mapping.md (3)

- L593: | Application version | See `package.json` (`1.0.0`); > **[CONFIRM]** the customer-facing "ClientIQ" version string with the doc owner |
- L595: | Doc version / owner | > **[CONFIRM]** doc version and owner (not derivable from the repo) |
- L597: Reconcile the historical "Last Updated: December 2024" footer and the "Apr 14, 2026" edit stamp from prior revisions with the actual last-edit date, and confirm the application version string, with the document owner. These governance/ow...

### data-grooming.md (5)

- L54: The `Insert Queries/*.sql` files target the literal database name `ClientIQPreProd`. If grooming a differently-named test database (e.g. a dedicated QA instance), the three-part names in every `.sql` file must be repointed. Confirm the t...
- L169: The SQL Server DDL for the `permission` table and the exact column/JSON shape it reads for attribute-based rules is not derivable from the repo `.sql` files (no ETL loads `permission`). Confirm with the DBA which column holds the attribu...
- L201: Whether a `BRS` role row must be created in preprod/prod (and at what privilege level, per `adGroupRoleMap.ts` this tier is privilege 2) is a data/identity-governance decision. Confirm with the AD-group / entitlement owner before groomin...
- L382: Enforcement of the employee-customer `transaction.view` rule on SQL Server is unverified. The attribute-based rule is authored for the dev-abstraction permission service; the SQL Server permission store implements branch/region condition...
- L396: Document owner / author and the published-copy revision date. The prior in-repo markdown and the published PDF carried divergent dates and authors; this rewrite intentionally omits an author line rather than assert one.

### roles-and-permissions.md (5)

- L13: Document owner and review cadence for this page (the prior wiki copy attributed authorship to an individual editor; that governance metadata cannot be derived from code). Doc version tracks the application `package.json` version (`1.0.0`...
- L43: Whether a `BRS` role has been created in each SQL Server database (preprod, prod), and its owner / privilege level, since it is not seeded by the repo.
- L282: Whether the SQL Server `permission.conditions` data for `transaction.view` (or any equivalent) encodes the employee-customer restriction, so the "employee transactions require level 3+" control is actually enforced server-side in preprod...
- L332: The owners of the ClientIQ AD groups (per environment) and the process for adding a user to the correct group, since group membership is the effective role-assignment mechanism in preprod/prod.
- L370: The runtime `NODE_ENV` value in preprod and prod. The production guard only engages if `NODE_ENV` is actually `'production'`; if the Windows Service environment sets a different value, role testing could remain enabled in a deployed high...

### active-directory-groups.md (6)

- L18: sign-off; see `[CONFIRM]` markers).
- L90: Confirm the `BRS` role row (privilege level 2) exists in the SQL Server `role` table for preprod and prod. It is not created by any in-repo seed or migration script.
- L179: The preprod administrative group name is inconsistent between sources: the legacy registry lists `CTRL_STG_APP_ClientIQ_AppAdmin_ADM` (STG + AppAdmin), while the code comment describes `CTRL_PRE_..._APPSVCS_ADM` (PRE + APPSVCS) as the pr...
- L234: codebase and must be confirmed (see the `[CONFIRM]` note at the end of this section).
- L252: The group **owner** and **data-classification** for each group must be confirmed with the IAM/AD governance team. These fields are outside the code's scope and are not verifiable from source. The legacy registry recorded them as: Data Cl...
- L275: The exact production (`CTRL_PRD_*` / `IAM_PRD_*`) group names, their owners, and data classifications are not present in the codebase. Confirm the full production group registry with the IAM/AD governance team. The application code resol...

### saml-configuration.md (7)

- L11: Current document owner and governance sign-off. The prior byline ("Haroun Ahmady, Apr 14, 2026") cannot be verified from code; confirm the responsible owner and re-stamp the last-reviewed date after any further change.
- L36: IIS site bindings, ARR/reverse-proxy rules, and the public FQDN used for the SP (`SAMLHost`) per environment. These are not defined in the repository.
- L49: IdP signing certificate owner, storage location, renewal cadence, and the RSA/IdP-team contact for coordinating metadata exchange.
- L91: On-host certificate file path/permissions and the certificate rotation process per environment.
- L309: Whether the audience-restriction and InResponseTo settings meet the bank's SAML security/compliance posture. These are relaxed deliberately to match the current RSA integration; confirm with the security team before hardening.
- L335: Log file locations and log-viewing procedure on the IIS/Windows hosts (the repo does not define the on-host log paths for preprod/prod).
- L377: Document version. No authoritative doc version exists in the repository; the application `package.json` version is `1.0.0`.

### environment-variables.md (7)

- L30: File-system ACLs / permissions on `C:\ClientIQ\Start-Server.ps1` on each host, the owner of the ADO variable groups (`VG-Dev`, `VG-Test`, `VG-Preprod`, `VG-Prod`, `VG-Prod2`), and the secret-rotation cadence/policy are governance items n...
- L83: Whether prod overrides `NODE_ENV` to `production` at the Windows-service level is not visible in the repo. A human must confirm the effective `NODE_ENV` on the preprod and prod hosts; if it is not overridden, the security implications ab...
- L181: Real SQL Server hostnames/instances and service-account logins per environment are not in the repo. `Start-Dev.ps1` references `HUB-SQL1TST-LIS` / `ClientIQdev` for local dev only.
- L255: The owner, source, and rotation process for the IdP signing certificate at `C:\ClientIQ\saml_cert.pem` are not in the repo.
- L308: The real IdP entry-point / portal host, the SP entity ID, the application FQDN used in `SAML_CALLBACK_URL`, and the IIS site bindings / TLS certificate that terminate HTTPS in front of the Node process on port 5000 are not in the repo. I...
- L375: Secret-rotation cadence, secret-management ownership, and the reconciliation plan for the committed plaintext secrets in `Start-Dev.ps1` are governance decisions that require a human owner. The listed rotation frequency is not derivable...
- L396: Document version and owner. Using the application `package.json` version `1.0.0` as a placeholder; the doc version and its maintainer must be confirmed by a human.

### on-premises-deployment.md (17)

- L15: | Host OS | Windows Server | App root is `C:\ClientIQ`; app runs as a Windows Service. > **[CONFIRM]** exact Windows Server version(s) in each environment. |
- L34: Production load-balancer product/VIP and the exact two-server topology (health-check path, session affinity, failover behavior). The pipeline confirms two deploy targets but the LB fronting them is not defined in the repo.
- L66: IIS site bindings (hostnames/FQDNs, HTTPS binding), the reverse-proxy/ARR rule forwarding to `127.0.0.1:5000` (or the bound interface), TLS certificate subject/issuer, cert file paths, and cert owner/renewal cadence. None of this is deri...
- L92: Whether the Windows Service environment overrides `NODE_ENV` to `production` at the service level in preprod/prod. This cannot be determined from the repo. If it does not, preprod and prod run in dev mode, a real dev/prod configuration m...
- L136: The Windows Service definition (service name per environment, how the service invokes `C:\ClientIQ\Start-Server.ps1`, the service account). The service-to-script binding is configured outside this repo.
- L162: Reference/seed data import procedure, SQL Server backup cadence and retention, DBA-owned security configuration (logins, roles, TDE), and DBA ownership. These are operational/governance decisions not derivable from the repo.
- L177: SP/IdP metadata exchange procedure, the signing certificate (`saml_cert.pem`) owner and rotation, and the AD-group owners for each role. Cert/AD governance is not in the repo.
- L183: | 443 | TCP | Inbound | HTTPS to IIS (TLS termination). > **[CONFIRM]** exact IIS HTTPS binding. |
- L192: Host/infra firewall rules that enforce "only 5000 open," and whether IIS reaches the app over loopback or the bound interface.
- L221: Final filenames/links for each companion guide once published alongside this overview.
- L227: - [ ] Windows Server host(s) provisioned. > **[CONFIRM]** minimum/recommended CPU, RAM, and disk (capacity numbers not derivable from the repo).
- L228: - [ ] SQL Server instance reachable on TCP 1433 with a service login. > **[CONFIRM]** SQL Server edition/version and sizing.
- L229: - [ ] DNS record and TLS certificate for the IIS HTTPS binding. > **[CONFIRM]** hostname/FQDN and cert.
- L233: - [ ] Node.js LTS installed. > **[CONFIRM]** the exact Node.js version supported.
- L244: - [ ] HTTPS reachable through IIS. > **[CONFIRM]** production URL/FQDN.
- L252: Support-contact addresses and escalation tiers (Application Support, DBA, Security/SSO, Infrastructure). In-repo hosts indicate the deployed organization is Farmers & Merchants Bank (`portal.fmb.com`, `farmers-merchants-bank.repo.sonatyp...
- L259: | Document version | > **[CONFIRM]** documentation revision and owner. This is a documentation version, distinct from the application version. |

### deployment-plan.md (16)

- L15: `[CONFIRM]`. The concrete technical claims (branches, pipeline stages, target platform, database
- L39: Delivery cadence below is a governance target, not derived from code. Confirm with the release and change-management owner that the sprint length and per-environment deployment frequency are current.
- L73: Data-masking posture per environment (e.g. that Dev/Test use masked data and Pre-Prod uses production data) is a data-governance decision not expressible in the repo. Have data engineering / data governance confirm which environments hol...
- L82: (see the `[CONFIRM]` above).
- L136: Role assignments, the rotating Release Lead model, and approver identities are governance decisions not derived from code. The ADO pipeline defines deployment environments (`Dev`, `Test`, `PreProd`, `Prod`) that can carry approval checks...
- L159: **Release Lead (rotating, `[CONFIRM]`)**
- L198: > `prod` trigger with the pipeline owner. `> **[CONFIRM]**`
- L230: > repo. `> **[CONFIRM]**` the runtime `NODE_ENV` actually in force in preprod and prod.
- L238: The IIS site bindings, ARR/reverse-proxy configuration, TLS certificate paths, and certificate owner are not defined in this repository. Confirm the IIS front-end configuration and certificate ownership with infrastructure/operations.
- L271: Where the authoritative SQL Server schema-change scripts live, and the exact out-of-band process (who runs them, in what order, against which environment) for applying them. This is not defined in the repository.
- L308: *No production data in Dev (`[CONFIRM]` masking posture, §2).*
- L362: Whether "Bank Security" sign-off is a required, separate approval on the Ready-for-Production gate, and who owns it.
- L374: Formal CAB / change-approval requirement and the scheduled deployment window are governance controls not defined in the repository. Confirm CAB applicability and the deployment window with change management.
- L382: The exact prod topology (load balancer, node roles, session affinity) is not defined in the repository. Confirm with infrastructure/operations.
- L391: - [ ] Backups/snapshots completed (`[CONFIRM]` backup cadence/owner).
- L392: - [ ] Coordinated deployment with App Services & DBAs (segregation of duties, `[CONFIRM]`).

### dev-test-server-setup.md (18)

- L32: Real dev/test hostnames and FQDNs (e.g. a `test-clientiq.*` DNS name), the DNS record owner, and the SQL Server hostname for each environment. These are not derivable from the repo.
- L34: TLS certificate: subject/FQDN, certificate and private-key file paths on the IIS host, issuing CA, and the certificate owner. Not defined in this repo.
- L36: IIS site bindings (site name, HTTP/HTTPS bindings, host header) and the reverse-proxy mechanism (e.g. Application Request Routing / URL Rewrite) fronting the Node process. No IIS `web.config` or binding config exists in the repo.
- L49: Whether the dev/test SQL Server uses SQL authentication or Windows authentication. The repo start scripts use **SQL authentication** (`MSSQL_USER` / `MSSQL_PASSWORD`); the code does not implement Windows-integrated auth.
- L77: The clone URL / artifact source for a manually provisioned dev/test host.
- L91: The authoritative SQL Server schema-creation and seed procedure for a fresh dev/test database (migration scripts, seed scripts, and their run order), and who owns/maintains them. This is not fully derivable from the repo; coordinate with...
- L130: If your dev/test SQL Server listens on a non-default port, note that the app cannot target it via `MSSQL_PORT` (unread). This would require a code change or a SQL Server alias/DNS mapping. Confirm the SQL Server port per environment.
- L162: The dev/test SQL Server hostname, database name, service-account login, and password for each environment (from the ADO variable groups `VG-Dev` / `VG-Test`, or your secrets store).
- L205: The service wrapper tool and its install path used in your environment (e.g. NSSM location), and the service account the ClientIQ service runs under.
- L238: The complete IIS configuration for each environment: site name and bindings, certificate binding (thumbprint / store), the reverse-proxy/rewrite rules to `127.0.0.1:5000`, request size limits, and any security headers applied at the prox...
- L276: For any test SSO trial: the IdP entry-point URL, the SP issuer/entity id agreed with the IdP team, and the IdP signing certificate (contents/fingerprint). Obtain from the SAML/IdP owners.
- L295: Whether `5000` should be reachable only from the local IIS worker (loopback) or also from a separate IIS host, and the exact host/infra firewall posture for each environment.
- L328: The environment FQDN to substitute for `<env-fqdn>` in step 3.
- L376: Document owner, version, and review cadence for this guide.
- L378: Environment-specific values: FQDN/DNS records, TLS cert (subject, paths, CA, owner), SQL Server host/database/login per environment (from ADO variable groups `VG-Dev` / `VG-Test` or your secrets store).
- L380: IIS site/binding/reverse-proxy configuration on the web tier.
- L382: SQL Server schema-creation and seed procedure and its owner.
- L384: Backup cadence, monitoring/alerting, support contacts, and any compliance posture for dev/test.

### windows-server-setup.md (12)

- L33: IIS site name, host header/bindings, ARR reverse-proxy or URL-rewrite rule targeting `http://127.0.0.1:5000`, and the TLS certificate (subject, path/store, owner, renewal) for each environment.
- L48: WinRM/PowerShell-Remoting configuration (listener, authentication, firewall) between the ADO deploy pool and each app host, plus the service account used for the remote session and to run the Windows service.
- L96: Whether the prod Windows-service environment overrides `NODE_ENV` to `production` outside the repo. Nothing in the repo does so; the generated start script sets `development` for every environment. If prod is intended to run in productio...
- L172: Prod topology in front of the two app servers: load balancer / IIS ARR farm, health-probe path, and session affinity (the app uses a SQL Server-backed session store, so affinity may not be required; confirm).
- L188: The Windows service name(s) per environment, the service manager/wrapper used to create them, the exact command/working directory the service runs (expected to invoke `C:\ClientIQ\Start-Server.ps1` → `npx tsx watch server/index.ts`), the...
- L206: Per-environment SQL Server host/FQDN, database name, and the service login used by the app (owner, permissions). These come from ADO variable groups (`VG-Dev`, `VG-Test`, `VG-Preprod`, `VG-Prod`, `VG-Prod2`) and are not in the repo.
- L225: Whether IIS runs on the same host (restrict to `127.0.0.1`) or a separate host (restrict inbound 5000 to the IIS host's address).
- L242: The RSA IdP host IPs/FQDNs and whether egress is via a proxy; adjust rules to your egress model.
- L251: Where the Windows service writes stdout (service wrapper config), and the current `LOG_LEVEL` per environment if overridden.
- L267: Log-retention policy (retention window, compression, off-host shipping) and any compliance requirement for retaining application/audit logs.
- L366: Host sizing (CPU/RAM) and any Node memory limit (`--max-old-space-size`) required per environment.
- L379: Document owner, review cadence, and whether NSSM/node-windows was ever the real service-creation method (the ADO PowerShell-Remoting pipeline is the authoritative deploy path in the repo). The prior guide was attributed to an individual...

### sql-server-dba-setup.md (16)

- L63: Exact SQL Server host FQDN(s) per environment, instance names, and listener/port for prod. `MSSQL_PORT` is set in deploy scripts but is a **dead variable**: no code reads it, and the `mssql` pool uses the driver default (1433). Do not re...
- L74: Supported/target SQL Server major version, edition, and compatibility level for each environment. The database-settings block in §4 uses values (e.g. compatibility level 160) that must be validated against the real server build before ap...
- L103: Data/index/log **drive layout** (`D:\SQLData`, `E:\SQLLogs`, backup volume), initial sizes, autogrowth, and `MAXSIZE`. These are placeholders. Confirm against the real server build and storage standards.
- L118: ALTER DATABASE ClientIQ SET COMPATIBILITY_LEVEL = 160; -- [CONFIRM] matches server version
- L130: Whether `RECOVERY FULL` is desired in every environment. Full recovery requires transaction-log backups to prevent unbounded log growth (see §11). Lower environments may use `SIMPLE`.
- L145: The authoritative DDL used to create the 40 base tables on each SQL Server host, since no consolidated schema script is committed. Reconcile the physically-created table set against `shared/schema.ts` before relying on the verification c...
- L225: The exact set of AD group names/tokens in the target directory and their mapping to role names, and which role names your environment's `SAML_ROLE_ENV` scope expects. Verify any `BRS` target against the role rows that actually exist (the...
- L331: WITH PASSWORD = N'<set-a-strong-password>', -- [CONFIRM] managed per your secret policy
- L358: WITH PASSWORD = N'<set-a-strong-password>', -- [CONFIRM]
- L368: Password management/rotation policy and the account under which the Windows Service and SQL login run. Passwords must never be committed; the repo's start scripts contain plaintext dev credentials that must not be reused for higher envir...
- L399: Backup **cadence** (full/differential/log frequency), retention period, backup **volume/drive**, off-host copy, and whether log backups are required (depends on the recovery model chosen in §4). None of these are derivable from code.
- L462: Monitoring/alerting integration (SQL Agent alerts, Ops tooling), thresholds, and who receives alerts.
- L495: Whether any environment overrides `NODE_ENV` to `production` at the Windows-Service level. As committed, the generated `Start-Server.ps1` sets `NODE_ENV=development` in every environment, which relaxes DB TLS trust (§1.1). Confirm the in...
- L523: Database HA topology for prod (AG vs FCI vs none), secondary replica hosts, listener name, read-routing, and RPO/RTO targets. dev, test, and preprod each run a single SQL Server database (no HA).
- L538: The actual maintenance **cadence/windows** and who owns each task for the on-prem SQL Server hosts.
- L558: Support contacts, escalation paths, and SLAs (DBA on-call, performance, security, data-corruption). These are governance decisions and are **not** derivable from the repository; do not assume any published SLA values.

### ssl-dns-setup.md (14)

- L9: In this environment the web tier is **IIS (Internet Information Services on Windows Server)**: IIS terminates TLS and reverse-proxies to the Node process on HTTP `:5000`. The exact IIS site bindings, Application Request Routing (ARR) rul...
- L45: The reverse-proxy product and version fronting ClientIQ (IIS + ARR is the expected terminator on the Windows hosts, but the site configuration is not in the repo). Confirm with the infrastructure owner: IIS site name, HTTPS binding, ARR...
- L47: Whether prod uses a hardware/software load balancer in front of the two prod app servers (`Deploy_Prod` and `Deploy_Prod2`; `azure-pipelines.yml:203,229`), and if so where TLS terminates (LB vs each IIS host). Confirm the prod LB/topolog...
- L71: The real per-environment application FQDNs (the actual values bound to `$(SAMLHost)` in the `VG-Dev`, `VG-Test`, `VG-Preprod`, and `VG-Prod`/`VG-Prod2` variable groups). Obtain these from the DNS/infra owner. Each value must match its TL...
- L73: Whether dev and test are published over HTTPS at all. SSO is off in those environments (the app uses the local/mock auth path), so external TLS may or may not be required there; confirm with the infrastructure owner.
- L100: DNS ownership/zone, the actual server/VIP IP addresses, the DNS record TTL standard, and whether prod uses round-robin A records or a load-balancer CNAME. These are infrastructure facts not present in the repo.
- L129: Whether an internal CA is the issuer for ClientIQ server certificates, the CA's request process/portal, and the mandated validity period. These are governance facts not in the repo.
- L170: Whether a wildcard certificate covering the ClientIQ application FQDNs is issued and approved for use, and who owns it.
- L190: The exact IIS site name and HTTPS binding for each environment (hostname, port 443, SNI on/off), and whether binding is done via IIS Manager, `New-WebBinding` + `netsh http add sslcert`, or the `WebAdministration` PowerShell module. This...
- L194: The IIS ARR / URL Rewrite reverse-proxy rule that forwards to `http://127.0.0.1:5000`, including whether `X-Forwarded-Proto` / `X-Forwarded-Host` headers are injected by IIS. The application does **not** set `trust proxy` and does not re...
- L250: The exact ClientIQ Windows Service name per host (the pipeline sets it from `$(serviceName)`; `PipelineTemplates/deploy-nodejs.yml:22,36`) and the IIS service/site name, for the commands above.
- L264: Security posture decisions that are not in the repo: HSTS rollout (max-age, `includeSubDomains`, preload), TLS-version and cipher policy on the IIS hosts, OCSP stapling, and whether the `secure` cookie / `NODE_ENV` mismatch should be rem...
- L316: The renewal SLA/thresholds, certificate/renewal ownership, and the alert distribution list (the legacy doc referenced a `30/14/7`-day cadence and an `ops@fmb.com` alias, neither of which is defined in code). Confirm with the security/PKI...
- L343: - **Application version:** 1.0.0 (`package.json`). Doc version: > **[CONFIRM]** documentation version/owner.

### ui-file-usage.md (3)

- L113: The RBR embedded reporting backend has been retired. Confirm whether `RBRShell.tsx`, its `/rbr` route, and the navbar entry should now be removed, since the iframe target still coded in `RBRShell.tsx` no longer resolves to a live backend.
- L343: Whether the frontend owner wants the alternate account-detail variants, `RecentContactHistory` A/B/base, `AccountSummary` / `AccountCard`, `NotesTab`, `RiskCompliance`, `TopBar`, `TotalRelationshipSummary`, `HouseholdRelationships`, and...
- L349: The authoritative application/version string. The prior "ClientIQ v3" label is not derivable from the frontend source.

### troubleshooting.md (15)

- L14: - **The TLS terminator / reverse proxy in front of the Node app is IIS** (Internet Information Services on Windows Server). IIS terminates TLS and reverse-proxies to the Node process on plain HTTP port `5000`. The exact IIS site bindings...
- L27: Exact prod load-balancer / topology fronting `Deploy_Prod` and `Deploy_Prod2`, and how the IIS tier or LB distributes traffic across them.
- L51: The real external FQDN for each environment (used in the second command).
- L55: Whether a `/health` endpoint is served by IIS or an infra probe, since the app itself only defines `/api/health`.
- L61: The actual Windows Service name per host (the `$(serviceName)` value). Substitute it for `<ClientIQ-Service>` everywhere below.
- L85: The IIS site log directory (default `%SystemDrive%\inetpub\logs\LogFiles\`) and whether stdout is captured anywhere (e.g. by the service wrapper).
- L114: The real SQL Server host/instance and database name per environment. In dev the local script points at `HUB-SQL1TST-LIS` / `ClientIQdev`; production values come from ADO variable groups and are not in the repo.
- L222: Any per-host memory ceiling / capacity expectations for the app tier.
- L268: SQL Server host/instance names and 1433-vs-named-instance ports per environment.
- L286: The real SQL login name(s) per environment and the credential/rotation owner before resetting any password.
- L322: IIS site name, host-header bindings, ARR/URL-Rewrite reverse-proxy rules, request/response timeout settings, and the TLS certificate store location and thumbprint per environment.
- L363: Certificate owner, renewal process, and the store/thumbprint the IIS binding references. The in-repo cert is only the SAML **signing** cert (`./saml_cert.pem`), which is unrelated to the IIS TLS cert.
- L386: The IIS/ARR forwarded-header configuration for each SSO environment.
- L536: The team's documented rollback runbook (which prior ADO build/release to redeploy, and the approval path for a prod rollback across `Deploy_Prod` and `Deploy_Prod2`).
- L546: L1/L2/L3 escalation contacts, on-call rotation, and response-time SLAs. These are governance data not derivable from the repo. Real infra identifiers found in code are the IdP host `portal.fmb.com` and (dev only) the SQL host `HUB-SQL1TS...

## How to Regenerate

These documents were produced by auditing each legacy wiki page against the live code (see `GAP-REPORT.md` and `gaps.json`), rewriting to current state, and rendering to `.docx`. Diagrams are Mermaid, rendered to embedded images. See `tasks/doc-modernization.md` for the full process and decisions.
