-- Depo Txn View

INSERT INTO ClientIQPreProd.dbo.financial_transaction
(
    account_id,
    amount,
    transaction_code,
    transaction_type,
    status,
    transaction_date,
    posting_date,
    description,
    category_id,
    ledger_balance_after,
    available_balance_after,
    source_system,
    source_transaction_id
)
SELECT
    a.account_id,
    s.[TRANSACTION AMOUNT]                     AS amount,
    s.[TRANSACTION_CD]                         AS transaction_code,
    COALESCE(s.[TRANSACTION_TYP], 'UNKNOWN')   AS transaction_type,
    s.[TRANSACTION_STATUS]                     AS status,
    s.[TRANSACTION_DT]                         AS transaction_date,
    COALESCE(
        s.[POST_DATE],
        s.[PROD_DATE],
        s.[TRANSACTION_DT]
    )                                          AS posting_date,
    s.[TRN_DESC]                               AS description,
    tc.category_id                             AS category_id,
    s.[ACCOUNT_BAL_AFTER]                     AS ledger_balance_after,
    s.[ACCOUNT_BAL_AFTER]                     AS available_balance_after,
    'TheSpotPreProd'                           AS source_system,
    s.[TRANSACTION_ID]                         AS source_transaction_id
FROM TheSpotPreProd.dbo.COMBINED_DEPO_TXN_VIEW s
JOIN ClientIQPreProd.dbo.account a
    ON a.account_number = CAST(s.[TRANSACTION_ACCT] AS VARCHAR(50))
LEFT JOIN ClientIQPreProd.dbo.transaction_category tc
    ON tc.category_code = s.[TRANSACTION_CD]
WHERE s.[TRANSACTION_DT] >= DATEADD(MONTH, -13, CAST(GETDATE() AS DATE))
  AND NOT EXISTS (
        SELECT 1
        FROM ClientIQPreProd.dbo.financial_transaction ft
        WHERE ft.account_id = a.account_id
          AND ft.source_system = 'TheSpotPreProd'
          AND ft.source_transaction_id = s.[TRANSACTION_ID]
    );

-- Loan Txn View

INSERT INTO ClientIQPreProd.dbo.financial_transaction
(
    account_id,
    amount,
    transaction_code,
    transaction_type,
    status,
    transaction_date,
    posting_date,
    description,
    category_id,
    ledger_balance_after,
    available_balance_after,
    source_system,
    source_transaction_id
)
SELECT
    a.account_id,
    s.[TRANSACTION_AMOUNT]                    AS amount,
    s.[TRANSACTION_CD]                        AS transaction_code,
    COALESCE(s.[TRANSACTION_TYP], 'UNKNOWN')  AS transaction_type,
    s.[TRANSACTION_STATUS]                    AS status,
    s.[TRANSACTION_DT]                        AS transaction_date,
    COALESCE(
        s.[POST_DATE],
        s.[PROD_DATE],
        s.[TRANSACTION_DT]
    )                                         AS posting_date,
    s.[TRN_DESC]                              AS description,
    tc.category_id                            AS category_id,
    s.[ACCOUNT_BAL_AFTER]                     AS ledger_balance_after,
    s.[ACCOUNT_BAL_AFTER]                     AS available_balance_after,
    'TheSpotPreProd'                          AS source_system,
    s.[TRANSACTION_ID]                        AS source_transaction_id
FROM TheSpotPreProd.dbo.LOAN_TXN_VIEW s
JOIN ClientIQPreProd.dbo.account a
    ON a.account_number = CAST(s.[TRANSACTION_ACCT] AS VARCHAR(50))
LEFT JOIN ClientIQPreProd.dbo.transaction_category tc
    ON tc.category_code = s.[TRANSACTION_CD]
WHERE s.[TRANSACTION_DT] >= DATEADD(MONTH, -13, CAST(GETDATE() AS DATE))
  AND NOT EXISTS (
        SELECT 1
        FROM ClientIQPreProd.dbo.financial_transaction ft
        WHERE ft.account_id = a.account_id
          AND ft.source_system = 'TheSpotPreProd'
          AND ft.source_transaction_id = s.[TRANSACTION_ID]
    );