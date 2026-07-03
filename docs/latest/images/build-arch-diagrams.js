/* Render each ClientIQ architecture diagram to a grayscale PNG (so the doc works in the on-prem
   Azure DevOps wiki, which does not render Mermaid). Output: docs/latest/images/arch-*.png */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const HERE = __dirname;
const MMDC = path.join(HERE, 'node_modules/.bin/mmdc');
const MMCFG = path.join(HERE, 'mermaid-config.json');
const PPTR = path.join(HERE, 'puppeteer-config.json');
const OUT = '/Users/sravanmodugula/code/BankClient360/docs/latest/images';
const TMP = path.join(HERE, 'diagrams');

const D = {
  'arch-system-context': `flowchart TB
  U["FMB Bank Employees<br/>Tellers, Relationship Managers, Branch Managers, Executives, System Administrators, IT Operations"]
  PERIM["FMB Datacenter Perimeter<br/>Firewall, IDS/IPS, port 443 only, source-IP allowlisting"]
  IIS["IIS Reverse Proxy<br/>TLS 1.3 termination, load balancing, health checks"]
  APP["Application Servers<br/>Windows Server, Node.js + Express (port 5000), React SPA"]
  DB[("SQL Server<br/>App DB, session store, audit; Always On AG in production")]
  SOR["FMB SOR (Jack Henry)<br/>Symitar, Silverlake core banking, Synapse"]
  VAULT["FMB Vault<br/>data warehouse (cleansed)"]
  SPOT["SPOT<br/>data platform (curated views)"]
  RSA["RSA Identity Provider<br/>SAML 2.0 SSO"]
  U -->|HTTPS 443, corporate network / VPN| PERIM
  PERIM --> IIS --> APP --> DB
  SOR --> VAULT --> SPOT -->|daily data load| DB
  APP -. SAML assertion .- RSA`,

  'arch-data-pipeline': `flowchart LR
  JH["Jack Henry<br/>Symitar / Silverlake core banking"]
  SYN["Synapse"]
  VAULT["FMB Vault<br/>data warehouse (cleansed)"]
  SPOT["SPOT<br/>data platform (curated views)"]
  CIQ[("ClientIQ<br/>SQL Server database")]
  APP["ClientIQ application"]
  JH --> VAULT
  SYN --> VAULT
  VAULT --> SPOT
  SPOT -->|initial bulk load + daily delta| CIQ
  CIQ --> APP`,

  'arch-component': `flowchart TB
  subgraph PRES["Presentation Layer"]
    P["Customer Dashboard, Household Management, Account Summary,<br/>Transaction History, Notes, Customer Overview<br/>React 18, TypeScript, Material-UI, TanStack Query, Wouter, React Hook Form + Zod"]
  end
  subgraph API["API Layer (Express.js on Windows Server)"]
    G["API routes (/api/customers, /api/accounts, ...) with Zod request validation"]
    AUTHN["Authentication middleware: SAML 2.0 SSO (RSA IdP), session validation, employee upsert"]
    AUTHZ["Authorization middleware: RBAC permission checks, ABAC evaluation, privilege levels"]
    G --- AUTHN --- AUTHZ
  end
  subgraph BIZ["Business Logic Layer"]
    ADPT["Customer adapter: PII masking, DTO mapping"]
    SVC["Account, Household, Transaction, Search, Permission, and Note services"]
    ADPT --- SVC
  end
  subgraph DAL["Data Access Layer"]
    MSSQL["Parameterized mssql queries, connection pooling"]
    SEARCH["Case-insensitive LIKE search over full_name"]
    SESS["SQL Server session store"]
    MSSQL --- SEARCH --- SESS
  end
  PRES -->|HTTPS / JSON| API --> BIZ --> DAL --> DB[("SQL Server: App DB, sessions, audit")]`,

  'arch-core-erd': `erDiagram
    region ||--o{ branch : "region_id"
    address ||--o{ branch : "address_id"
    branch ||--o{ customer : "branch_id"
    branch ||--o{ account : "branch_id"
    employee ||--o{ household : "relationship_manager_id"
    household ||--o{ household : "parent_household_id (self)"
    customer ||--o{ household_membership : "customer_id"
    household ||--o{ household_membership : "household_id"
    account ||--o{ account_ownership : "account_id"
    customer ||--o{ account_ownership : "customer_id"
    employee ||--o{ employee_branch : "employee_id"
    branch ||--o{ employee_branch : "branch_id"
    customer ||--o{ customer_officer_assignment : "customer_id"
    account ||--o{ debit_card : "account_id"
    customer ||--o{ debit_card : "customer_id"
    debit_card_limit_profile ||--o{ debit_card : "limit_profile_id"
    customer {
        bigint customer_id PK "IDENTITY"
        varchar first_name "nullable"
        varchar last_name "nullable"
        varchar business_name "nullable"
        varchar full_name "generated/derived"
        varchar tax_identifier UK
        varchar customer_type "default regular"
        bigint branch_id FK "-> branch"
        varchar jack_henry_cif_number
        varchar silverlake_customer_id
    }
    household {
        bigint household_id PK "IDENTITY"
        varchar household_name
        varchar household_type "default family"
        bigint relationship_manager_id FK "-> employee"
        bigint parent_household_id FK "-> household (self)"
    }
    employee {
        bigint employee_id PK "IDENTITY"
        varchar employee_number UK
        varchar officer_code UK
        varchar sso_subject UK "SAML subject"
        nvarchar(max) last_seen_saml_role
        datetime2 deleted_at "soft delete"
    }
    account {
        bigint account_id PK "IDENTITY"
        varchar account_number UK
        varchar account_type
        varchar account_status "default active"
        decimal balance
        bigint branch_id FK "-> branch"
        varchar jack_henry_account_id
    }
    debit_card {
        bigint card_id PK "IDENTITY"
        bigint account_id FK "NOT NULL -> account"
        bigint customer_id FK "NOT NULL -> customer"
        bigint limit_profile_id FK "-> debit_card_limit_profile"
        varchar last_four_digits "PCI: last 4 only"
    }
    debit_card_limit_profile {
        bigint profile_id PK "IDENTITY"
        decimal daily_purchase_limit
        decimal daily_atm_limit
    }`,

  'arch-deployment': `flowchart TB
  subgraph DEV["Development (branch: develop): synthetic data"]
    D1["App server (1 instance)"] --> D2[("SQL Server (standalone)")]
  end
  subgraph TEST["Test (branch: test): masked / obfuscated data"]
    T1["App server (1 instance)"] --> T2[("SQL Server (standalone)")]
  end
  subgraph PRE["Pre-production (branch: preprod, SSO on): production data, bankers only"]
    R1["App server (1 instance)"] --> R2[("SQL Server (standalone)")]
  end
  subgraph PROD["Production (branch: prod, SSO on): production data"]
    direction TB
    PLB["IIS reverse proxy (HA pair)<br/>TLS 1.3, load balancing, health checks"]
    PA["App servers (2 instances)"]
    PDB[("SQL Server Always On AG (2 nodes)<br/>synchronous commit, automatic failover")]
    PLB --> PA --> PDB
  end`,

  'arch-cicd': `flowchart TB
  subgraph BUILD["Build (Azure DevOps, on-prem agents)"]
    B1["npm install, lint, tsc type-check, unit tests, build"]
    B2["SonarQube SAST (develop)"]
    B1 --> B2
  end
  BUILD --> DDEV["Deploy Dev (branch: develop)"]
  DDEV --> DTEST["Deploy Test (branch: test)<br/>OWASP ZAP DAST"]
  DTEST --> DPRE["Deploy PreProd (branch: preprod)"]
  DPRE --> DPROD["Deploy Prod (branch: prod)<br/>two app servers, Windows Service restart"]`,

  'arch-saml-sequence': `sequenceDiagram
  participant U as Browser
  participant IIS as IIS
  participant APP as ClientIQ (Node)
  participant RSA as RSA SecurID (IdP)
  participant DB as SQL Server
  U->>RSA: Launch ClientIQ tile from RSA portal
  RSA->>U: SAML Response (HTTP-POST)
  U->>IIS: POST /saml/acs
  IIS->>APP: forward :5000
  APP->>APP: Validate assertion (signature, clock skew)
  APP->>APP: Regenerate session (fixation defense)
  APP->>DB: upsertEmployeeFromSaml (find/create employee)
  APP->>APP: Map AD groups to role names (adGroupRoleMap)
  APP->>DB: Enforced role sync (assign/revoke AD-derived roles)
  APP->>DB: Load permissions, then ensure Branch Manager fallback
  APP->>U: 302 to / with clientiq.sid session cookie`,
};

for (const [name, src] of Object.entries(D)) {
  const inp = path.join(TMP, name + '.mmd');
  const outp = path.join(OUT, name + '.png');
  fs.writeFileSync(inp, src);
  try {
    execFileSync(MMDC, ['-i', inp, '-o', outp, '-c', MMCFG, '-p', PPTR, '-b', 'white', '-s', '3'], { stdio: 'pipe' });
    const buf = fs.readFileSync(outp);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    console.log(`  OK  ${name}.png  ${w}x${h}`);
  } catch (e) {
    console.log(`  FAIL ${name}: ${String(e.message).split('\n')[0]}`);
  }
}
