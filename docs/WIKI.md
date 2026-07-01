# Banking Client 360 - Application Wiki

## Overview

Banking Client 360 is an enterprise-grade customer relationship management platform designed for financial institutions. The application provides a comprehensive 360-degree view of banking customers, integrating account data, transaction history, compliance information, and relationship analytics in a unified interface.

Built with modern web technologies (React.js, Node.js, TypeScript) and Material Design principles, the platform emphasizes data density, trust, and operational efficiency for banking professionals.

## Core Features

### 1. Customer Search & Discovery

**Intelligent Hybrid Search**
- **Multi-criteria search**: Find customers by ID, name, tax ID, government ID, or Silverlake CIF number
- **Fuzzy matching**: Handles typos and spelling variations using PostgreSQL trigram similarity or SQL Server phonetic matching
- **Dual-database support**: Seamlessly works with both PostgreSQL and Microsoft SQL Server backends
- **Relevance scoring**: Returns match confidence scores (0-100%) with exact/fuzzy/partial indicators
- **Real-time results**: Instant search with comprehensive customer matching

**Search Examples**:
- Customer ID: "3" → 100% exact match
- Fuzzy name: "Smyth" finds "Smith" with 33% similarity
- Tax ID: "123-45-6789" → exact match with full customer details

### 2. Customer Profile Management

**Polymorphic Customer Data Model**
- **Individual customers**: First name + last name required
- **Business customers**: Business name required
- **Trust customers**: Business name required
- **Database-enforced validation**: CHECK constraints prevent invalid data combinations
- **Unified search field**: Auto-populated full_name for consistent search experience

**Customer Information Display**:
- Personal/business details with VIP and Employee badges
- Customer status indicators (Active, Inactive, Closed)
- Birthday notifications with animated indicators
- Date of birth and customer since dates (MM/DD/YYYY format)
- Contact information and address details
- Household relationship mapping

### 3. Account & Relationship Summary

**Total Relationship Summary**
- **Deposits overview**: Total deposit balances across all accounts
- **Loans overview**: Total loan balances with separate tracking
- **Independent QoQ analytics**: Separate quarter-over-quarter calculations for deposits and loans
- **Real historical data**: Compares current balances to 90-day historical snapshots
- **Accurate comparisons**: Excludes accounts opened after historical cutoff to prevent inflated metrics

**Example Metrics**:
- Customer deposits: $35,078.34 (QoQ: +52.03%)
- Customer loans: $51,150.80 (QoQ: -13.30%)

### 4. Interactive Account Management

**Account Selection & Filtering**
- **Dynamic account list**: View all customer accounts grouped by type
- **Interactive selection**: Click any account to view detailed transaction history
- **CIF number display**: Full Customer Information File (CIF) numbers with search capability
- **Account types supported**:
  - Checking accounts
  - Savings accounts
  - Money Market accounts
  - Certificates of Deposit (CDs)
  - Mortgage loans
  - Auto loans
  - Personal loans
  - Home Equity Lines of Credit (HELOC)
  - Credit cards

**Account Details**:
- Account numbers and types
- Current balances with real-time accuracy
- Interest rates and terms
- Open dates and maturity dates (for time-based accounts)
- Status indicators

### 5. Transaction History & Analytics

**Comprehensive Transaction Tracking**
- **Real transaction data**: Extensive realistic test data with authentic banking patterns
- **Transaction types**: Deposits, withdrawals, transfers, payments, fees, interest
- **Ledger balance tracking**: Accurate running balance after each transaction
- **Date/time display**: All timestamps in PST timezone
- **Null safety**: Comprehensive error handling for missing or incomplete data

**Transaction Filtering**:
- Filter by selected account
- View account-specific transaction history
- See running ledger balances
- Track transaction patterns over time

### 6. Balance Trends & Analytics

**Real Data-Driven Charts**
- **Historical balance trends**: Visualize balance changes over time using actual transaction history
- **Account type breakdown**: Weighted average calculations segmented by account type
- **Interactive charts**: Responsive data visualizations with Material Design aesthetics
- **No synthetic data**: All charts display real transaction-based calculations

### 7. Debit Card Management

**Card Lifecycle Management**
- **Card inventory**: View all debit cards linked to customer accounts
- **Status tracking**: Active, Inactive, Expired, Blocked card states
- **Security features**: Last 4 digits display for security
- **Expiration monitoring**: Track card expiration dates
- **Multi-card support**: Manage multiple cards per account

### 8. Enterprise Notes Module

