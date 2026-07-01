# Banking Client 360 - Technical Requirements Document

**Version:** 1.0  
**Date:** October 2025  
**Application:** Banking Client 360 Platform  
**Stack:** React.js, Node.js, PostgreSQL/SQL Server, Material Design

---

## Document Overview

This document defines the technical requirements for the Banking Client 360 application organized into nine major EPICs. Each EPIC contains detailed FEATURES with actionable USER STORIES and acceptance criteria aligned with the dual-database enterprise architecture.

---

# EPIC 1: Customer Management

## Overview
Customer Management provides a unified view of individual and business customers with polymorphic data model support, comprehensive profile management, and Jack Henry core banking integration. The system enforces conditional name requirements at the database level and supports full-text fuzzy search across customer records.

## Data Model
- **Customer Table**: Polymorphic design with discriminated union validation
  - Individual customers: `first_name` + `last_name` (required)
  - Business/trust customers: `business_name` (required)
  - Auto-generated `full_name` field for unified search (trigram index)
- **Validation**: Database CHECK constraint `customer_name_type_check`
- **Search Support**: PostgreSQL trigram similarity, SQL Server STRING_SIMILARITY/SOUNDEX
- **Jack Henry Integration**: CIF number linking

## FEATURE 1.1: Polymorphic Customer Registration

### User Stories

**US-1.1.1: Register Individual Customer**
- As a **bank representative**, I want to register a new individual customer so that they can open accounts and access banking services.
  - Acceptance Criteria:
    - [ ] Form validates `first_name` and `last_name` as required fields for individual type
    - [ ] System auto-populates `full_name` as concatenation of first and last name
    - [ ] Date of birth must be at least 18 years ago
    - [ ] Tax identifier (SSN) must be unique and 9 digits
    - [ ] Government ID validation accepts valid formats
    - [ ] Customer type defaults to "individual"
    - [ ] Jack Henry CIF number generated and stored
    - [ ] Database trigger prevents saving individual customer without first/last name

**US-1.1.2: Register Business Customer**
- As a **business banking specialist**, I want to register a business entity customer so that companies can establish banking relationships.
  - Acceptance Criteria:
    - [ ] Form validates `business_name` as required field for business type
    - [ ] System auto-populates `full_name` with business_name value
    - [ ] Tax identifier (EIN) must be unique and 9 digits
    - [ ] Business name supports up to 200 characters
    - [ ] Database trigger prevents saving business customer without business_name
    - [ ] First name and last name fields are hidden/disabled for business type
    - [ ] Customer type set to "business"

**US-1.1.3: Register Trust/Estate Customer**
- As a **wealth management advisor**, I want to register trust or estate entities so that fiduciary accounts can be managed properly.
  - Acceptance Criteria:
    - [ ] Form validates `business_name` as required field for trust/estate types
    - [ ] Business name accepts trust naming patterns (e.g., "Smith Family Trust")
    - [ ] System auto-populates `full_name` with business_name value
    - [ ] Customer type options include "trust" and "estate"
    - [ ] Database constraint enforces business_name requirement
    - [ ] Trust-specific metadata can be captured

## FEATURE 1.2: Customer Profile Search & Discovery

### User Stories

**US-1.2.1: Intelligent Customer ID Search**
- As a **bank representative**, I want to search for customers by ID so that I can quickly locate customer records.
  - Acceptance Criteria:
    - [ ] System auto-detects numeric input as customer ID search
    - [ ] Exact customer ID match returns 100% relevance score
    - [ ] Search works across both PostgreSQL and SQL Server databases
    - [ ] Results display within 500ms for ID-based searches
    - [ ] CIF number search also supported with exact matching

**US-1.2.2: Fuzzy Name Search**
- As a **customer service representative**, I want to search for customers by name with typo tolerance so that I can find customers even with spelling variations.
  - Acceptance Criteria:
    - [ ] PostgreSQL uses trigram similarity with configurable threshold (default 30%)
    - [ ] SQL Server 2022+ uses STRING_SIMILARITY function
    - [ ] SQL Server <2022 falls back to SOUNDEX phonetic matching
    - [ ] Search returns relevance score (0-100%) for each match
    - [ ] Matches work on both individual names and business names
    - [ ] Example: "Smyth" finds "Smith" with ~33% similarity
    - [ ] Example: "Sara Li" finds "Sarah Lee" with ~37% similarity
    - [ ] Results sorted by relevance score descending

**US-1.2.3: Tax ID & Government ID Search**
- As a **compliance officer**, I want to search customers by tax identifier or government ID so that I can verify identities and prevent fraud.
  - Acceptance Criteria:
    - [ ] Tax ID search supports exact match only (security requirement)
    - [ ] Last 4 digits of SSN/EIN search supported
    - [ ] Government ID search with exact and partial matching
    - [ ] Search results mask sensitive data (show only last 4 digits)
    - [ ] Audit log captures all tax ID searches with user and timestamp
    - [ ] Search respects role-based access permissions

## FEATURE 1.3: Customer Dashboard & 360 View

### User Stories

