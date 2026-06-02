MERGE ClientIQPreProd.dbo.household_membership AS tgt
USING (
    SELECT
        h.household_id,
        c.customer_id,

        CASE
            WHEN LTRIM(RTRIM(hm.CIF_ID)) = LTRIM(RTRIM(hv.HOH_CIF_NBR))
                THEN 'Head of Household'
            ELSE 'Household Member'
        END AS relationship_role,

        CASE
            WHEN LTRIM(RTRIM(hm.CIF_ID)) = LTRIM(RTRIM(hv.HOH_CIF_NBR))
                THEN 1
            ELSE 0
        END AS is_primary_member,

        CASE
            WHEN LTRIM(RTRIM(hm.CIF_ID)) = LTRIM(RTRIM(hv.HOH_CIF_NBR))
                THEN 1
            ELSE 0
        END AS is_head_of_household,

        hm.EFF_DT AS membership_start_date

    FROM TheSpotPreProd.[dbo].[HOUSEHOLD_MAP] hm

    JOIN TheSpotPreProd.[dbo].[HH_VIEW] hv
        ON LTRIM(RTRIM(hv.HH_NBR)) = LTRIM(RTRIM(hm.HH_ID))

    JOIN ClientIQPreProd.dbo.household h
        ON h.jack_henry_household_number = LTRIM(RTRIM(hv.HH_NBR))

    JOIN ClientIQPreProd.dbo.customer c
        ON LTRIM(RTRIM(c.jack_henry_cif_number)) = LTRIM(RTRIM(hm.CIF_ID))
) AS src
ON  tgt.household_id = src.household_id
AND tgt.customer_id  = src.customer_id

WHEN MATCHED THEN
    UPDATE SET
        tgt.relationship_role     = src.relationship_role,
        tgt.is_primary_member     = src.is_primary_member,
        tgt.is_head_of_household  = src.is_head_of_household,
        tgt.membership_start_date = src.membership_start_date,
        tgt.updated_at            = SYSDATETIME()

WHEN NOT MATCHED THEN
    INSERT (
        household_id,
        customer_id,
        relationship_role,
        is_primary_member,
        is_head_of_household,
        membership_start_date,
        created_at,
        updated_at
    )
    VALUES (
        src.household_id,
        src.customer_id,
        src.relationship_role,
        src.is_primary_member,
        src.is_head_of_household,
        src.membership_start_date,
        SYSDATETIME(),
        SYSDATETIME()
    );