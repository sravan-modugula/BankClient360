INSERT INTO ClientIQPreProd.dbo.contact_info
(
    contact_type,
    contact_value,
    contact_subtype,
    is_primary,
    is_verified,
    verification_date,
    can_contact,
    customer_id
)
SELECT
    c.contact_type,
    NULLIF(
        CASE
            WHEN UPPER(LTRIM(RTRIM(c.contact_value))) = 'N/A' THEN NULL
            WHEN LTRIM(RTRIM(c.contact_value)) = '0' THEN NULL
            ELSE c.contact_value
        END,
        ''
    ) AS contact_value,
    c.contact_subtype,
    c.is_primary,
    0 AS is_verified,
    NULL AS verification_date,
    CASE WHEN cv.do_not_call_flg = 'y' THEN 0 ELSE 1 END AS can_contact,
    cust.customer_id
FROM TheSpot.dbo.cust_view_curr cv
JOIN ClientIQPreProd.dbo.customer cust
  ON cust.jack_henry_cif_number = cv.cif_nbr
CROSS APPLY
(
    VALUES
        ('EMAIL', CAST(cv.email_addr       AS VARCHAR(200)), 'PRIMARY',     1),
        ('EMAIL', CAST(cv.email_oth_addr   AS VARCHAR(200)), 'SECONDARY',   0),
        ('PHONE', CAST(cv.phn_hm           AS VARCHAR(50)),  'HOME',        0),
        ('PHONE', CAST(cv.phn_bus          AS VARCHAR(50)),  'BUSINESS',    0),
        ('PHONE', CAST(cv.phn_cell_nbr     AS VARCHAR(50)),  'CELL',        1),
        ('PHONE', CAST(cv.phn_oth_cell_nbr AS VARCHAR(50)),  'OTHER_CELL',  0)
) c (contact_type, contact_value, contact_subtype, is_primary)
WHERE NULLIF(
        CASE
            WHEN UPPER(LTRIM(RTRIM(c.contact_value))) = 'N/A' THEN NULL
            WHEN LTRIM(RTRIM(c.contact_value)) = '0' THEN NULL
            ELSE c.contact_value
        END,
        ''
      ) IS NOT NULL;