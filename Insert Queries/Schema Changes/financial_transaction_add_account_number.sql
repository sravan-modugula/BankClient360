-- Add denormalized account number to the financial_transaction table for Operations queries.
-- Nullable; legacy rows remain NULL. Future write paths populate it from account.account_number.
-- Idempotent: safe to run multiple times.

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE Name = N'account_number'
      AND Object_ID = OBJECT_ID(N'dbo.financial_transaction')
)
BEGIN
    ALTER TABLE dbo.financial_transaction ADD account_number VARCHAR(50) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'idx_transaction_account_number'
      AND object_id = OBJECT_ID(N'dbo.financial_transaction')
)
BEGIN
    CREATE INDEX idx_transaction_account_number ON dbo.financial_transaction (account_number);
END
GO
