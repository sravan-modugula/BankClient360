--Insert Primary Address

INSERT INTO ClientIQPreProd.dbo.address
(
    address_type,
    address_line1,
    address_line2,
    city,
    state,
    postal_code
)
SELECT DISTINCT
       'PRIMARY',
       STREET_ADDR_1,
       STREET_ADDR_2,
       CITY,
       STATE,
       ZIP_CD
FROM TheSpot.dbo.cust_view_curr
WHERE STREET_ADDR_1 IS NOT NULL;


--Insert PF Address

INSERT INTO ClientIQPreProd.dbo.address
(
    address_type,
    address_line1,
    address_line2,
    city,
    state,
    postal_code
)
SELECT DISTINCT
       'PF',
       PF_ADDR1,
       PF_ADDR2,
       PF_ADDR_CITY,
       PF_ADDR_ST,
       PF_ADDR_ZIP
FROM TheSpot.dbo.cust_view_curr
WHERE PF_ADDR1 IS NOT NULL;


--Insert IRS Address

INSERT INTO ClientIQPreProd.dbo.address
(
    address_type,
    address_line1,
    address_line2,
    city,
    state,
    postal_code
)
SELECT DISTINCT
       'IRS',
       IRS_ADDR,
       NULL,
       IRS_CITY,
       IRS_STATE,
       IRS_ZIP
FROM TheSpot.dbo.cust_view_curr
WHERE IRS_ADDR IS NOT NULL;
