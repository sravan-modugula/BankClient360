-- Performance indexes for ClientIQ on-prem MS SQL Server
-- Run this against the SQL Server database to improve query performance
-- Especially important after large data loads

-- ============================================================================
-- FINANCIAL TRANSACTION INDEXES (highest impact)
-- ============================================================================

-- Index for account-level transaction lookups (used by transaction history, balance history)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_financial_transaction_account_date')
  CREATE NONCLUSTERED INDEX IX_financial_transaction_account_date
  ON financial_transaction (account_id, transaction_date DESC, transaction_id DESC)
  INCLUDE (amount, ledger_balance_after, transaction_code, description);

-- Index for customer-level transaction lookups via account_ownership
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_financial_transaction_date_desc')
  CREATE NONCLUSTERED INDEX IX_financial_transaction_date_desc
  ON financial_transaction (transaction_date DESC, transaction_id DESC)
  INCLUDE (account_id, amount, ledger_balance_after);

-- ============================================================================
-- ACCOUNT OWNERSHIP INDEXES
-- ============================================================================

-- Index for customer-to-account lookups (used by relationship summary, deposit analytics)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_account_ownership_customer')
  CREATE NONCLUSTERED INDEX IX_account_ownership_customer
  ON account_ownership (customer_id)
  INCLUDE (account_id);

-- ============================================================================
-- ACCOUNT INDEXES
-- ============================================================================

-- Index for account type and status filtering
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_account_type_status')
  CREATE NONCLUSTERED INDEX IX_account_type_status
  ON account (account_type, account_status)
  INCLUDE (balance, interest_rate, account_id);

-- ============================================================================
-- CUSTOMER INDEXES
-- ============================================================================

-- Index for CIF number lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_customer_cif')
  CREATE NONCLUSTERED INDEX IX_customer_cif
  ON customer (jack_henry_cif_number)
  INCLUDE (customer_id, first_name, last_name, customer_status);

-- Index for name search
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_customer_name')
  CREATE NONCLUSTERED INDEX IX_customer_name
  ON customer (last_name, first_name)
  INCLUDE (customer_id, customer_status, customer_type);

-- ============================================================================
-- VERIFY
-- ============================================================================
PRINT 'Performance indexes created successfully';
PRINT 'Run: SELECT name, type_desc FROM sys.indexes WHERE object_id = OBJECT_ID(''financial_transaction'') to verify';
