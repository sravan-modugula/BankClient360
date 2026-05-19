-- SQL Server migration: widen employee.last_seen_saml_role to NVARCHAR(MAX)
-- For PostgreSQL, use drizzle-kit push (schema is defined in shared/schema.ts)
--
-- Reason: IdPs may send the user's full AD group list (multi-kilobyte) in the
-- SAML role attribute. The previous varchar(255) caused error 2628
-- ("String or binary data would be truncated"), which aborted the employee
-- upsert and left SSO users stuck on "Awaiting Role Assignment".

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[employee]')
      AND name = N'last_seen_saml_role'
      AND (max_length <> -1 OR system_type_id <> TYPE_ID(N'nvarchar'))
)
BEGIN
    ALTER TABLE [dbo].[employee]
    ALTER COLUMN [last_seen_saml_role] NVARCHAR(MAX) NULL;

    PRINT 'employee.last_seen_saml_role widened to NVARCHAR(MAX)';
END
ELSE
BEGIN
    PRINT 'employee.last_seen_saml_role already NVARCHAR(MAX) — no change';
END