**US-1.3.1: Comprehensive Customer Overview**
- As a **relationship manager**, I want to view a complete 360-degree customer profile so that I can understand all customer relationships and activity.
  - Acceptance Criteria:
    - [ ] Dashboard displays customer personal/business information
    - [ ] Shows all linked accounts with current balances (PST timezone)
    - [ ] Displays household relationships and members
    - [ ] Shows risk rating and compliance status with color indicators
    - [ ] Lists all debit cards linked to customer
    - [ ] Displays recent transaction history (last 30 days)
    - [ ] Shows assigned relationship officer
    - [ ] VIP badge displayed for VIP customers (gold color #936b06)
    - [ ] Employee badge displayed for employee customers (green color #2e7d32)
    - [ ] Birthday indicator shown for customers with birthdays today

**US-1.3.2: Customer Status Management**
- As a **operations manager**, I want to manage customer status transitions so that I can activate, deactivate, or close customer records.
  - Acceptance Criteria:
    - [ ] Status options: active, inactive, prospect, closed
    - [ ] Status change requires reason code and comments
    - [ ] Closing customer validates no active accounts exist
    - [ ] Status history tracked with timestamps and user
    - [ ] Email notification sent on status change
    - [ ] Closed customers cannot open new accounts

## FEATURE 1.4: Customer Compliance & KYC

### User Stories

**US-1.4.1: KYC Status Tracking**
- As a **compliance officer**, I want to track KYC completion status for each customer so that regulatory requirements are met.
  - Acceptance Criteria:
    - [ ] KYC status options: complete, pending, incomplete
    - [ ] KYC last updated date tracked automatically
    - [ ] Alerts generated for expired KYC (>12 months old)
    - [ ] Document checklist tracked per customer type
    - [ ] KYC renewal workflow triggered automatically
    - [ ] Compliance dashboard shows KYC statistics

**US-1.4.2: Risk Rating Assignment**
- As a **risk analyst**, I want to assign risk ratings to customers so that monitoring and controls can be applied appropriately.
  - Acceptance Criteria:
    - [ ] Risk rating options: low, medium, high
    - [ ] Risk rating change requires justification
    - [ ] High-risk customers flagged on dashboard (red indicator)
    - [ ] Risk rating impacts transaction monitoring thresholds
    - [ ] Risk assessment history maintained
    - [ ] Monthly risk review reports generated

---

# EPIC 2: Account Management

## Overview
Account Management handles multi-type account creation, multi-owner support, balance tracking, and account lifecycle management. Supports checking, savings, money market, CD, business checking, business savings, and loan accounts with proper owner validations.

## Data Model
- **Account Table**: Multi-type support with status tracking
- **Account Ownership Table**: Many-to-many relationship supporting joint accounts
  - `is_primary_owner` flag distinguishes account roles
  - `ownership_percentage` for trust and estate accounts
  - `is_active` flag for ownership lifecycle
- **Account Types**: checking, savings, money_market, cd, business_checking, business_savings, loan
- **Balance Tracking**: Current balance, available balance, hold amounts

## FEATURE 2.1: Account Creation & Setup

### User Stories

**US-2.1.1: Create Individual Checking Account**
- As a **bank representative**, I want to create a checking account for a customer so that they can deposit and withdraw funds.
  - Acceptance Criteria:
    - [ ] Account number generated with bank prefix + unique identifier
    - [ ] Minimum opening deposit validated ($25 for checking)
    - [ ] Customer must have "active" status to open account
    - [ ] Initial account status set to "active"
    - [ ] Jack Henry account ID generated and linked
    - [ ] Account ownership record created with is_primary_owner = true
    - [ ] Interest rate set to 0% for standard checking

**US-2.1.2: Create Joint Account**
- As a **bank representative**, I want to create a joint account with multiple owners so that customers can share account access.
  - Acceptance Criteria:
    - [ ] Supports 2-4 joint owners on single account
    - [ ] Primary owner designated during setup
    - [ ] All owners must be "active" customers
    - [ ] Ownership percentages can be specified (default 50/50 for 2 owners)
    - [ ] All owners appear in account search results
    - [ ] Each owner sees account on their dashboard

**US-2.1.3: Create Business Checking Account**
- As a **business banking specialist**, I want to create a business checking account so that business customers can manage company finances.
  - Acceptance Criteria:
    - [ ] Customer type must be "business" or "trust"
    - [ ] Account type set to "business_checking"
    - [ ] Minimum opening deposit validated ($100 for business)
    - [ ] Business tax ID (EIN) required
    - [ ] Supports multiple authorized signers
    - [ ] Monthly service fee configured
    - [ ] Transaction limits higher than personal accounts

## FEATURE 2.2: Account Ownership & Permissions

### User Stories

**US-2.2.1: Manage Account Ownership**
- As a **branch manager**, I want to add or remove account owners so that ownership can be updated as relationships change.
  - Acceptance Criteria:
    - [ ] New owner added creates account_ownership record
    - [ ] Cannot remove last active owner
    - [ ] Primary owner can be transferred to another owner
    - [ ] Ownership change requires dual authorization
    - [ ] Audit log captures all ownership changes
    - [ ] Removed owners marked inactive (is_active = false)

**US-2.2.2: Ownership Percentage Management**
- As a **trust administrator**, I want to specify ownership percentages for estate and trust accounts so that distributions can be calculated correctly.
  - Acceptance Criteria:
    - [ ] Ownership percentages total 100% validation
    - [ ] Percentages support up to 2 decimal places
    - [ ] Distribution calculations use ownership percentages
    - [ ] Percentage changes tracked in audit log
    - [ ] Estate accounts require ownership percentages

## FEATURE 2.3: Account Balance & Transactions

### User Stories

**US-2.3.1: Real-Time Balance Updates**
- As a **customer**, I want to see my current account balance in real-time so that I can make informed financial decisions.
  - Acceptance Criteria:
    - [ ] Current balance updated immediately after transactions
    - [ ] Available balance accounts for pending transactions and holds
    - [ ] Balance displayed in PST timezone context
    - [ ] Negative balance flagged with warning indicator
    - [ ] Balance history tracked for reconciliation

**US-2.3.2: Account Holds Management**
- As a **fraud analyst**, I want to place holds on account funds so that suspicious activity can be investigated.
  - Acceptance Criteria:
    - [ ] Hold amount reduces available balance
    - [ ] Hold reason and expiration date required
    - [ ] Holds tracked in separate table linked to account
    - [ ] Expired holds automatically released
    - [ ] Customer notified of holds via email/SMS
    - [ ] Hold history maintained for audit

## FEATURE 2.4: Account Status & Lifecycle

### User Stories

**US-2.4.1: Account Status Transitions**
- As a **operations supervisor**, I want to manage account status so that accounts can be properly activated, frozen, or closed.
  - Acceptance Criteria:
    - [ ] Status options: active, inactive, frozen, closed, pending
    - [ ] Frozen accounts block debits but allow deposits
    - [ ] Closed accounts require zero balance
    - [ ] Status change requires reason code
    - [ ] Linked debit cards deactivated when account frozen/closed
    - [ ] Reactivation workflow for inactive accounts

**US-2.4.2: Account Closure Process**
- As a **branch manager**, I want to close customer accounts so that dormant or requested closures are processed properly.
  - Acceptance Criteria:
    - [ ] Balance must be exactly $0.00 to close
    - [ ] All pending transactions must clear
    - [ ] Debit cards linked to account canceled
    - [ ] Automatic transfers stopped
    - [ ] Closure reason captured
    - [ ] Account marked closed, not deleted (regulatory requirement)
    - [ ] Final statement generated and archived

---

# EPIC 3: Debit Card Management

## Overview
Debit Card Management handles card issuance, limit profiles, PCI-compliant data storage, and lifecycle management. Cards are restricted to checking accounts only with customer ownership validation enforced by database triggers.

## Data Model
- **Debit Card Table**: Linked to account_id and customer_id
  - `last_four_digits` only (PCI compliance - no full PAN stored)
  - `jack_henry_card_id` and `silverlake_card_token` for core banking references
  - Database trigger validates customer ownership before card creation
- **Debit Card Limit Profile Table**: 8 pre-configured limit profiles
  - Standard Individual, Premium Individual, Business Standard, Business Premium
  - VIP Elite, Employee Banking, Student Banking, Senior Banking
- **Business Rule**: Database trigger ensures cards only issued to checking/business_checking accounts

## FEATURE 3.1: Card Issuance & Activation

### User Stories

**US-3.1.1: Issue Primary Debit Card**
- As a **bank representative**, I want to issue a debit card for a checking account so that the customer can access funds via ATM and POS.
  - Acceptance Criteria:
    - [ ] Account type must be "checking" or "business_checking" (database trigger enforces)
    - [ ] Customer must be account owner (database trigger validates ownership)
    - [ ] Cardholder name auto-populated from customer full_name
    - [ ] Card brand selected: Visa or Mastercard
    - [ ] Limit profile assigned based on customer type and account balance
    - [ ] Only last 4 digits of card stored (PCI compliance)
    - [ ] Jack Henry card ID and Silverlake token generated
    - [ ] Expiry date set to 3-5 years from issuance
    - [ ] Card status set to "inactive" until customer activation

**US-3.1.2: Issue Companion Card for Joint Account**
- As a **bank representative**, I want to issue additional cards for joint account owners so that all owners have card access.
  - Acceptance Criteria:
    - [ ] Joint account supports multiple cards (one per owner)
    - [ ] Each card linked to specific customer_id (owner)
    - [ ] Each card has unique last 4 digits
    - [ ] Same account_id referenced for all cards on joint account
    - [ ] Each owner can have different limit profile
    - [ ] Database validates each customer is account owner

**US-3.1.3: Activate Debit Card**
- As a **customer**, I want to activate my new debit card so that I can begin using it for transactions.
  - Acceptance Criteria:
    - [ ] Activation requires last 4 digits, expiry date, and CVV verification
    - [ ] Card status changes from "inactive" to "active"
    - [ ] Activation timestamp recorded
    - [ ] Customer can set PIN during activation
    - [ ] Activation confirmation sent via email/SMS
    - [ ] Card usable within 5 minutes of activation

## FEATURE 3.2: Card Limit Profiles & Management

### User Stories

**US-3.2.1: Assign Limit Profile**
- As a **branch manager**, I want to assign appropriate limit profiles to debit cards so that customer spending is aligned with their account type and risk.
  - Acceptance Criteria:
    - [ ] 8 pre-configured profiles available: Standard Individual, Premium Individual, Business Standard, Business Premium, VIP Elite, Employee Banking, Student Banking, Senior Banking
    - [ ] Business customers default to Business Standard (70%) or Business Premium (30%)
    - [ ] Individual customers distributed: 50% Standard, 25% Premium, 10% Student, 7% Senior, 5% VIP, 3% Employee
    - [ ] Limit profile defines: daily_purchase_limit, daily_atm_limit, single_transaction_limit, monthly_limit
    - [ ] Profile assignment tracked with timestamp and user
    - [ ] Profile changes take effect immediately

**US-3.2.2: Temporary Limit Increase**
- As a **VIP customer**, I want to request a temporary limit increase so that I can make large purchases beyond my normal limits.
  - Acceptance Criteria:
    - [ ] Temporary limit increase duration: 1-7 days
    - [ ] Approval required for increases >50% of normal limit
    - [ ] Original limits restored automatically after expiration
    - [ ] SMS notification sent when temporary limit active
    - [ ] Temporary limit logged for fraud monitoring

## FEATURE 3.3: Card Security & Fraud Controls

### User Stories

**US-3.3.1: Block/Unblock Card**
- As a **customer**, I want to block my card immediately so that unauthorized use is prevented if card is lost or stolen.
  - Acceptance Criteria:
    - [ ] Card status changes to "blocked" immediately
    - [ ] All transactions declined on blocked card
    - [ ] Customer can block via mobile app, web, or phone
    - [ ] Block reason captured: lost, stolen, suspected fraud, customer request
    - [ ] Unblock available only if reason is "customer request"
    - [ ] Lost/stolen cards cannot be unblocked (must reissue)

**US-3.3.2: Card Replacement**
- As a **customer**, I want to request a card replacement so that I receive a new card with new numbers after loss/theft.
  - Acceptance Criteria:
    - [ ] Old card marked as "canceled" status
    - [ ] New card issued with new last 4 digits
    - [ ] Same limit profile transferred to new card
    - [ ] Replacement fee applied ($5 for standard, waived for premium)
    - [ ] New card shipped to verified address
    - [ ] Customer cannot activate old card after replacement

**US-3.3.3: Fraud Alert & Card Freeze**
- As a **fraud detection system**, I want to automatically freeze cards with suspicious activity so that losses are minimized.
  - Acceptance Criteria:
    - [ ] Card status changes to "frozen" when fraud detected
    - [ ] Customer notified immediately via SMS and email
    - [ ] Customer can confirm or deny suspicious transactions
    - [ ] Confirmed fraud triggers card replacement
    - [ ] False positive allows instant unfreeze
    - [ ] Freeze reasons logged for fraud analytics

## FEATURE 3.4: Card Lifecycle & Expiry

### User Stories

**US-3.4.1: Card Expiry Management**
- As a **card operations specialist**, I want to automatically identify expiring cards so that replacement cards are issued proactively.
  - Acceptance Criteria:
    - [ ] Cards expiring within 60 days flagged for renewal
    - [ ] Replacement card issued automatically 45 days before expiry
    - [ ] Customer notification sent when replacement shipped
    - [ ] Old card expires at midnight on last day of expiry month
    - [ ] Expired cards marked with status "expired"
    - [ ] Transaction attempts on expired cards declined

---

# EPIC 4: Transaction Management

## Overview
Transaction Management tracks all financial transactions across accounts with PST timezone support, categorization, posting/pending states, and comprehensive transaction history. All timestamps displayed in Pacific Standard Time for consistency.

## Data Model
- **Transaction Table**: Comprehensive transaction logging
  - `transaction_date` and `posted_date` in PST timezone
  - `transaction_type`: debit, credit, transfer, fee, interest, adjustment
  - `transaction_status`: pending, posted, failed, reversed
  - `category`: groceries, dining, gas, shopping, utilities, etc.
  - `merchant_name`, `merchant_category_code` for POS transactions
  - `running_balance` for account reconciliation
- **Timezone Handling**: All dates stored in PST, converted for display

## FEATURE 4.1: Transaction Recording & Posting

### User Stories

**US-4.1.1: Record Debit Transaction**
- As a **transaction processing system**, I want to record debit transactions so that customer spending is tracked accurately.
  - Acceptance Criteria:
    - [ ] Transaction amount validated against available balance
    - [ ] Transaction type set to "debit"
    - [ ] Transaction status initially "pending"
    - [ ] Transaction date captured in PST timezone
    - [ ] Merchant name and category code captured for POS transactions
    - [ ] Running balance calculated after transaction
    - [ ] Insufficient funds check prevents overdraft (unless overdraft protection enabled)

**US-4.1.2: Record Credit Transaction**
- As a **transaction processing system**, I want to record credit transactions so that deposits and payments are reflected in account balance.
  - Acceptance Criteria:
    - [ ] Transaction type set to "credit"
    - [ ] Credit transactions post immediately (no holds for verified sources)
    - [ ] Check deposits held 1-2 business days before posting
    - [ ] Available balance updated based on deposit type
    - [ ] Transaction timestamp in PST timezone

**US-4.1.3: Post Pending Transactions**
- As a **overnight batch process**, I want to post pending transactions so that account balances reflect completed transactions.
  - Acceptance Criteria:
    - [ ] Pending transactions older than 24 hours posted automatically
    - [ ] Transaction status changes from "pending" to "posted"
    - [ ] Posted date captured in PST timezone
    - [ ] Current balance updated for posted transactions
    - [ ] Posting failures logged and alerted

## FEATURE 4.2: Transaction Categorization & Analytics

### User Stories

**US-4.2.1: Auto-Categorize Transactions**
- As a **customer**, I want transactions automatically categorized so that I can understand my spending patterns.
  - Acceptance Criteria:
    - [ ] Merchant Category Code (MCC) mapped to user-friendly categories
    - [ ] Categories: groceries, dining, gas, shopping, utilities, travel, entertainment, healthcare, other
    - [ ] Recurring transactions identified and tagged
    - [ ] Category confidence score provided
    - [ ] Customer can override auto-categorization

**US-4.2.2: Monthly Spending Summary**
- As a **customer**, I want to view monthly spending by category so that I can manage my budget.
  - Acceptance Criteria:
    - [ ] Summary shows current month by default
    - [ ] Previous months accessible via date picker
    - [ ] Chart visualization of spending by category
    - [ ] Top 5 merchants by spend displayed
    - [ ] Month-over-month comparison available
    - [ ] Export to PDF/CSV supported

## FEATURE 4.3: Transaction Search & Filtering

### User Stories

**US-4.3.1: Filter Transactions by Date Range**
- As a **customer**, I want to filter transactions by date range so that I can find specific transactions.
  - Acceptance Criteria:
    - [ ] Date range picker with PST timezone display
    - [ ] Common presets: Last 7 days, Last 30 days, Last 90 days, This month, Last month
    - [ ] Custom date range up to 2 years history
    - [ ] Results paginated (50 per page)
    - [ ] Total debit and credit amounts shown for filtered range

**US-4.3.2: Search Transactions by Merchant or Amount**
- As a **customer**, I want to search transactions by merchant name or amount so that I can locate specific purchases.
  - Acceptance Criteria:
    - [ ] Merchant name search with partial matching
    - [ ] Amount search with exact, greater than, less than operators
    - [ ] Combined filters (date + merchant + amount)
    - [ ] Search results highlight matching terms
    - [ ] Recent searches saved for quick access

## FEATURE 4.4: Transaction Disputes & Reversals

### User Stories

**US-4.4.1: Dispute Transaction**
- As a **customer**, I want to dispute unauthorized transactions so that fraudulent charges are reversed.
  - Acceptance Criteria:
    - [ ] Dispute filed within 60 days of transaction
    - [ ] Dispute reason required: unauthorized, incorrect amount, duplicate, other
    - [ ] Temporary credit issued within 10 business days for amounts >$50
    - [ ] Merchant contacted for documentation
    - [ ] Dispute status tracked: open, under review, resolved, denied
    - [ ] Customer notified at each status change

**US-4.4.2: Reverse Posted Transaction**
- As a **branch manager**, I want to reverse posted transactions so that errors can be corrected.
  - Acceptance Criteria:
    - [ ] Reversal creates offsetting transaction
    - [ ] Original transaction marked with reversal flag
    - [ ] Reversal reason required and logged
    - [ ] Both transactions linked via reversal_reference_id
    - [ ] Account balance adjusted immediately
    - [ ] Customer notification sent for reversals >$100

---

# EPIC 5: Search & Discovery

## Overview
Search & Discovery provides intelligent hybrid search across customer records with dual-database support (PostgreSQL and SQL Server). Features include automatic customer ID detection, fuzzy name matching, tax ID search, and relevance scoring.

## Data Model
- **SearchProvider Adapter Pattern**: Abstraction layer isolating database-specific search logic
  - PostgresSearchProvider: Uses `pg_trgm` trigram similarity and GIN indexes
  - SqlServerSearchProvider: Uses `STRING_SIMILARITY()` (SQL Server 2022+) or `SOUNDEX()` fallback
- **Search Types**: Customer ID, fuzzy name, tax ID, government ID, CIF number
- **Relevance Scoring**: 0-100% match score with configurable threshold (default 30%)

## FEATURE 5.1: Intelligent Search Detection

### User Stories

**US-5.1.1: Auto-Detect Customer ID Search**
- As a **bank representative**, I want the system to automatically detect when I'm searching by customer ID so that I get exact matches quickly.
  - Acceptance Criteria:
    - [ ] Numeric input auto-detected as customer ID
    - [ ] Exact customer ID match returns 100% relevance score
    - [ ] Match type displayed as "exact"
    - [ ] Search completes within 200ms
    - [ ] Works identically on PostgreSQL and SQL Server

**US-5.1.2: Auto-Detect CIF Number Search**
- As a **bank representative**, I want to search by Jack Henry CIF number so that I can locate customers using core banking identifiers.
  - Acceptance Criteria:
    - [ ] Alphanumeric patterns matching CIF format auto-detected
    - [ ] Exact CIF match returns 100% relevance score
    - [ ] Partial CIF match with prefix matching supported
    - [ ] CIF search works across both databases

## FEATURE 5.2: Fuzzy Search Capabilities

### User Stories

**US-5.2.1: Fuzzy Name Matching**
- As a **customer service representative**, I want fuzzy name search so that I can find customers even with typos or spelling variations.
  - Acceptance Criteria:
    - [ ] PostgreSQL uses trigram similarity algorithm
    - [ ] SQL Server 2022+ uses STRING_SIMILARITY function
    - [ ] SQL Server <2022 uses SOUNDEX phonetic matching
    - [ ] Configurable similarity threshold (default 30%)
    - [ ] Returns relevance score (0-100%) for each result
    - [ ] Sorts results by relevance descending
    - [ ] Example matches: "Smyth" finds "Smith" (33%), "Sara Li" finds "Sarah Lee" (37%)
    - [ ] Works on both individual names (first_name + last_name) and business names

**US-5.2.2: Multi-Layer Search Strategy**
- As a **search system**, I want to execute multi-layer search queries so that comprehensive results are returned efficiently.
  - Acceptance Criteria:
    - [ ] Layer 1: Exact ID matching (customer_id, CIF) - 100% score
    - [ ] Layer 2: Fuzzy matching with threshold - variable score
    - [ ] Layer 3: Partial matching for broader results - lower score
    - [ ] Results combined and de-duplicated
    - [ ] Performance: <500ms for fuzzy searches
    - [ ] Maximum 100 results returned

## FEATURE 5.3: Secure Search & Audit

### User Stories

**US-5.3.1: Tax ID Search with Masking**
- As a **compliance officer**, I want to search by tax ID so that I can verify customer identities securely.
  - Acceptance Criteria:
    - [ ] Tax ID search requires exact match only (no fuzzy)
    - [ ] Results display last 4 digits only (e.g., ***-**-1234)
    - [ ] Full tax ID never exposed in UI or API responses
    - [ ] Search audit log captures: user, timestamp, search term, results count
    - [ ] Role-based access: only compliance and management roles

**US-5.3.2: Search Audit Logging**
- As a **security administrator**, I want all searches logged so that suspicious activity can be detected.
  - Acceptance Criteria:
    - [ ] Every search logged with: user_id, timestamp, search_term, search_type, results_count
    - [ ] PII searches (tax ID, SSN) logged separately with enhanced detail
    - [ ] Failed searches logged
    - [ ] Search patterns analyzed for anomalies
    - [ ] Audit logs retained for 7 years (regulatory requirement)

## FEATURE 5.4: Dual-Database Search Parity

### User Stories

**US-5.4.1: PostgreSQL Search Provider**
- As a **search system**, I want to use PostgreSQL-optimized search algorithms so that fuzzy matching performs efficiently.
  - Acceptance Criteria:
    - [ ] pg_trgm extension enabled for trigram similarity
    - [ ] GIN indexes created on first_name, last_name, business_name
    - [ ] Similarity threshold configurable (0.1-1.0)
    - [ ] Full-text search with ranking
    - [ ] Search performance: <300ms for 1M customer records

**US-5.4.2: SQL Server Search Provider**
- As a **search system**, I want to use SQL Server-optimized search algorithms so that fuzzy matching provides consistent results.
  - Acceptance Criteria:
    - [ ] SQL Server 2022+: STRING_SIMILARITY() function used
    - [ ] SQL Server <2022: SOUNDEX() and DIFFERENCE() used
    - [ ] Full-Text Search catalogs created
    - [ ] Computed columns for search performance
    - [ ] Search performance: <300ms for 1M customer records
    - [ ] Results match PostgreSQL relevance scores (±5%)

---

# EPIC 6: Household & Relationship Management

## Overview
Household & Relationship Management groups related customers, tracks family relationships, and supports household-level analysis. Enables consolidated reporting and relationship-based marketing.

## Data Model
- **Household Table**: Groups related customers
  - `household_name`: User-defined or auto-generated
  - `household_type`: family, business, trust
  - `primary_customer_id`: Household head
- **Household Membership Table**: Many-to-many customer-to-household
  - `relationship_type`: spouse, child, parent, sibling, partner, business_partner, trustee, beneficiary
  - `is_primary_member`: Designates household head
- **Relationship Analytics**: Aggregate household balances, transaction volumes

## FEATURE 6.1: Household Creation & Management

### User Stories

**US-6.1.1: Create Family Household**
- As a **relationship manager**, I want to create a household grouping for family members so that I can view consolidated household finances.
  - Acceptance Criteria:
    - [ ] Household name auto-generated from primary customer last name (e.g., "Smith Household")
    - [ ] Household type set to "family"
    - [ ] Primary customer designated as household head
    - [ ] Household created with minimum 1 member
    - [ ] Additional members added via search
    - [ ] Household address linked to primary customer address

**US-6.1.2: Add Household Member**
- As a **relationship manager**, I want to add customers to existing households so that family relationships are properly tracked.
  - Acceptance Criteria:
    - [ ] Member search by name or customer ID
    - [ ] Relationship type required: spouse, child, parent, sibling, partner, other
    - [ ] Customer can belong to only one family household
    - [ ] Duplicate member prevented
    - [ ] Member addition tracked in audit log
    - [ ] Household updated timestamp changed

**US-6.1.3: Remove Household Member**
- As a **relationship manager**, I want to remove members from households so that outdated relationships are maintained accurately.
  - Acceptance Criteria:
    - [ ] Cannot remove primary household member (must transfer first)
    - [ ] Removed member marked inactive (not deleted)
    - [ ] Removal reason captured
    - [ ] Removal date timestamp recorded
    - [ ] Joint accounts with other members flagged for review

## FEATURE 6.2: Household Analytics & Reporting

### User Stories

**US-6.2.1: Household Balance Summary**
- As a **wealth advisor**, I want to view total household assets so that I can provide comprehensive financial advice.
  - Acceptance Criteria:
    - [ ] Aggregates all account balances across household members
    - [ ] Displays total checking, savings, CD, and loan balances
    - [ ] Shows net worth (assets minus liabilities)
    - [ ] Breakdown by account type and owner
    - [ ] Historical trend chart (6 months)
    - [ ] Updates in real-time

**US-6.2.2: Household Transaction Volume**
- As a **marketing analyst**, I want to analyze household transaction patterns so that targeted offers can be created.
  - Acceptance Criteria:
    - [ ] Monthly transaction count by household
    - [ ] Average transaction amount
    - [ ] Transaction volume trends
    - [ ] Category spending analysis across household
    - [ ] Identifies high-value households (top 10% by volume)

## FEATURE 6.3: Relationship Mapping

### User Stories

**US-6.3.1: Visualize Family Tree**
- As a **private banker**, I want to see a visual family tree so that generational wealth planning is facilitated.
  - Acceptance Criteria:
    - [ ] Hierarchical visualization of household members
    - [ ] Relationship lines connect members (spouse, parent-child)
    - [ ] Each node shows customer name, age, total assets
    - [ ] Click node to navigate to customer profile
    - [ ] Export family tree to PDF
    - [ ] Supports up to 4 generations

---

# EPIC 7: Compliance & Risk Management

## Overview
Compliance & Risk Management ensures regulatory adherence through KYC tracking, AML monitoring, OFAC screening, risk rating assignment, and audit logging. Integrates with enterprise compliance systems.

## Data Model
- **Customer Table**: KYC status, risk rating, compliance flags
- **Compliance Alert Table**: Tracks AML alerts, OFAC matches, suspicious activity
  - `alert_type`: kyc_expiry, aml_threshold, ofac_match, suspicious_activity
  - `alert_severity`: low, medium, high, critical
  - `alert_status`: open, under_review, resolved, false_positive
- **Audit Log Table**: Comprehensive activity tracking

## FEATURE 7.1: KYC & Customer Due Diligence

### User Stories

**US-7.1.1: KYC Document Checklist**
- As a **compliance officer**, I want to track required KYC documents for each customer so that regulatory requirements are met.
  - Acceptance Criteria:
    - [ ] Document checklist varies by customer type (individual vs business)
    - [ ] Required documents: government ID, proof of address, tax ID
    - [ ] Document upload with file type validation (PDF, JPG, PNG)
    - [ ] Document expiry tracking
    - [ ] Document verification workflow
    - [ ] Checklist completion percentage displayed

**US-7.1.2: KYC Expiry Alerts**
- As a **compliance system**, I want to alert when KYC documents expire so that renewals are processed timely.
  - Acceptance Criteria:
    - [ ] KYC expires after 12 months for low-risk customers
    - [ ] KYC expires after 6 months for high-risk customers
    - [ ] Alert generated 60 days before expiry
    - [ ] Email sent to compliance team and relationship manager
    - [ ] Dashboard widget shows expiring KYC count
    - [ ] Auto-renewal workflow triggered

## FEATURE 7.2: AML & Suspicious Activity Monitoring

### User Stories

**US-7.2.1: Transaction Threshold Monitoring**
- As an **AML system**, I want to detect transactions exceeding thresholds so that suspicious activity is flagged.
  - Acceptance Criteria:
    - [ ] Threshold: Single transaction >$10,000
    - [ ] Threshold: Daily transactions totaling >$25,000
    - [ ] Threshold: Multiple transactions just below $10,000 (structuring)
    - [ ] Alert created with transaction details
    - [ ] Alert assigned to AML analyst
    - [ ] Customer profile flagged during review

**US-7.2.2: Suspicious Activity Report (SAR) Filing**
- As an **AML officer**, I want to file SARs for suspicious activity so that regulatory reporting obligations are met.
  - Acceptance Criteria:
    - [ ] SAR form template pre-populated with customer and transaction data
    - [ ] SAR narrative text editor with guidance
    - [ ] Attachment upload for supporting documents
    - [ ] SAR submission to FinCEN within 30 days
    - [ ] SAR reference number tracked
    - [ ] SAR filing logged in customer compliance record

## FEATURE 7.3: OFAC & Sanctions Screening

### User Stories

**US-7.3.1: Customer OFAC Screening**
- As a **compliance system**, I want to screen new customers against OFAC lists so that sanctioned entities are blocked.
  - Acceptance Criteria:
    - [ ] OFAC screening performed on customer creation
    - [ ] Name, date of birth, and address matched
    - [ ] Match score calculated (fuzzy matching)
    - [ ] Matches >80% score block account opening
    - [ ] Matches 50-80% score trigger manual review
    - [ ] Screening results logged
    - [ ] OFAC list updated daily

**US-7.3.2: Transaction OFAC Screening**
- As a **compliance system**, I want to screen wire transfers against OFAC lists so that prohibited transfers are blocked.
  - Acceptance Criteria:
    - [ ] Beneficiary name screened against OFAC list
    - [ ] Beneficiary bank and country screened
    - [ ] High-risk countries flagged
    - [ ] Matched transactions held for review
    - [ ] Compliance officer notified immediately
    - [ ] Transaction rejected if confirmed match

## FEATURE 7.4: Audit Logging & Compliance Reporting

### User Stories

**US-7.4.1: Comprehensive Audit Logging**
- As a **security system**, I want to log all user actions so that audit trails are complete for regulatory exams.
  - Acceptance Criteria:
    - [ ] Actions logged: login, customer view, account modification, transaction entry, search
    - [ ] Log fields: user_id, timestamp, action_type, resource_id, IP address, result
    - [ ] PII access logged with enhanced detail
    - [ ] Failed actions logged (invalid login, unauthorized access)
    - [ ] Logs immutable (append-only)
    - [ ] Logs retained for 7 years

**US-7.4.2: Compliance Dashboard**
- As a **chief compliance officer**, I want a compliance metrics dashboard so that regulatory posture is visible.
  - Acceptance Criteria:
    - [ ] KYC completion rate by customer segment
    - [ ] Open compliance alerts count by severity
    - [ ] SAR filing volume trends
    - [ ] High-risk customer count
    - [ ] OFAC screening statistics
    - [ ] Regulatory exam readiness score

---

# EPIC 8: Branch & Employee Administration

## Overview
Branch & Employee Administration manages branch locations, employee records, officer assignments, and organizational hierarchy. Supports multi-branch operations with employee-to-branch assignments.

## Data Model
- **Branch Table**: Branch locations with addresses
  - `branch_code`: Unique identifier
  - `branch_type`: main, satellite, mobile, ATM
  - `is_active`: Operational status
- **Employee Table**: Employee records
  - `employee_number`: Unique identifier
  - `officer_code`: Lending authority designation
  - `department`: Operations, Lending, Compliance, etc.
- **Employee Branch Table**: Many-to-many employee-to-branch assignments
- **Customer Officer Assignment**: Links relationship officers to customers

## FEATURE 8.1: Branch Management

### User Stories

**US-8.1.1: Create Branch Location**
- As a **bank administrator**, I want to create new branch records so that branch operations can be tracked.
  - Acceptance Criteria:
    - [ ] Branch code auto-generated or manually entered (6 characters)
    - [ ] Branch name required
    - [ ] Branch type: main, satellite, mobile, ATM
    - [ ] Branch address linked to address table
    - [ ] Branch phone and email captured
    - [ ] Branch opened date required
    - [ ] Branch status set to "active"

**US-8.1.2: Assign Employees to Branch**
- As a **HR manager**, I want to assign employees to branches so that staffing levels are tracked.
  - Acceptance Criteria:
    - [ ] Employee can be assigned to multiple branches
    - [ ] Primary branch designated
    - [ ] Assignment start and end dates tracked
    - [ ] Branch capacity limits enforced
    - [ ] Employee schedule per branch (days/hours)
    - [ ] Assignment history maintained

## FEATURE 8.2: Employee Management

### User Stories

**US-8.2.1: Create Employee Record**
- As a **HR administrator**, I want to create employee records so that staff can be assigned to banking functions.
  - Acceptance Criteria:
    - [ ] Employee number auto-generated
    - [ ] First name and last name required
    - [ ] Job title and department required
    - [ ] Email format validated
    - [ ] Hire date required
    - [ ] Officer code assigned for lending authority
    - [ ] Salary and review date optional
    - [ ] Employee marked as "active"

**US-8.2.2: Assign Customer Relationship Officer**
- As a **branch manager**, I want to assign relationship officers to customers so that customer service is personalized.
  - Acceptance Criteria:
    - [ ] Only employees with officer_code can be assigned
    - [ ] Customer can have only one primary officer
    - [ ] Officer assignment date tracked
    - [ ] Officer workload balanced (max 100 customers per officer)
    - [ ] Officer change triggers customer notification
    - [ ] Assignment history maintained

## FEATURE 8.3: Organizational Hierarchy

### User Stories

**US-8.3.1: Manager Hierarchy**
- As a **HR system**, I want to track manager-employee relationships so that organizational structure is maintained.
  - Acceptance Criteria:
    - [ ] Employee table includes manager_employee_id field
    - [ ] Circular reporting relationships prevented
    - [ ] Organizational chart visualization
    - [ ] Reporting depth limited to 5 levels
    - [ ] Manager change workflow with approval
    - [ ] Employee count per manager displayed

---

# EPIC 9: Dual-Database & Infrastructure

## Overview
Dual-Database & Infrastructure provides database-agnostic architecture supporting both PostgreSQL and Microsoft SQL Server with consistent fuzzy search, automated migrations, and vendor-specific optimizations.

## Data Model
- **SearchProvider Adapter Pattern**: Database-agnostic search interface
  - PostgresSearchProvider: Trigram similarity, GIN indexes
  - SqlServerSearchProvider: STRING_SIMILARITY (2022+), SOUNDEX fallback
- **Vendor-Specific Migrations**: Separate migration directories
  - `/migrations/postgres/`: PostgreSQL DDL scripts
  - `/migrations/sqlserver/`: SQL Server DDL scripts
- **Runtime Vendor Detection**: Automatic provider selection via `DB_VENDOR` env var

## FEATURE 9.1: Database Vendor Abstraction

### User Stories

**US-9.1.1: Automatic Vendor Detection**
- As a **deployment system**, I want to automatically detect the database vendor so that the correct search provider is used.
  - Acceptance Criteria:
    - [ ] Environment variable `DB_VENDOR` supports: postgres, sqlserver
    - [ ] Database URL inspection as fallback detection
    - [ ] SearchProviderFactory returns appropriate provider
    - [ ] Vendor detection logged on application startup
    - [ ] Unsupported vendor throws configuration error

**US-9.1.2: Search Provider Interface**
- As a **developer**, I want a unified search interface so that database-specific logic is abstracted.
  - Acceptance Criteria:
    - [ ] ISearchProvider interface defines: searchCustomers(), searchAccounts()
    - [ ] Both providers implement identical interface
    - [ ] Search parameters consistent across providers
    - [ ] Response format identical (CustomerSearchResult[])
    - [ ] Relevance scoring normalized (0-100%)
    - [ ] Provider swap requires zero code changes

## FEATURE 9.2: Vendor-Specific Migrations

### User Stories

**US-9.2.1: PostgreSQL Migration Management**
- As a **database administrator**, I want to apply PostgreSQL migrations so that schema changes are versioned and automated.
  - Acceptance Criteria:
    - [ ] Migrations in `/migrations/postgres/` directory
    - [ ] Naming convention: `NNNN_description.sql`
    - [ ] Migrations applied in numerical order
    - [ ] Migration history tracked in `schema_migrations` table
    - [ ] Rollback scripts available for each migration
    - [ ] Failed migrations block application startup

**US-9.2.2: SQL Server Migration Management**
- As a **database administrator**, I want to apply SQL Server migrations so that schema parity with PostgreSQL is maintained.
  - Acceptance Criteria:
    - [ ] Migrations in `/migrations/sqlserver/` directory
    - [ ] Migration numbers match PostgreSQL equivalents
    - [ ] SQL Server-specific syntax used (e.g., `NVARCHAR` vs `VARCHAR`)
    - [ ] Full-Text Search catalogs created
    - [ ] Computed columns used for performance
    - [ ] Migration history tracked

## FEATURE 9.3: Fuzzy Search Parity

### User Stories

**US-9.3.1: PostgreSQL Fuzzy Search**
- As a **search system**, I want to use PostgreSQL trigram similarity so that fuzzy name matching is performant.
  - Acceptance Criteria:
    - [ ] Extension `pg_trgm` enabled
    - [ ] GIN indexes on first_name, last_name, business_name, full_name
    - [ ] Similarity function with configurable threshold
    - [ ] Query plan uses index scan (not sequential)
    - [ ] Performance: <300ms for 1M records

**US-9.3.2: SQL Server Fuzzy Search**
- As a **search system**, I want to use SQL Server fuzzy matching so that search results are equivalent to PostgreSQL.
  - Acceptance Criteria:
    - [ ] SQL Server 2022+: `STRING_SIMILARITY()` function
    - [ ] SQL Server <2022: `SOUNDEX()` and `DIFFERENCE()` fallback
    - [ ] Full-Text Search catalog created
    - [ ] Computed columns for search optimization
    - [ ] Relevance scores within ±5% of PostgreSQL
    - [ ] Performance: <300ms for 1M records

## FEATURE 9.4: Environment Configuration

### User Stories

**US-9.4.1: Environment-Based Configuration**
- As a **DevOps engineer**, I want environment-based configuration so that dev, staging, and production use appropriate database vendors.
  - Acceptance Criteria:
    - [ ] Environment variables: `DB_VENDOR`, `DATABASE_URL`
    - [ ] Development: Supports both PostgreSQL and SQL Server
    - [ ] Staging: Matches production database vendor
    - [ ] Production: Vendor-specific connection pooling
    - [ ] Configuration validation on startup
    - [ ] Missing configuration triggers clear error message

**US-9.4.2: Database Health Monitoring**
- As a **operations team**, I want database health checks so that connectivity issues are detected proactively.
  - Acceptance Criteria:
    - [ ] Health check endpoint: `/health/database`
    - [ ] Checks: connectivity, query performance, disk space
    - [ ] Response: status (healthy/degraded/down), latency, vendor
    - [ ] Unhealthy status triggers alerts
    - [ ] Health check runs every 60 seconds
    - [ ] Metrics exported to monitoring system

---

## Requirements Traceability Matrix

| EPIC | Feature Count | User Story Count | Priority |
|------|---------------|------------------|----------|
| Customer Management | 4 | 9 | Critical |
| Account Management | 4 | 8 | Critical |
| Debit Card Management | 4 | 11 | High |
| Transaction Management | 4 | 7 | Critical |
| Search & Discovery | 4 | 8 | High |
| Household & Relationship Management | 3 | 4 | Medium |
| Compliance & Risk Management | 4 | 8 | Critical |
| Branch & Employee Administration | 3 | 5 | Medium |
| Dual-Database & Infrastructure | 4 | 8 | High |
| **TOTAL** | **34** | **68** | - |

---

## Technical Architecture Summary

### Technology Stack
- **Frontend**: React.js, Material-UI, Shadcn/UI, Tailwind CSS, Vite
- **Backend**: Node.js, Express.js, TypeScript
- **ORM**: Drizzle ORM with dual-database support
- **Databases**: PostgreSQL (Neon serverless), Microsoft SQL Server
- **State Management**: TanStack React Query
- **Forms**: React Hook Form with Zod validation
- **Search**: Adapter pattern with vendor-specific implementations
- **Timezone**: Pacific Standard Time (PST) for all timestamps

### Security & Compliance
- **PCI DSS**: Only last 4 digits of card numbers stored
- **Data Masking**: SSN/EIN display last 4 digits only
- **Audit Logging**: Comprehensive activity tracking, 7-year retention
- **Role-Based Access**: Granular permissions per feature
- **OFAC Screening**: Automated sanctions screening
- **KYC/AML**: Regulatory compliance workflows

### Performance Targets
- **Search Response**: <500ms for fuzzy searches on 1M records
- **Transaction Processing**: <200ms for balance updates
- **Dashboard Load**: <2 seconds for complete customer 360 view
- **Database Queries**: Index-optimized, execution plans validated
- **API Response Time**: 95th percentile <1 second

---

## Appendix: Database Constraints & Business Rules

### Customer Constraints
- `customer_name_type_check`: Enforces conditional name requirements
  - Individual: first_name AND last_name required
  - Business/trust: business_name required

### Account Constraints
- Active account requires at least one active owner
- Account closure requires zero balance
- Joint account supports 2-4 owners

### Debit Card Constraints
- Cards ONLY for checking/business_checking accounts (trigger enforced)
- Customer must be account owner (trigger validates)
- One primary card per account-customer pair
- Card expiry date must be future date

### Transaction Constraints
- Debit amount cannot exceed available balance (unless overdraft protection)
- Transaction date cannot be future date
- Posted transaction cannot be modified (only reversed)

---

**Document Control:**
- Version: 1.0
- Last Updated: October 2025
- Owner: Product Management & Engineering
- Review Cycle: Quarterly