**Collaborative Note-Taking**
- **Rich note creation**: Add detailed notes with timestamps
- **Note categorization**: Organize by type (General, Follow-up, Complaint, Compliance)
- **Audit trail**: Track note creation dates and authors
- **Search and filter**: Find notes across customer profiles
- **Compliance support**: Document regulatory interactions and issues

### 9. Risk & Compliance Management

**Regulatory Compliance**
- **Risk assessment scores**: Customer risk ratings (Low, Medium, High)
- **KYC status tracking**: Know Your Customer verification status
- **AML monitoring**: Anti-Money Laundering compliance indicators
- **OFAC screening**: Office of Foreign Assets Control check results
- **Last review dates**: Track compliance review schedules
- **Next review scheduling**: Automated compliance calendar

### 10. Household Relationship Mapping

**Family & Business Relationships**
- **Relationship types**: Spouse, parent, child, sibling, business partner, authorized signer
- **Cross-customer linking**: Navigate between related customer profiles
- **Household aggregation**: View consolidated household relationships
- **Authority tracking**: Identify authorized signers and co-owners

## Technical Capabilities

### Architecture
- **Frontend**: React.js with Material-UI and shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: Dual support for PostgreSQL and Microsoft SQL Server
- **ORM**: Drizzle ORM with type-safe database operations
- **State Management**: React Query for server state
- **Routing**: Wouter for client-side navigation

### Data Quality & Integrity
- **Null safety**: Comprehensive COALESCE statements and error handling
- **Data validation**: Zod schemas for type-safe API contracts
- **Database constraints**: CHECK constraints enforce business rules at database level
- **Automatic triggers**: PostgreSQL triggers maintain computed fields
- **Computed columns**: SQL Server persisted columns for performance
- **Index optimization**: Trigram GIN indexes and Full-Text Search support

### Dual-Database Support
- **Database-agnostic architecture**: SearchProvider adapter pattern isolates vendor-specific logic
- **Automatic detection**: Runtime database vendor detection via environment variables
- **Feature parity**: Identical fuzzy search capabilities on both platforms
- **Vendor-specific migrations**: Separate migration directories for each database
- **Consistent API**: Same response format regardless of backend database

### CI/CD Governance
- **Pre-commit validation**: Block commits with governance violations
- **Automated testing**: TypeScript validation, schema consistency checks
- **Contract validation**: API DTO compliance enforcement
- **Security scanning**: npm audit integration
- **Architecture standards**: Automated enforcement of coding patterns

## Design System

### Material Design Implementation
- **Color palette**:
  - Primary: #2e7d32 (Professional green)
  - Secondary: #936b06 (Gold accents for VIP/premium features)
- **Typography**: Roboto font family (regular, medium, mono)
- **Spacing**: Consistent 8px grid system
- **Components**: Material-UI cards, data tables, and form controls
- **Theme**: Professional banking aesthetic emphasizing trust and stability

### User Experience Features
- **Dense data tables**: Maximize information visibility
- **Visual badges**: VIP, Employee, Birthday indicators
- **Responsive layout**: Tabbed navigation for different data sections
- **Date formatting**: Consistent MM/DD/YYYY format throughout
- **PST timezone**: All dates/times displayed in Pacific Standard Time
- **Loading states**: Skeleton screens and progress indicators

## Data Model Highlights

### Jack Henry Banking Integration
The application is designed to integrate with Jack Henry banking core systems, following industry-standard data models for:
- Customer Information File (CIF) numbers
- Silverlake account structures
- Standard banking transaction codes
- Regulatory compliance fields

### Test Data
- **505 total customers**: Mix of individual, business, and trust customers
- **175 individual customers**: Personal banking customers
- **159 business customers**: Commercial banking clients
- **171 trust customers**: Estate and trust accounts
- **Extensive transaction history**: Realistic banking patterns across 90+ days
- **Account diversity**: Multiple account types per customer with varied balances

## Key Differentiators

1. **Separate QoQ Calculations**: Deposits and loans show independent quarter-over-quarter growth rates
2. **Historical Accuracy**: Excludes newly-opened accounts from historical comparisons
3. **Real Balance Aggregation**: Uses ledger_balance_after from actual transactions, falling back to account.balance
4. **Polymorphic Customers**: Database-enforced conditional name requirements by customer type
5. **Dual-Database Architecture**: Seamlessly switch between PostgreSQL and SQL Server
6. **Enterprise Governance**: CI/CD framework prevents architectural violations
7. **Comprehensive Null Safety**: Defensive programming throughout the stack

## Future Enhancements

Based on architect recommendations:
- Automated regression tests for accounts with/without transaction history
- Shared balance aggregation helper to prevent endpoint divergence
- Expanded analytics dashboards with additional trending metrics
- Enhanced household aggregation views
- Additional compliance workflow automation
