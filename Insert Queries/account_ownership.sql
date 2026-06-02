

INSERT INTO ClientIQPreProd.dbo.account_ownership
(
    account_id,
    customer_id,
    ownership_type,
    is_primary_owner
)
SELECT
    a.account_id,
    c.customer_id,
    ctar.REL_TYP_DESC AS ownership_type,
    CASE
        WHEN ctar.REL_TYP_DESC = 'Primary account owner'
            THEN 1
        ELSE 0
    END AS is_primary_owner
FROM [TheSpotPreProd].[dbo].[TEST_CUST_ACCT_RELS_VIEW] ctar
JOIN ClientIQPreProd.dbo.account a
    ON a.account_number = ctar.ACCT_NBR
JOIN ClientIQPreProd.dbo.customer c
    ON c.jack_henry_cif_number = ctar.CIF_NBR;