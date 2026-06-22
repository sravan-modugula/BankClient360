-- Ensure RBAC provenance columns exist so enforced AD-group role sync can
-- distinguish AD/system-derived assignments from admin (manual) ones, and so
-- the audit trail can be written.
--
-- Idempotent — safe to run repeatedly. Adds columns only when missing.
--
-- Provenance rule used by the app:
--   employee_role.assigned_by IS NULL      -> AD/system-derived (enforced sync may revoke)
--   employee_role.assigned_by IS NOT NULL  -> admin-assigned    (never auto-revoked)

-------------------------------------------------------------------------------
-- employee_role.assigned_by
-------------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.employee_role') AND name = 'assigned_by'
)
BEGIN
    ALTER TABLE dbo.employee_role ADD assigned_by BIGINT NULL;
    PRINT 'Added employee_role.assigned_by';
END
ELSE
    PRINT 'employee_role.assigned_by already exists';
GO

-------------------------------------------------------------------------------
-- employee_role_history optional columns written by the app's history logger.
-- The table already exists (source, saml_role_attribute, action, assigned_at
-- are read elsewhere); ensure the rest are present.
-------------------------------------------------------------------------------
IF OBJECT_ID('dbo.employee_role_history') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employee_role_history') AND name = 'assigned_by')
    BEGIN
        ALTER TABLE dbo.employee_role_history ADD assigned_by BIGINT NULL;
        PRINT 'Added employee_role_history.assigned_by';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employee_role_history') AND name = 'reason')
    BEGIN
        ALTER TABLE dbo.employee_role_history ADD reason NVARCHAR(MAX) NULL;
        PRINT 'Added employee_role_history.reason';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employee_role_history') AND name = 'is_primary')
    BEGIN
        ALTER TABLE dbo.employee_role_history ADD is_primary BIT NULL;
        PRINT 'Added employee_role_history.is_primary';
    END
END
ELSE
    PRINT 'WARNING: dbo.employee_role_history does not exist — role history will be skipped (best-effort).';
GO
