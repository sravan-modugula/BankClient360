-- Ensure the "Branch Manager" role exists in [dbo].[role] so SAML
-- auto-provisioned users get a default role on first sign-in.
--
-- Idempotent — safe to run repeatedly. Inserts the role only when
-- there is no row whose name matches "Branch Manager"
-- (case-insensitive, trimmed). Reactivates an existing inactive row
-- rather than inserting a duplicate.
--
-- privilege_level=3 matches the seed in scripts/seed.ts (Branch-level
-- authority — full customer/account read access). Adjust if your
-- privilege_level table uses different numeric levels.

DECLARE @roleName NVARCHAR(100) = N'Branch Manager';
DECLARE @privilegeLevel BIGINT = 3;

IF EXISTS (
    SELECT 1 FROM [dbo].[role]
    WHERE UPPER(LTRIM(RTRIM(role_name))) = UPPER(@roleName)
)
BEGIN
    UPDATE [dbo].[role]
    SET is_active = 1, updated_at = GETDATE()
    WHERE UPPER(LTRIM(RTRIM(role_name))) = UPPER(@roleName)
      AND is_active = 0;
    PRINT 'Branch Manager role already exists; ensured is_active=1';
END
ELSE
BEGIN
    INSERT INTO [dbo].[role] (
        role_name, privilege_level, description,
        is_system_role, is_active, created_at, updated_at
    )
    VALUES (
        @roleName, @privilegeLevel,
        N'Branch-level authority. Default role auto-assigned to new SAML users.',
        1, 1, GETDATE(), GETDATE()
    );
    PRINT 'Inserted Branch Manager role';
END
GO
