-- SQL Server migration: create sessions table for connect-mssql-v2
-- Required by server/auth/session.ts when SAML_ENABLED=true.
-- The DB user must have db_datareader, db_datawriter, and db_ddladmin permissions.

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sessions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[sessions](
        [sid]     [nvarchar](255) NOT NULL PRIMARY KEY,
        [session] [nvarchar](max) NOT NULL,
        [expires] [datetime]      NOT NULL
    );

    CREATE NONCLUSTERED INDEX [idx_sessions_expires]
        ON [dbo].[sessions] ([expires]);

    PRINT 'Created sessions table';
END
ELSE
BEGIN
    PRINT 'sessions table already exists';
END
GO
