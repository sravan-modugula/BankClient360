-- Deposit View

MERGE dbo.Account AS target
USING (
    SELECT
        s.Acct_NBR                                      AS account_number,
        s.ACCT_TYPE_DESC                                AS account_type,
        s.PROD_STMT_DESC                                AS account_subtype,
        s.ACCT_STATUS_DESC                              AS account_status,
        s.CURR_BAL                                      AS balance,
        s.AVAIL_BAL                                     AS available_balance,
        s.INT_RT                                        AS interest_rate,
        b.branch_id                                     AS branch_id,
        s.PROD_CD                                       AS product_code,

        CASE 
            WHEN s.ACCT_TYP_CD IN ('D','S','X') THEN s.OPEN_DT
            WHEN s.ACCT_TYP_CD = 'T' THEN s.ISSUE_DT
            ELSE s.OPEN_DT
        END                                             AS opened_date,

        s.CLOSE_DT                                      AS closed_date,
        s.LAST_CONTACT_DT                               AS last_transaction_date,
        s.ACCT_CUST_CLASS_DESC                          AS account_class,
        s.MTD_AVG_BAL                                   AS average_balance,
        s.LAST_MNTNC_DT                                 AS last_maintenance_date,

        -- ✅ NEW FIELDS
        s.STMT_CYCL_CD                                  AS statement_cycle,
        CASE 
            WHEN s.STMT_CYCL_CD = 'A' THEN 'Annual Statement'
            WHEN s.STMT_CYCL_CD = 'M' THEN 'Monthly Statement'
            WHEN s.STMT_CYCL_CD = 'Q' THEN 'Quarterly Statement'
            ELSE NULLIF(LTRIM(RTRIM(s.STMT_CYCL_DESC)), '')
        END                                             AS statement_code_desc

    FROM TheSpot.dbo.COMBINED_DEPO_VIEW_CURR s
    LEFT JOIN dbo.branch b
        ON b.branch_code = s.BRANCH_NBR
) AS source
ON target.account_number = source.account_number

-- Loan View

MERGE dbo.account AS target
USING (
    SELECT
        CAST(s.ACCT_NBR AS VARCHAR(50))                         AS account_number,

        LEFT(CAST(s.ACCT_TYPE_DESC AS VARCHAR(50)), 50)        AS account_type,
        LEFT(CAST(s.PROD_STMT_DESC AS VARCHAR(50)), 50)        AS account_subtype,

        -- IMPORTANT: account_status is VARCHAR(20)
        LEFT(
            REPLACE(
                CAST(s.ACCT_STATUS_DESC AS VARCHAR(50)),
                CHAR(0),
                ''
            ),
            20
        )                                                       AS account_status,

        s.CURR_BAL                                             AS balance,
        s.CURR_PAYOFF_AMT                                      AS available_balance,
        s.INT_RT                                               AS interest_rate,
        b.branch_id                                            AS branch_id,

        LEFT(CAST(s.PROD_CD AS VARCHAR(50)), 50)               AS product_code,

        COALESCE(s.ORIG_LN_DT, s.OPEN_DT)                       AS opened_date,
        s.CLOSE_DT                                             AS closed_date,
        s.LAST_ACTIVITY_DT                                     AS last_transaction_date,

        LEFT(CAST(s.ACCT_CLASS_DESC AS VARCHAR(50)), 50)       AS account_class,
        s.CURR_BAL                                             AS average_balance,
        s.LAST_MNTNC_DT                                        AS last_maintenance_date
    FROM TheSpot.dbo.LOAN_VIEW_CURR s
    LEFT JOIN dbo.branch b
        ON b.branch_code = s.BRANCH
) AS source
ON target.account_number = source.account_number

WHEN MATCHED THEN
    UPDATE SET
        account_type            = source.account_type,
        account_subtype         = source.account_subtype,
        account_status          = source.account_status,
        balance                 = source.balance,
        available_balance       = source.available_balance,
        interest_rate           = source.interest_rate,
        branch_id               = source.branch_id,
        product_code            = source.product_code,
        opened_date             = source.opened_date,
        closed_date             = source.closed_date,
        last_transaction_date   = source.last_transaction_date,
        account_class           = source.account_class,
        average_balance         = source.average_balance,
        last_maintenance_date   = source.last_maintenance_date

WHEN NOT MATCHED THEN
    INSERT (
        account_number,
        account_type,
        account_subtype,
        account_status,
        balance,
        available_balance,
        interest_rate,
        branch_id,
        product_code,
        opened_date,
        closed_date,
        last_transaction_date,
        account_class,
        average_balance,
        last_maintenance_date
    )
    VALUES (
        source.account_number,
        source.account_type,
        source.account_subtype,
        source.account_status,
        source.balance,
        source.available_balance,
        source.interest_rate,
        source.branch_id,
        source.product_code,
        source.opened_date,
        source.closed_date,
        source.last_transaction_date,
        source.account_class,
        source.average_balance,
        source.last_maintenance_date
    );
