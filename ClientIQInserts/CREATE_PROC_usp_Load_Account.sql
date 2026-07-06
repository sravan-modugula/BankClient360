USE [ClientIQPreProd]
GO

/****** Object:  StoredProcedure [dbo].[usp_Load_Account]    Script Date: 6/26/2026 1:53:22 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO



CREATE PROCEDURE [dbo].[usp_Load_Account]
AS
BEGIN
    SET NOCOUNT ON;

    /* ===== DEPOSIT ACCOUNTS from TheSpotPreProd.COMBINED_DEPO_VIEW_CURR ===== */
    MERGE [ClientIQPreProd].[dbo].[account] AS target
    USING (
        SELECT 
            s.ACCT_NBR AS account_number,
            s.UNQ_ACCT_NBR AS unique_act_number,
            s.ACCT_TYPE_DESC AS account_type,
            s.PROD_TYPE_DESC AS account_subtype,
            s.ACCT_STATUS_DESC AS account_status,
            s.CURR_BAL AS balance,
            s.AVAIL_BAL AS available_balance,
            s.INT_RT AS interest_rate,
            b.branch_id,
            s.PROD_CD AS product_code,
            CASE 
                WHEN s.ACCT_TYP_CD IN ('D','S','X') THEN s.OPEN_DT
                WHEN s.ACCT_TYP_CD = 'T' THEN s.ISSUE_DT 
                ELSE s.OPEN_DT 
            END AS opened_date,
            s.CLOSE_DT AS closed_date,
            s.MAT_DT AS maturity_date,
            s.LAST_CONTACT_DT AS last_transaction_date,
            s.ACCT_CUST_CLASS_DESC AS account_class,
            s.MTD_AVG_BAL AS average_balance,
            s.LAST_MNTNC_DT AS last_maintenance_date
        FROM [TheSpotPreProd].[dbo].[COMBINED_DEPO_VIEW_CURR] s
        LEFT JOIN [ClientIQPreProd].[dbo].[branch] b ON b.branch_code = s.BRANCH_NBR
    ) AS source ON target.unique_act_number = source.unique_act_number
    WHEN MATCHED THEN UPDATE SET
        target.account_type = source.account_type,
        target.account_subtype = source.account_subtype,
        target.account_status = source.account_status,
        target.balance = source.balance,
        target.available_balance = source.available_balance,
        target.interest_rate = source.interest_rate,
        target.branch_id = source.branch_id,
        target.product_code = source.product_code,
        target.opened_date = source.opened_date,
        target.closed_date = source.closed_date,
        target.maturity_date = source.maturity_date,
        target.last_transaction_date = source.last_transaction_date,
        target.account_class = source.account_class,
        target.average_balance = source.average_balance,
        target.last_maintenance_date = source.last_maintenance_date
    WHEN NOT MATCHED THEN INSERT (
        account_number, unique_act_number, account_type, account_subtype,
        account_status, balance, available_balance, interest_rate, branch_id, 
        product_code, opened_date, closed_date, maturity_date, 
        last_transaction_date, account_class, average_balance, last_maintenance_date
    )
    VALUES (
        source.account_number, source.unique_act_number, source.account_type, source.account_subtype,
        source.account_status, source.balance, source.available_balance, source.interest_rate, 
        source.branch_id, source.product_code, source.opened_date, source.closed_date, 
        source.maturity_date, source.last_transaction_date, source.account_class, 
        source.average_balance, source.last_maintenance_date
    );

    /* ===== LOAN ACCOUNTS from TheSpotPreProd.LOAN_VIEW_CURR ===== */
    MERGE [ClientIQPreProd].[dbo].[account] AS target
    USING (
        SELECT 
            CAST(s.ACCT_NBR AS VARCHAR(50)) AS account_number,
            s.UNQ_ACCT_NBR AS unique_act_number,
            LEFT(CAST(s.ACCT_TYPE_DESC AS VARCHAR(50)), 50) AS account_type,
            LEFT(CAST(s.PROD_STMT_DESC AS VARCHAR(50)), 50) AS account_subtype,
            LEFT(REPLACE(CAST(s.ACCT_STATUS_DESC AS VARCHAR(50)), CHAR(0), ''), 20) AS account_status,
            s.CURR_BAL AS balance,
            s.CURR_PAYOFF_AMT AS available_balance,
            s.INT_RT AS interest_rate,
            b.branch_id,
            LEFT(CAST(s.PROD_CD AS VARCHAR(50)), 50) AS product_code,
            COALESCE(s.ORIG_LN_DT, s.OPEN_DT) AS opened_date,
            s.CLOSE_DT AS closed_date,
            s.MAT_DT AS maturity_date,
            s.LAST_ACTIVITY_DT AS last_transaction_date,
            LEFT(CAST(s.ACCT_CLASS_DESC AS VARCHAR(50)), 50) AS account_class,
            s.CURR_BAL AS average_balance,
            s.LAST_MNTNC_DT AS last_maintenance_date
        FROM [TheSpotPreProd].[dbo].[LOAN_VIEW_CURR] s
        LEFT JOIN [ClientIQPreProd].[dbo].[branch] b ON b.branch_code = s.BRANCH
    ) AS source ON target.unique_act_number = source.unique_act_number
    WHEN MATCHED THEN UPDATE SET
        target.account_type = source.account_type,
        target.account_subtype = source.account_subtype,
        target.account_status = source.account_status,
        target.balance = source.balance,
        target.available_balance = source.available_balance,
        target.interest_rate = source.interest_rate,
        target.branch_id = source.branch_id,
        target.product_code = source.product_code,
        target.opened_date = source.opened_date,
        target.closed_date = source.closed_date,
        target.maturity_date = source.maturity_date,
        target.last_transaction_date = source.last_transaction_date,
        target.account_class = source.account_class,
        target.average_balance = source.average_balance,
        target.last_maintenance_date = source.last_maintenance_date
    WHEN NOT MATCHED THEN INSERT (
        account_number, unique_act_number, account_type, account_subtype,
        account_status, balance, available_balance, interest_rate, branch_id, 
        product_code, opened_date, closed_date, maturity_date, 
        last_transaction_date, account_class, average_balance, last_maintenance_date
    )
    VALUES (
        source.account_number, source.unique_act_number, source.account_type, source.account_subtype,
        source.account_status, source.balance, source.available_balance, source.interest_rate, 
        source.branch_id, source.product_code, source.opened_date, source.closed_date, 
        source.maturity_date, source.last_transaction_date, source.account_class, 
        source.average_balance, source.last_maintenance_date
    );
END;
GO


