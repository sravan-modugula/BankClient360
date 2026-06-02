IF COL_LENGTH('dbo.household', 'jack_henry_household_number') IS NULL
BEGIN
    ALTER TABLE dbo.household
    ADD jack_henry_household_number VARCHAR(20) NULL;
END;
GO

IF COL_LENGTH('dbo.household', 'relationship_manager_code') IS NULL
BEGIN
    ALTER TABLE dbo.household
    ADD relationship_manager_code VARCHAR(20) NULL;
END;
GO

MERGE ClientIQPreProd.dbo.household AS tgt
USING (
    SELECT
        LTRIM(RTRIM(h.HH_NBR))        AS jack_henry_household_number,
        h.HH_NM                       AS household_name,
        'Customer'                    AS household_type,
        'Active'                      AS household_status,
        h.FRST_CIF_ORG_DT             AS established_date,
        h.TOTL_DEPS                   AS total_assets,
        h.TOTL_LN_BAL                 AS total_liabilities,
        e.employee_id                 AS relationship_manager_id,
        NULLIF(LTRIM(RTRIM(h.OFFCR_CD)), '') AS relationship_manager_code
    FROM TheSpotPreProd.[dbo].[HH_VIEW] h
    LEFT JOIN ClientIQPreProd.dbo.employee e
        ON e.officer_code = LTRIM(RTRIM(h.OFFCR_CD))
       AND e.deleted_at IS NULL
) AS src
ON tgt.jack_henry_household_number = src.jack_henry_household_number

WHEN MATCHED THEN
    UPDATE SET
        tgt.household_name            = src.household_name,
        tgt.household_type            = src.household_type,
        tgt.household_status          = src.household_status,
        tgt.established_date          = src.established_date,
        tgt.total_assets              = src.total_assets,
        tgt.total_liabilities         = src.total_liabilities,
        tgt.relationship_manager_id   = src.relationship_manager_id,
        tgt.relationship_manager_code = src.relationship_manager_code,
        tgt.updated_at                = SYSDATETIME()

WHEN NOT MATCHED THEN
    INSERT (
        jack_henry_household_number,
        household_name,
        household_type,
        household_status,
        established_date,
        total_assets,
        total_liabilities,
        relationship_manager_id,
        relationship_manager_code,
        created_at,
        updated_at
    )
    VALUES (
        src.jack_henry_household_number,
        src.household_name,
        src.household_type,
        src.household_status,
        src.established_date,
        src.total_assets,
        src.total_liabilities,
        src.relationship_manager_id,
        src.relationship_manager_code,
        SYSDATETIME(),
        SYSDATETIME()
    );