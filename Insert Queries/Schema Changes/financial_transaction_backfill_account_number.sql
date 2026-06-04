-- Backfill financial_transaction.account_number from account.account_number for legacy rows.
-- Required before the application code repoints transaction queries from ft.account_id onto
-- ft.account_number (which is the new source of truth — the ETL no longer populates
-- ft.account_id reliably).
-- Idempotent: safe to run multiple times. Only touches rows where account_number IS NULL
-- AND a usable account_id is still present.
-- After running, verify with:
--   SELECT COUNT(*) FROM dbo.financial_transaction WHERE account_number IS NULL;
-- Any remaining NULL rows are orphans (no usable account_id either) and need a separate
-- ETL repair — they are not addressable by this script.

UPDATE ft
SET ft.account_number = a.account_number
FROM dbo.financial_transaction ft
INNER JOIN dbo.account a ON a.account_id = ft.account_id
WHERE ft.account_number IS NULL
  AND ft.account_id IS NOT NULL;
GO
