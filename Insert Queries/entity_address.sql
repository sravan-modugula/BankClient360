-- Link addresses to customers (entity_address)

-- Primary Address → entity_address

INSERT INTO ClientIQPreProd.dbo.entity_address
(
    entity_type,
    entity_id,
    address_id,
    address_purpose
)
SELECT DISTINCT
       'CUSTOMER',
       c.customer_id,
       a.address_id,
       'PRIMARY'
FROM TheSpot.dbo.cust_view_curr v
JOIN ClientIQPreProd.dbo.customer c
    ON c.jack_henry_cif_number = v.cif_nbr
JOIN ClientIQPreProd.dbo.address a
    ON a.address_type  = 'PRIMARY'
   AND a.address_line1 = v.STREET_ADDR_1
   AND ISNULL(a.address_line2,'') = ISNULL(v.STREET_ADDR_2,'')
   AND a.city          = v.CITY
   AND a.state         = v.STATE
   AND a.postal_code   = v.ZIP_CD
WHERE NOT EXISTS
(
    SELECT 1
    FROM ClientIQPreProd.dbo.entity_address ea
    WHERE ea.entity_id  = c.customer_id
      AND ea.address_id = a.address_id
);


-- PF Address → entity_address

INSERT INTO ClientIQPreProd.dbo.entity_address
(
    entity_type,
    entity_id,
    address_id,
    address_purpose
)
SELECT DISTINCT
       'CUSTOMER',
       c.customer_id,
       a.address_id,
       'PF'
FROM TheSpot.dbo.cust_view_curr v
JOIN ClientIQPreProd.dbo.customer c
    ON c.jack_henry_cif_number = v.cif_nbr
JOIN ClientIQPreProd.dbo.address a
    ON a.address_type  = 'PF'
   AND a.address_line1 = v.PF_ADDR1
   AND ISNULL(a.address_line2,'') = ISNULL(v.PF_ADDR2,'')
   AND a.city          = v.PF_ADDR_CITY
   AND a.state         = v.PF_ADDR_ST
   AND a.postal_code   = v.PF_ADDR_ZIP
WHERE NOT EXISTS
(
    SELECT 1
    FROM ClientIQPreProd.dbo.entity_address ea
    WHERE ea.entity_id  = c.customer_id
      AND ea.address_id = a.address_id
);

-- IRS Address → entity_address

INSERT INTO ClientIQPreProd.dbo.entity_address
(
    entity_type,
    entity_id,
    address_id,
    address_purpose
)
SELECT DISTINCT
       'CUSTOMER',
       c.customer_id,
       a.address_id,
       'IRS'
FROM TheSpot.dbo.cust_view_curr v
JOIN ClientIQPreProd.dbo.customer c
    ON c.jack_henry_cif_number = v.cif_nbr
JOIN ClientIQPreProd.dbo.address a
    ON a.address_type  = 'IRS'
   AND a.address_line1 = v.IRS_ADDR
   AND a.city          = v.IRS_CITY
   AND a.state         = v.IRS_STATE
   AND a.postal_code   = v.IRS_ZIP
WHERE NOT EXISTS
(
    SELECT 1
    FROM ClientIQPreProd.dbo.entity_address ea
    WHERE ea.entity_id  = c.customer_id
      AND ea.address_id = a.address_id
);