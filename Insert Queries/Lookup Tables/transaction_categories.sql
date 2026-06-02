INSERT INTO ClientIQPreProd.dbo.transaction_category
(
    category_code,
    group_code,
    name
)
SELECT
    s.UNQ_TRANCD          AS category_code,
    s.GRP                AS group_code,
    s.TRANCD_STMT_DESC   AS name
FROM TheSpotPreProd.[dbo].[TXN_TYP] s
WHERE NOT EXISTS (
    SELECT 1
    FROM ClientIQPreProd.dbo.transaction_category t
    WHERE t.category_code = s.UNQ_TRANCD
)
AND NOT EXISTS (
    SELECT 1
    FROM ClientIQPreProd.dbo.transaction_category t
    WHERE t.name = s.TRANCD_STMT_DESC
);