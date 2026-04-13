-- Diagnostic queries for transaction data issues
-- Run against the on-prem SQL Server database

-- 1. Check if financial_transaction has data at all
SELECT 'Total transactions' as check_name, COUNT(*) as result FROM financial_transaction;

-- 2. Check transaction counts per customer (via account_ownership)
-- Replace 8473132 with the customer ID having issues
DECLARE @custId BIGINT = 8473132;

SELECT 'Customer account count' as check_name, COUNT(*) as result
FROM account_ownership WHERE customer_id = @custId;

SELECT 'Customer transactions via account_ownership' as check_name, COUNT(*) as result
FROM financial_transaction ft
WHERE ft.account_id IN (
  SELECT account_id FROM account_ownership WHERE customer_id = @custId
);

-- 3. Show which of the customer's accounts have transactions
SELECT
  a.account_id,
  a.account_number,
  a.account_type,
  (SELECT COUNT(*) FROM financial_transaction ft WHERE ft.account_id = a.account_id) as tx_count
FROM account a
INNER JOIN account_ownership ao ON ao.account_id = a.account_id
WHERE ao.customer_id = @custId
ORDER BY tx_count DESC;

-- 4. Check if financial_transaction has account_ids that don't exist in account table
SELECT 'Orphaned transaction account_ids' as check_name, COUNT(DISTINCT ft.account_id) as result
FROM financial_transaction ft
WHERE NOT EXISTS (SELECT 1 FROM account a WHERE a.account_id = ft.account_id);

-- 5. Sample of account_ids in financial_transaction vs account table
SELECT TOP 10 'Sample ft account_ids' as check_name, ft.account_id, ft.transaction_date, ft.amount
FROM financial_transaction ft
ORDER BY ft.transaction_id DESC;

SELECT TOP 10 'Sample account IDs' as check_name, a.account_id, a.account_number, a.account_type
FROM account a
INNER JOIN account_ownership ao ON ao.account_id = a.account_id
WHERE ao.customer_id = @custId
ORDER BY a.account_id;
