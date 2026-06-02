INSERT INTO ClientIQPreProd.dbo.employee
(
    employee_number,
    officer_code,
    first_name,
    last_name,
    title
)
SELECT
    e.employee_number,
    e.officer_code,
    e.first_name,
    e.last_name,
    e.title
FROM
(
    SELECT
        src.employee_number,
        src.officer_code,
        src.first_name,
        src.last_name,
        src.title,
        ROW_NUMBER() OVER (
            PARTITION BY src.officer_code
            ORDER BY src.source_priority
        ) AS rn
    FROM
    (
        /* =====================================================
           SOURCE 1: Authoritative employee table (EMPL_VIEW)
           ===================================================== */
        SELECT
            ev.OFFFCR_CD                    AS employee_number,
            ev.OFFFCR_CD                    AS officer_code,
            ev.FRST_NM                      AS first_name,
            ev.LST_NM                       AS last_name,
            COALESCE(ev.POSTN, ev.TITLE)    AS title,
            1                                AS source_priority
        FROM TheSpotPreProd.dbo.EMPL_VIEW ev
        WHERE ev.OFFFCR_CD IS NOT NULL

        UNION ALL

        /* =====================================================
           SOURCE 2: Branch Officers from customers (fallback)
           ===================================================== */
        SELECT
            LTRIM(RTRIM(cvc.BRANCH_OFFCR_CD))   AS employee_number,
            LTRIM(RTRIM(cvc.BRANCH_OFFCR_CD))   AS officer_code,
            cvc.BRANCH_OFFICER_NM               AS first_name,
            ''                                  AS last_name,
            'Branch Officer'                    AS title,
            2                                   AS source_priority
        FROM TheSpot.[dbo].[CUST_VIEW_CURR] cvc
        WHERE cvc.BRANCH_OFFCR_CD IS NOT NULL

        UNION ALL

        /* =====================================================
           SOURCE 3: Sales Associates from customers (fallback)
           ===================================================== */
        SELECT
            CAST(cvc.CUST_SALES_ASSOC_CD AS VARCHAR(50)) AS employee_number,
            CAST(cvc.CUST_SALES_ASSOC_CD AS VARCHAR(50)) AS officer_code,
            cvc.CUST_SALES_ASSOC_NM                      AS first_name,
            ''                                           AS last_name,
            'Sales Associate'                            AS title,
            2                                            AS source_priority
        FROM TheSpot.[dbo].[CUST_VIEW_CURR] cvc
        WHERE cvc.CUST_SALES_ASSOC_CD IS NOT NULL
    ) src
) e
WHERE e.rn = 1;

