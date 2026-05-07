-- SQL Server migration: ensure the sessions table has the schema
-- connect-mssql-v2 expects (sid NVARCHAR(255), session NVARCHAR(MAX), expires DATETIME).
--
-- Use this when an existing [dbo].[sessions] table has wrong column types
-- (e.g. the previous CREATE accidentally produced sid NVARCHAR(1), causing
-- "String or binary data would be truncated in table ... column 'sid'." on
-- the first login attempt). Dropping and recreating is safe — sessions
-- aren't durable application data.

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sessions]') AND type in (N'U'))
BEGIN
    DECLARE @sidLen INT = (
        SELECT CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'sid'
    );

    IF @sidLen IS NULL OR @sidLen < 255
    BEGIN
        PRINT 'sessions table has wrong sid column size — dropping and recreating';
        DROP TABLE [dbo].[sessions];
    END
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sessions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[sessions](
        [sid]     [nvarchar](255) NOT NULL PRIMARY KEY,
        [session] [nvarchar](max) NOT NULL,
        [expires] [datetime]      NOT NULL
    );

    CREATE NONCLUSTERED INDEX [idx_sessions_expires]
        ON [dbo].[sessions] ([expires]);

    PRINT 'Created sessions table with correct schema';
END
ELSE
BEGIN
    PRINT 'sessions table already exists with correct schema';
END
GO
