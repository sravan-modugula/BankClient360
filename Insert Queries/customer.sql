INSERT INTO [ClientIQPreProd].[dbo].[customer] (
    first_name,
    last_name,
    middle_name,
    suffix,
    date_of_birth,
    gender,
    business_name,
    full_name,
    tax_identifier,
    customer_status,
    customer_since,
    language_preference,
    occupation,
    employer_name,
    naics_code,
    branch_id,
    jack_henry_cif_number,
    inside_code,
    sales_associate_code,
    class_code,
    vip_customer,
    is_deceased,
    inquiry_code
)
SELECT
    CASE
        WHEN NULLIF(LTRIM(RTRIM(c.cust_frst_nm)), '') IS NULL
         AND NULLIF(LTRIM(RTRIM(c.cust_lst_nm)), '') IS NULL
            THEN c.cust_full_nm
        ELSE c.cust_frst_nm
    END AS first_name,

    CASE
        WHEN NULLIF(LTRIM(RTRIM(c.cust_frst_nm)), '') IS NULL
         AND NULLIF(LTRIM(RTRIM(c.cust_lst_nm)), '') IS NULL
            THEN NULL
        ELSE c.cust_lst_nm
    END AS last_name,

    c.cust_mid_nm,
    c.cust_nm_sfx,
    c.brth_dt,
    c.gender,
    c.cust_full_nm,
    c.cust_full_addr_nm,
    c.tx_id_nbr,

    /* Customer Status Rules */
    CASE
        WHEN c.CUST_LCYCL_STATUS IN ('OPEN', 'OPEN-JNT-CO') THEN 'Active'
        WHEN c.CUST_LCYCL_STATUS = 'NON-CUST'
             AND c.RLTD_PRTY_LCYCL_STATUS = 'OPEN' THEN 'Active'
        ELSE 'Inactive'
    END AS customer_status,

    c.orig_dt,
    c.language,
    c.occptn_desc,
    c.cust_emplyr_nm,
    c.naics_cd,

    b.branch_id,

    c.cif_nbr,
    c.insdr_cd,
    c.cust_sales_assoc_cd,
    c.cust_class_cd,

    CASE WHEN c.vip_cust_flg IN ('Y','y','1') THEN 1 ELSE 0 END,
    CASE WHEN c.dcsd_flg IN ('Y','y','1') THEN 1 ELSE 0 END,

    /* Inquiry Code formatting */
    CASE
        WHEN NULLIF(LTRIM(RTRIM(c.INQ_QSTN)), '') IS NOT NULL
         AND NULLIF(LTRIM(RTRIM(c.INQR_CD)), '') IS NOT NULL
            THEN CONCAT(c.INQ_QSTN, ': ', c.INQR_CD)
        ELSE COALESCE(
            NULLIF(LTRIM(RTRIM(c.INQ_QSTN)), ''),
            NULLIF(LTRIM(RTRIM(c.INQR_CD)), '')
        )
    END AS inquiry_code
FROM [TheSpotPreProd].[dbo].[TEST_CUST_VIEW_CURR] c
LEFT JOIN [ClientIQPreProd].[dbo].[branch] b
       ON b.branch_code = c.cust_branch_nbr;