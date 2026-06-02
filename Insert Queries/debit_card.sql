MERGE ClientIQPreProd.dbo.debit_card AS tgt
USING (
    SELECT
        a.account_id,
        ao.customer_id,

        CAST(s.DLY_WTDWL_LMT AS DECIMAL(18,2)) AS daily_withdrawal_limit,
        CAST(s.DLY_POS_LMT   AS DECIMAL(18,2)) AS daily_purchase_limit,
        CAST(s.DLY_TXN_LMT   AS DECIMAL(18,2)) AS daily_transaction_limit,

        s.ACCT_TYP_DESC AS card_type,
        s.STS_CD_DESC   AS card_status,
        s.PAN_LST_4     AS last_four_digits,
        s.CRD_NTWRK     AS card_brand,
        MONTH(s.EXPR_DT) AS expiry_month,
        YEAR(s.EXPR_DT)  AS expiry_year,
        COALESCE(
            NULLIF(LTRIM(RTRIM(s.EMBS_NM_1)), ''),
            COALESCE(c.full_name, 'Cardholder')
        ) AS cardholder_name
    FROM TheSpotPreProd.[dbo].[DBT_CRD_VIEW] s

    JOIN ClientIQPreProd.dbo.account a
      ON a.account_number = s.ACCT_NBR

    JOIN ClientIQPreProd.dbo.account_ownership ao
      ON ao.account_id = a.account_id
     AND ao.is_primary_owner = 1

    JOIN ClientIQPreProd.dbo.customer c
      ON c.customer_id = ao.customer_id
     AND LTRIM(RTRIM(c.jack_henry_cif_number)) =
         LTRIM(RTRIM(s.CIF_NBR))
) src
ON  tgt.account_id       = src.account_id
AND tgt.last_four_digits = src.last_four_digits

WHEN MATCHED THEN
    UPDATE SET
        tgt.customer_id             = src.customer_id,
        tgt.cardholder_name          = src.cardholder_name,
        tgt.card_status              = src.card_status,
        tgt.card_type                = src.card_type,
        tgt.card_brand               = src.card_brand,

        tgt.daily_withdrawal_limit   = src.daily_withdrawal_limit,
        tgt.daily_purchase_limit     = src.daily_purchase_limit,
        tgt.daily_transaction_limit  = src.daily_transaction_limit,

        tgt.expiry_month             = src.expiry_month,
        tgt.expiry_year              = src.expiry_year,
        tgt.updated_at               = SYSDATETIME()

WHEN NOT MATCHED THEN
    INSERT (
        account_id,
        customer_id,
        cardholder_name,

        daily_withdrawal_limit,
        daily_purchase_limit,
        daily_transaction_limit,

        card_type,
        card_status,
        last_four_digits,
        card_brand,
        expiry_month,
        expiry_year
    )
    VALUES (
        src.account_id,
        src.customer_id,
        src.cardholder_name,

        src.daily_withdrawal_limit,
        src.daily_purchase_limit,
        src.daily_transaction_limit,

        src.card_type,
        src.card_status,
        src.last_four_digits,
        src.card_brand,
        src.expiry_month,
        src.expiry_year
    );
