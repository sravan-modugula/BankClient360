USE [ClientIQPreProd]
GO

/****** Object:  StoredProcedure [dbo].[usp_Load_Account_Maintenance]    Script Date: 6/26/2026 1:56:54 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[usp_Load_Account_Maintenance]
    @FullRefresh BIT = 0  -- 1 = truncate + reload, 0 = incremental
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @MaxCustProdDt DATETIME;
    DECLARE @MaxLoanProdDt DATETIME;

    /* =========================
       CUSTOMER ACCOUNT TABLE
       ========================= */
    IF @FullRefresh = 1
    BEGIN
        TRUNCATE TABLE [ClientIQPreProd].[dbo].[customer_account_maintenance];
        SET @MaxCustProdDt = NULL;
    END
    ELSE
    BEGIN
        SELECT @MaxCustProdDt = MAX(PROD_DT)
        FROM [ClientIQPreProd].[dbo].[customer_account_maintenance];
    END

    INSERT INTO [ClientIQPreProd].[dbo].[customer_account_maintenance] (
        CIF_NBR, ACCT_NBR, ACCT_TYP, UNQ_ACCT_NBR,
        MANT_DT, MANT_FLD, NEW_VAL, OLD_VAL, PROD_DT
    )
    SELECT 
        s.CIF_NBR, s.ACCT_NBR, s.ACCT_TYP, s.UNQ_ACCT_NBR,
        s.MANT_DT, s.MANT_FLD, s.NEW_VAL, s.OLD_VAL, s.PROD_DT
    FROM [TheSpotPreProd].[dbo].[CUST_ACCT_MANT] s
    WHERE @FullRefresh = 1
       OR s.PROD_DT > ISNULL(@MaxCustProdDt, '1900-01-01');

    /* =========================
       LOAN ACCOUNT TABLE
       ========================= */
    IF @FullRefresh = 1
    BEGIN
        TRUNCATE TABLE [ClientIQPreProd].[dbo].[loan_account_maintenance];
        SET @MaxLoanProdDt = NULL;
    END
    ELSE
    BEGIN
        SELECT @MaxLoanProdDt = MAX(PROD_DT)
        FROM [ClientIQPreProd].[dbo].[loan_account_maintenance];
    END

    INSERT INTO [ClientIQPreProd].[dbo].[loan_account_maintenance] (
        CIF_NBR, ACCT_NBR, ACCT_TYP, UNQ_ACCT_NBR,
        MANT_DT, MANT_FLD, NEW_VAL, OLD_VAL, PROD_DT
    )
    SELECT 
        s.CIF_NBR, s.ACCT_NBR, s.ACCT_TYP, s.UNQ_ACCT_NBR,
        s.MANT_DT, s.MANT_FLD, s.NEW_VAL, s.OLD_VAL, s.PROD_DT
    FROM [TheSpotPreProd].[dbo].[LN_ACCT_MANT] s
    WHERE @FullRefresh = 1
       OR s.PROD_DT > ISNULL(@MaxLoanProdDt, '1900-01-01');

END;
GO


