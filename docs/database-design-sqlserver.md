# ClientIQ - SQL Server Database Design Document

**Version:** 1.0  
**Last Updated:** October 22, 2025  
**Database Engine:** Microsoft SQL Server 2019+  
**Compatibility:** SQL Server 2019, 2022 (STRING_SIMILARITY function)

---

## Table of Contents

1. [Overview](#overview)
2. [SQL Server Features](#sql-server-features)
3. [Entity Relationship Summary](#entity-relationship-summary)
4. [Table Definitions](#table-definitions)
5. [Indexes](#indexes)
6. [Constraints and Rules](#constraints-and-rules)
7. [Triggers](#triggers)
8. [Data Integrity](#data-integrity)
9. [Performance Considerations](#performance-considerations)

---

## Overview

This database supports a comprehensive banking client 360 application that integrates with Jack Henry and Silverlake core banking systems. The SQL Server implementation maintains complete parity with the PostgreSQL version while leveraging SQL Server-specific features.

### Design Principles

- **Dual-Database Parity**: Functionally equivalent to PostgreSQL implementation
- **Data Integrity**: Extensive use of foreign keys, check constraints, and triggers
- **Performance**: Strategic indexing, full-text search, computed columns
- **Compliance**: PCI-DSS compliance for card data, audit trails
- **Search Optimization**: Full-text search and STRING_SIMILARITY for fuzzy matching



### Core Banking Integration
- **Jack Henry CIF**: Customer Information File integration
- **Silverlake**: Account structure and transaction synchronization
- **Real-time Sync**: Designed for read-only display of core banking data

---







## SQL Server Features

### Full-Text Search Configuration

```sql
-- Migration 0001: Enable full-text search
-- Create full-text catalog
CREATE FULLTEXT CATALOG banking_ft_catalog AS DEFAULT;

-- Full-text index on customer names (created in migration 0006)
CREATE FULLTEXT INDEX ON customer(first_name, last_name, business_name)
  KEY INDEX PK_customer
  WITH STOPLIST = SYSTEM;
```

### Fuzzy Search Implementation

**SQL Server 2022+:**
```sql
-- Uses STRING_SIMILARITY function (similar to PostgreSQL pg_trgm)
SELECT customer_id, full_name,
       STRING_SIMILARITY(full_name, 'search_term', 0.3) AS match_score
FROM customer
WHERE STRING_SIMILARITY(full_name, 'search_term', 0.3) > 0
ORDER BY match_score DESC;
```

**SQL Server 2019:**
```sql
-- Uses SOUNDEX and DIFFERENCE for phonetic matching
SELECT customer_id, full_name,
       DIFFERENCE(full_name, 'search_term') AS match_score
FROM customer
WHERE DIFFERENCE(full_name, 'search_term') >= 3
ORDER BY match_score DESC;
```

### Computed Columns

```sql
-- Customer full_name as computed persisted column
ALTER TABLE customer ADD full_name AS (
  CASE 
    WHEN customer_type IN ('business', 'trust') THEN business_name
    ELSE LTRIM(RTRIM(CONCAT(first_name, ' ', last_name)))
  END
) PERSISTED;
```




## Entity Relationship Summary

### Core Banking Entities

```
Customer (1) ──────< (M) Account Ownership (M) >────── (1) Account
    │                                                        │
    │                                                        │
    └──< (M) Household Membership (M) >─── Household        │
    │                                                        │
    └──< (M) Entity Contact (M) >────────── Contact Info    │
    │                                                        │
    └──< (M) Entity Address (M) >────────── Address         │
                                                             │
                                                             └──< (M) Financial Transaction
                                                             │
                                                             └──< (M) Debit Card
```

---

## Table Definitions

### 1. CORE BANKING TABLES

#### 1.1 `customer`

Primary entity representing individual and business customers.

```sql
CREATE TABLE customer (
  customer_id           BIGINT IDENTITY(1,1) PRIMARY KEY,
  -- Individual customer fields
  first_name            VARCHAR(100) NULL,
  last_name             VARCHAR(100) NULL,
  middle_name           VARCHAR(100) NULL,
  preferred_name        VARCHAR(100) NULL,
  title                 VARCHAR(20) NULL,
  suffix                VARCHAR(20) NULL,
  date_of_birth         DATE NULL,
  gender                VARCHAR(20) NULL,
  marital_status        VARCHAR(20) NULL,
  -- Business/organization fields
  business_name         VARCHAR(200) NULL,
  -- Computed full name field
  full_name             AS (
    CASE 
      WHEN customer_type IN ('business', 'trust') THEN business_name
      ELSE LTRIM(RTRIM(CONCAT(first_name, ' ', last_name)))
    END
  ) PERSISTED,
  -- Identification
  tax_identifier        VARCHAR(20) NULL UNIQUE,
  government_id         VARCHAR(50) NULL,
  government_id_type    VARCHAR(20) NULL,
  citizenship           VARCHAR(50) NULL,
  -- Customer classification
  customer_type         VARCHAR(20) NOT NULL DEFAULT 'regular',
  customer_status       VARCHAR(20) DEFAULT 'active',
  customer_since        DATE DEFAULT GETDATE(),
  -- Compliance
  kyc_status            VARCHAR(20) NULL,
  kyc_last_updated      DATE NULL,
  risk_rating           VARCHAR(20) NULL,
  -- Preferences
  language_preference   VARCHAR(10) DEFAULT 'en',
  -- Core banking integration
  jack_henry_cif_number VARCHAR(20) NULL,
  silverlake_customer_id VARCHAR(20) NULL,
  -- Flags
  is_employee           BIT DEFAULT 0,
  vip_customer          BIT DEFAULT 0,
  is_deceased           BIT DEFAULT 0,
  -- Audit
  created_at            DATETIME2 DEFAULT GETDATE(),
  updated_at            DATETIME2 DEFAULT GETDATE(),
  
  -- Check constraint for conditional name requirements
  CONSTRAINT customer_name_type_check CHECK (
    CASE 
      WHEN customer_type IN ('individual', 'premium', 'regular') 
        THEN CASE WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN 1 ELSE 0 END
      WHEN customer_type IN ('business', 'trust') 
        THEN CASE WHEN business_name IS NOT NULL THEN 1 ELSE 0 END
      ELSE 1
    END = 1
  )
);
```

**Indexes:**
```sql
CREATE INDEX idx_customer_tax_id ON customer(tax_identifier);
CREATE INDEX idx_customer_full_name ON customer(full_name);
CREATE INDEX idx_customer_status ON customer(customer_status);
CREATE INDEX idx_customer_jack_henry_cif ON customer(jack_henry_cif_number);
CREATE INDEX idx_customer_silverlake_id ON customer(silverlake_customer_id);
CREATE INDEX idx_customer_government_id ON customer(government_id);

-- Full-text index for fuzzy search
CREATE FULLTEXT INDEX ON customer(first_name, last_name, business_name, full_name)
  KEY INDEX PK_customer;
```

**Business Rules:**
- **Conditional Name Requirements** (enforced by CHECK constraint):
  - Individual customers: MUST have `first_name` AND `last_name`
  - Business customers: MUST have `business_name`
- **Auto-computed full_name**: Persisted computed column
  - Individuals: `first_name + ' ' + last_name`
  - Businesses: `business_name`

**Data Types (SQL Server vs PostgreSQL):**
- `BIGINT IDENTITY(1,1)` ≡ PostgreSQL `BIGSERIAL`
- `DATETIME2` ≡ PostgreSQL `TIMESTAMP`
- `BIT` ≡ PostgreSQL `BOOLEAN`
- `NVARCHAR(MAX)` ≡ PostgreSQL `TEXT`

---

#### 1.2 `account`

Bank accounts (checking, savings, loans, credit cards, etc.)

```sql
CREATE TABLE account (
  account_id                BIGINT IDENTITY(1,1) PRIMARY KEY,
  account_number            VARCHAR(50) NOT NULL UNIQUE,
  account_type              VARCHAR(50) NOT NULL,
  account_subtype           VARCHAR(50) NULL,
  account_status            VARCHAR(20) NOT NULL DEFAULT 'active',
  balance                   DECIMAL(15,2) DEFAULT 0,
  available_balance         DECIMAL(15,2) DEFAULT 0,
  currency                  VARCHAR(3) DEFAULT 'USD',
  interest_rate             DECIMAL(5,4) NULL,
  credit_limit              DECIMAL(15,2) NULL,
  branch_id                 BIGINT NULL,
  product_code              VARCHAR(50) NULL,
  opened_date               DATE DEFAULT GETDATE(),
  closed_date               DATE NULL,
  last_transaction_date     DATE NULL,
  maturity_date             DATE NULL,
  jack_henry_account_id     VARCHAR(50) NULL,
  silverlake_account_structure VARCHAR(200) NULL,
  account_class             VARCHAR(50) NULL,
  statement_cycle           VARCHAR(20) NULL,
  statement_code_desc       VARCHAR(200) NULL,
  average_balance           DECIMAL(15,2) NULL,
  last_maintenance_date     DATE NULL,
  sic_code                  BIGINT NULL,
  created_at                DATETIME2 DEFAULT GETDATE(),
  updated_at                DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_account_branch FOREIGN KEY (branch_id) 
    REFERENCES branch(branch_id),
  CONSTRAINT fk_account_sic_code FOREIGN KEY (sic_code) 
    REFERENCES sic_code(sic_code)
);
```

**Indexes:**
```sql
CREATE INDEX idx_account_number ON account(account_number);
CREATE INDEX idx_account_type ON account(account_type);
CREATE INDEX idx_account_status ON account(account_status);
CREATE INDEX idx_account_jack_henry ON account(jack_henry_account_id);
CREATE INDEX idx_account_sic_code ON account(sic_code);
```

---

#### 1.3 `financial_transaction`

Complete transaction history with core banking balance tracking.

```sql
CREATE TABLE financial_transaction (
  transaction_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
  account_id              BIGINT NOT NULL,
  amount                  DECIMAL(15,2) NOT NULL,
  transaction_code        VARCHAR(30) NULL,
  transaction_type        VARCHAR(30) NULL,
  status                  VARCHAR(20) NOT NULL,
  transaction_date        DATETIME2 NOT NULL,
  posting_date            DATETIME2 NOT NULL,
  description             NVARCHAR(MAX) NULL,
  reference_number        VARCHAR(64) NULL,
  merchant_name           VARCHAR(200) NULL,
  merchant_category_code  VARCHAR(4) NULL,
  category_id             BIGINT NULL,
  transfer_group_id       UNIQUEIDENTIFIER NULL,
  counterparty_account_id BIGINT NULL,
  related_transaction_id  BIGINT NULL,
  ledger_balance_after    DECIMAL(15,2) NOT NULL,
  available_balance_after DECIMAL(15,2) NOT NULL,
  source_system           VARCHAR(32) NOT NULL DEFAULT 'jack_henry',
  source_transaction_id   VARCHAR(128) NULL,
  raw_payload             NVARCHAR(MAX) NULL, -- JSON storage
  debit_card_id           BIGINT NULL,
  created_at              DATETIME2 DEFAULT GETDATE(),
  updated_at              DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_transaction_account 
    FOREIGN KEY (account_id) REFERENCES account(account_id),
  CONSTRAINT fk_transaction_category 
    FOREIGN KEY (category_id) REFERENCES transaction_category(category_id),
  CONSTRAINT fk_transaction_counterparty 
    FOREIGN KEY (counterparty_account_id) REFERENCES account(account_id),
  CONSTRAINT fk_transaction_debit_card 
    FOREIGN KEY (debit_card_id) REFERENCES debit_card(card_id) 
    ON DELETE SET NULL,
  
  -- Unique constraint for deduplication
  CONSTRAINT unq_account_source_txn 
    UNIQUE (account_id, source_system, source_transaction_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_transaction_account_posting 
  ON financial_transaction(account_id, posting_date, transaction_id);

CREATE INDEX idx_transaction_account_status 
  ON financial_transaction(account_id, status, posting_date);

CREATE INDEX idx_transaction_account_date 
  ON financial_transaction(account_id, transaction_date);

CREATE INDEX idx_transaction_transfer_group 
  ON financial_transaction(transfer_group_id);

CREATE INDEX idx_transaction_counterparty 
  ON financial_transaction(counterparty_account_id);

CREATE INDEX idx_transaction_merchant_category 
  ON financial_transaction(merchant_category_code);

CREATE INDEX idx_transaction_category 
  ON financial_transaction(category_id);

CREATE INDEX idx_transaction_debit_card 
  ON financial_transaction(debit_card_id, posting_date DESC);
```

**SQL Server Specifics:**
- `NVARCHAR(MAX)` used for JSON storage (raw_payload, description)
- `UNIQUEIDENTIFIER` for transfer_group_id (equivalent to PostgreSQL UUID)
- Descending index on posting_date for recent transaction queries

---

### 2. DEBIT CARD TABLES

#### 2.1 `debit_card_limit_profile`

Reusable spending limit templates for debit cards.





CREATE TABLE debit_card_limit_profile (
  profile_id              BIGINT IDENTITY(1,1) PRIMARY KEY,
  profile_name            VARCHAR(100) NOT NULL,
  profile_description     NVARCHAR(MAX) NULL,
  daily_purchase_limit    DECIMAL(15,2) NOT NULL,
  daily_atm_limit         DECIMAL(15,2) NOT NULL,
  single_transaction_limit DECIMAL(15,2) NULL,
  monthly_limit           DECIMAL(15,2) NULL,
  created_at              DATETIME2 DEFAULT GETDATE(),
  updated_at              DATETIME2 DEFAULT GETDATE()
);
```

**Default Profiles (Seeded):**
1. Standard Personal: $2,500 daily purchase, $500 ATM
2. Premium Personal: $10,000 daily purchase, $1,000 ATM
3. Business Standard: $25,000 daily purchase, $2,000 ATM
4. Business Premium: $100,000 daily purchase, $5,000 ATM
5. Employee Card: $500 daily purchase, $200 ATM

---

#### 2.2 `debit_card`

Debit card information (read-only display, PCI-compliant).

```sql
CREATE TABLE debit_card (
  card_id               BIGINT IDENTITY(1,1) PRIMARY KEY,
  account_id            BIGINT NOT NULL,
  limit_profile_id      BIGINT NULL,
  card_type             VARCHAR(30) NOT NULL,
  card_status           VARCHAR(30) NOT NULL,
  last_four_digits      VARCHAR(4) NOT NULL,
  card_brand            VARCHAR(20) NULL,
  expiry_month          BIGINT NOT NULL,
  expiry_year           BIGINT NOT NULL,
  cardholder_name       VARCHAR(100) NOT NULL,
  jack_henry_card_id    VARCHAR(50) NULL,
  silverlake_card_token VARCHAR(100) NULL,
  created_at            DATETIME2 DEFAULT GETDATE(),
  updated_at            DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_debit_card_account 
    FOREIGN KEY (account_id) REFERENCES account(account_id),
  CONSTRAINT fk_debit_card_limit_profile 
    FOREIGN KEY (limit_profile_id) REFERENCES debit_card_limit_profile(profile_id),
  CONSTRAINT chk_expiry_month 
    CHECK (expiry_month >= 1 AND expiry_month <= 12),
  CONSTRAINT chk_expiry_year 
    CHECK (expiry_year >= YEAR(GETDATE()))
);
```

**Business Rules (enforced by trigger):**
- Debit cards can ONLY be issued to accounts with `account_type` IN ('checking', 'business_checking')
- Trigger `trg_validate_debit_card_account_type` enforces this rule

**PCI Compliance:**
- Only last 4 digits stored
- No full PAN, CVV, or PIN storage
- Card tokens used for core banking references

**Indexes:**

CREATE INDEX idx_debit_card_account ON debit_card(account_id);
CREATE INDEX idx_debit_card_status ON debit_card(card_status);
CREATE INDEX idx_debit_card_last_four ON debit_card(account_id, last_four_digits);


**Trigger:**sql
CREATE TRIGGER trg_validate_debit_card_account_type
ON debit_card
FOR INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  
  IF EXISTS (
    SELECT 1 
    FROM inserted i
    LEFT JOIN account a ON i.account_id = a.account_id
    WHERE a.account_type NOT IN ('checking', 'business_checking')
       OR a.account_id IS NULL
  )
  BEGIN
    DECLARE @ErrorMsg NVARCHAR(500);
    DECLARE @AccountId BIGINT;
    DECLARE @AccountType VARCHAR(50);
    
    SELECT TOP 1 
      @AccountId = i.account_id,
      @AccountType = ISNULL(a.account_type, 'NOT FOUND')
    FROM inserted i
    LEFT JOIN account a ON i.account_id = a.account_id
    WHERE a.account_type NOT IN ('checking', 'business_checking')
       OR a.account_id IS NULL;
    
    SET @ErrorMsg = 'Debit cards can only be issued to checking or business_checking accounts. Account ' 
      + CAST(@AccountId AS VARCHAR(20)) + ' has type ' + @AccountType;
    
    RAISERROR(@ErrorMsg, 16, 1);
    ROLLBACK TRANSACTION;
  END
END;
GO
```

---

### 3. RELATIONSHIP TABLES

#### 3.1 `account_ownership`

Links customers to accounts with ownership details.

```sql
CREATE TABLE account_ownership (
  ownership_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
  account_id              BIGINT NOT NULL,
  customer_id             BIGINT NOT NULL,
  ownership_type          VARCHAR(50) NOT NULL,
  ownership_percentage    DECIMAL(5,2) DEFAULT 100.00,
  is_primary_owner        BIT DEFAULT 0,
  signing_authority       BIT DEFAULT 1,
  can_view_statements     BIT DEFAULT 1,
  can_make_transactions   BIT DEFAULT 1,
  transaction_limit       DECIMAL(15,2) NULL,
  relationship_start_date DATE DEFAULT GETDATE(),
  relationship_end_date   DATE NULL,
  created_at              DATETIME2 DEFAULT GETDATE(),
  updated_at              DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_ownership_account 
    FOREIGN KEY (account_id) REFERENCES account(account_id),
  CONSTRAINT fk_ownership_customer 
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
);
```

---

#### 3.2 `household`

Customer household groupings for relationship management.

```sql
CREATE TABLE household (
  household_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
  household_name          VARCHAR(200) NOT NULL,
  household_type          VARCHAR(50) DEFAULT 'family',
  total_assets            DECIMAL(15,2) DEFAULT 0,
  total_liabilities       DECIMAL(15,2) DEFAULT 0,
  household_status        VARCHAR(20) DEFAULT 'active',
  risk_rating             VARCHAR(20) NULL,
  relationship_manager_id BIGINT NULL,
  established_date        DATE DEFAULT GETDATE(),
  tax_filing_status       VARCHAR(20) NULL,
  created_at              DATETIME2 DEFAULT GETDATE(),
  updated_at              DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_household_rm 
    FOREIGN KEY (relationship_manager_id) REFERENCES employee(employee_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_household_status ON household(household_status);
CREATE INDEX idx_household_rm ON household(relationship_manager_id);
```

---

#### 3.3 `household_membership`

Links customers to households.

```sql
CREATE TABLE household_membership (
  membership_id           BIGINT IDENTITY(1,1) PRIMARY KEY,
  household_id            BIGINT NOT NULL,
  customer_id             BIGINT NOT NULL,
  relationship_role       VARCHAR(50) NOT NULL,
  is_primary_member       BIT DEFAULT 0,
  is_head_of_household    BIT DEFAULT 0,
  membership_start_date   DATE DEFAULT GETDATE(),
  membership_end_date     DATE NULL,
  rollup_accounts         BIT DEFAULT 1,
  rollup_percentage       DECIMAL(5,2) DEFAULT 100.00,
  notes                   NVARCHAR(MAX) NULL,
  created_at              DATETIME2 DEFAULT GETDATE(),
  updated_at              DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_membership_household 
    FOREIGN KEY (household_id) REFERENCES household(household_id),
  CONSTRAINT fk_membership_customer 
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
);
```

---

### 4. SUPPORTING TABLES

#### 4.1 `branch`

Bank branch locations.



CREATE TABLE branch (
  branch_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
  branch_code   VARCHAR(10) NOT NULL UNIQUE,
  branch_name   VARCHAR(100) NOT NULL,
  branch_type   VARCHAR(20) NULL,
  address_id    BIGINT NULL,
  is_active     BIT DEFAULT 1,
  opened_date   DATE NULL,
  created_at    DATETIME2 DEFAULT GETDATE(),
  updated_at    DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_branch_address 
    FOREIGN KEY (address_id) REFERENCES address(address_id)
);
```

---

#### 4.2 `employee`

Bank employees.


CREATE TABLE employee (
  employee_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
  employee_number VARCHAR(20) NOT NULL UNIQUE,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  title           VARCHAR(50) NULL,
  position        VARCHAR(100) NULL,
  officer_code    VARCHAR(20) NULL UNIQUE,
  department      VARCHAR(50) NULL,
  is_active       BIT DEFAULT 1,
  hire_date       DATE NULL,
  created_at      DATETIME2 DEFAULT GETDATE(),
  updated_at      DATETIME2 DEFAULT GETDATE()
);
```

---

#### 4.3 `address`

Physical addresses for entities.

```sql
CREATE TABLE address (
  address_id      BIGINT IDENTITY(1,1) PRIMARY KEY,
  address_line1   VARCHAR(200) NOT NULL,
  address_line2   VARCHAR(200) NULL,
  city            VARCHAR(100) NOT NULL,
  state           VARCHAR(50) NULL,
  postal_code     VARCHAR(20) NULL,
  country         VARCHAR(50) NOT NULL DEFAULT 'US',
  address_type    VARCHAR(20) NULL,
  is_primary      BIT DEFAULT 0,
  validated       BIT DEFAULT 0,
  validation_date DATETIME2 NULL,
  created_at      DATETIME2 DEFAULT GETDATE(),
  updated_at      DATETIME2 DEFAULT GETDATE()
);
```

---

#### 4.4 `contact_info`

Contact information (phone, email, etc.)

```sql
CREATE TABLE contact_info (
  contact_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
  contact_type      VARCHAR(20) NOT NULL,
  contact_value     VARCHAR(200) NOT NULL,
  contact_subtype   VARCHAR(20) NULL,
  is_primary        BIT DEFAULT 0,
  is_verified       BIT DEFAULT 0,
  verification_date DATETIME2 NULL,
  can_contact       BIT DEFAULT 1,
  preferred_time    VARCHAR(50) NULL,
  created_at        DATETIME2 DEFAULT GETDATE(),
  updated_at        DATETIME2 DEFAULT GETDATE()
);
```

**Indexes:**
```sql
CREATE INDEX idx_contact_info_type ON contact_info(contact_type, contact_value);
```

---

#### 4.5 `sic_code`

Standard Industrial Classification codes.

```sql
CREATE TABLE sic_code (
  sic_code    BIGINT PRIMARY KEY,
  description VARCHAR(500) NOT NULL,
  is_active   BIT DEFAULT 1,
  created_at  DATETIME2 DEFAULT GETDATE(),
  updated_at  DATETIME2 DEFAULT GETDATE()
);
```


**Indexes:**
```sql
CREATE INDEX idx_sic_code_description ON sic_code(description);
```

---

#### 4.6 `transaction_category`

Transaction categorization hierarchy.

```sql
CREATE TABLE transaction_category (
  category_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  parent_id   BIGINT NULL,
  group_code  VARCHAR(30) NULL,
  created_at  DATETIME2 DEFAULT GETDATE(),
  updated_at  DATETIME2 DEFAULT GETDATE()
);
```

---

### 5. JUNCTION/LINKING TABLES

#### 5.1 `entity_address`

Links addresses to any entity (customer, branch, etc.)

```sql
CREATE TABLE entity_address (
  entity_address_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  entity_type       VARCHAR(20) NOT NULL,
  entity_id         BIGINT NOT NULL,
  address_id        BIGINT NOT NULL,
  address_purpose   VARCHAR(20) NOT NULL DEFAULT 'primary',
  is_current        BIT DEFAULT 1,
  start_date        DATE DEFAULT GETDATE(),
  end_date          DATE NULL,
  created_at        DATETIME2 DEFAULT GETDATE(),
  updated_at        DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_entity_address_address 
    FOREIGN KEY (address_id) REFERENCES address(address_id)
);
```

---





#### 5.2 `entity_contact`

Links contact info to any entity.

```sql
CREATE TABLE entity_contact (
  entity_contact_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  entity_type       VARCHAR(20) NOT NULL,
  entity_id         BIGINT NOT NULL,
  contact_id        BIGINT NOT NULL,
  contact_purpose   VARCHAR(20) DEFAULT 'primary',
  is_current        BIT DEFAULT 1,
  start_date        DATE DEFAULT GETDATE(),
  end_date          DATE NULL,
  created_at        DATETIME2 DEFAULT GETDATE(),
  updated_at        DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_entity_contact_contact 
    FOREIGN KEY (contact_id) REFERENCES contact_info(contact_id)
);
```

---

#### 5.3 `employee_branch`

Links employees to branches.

```sql
CREATE TABLE employee_branch (
  employee_branch_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  employee_id        BIGINT NOT NULL,
  branch_id          BIGINT NOT NULL,
  assignment_role    VARCHAR(100) NULL,
  is_primary         BIT DEFAULT 0,
  start_date         DATE NULL,
  end_date           DATE NULL,
  is_active          BIT DEFAULT 1,
  created_at         DATETIME2 DEFAULT GETDATE(),
  updated_at         DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_employee_branch_employee 
    FOREIGN KEY (employee_id) REFERENCES employee(employee_id),
  CONSTRAINT fk_employee_branch_branch 
    FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
  CONSTRAINT unq_employee_branch 
    UNIQUE (employee_id, branch_id)
);






**Indexes:**
```sql
CREATE INDEX idx_employee_branch_employee ON employee_branch(employee_id);
CREATE INDEX idx_employee_branch_branch ON employee_branch(branch_id);
CREATE INDEX idx_employee_branch_primary ON employee_branch(employee_id, is_primary);
```

---

#### 5.4 `customer_officer_assignment`

Links customers to relationship officers.

```sql
CREATE TABLE customer_officer_assignment (
  customer_id       BIGINT NOT NULL,
  officer_code      VARCHAR(20) NOT NULL,
  relationship_type VARCHAR(20) NOT NULL,
  created_at        DATETIME2 DEFAULT GETDATE(),
  updated_at        DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT pk_customer_officer PRIMARY KEY (customer_id, officer_code),
  CONSTRAINT fk_customer_officer_customer 
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_customer_officer_customer ON customer_officer_assignment(customer_id);
CREATE INDEX idx_customer_officer_code ON customer_officer_assignment(officer_code);
CREATE INDEX idx_customer_officer_type ON customer_officer_assignment(officer_code, relationship_type);
```

---

#### 5.5 `customer_sic_code`

Links customers to SIC codes (many-to-many).

```sql
CREATE TABLE customer_sic_code (
  customer_id BIGINT NOT NULL,
  sic_code    BIGINT NOT NULL,
  assigned_at DATETIME2 DEFAULT GETDATE(),
  updated_at  DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT pk_customer_sic PRIMARY KEY (customer_id, sic_code),
  CONSTRAINT fk_customer_sic_customer 
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
  CONSTRAINT fk_customer_sic_code 
    FOREIGN KEY (sic_code) REFERENCES sic_code(sic_code)
);
```

**Indexes:**
```sql
CREATE INDEX idx_customer_sic_customer ON customer_sic_code(customer_id);
CREATE INDEX idx_customer_sic_code ON customer_sic_code(sic_code);
```

---

### 6. DASHBOARD/REPORTING TABLES

#### 6.1 `online_banking_user`

Online banking user accounts.

```sql
CREATE TABLE online_banking_user (
  online_banking_user_id BIGINT IDENTITY(1,1) PRIMARY KEY,
  customer_id            BIGINT NOT NULL,
  login_id               VARCHAR(50) NOT NULL UNIQUE,
  status                 VARCHAR(20) DEFAULT 'active',
  last_login_at          DATETIME2 NULL,
  failed_attempts        BIGINT DEFAULT 0,
  locked_at              DATETIME2 NULL,
  created_at             DATETIME2 DEFAULT GETDATE(),
  updated_at             DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_online_banking_customer 
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_online_banking_customer ON online_banking_user(customer_id);
CREATE INDEX idx_online_banking_login_id ON online_banking_user(login_id);
CREATE INDEX idx_online_banking_status ON online_banking_user(status);
```

---

#### 6.2 `online_banking_login_event`

Login activity tracking.

```sql
CREATE TABLE online_banking_login_event (
  event_id               BIGINT IDENTITY(1,1) PRIMARY KEY,
  online_banking_user_id BIGINT NOT NULL,
  occurred_at            DATETIME2 NOT NULL DEFAULT GETDATE(),
  channel                VARCHAR(20) DEFAULT 'web',
  result                 VARCHAR(20) NOT NULL,
  ip_address             VARCHAR(45) NULL,
  user_agent             NVARCHAR(MAX) NULL,
  created_at             DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_login_event_user 
    FOREIGN KEY (online_banking_user_id) REFERENCES online_banking_user(online_banking_user_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_login_event_user_time ON online_banking_login_event(online_banking_user_id, occurred_at);
CREATE INDEX idx_login_event_result ON online_banking_login_event(result, occurred_at);
```

---

#### 6.3 `contact_history`

Customer contact/interaction history.

```sql
CREATE TABLE contact_history (
  contact_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
  customer_id   BIGINT NOT NULL,
  employee_id   BIGINT NULL,
  contact_type  VARCHAR(30) NOT NULL,
  occurred_at   DATETIME2 NOT NULL DEFAULT GETDATE(),
  employee_name VARCHAR(200) NULL,
  summary       NVARCHAR(MAX) NULL,
  channel       VARCHAR(30) NULL,
  outcome       VARCHAR(50) NULL,
  created_at    DATETIME2 DEFAULT GETDATE(),
  updated_at    DATETIME2 DEFAULT GETDATE(),
  
  CONSTRAINT fk_contact_history_customer 
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
  CONSTRAINT fk_contact_history_employee 
    FOREIGN KEY (employee_id) REFERENCES employee(employee_id)
);
```

**Indexes:**
```sql
CREATE INDEX idx_contact_history_customer_time ON contact_history(customer_id, occurred_at);
CREATE INDEX idx_contact_history_type ON contact_history(contact_type);
CREATE INDEX idx_contact_history_employee ON contact_history(employee_id);
```

---

## Constraints and Rules

### Check Constraints

#### customer table
```sql
ALTER TABLE customer ADD CONSTRAINT customer_name_type_check CHECK (
  CASE 
    WHEN customer_type IN ('individual', 'premium', 'regular') 
      THEN CASE WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN 1 ELSE 0 END
    WHEN customer_type IN ('business', 'trust') 
      THEN CASE WHEN business_name IS NOT NULL THEN 1 ELSE 0 END
    ELSE 1
  END = 1
);
```

#### debit_card table
```sql
ALTER TABLE debit_card ADD CONSTRAINT chk_expiry_month 
  CHECK (expiry_month >= 1 AND expiry_month <= 12);

ALTER TABLE debit_card ADD CONSTRAINT chk_expiry_year 
  CHECK (expiry_year >= YEAR(GETDATE()));
```

---

## Triggers

### 1. Debit Card Account Type Validation (T-SQL)

```sql
CREATE TRIGGER trg_validate_debit_card_account_type
ON debit_card
FOR INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  
  -- Check if any inserted/updated rows violate the account type constraint
  IF EXISTS (
    SELECT 1 
    FROM inserted i
    LEFT JOIN account a ON i.account_id = a.account_id
    WHERE a.account_type NOT IN ('checking', 'business_checking')
       OR a.account_id IS NULL
  )
  BEGIN
    DECLARE @ErrorMsg NVARCHAR(500);
    DECLARE @AccountId BIGINT;
    DECLARE @AccountType VARCHAR(50);
    
    SELECT TOP 1 
      @AccountId = i.account_id,
      @AccountType = ISNULL(a.account_type, 'NOT FOUND')
    FROM inserted i
    LEFT JOIN account a ON i.account_id = a.account_id
    WHERE a.account_type NOT IN ('checking', 'business_checking')
       OR a.account_id IS NULL;
    
    SET @ErrorMsg = 'Debit cards can only be issued to checking or business_checking accounts. Account ' 
      + CAST(@AccountId AS VARCHAR(20)) + ' has type ' + @AccountType;
    
    RAISERROR(@ErrorMsg, 16, 1);
    ROLLBACK TRANSACTION;
  END
END;
GO
```

**Purpose:** Enforces business rule that debit cards can only be issued to checking accounts.

---

## Data Integrity

### Foreign Key Relationships

All foreign keys are defined with appropriate referential actions:

- **ON DELETE CASCADE**: Used for dependent data
- **ON DELETE SET NULL**: Used for optional references (e.g., debit_card_id in transactions)
- **ON DELETE NO ACTION**: Default for core entities

### Unique Constraints

Key unique constraints beyond primary keys:

1. **customer**: tax_identifier (SSN/EIN uniqueness)
2. **account**: account_number
3. **employee**: employee_number, officer_code
4. **branch**: branch_code
5. **financial_transaction**: (account_id, source_system, source_transaction_id)

---

## Performance Considerations

### Indexing Strategy

1. **Clustered Indexes**: Automatic on all PRIMARY KEYs (IDENTITY columns)
2. **Non-Clustered Indexes**: Strategic placement on foreign keys and search fields
3. **Full-Text Indexes**: On customer name fields for fuzzy search
4. **Covering Indexes**: Multi-column indexes for common query patterns

### Computed Columns

**Persisted Computed Columns:**
```sql
-- Customer full_name (indexed for search)
full_name AS (
  CASE 
    WHEN customer_type IN ('business', 'trust') THEN business_name
    ELSE LTRIM(RTRIM(CONCAT(first_name, ' ', last_name)))
  END
) PERSISTED;
```

**Benefits:**
- Pre-computed values stored on disk
- Can be indexed for fast searches
- Consistent calculation logic

### Query Optimization Examples

**Customer Fuzzy Search (SQL Server 2022):**
```sql
SELECT customer_id, full_name, 
       STRING_SIMILARITY(full_name, @searchTerm, 0.3) AS match_score
FROM customer
WHERE STRING_SIMILARITY(full_name, @searchTerm, 0.3) > 0
ORDER BY match_score DESC;
```

**Customer Fuzzy Search (SQL Server 2019):**
```sql
SELECT customer_id, full_name, 
       DIFFERENCE(full_name, @searchTerm) AS match_score
FROM customer
WHERE SOUNDEX(full_name) = SOUNDEX(@searchTerm)
   OR DIFFERENCE(full_name, @searchTerm) >= 3
ORDER BY match_score DESC;
```

**Transaction History:**
```sql
-- Optimized with covering index: (account_id, posting_date DESC, transaction_id)
SELECT * FROM financial_transaction
WHERE account_id = @accountId
ORDER BY posting_date DESC, transaction_id DESC
OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY;
```

---

## Migration History

| Migration | Description | Date |
|-----------|-------------|------|
| 0001 | Enable full-text search catalog and indexes | Oct 2025 |
| 0002 | Add branch address and employee position fields | Oct 2025 |
| 0003 | Create employee_branch junction table | Oct 2025 |
| 0004 | Add officer_code to employee | Oct 2025 |
| 0005 | Remove employee_branch_id from employee | Oct 2025 |
| 0006 | Conditional customer names with CHECK constraint and computed column | Oct 2025 |
| 0007 | Customer officer assignment table | Oct 2025 |
| 0008 | SIC code table and seeding | Oct 2025 |
| 0009 | Customer SIC code junction table | Oct 2025 |
| 0010 | Add is_deceased to customer | Oct 2025 |
| 0011 | Add account optional fields | Oct 2025 |
| 0012 | Fix account column typos | Oct 2025 |
| 0013 | Add sic_code foreign key to account | Oct 2025 |
| 0014 | Add debit card tables with account type validation trigger | Oct 2025 |

---

## SQL Server Specific Features

### Data Types

| PostgreSQL | SQL Server | Notes |
|------------|------------|-------|
| BIGSERIAL | BIGINT IDENTITY(1,1) | Auto-increment |
| BOOLEAN | BIT | 0 = false, 1 = true |
| TIMESTAMP | DATETIME2 | Higher precision than DATETIME |
| TEXT | NVARCHAR(MAX) | Unicode text |
| JSONB | NVARCHAR(MAX) | Store JSON as text, use JSON functions |
| UUID | UNIQUEIDENTIFIER | GUID type |

### String Functions

**Fuzzy Matching:**
- SQL Server 2022+: `STRING_SIMILARITY()`
- SQL Server 2019: `SOUNDEX()`, `DIFFERENCE()`

**Full-Text Search:**
```sql
SELECT * FROM customer
WHERE CONTAINS(first_name, 'FORMSOF(THESAURUS, "john")');
```

### JSON Support

```sql
-- Query JSON column
SELECT 
  transaction_id,
  JSON_VALUE(raw_payload, '$.merchantId') AS merchant_id
FROM financial_transaction
WHERE JSON_VALUE(raw_payload, '$.type') = 'purchase';
```

---

## Compliance and Security

### PCI-DSS Compliance

**Debit Card Data:**
- ✅ Only last 4 digits stored
- ✅ No full PAN (Primary Account Number)
- ✅ No CVV/CVV2/CVC2 storage
- ✅ No PIN storage
- ✅ Card tokens used for core banking references

### Data Privacy

**Sensitive Fields:**
- `tax_identifier`: Should be encrypted at application layer
- `government_id`: Should be encrypted at application layer
- Contact information: Subject to consent management

### Audit Trail

All tables include:
- `created_at`: Record creation timestamp (DATETIME2)
- `updated_at`: Last modification timestamp (DATETIME2)

---

## Database Maintenance

### Recommended Tasks

**Daily:**
- Monitor transaction table growth
- Check index fragmentation on large tables
- Review query execution plans

**Weekly:**
- UPDATE STATISTICS on high-traffic tables
- Review slow query reports
- Check blocking and deadlocks

**Monthly:**
- REBUILD indexes with high fragmentation (>30%)
- Archive old transactions
- Backup and test restore procedures

### Index Maintenance

```sql
-- Check index fragmentation
SELECT 
  OBJECT_NAME(ips.object_id) AS table_name,
  i.name AS index_name,
  ips.avg_fragmentation_in_percent
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.avg_fragmentation_in_percent > 10
ORDER BY ips.avg_fragmentation_in_percent DESC;

-- Rebuild fragmented indexes
ALTER INDEX ALL ON financial_transaction REBUILD;
```

---

## Version Control

**Schema Version:** 1.0  
**Last Migration:** 0014_add_debit_card_tables.sql  
**Compatible SQL Server Versions:** 2019+, 2022 (for STRING_SIMILARITY)  
**Required Features:** Full-Text Search

---

## PostgreSQL Parity Notes

This SQL Server implementation maintains functional parity with PostgreSQL:

1. **Data Types**: Equivalent types used (BIGINT IDENTITY ≡ BIGSERIAL)
2. **Constraints**: Same CHECK constraints and foreign keys
3. **Triggers**: Equivalent validation logic (T-SQL vs PL/pgSQL)
4. **Indexes**: Same indexing strategy adapted for SQL Server
5. **Computed Columns**: SQL Server uses persisted computed columns vs PostgreSQL triggers
6. **Fuzzy Search**: Full-text search + STRING_SIMILARITY (2022) or SOUNDEX (2019) vs pg_trgm

**Differences:**
- PostgreSQL uses function + trigger for full_name; SQL Server uses computed column
- PostgreSQL uses pg_trgm for fuzzy search; SQL Server uses Full-Text + STRING_SIMILARITY/SOUNDEX
- Date/time functions differ (GETDATE() vs NOW(), YEAR() vs EXTRACT())

---

**End of SQL Server Database Design Document**

