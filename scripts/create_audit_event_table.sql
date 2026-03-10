-- SQL Server migration: create audit_event table
-- For PostgreSQL, use drizzle-kit push (schema is defined in shared/schema.ts)

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[audit_event]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[audit_event] (
        [event_id]        BIGINT IDENTITY(1,1) PRIMARY KEY,
        [event_type]      VARCHAR(100)  NOT NULL,
        [category]        VARCHAR(50)   NOT NULL,
        [severity]        VARCHAR(20)   NOT NULL,
        [correlation_id]  UNIQUEIDENTIFIER NULL,
        -- Actor
        [employee_id]     BIGINT        NULL REFERENCES [dbo].[employee]([employee_id]),
        [session_id]      VARCHAR(255)  NULL,
        [ip_address]      VARCHAR(45)   NULL,
        [user_agent]      VARCHAR(500)  NULL,
        -- Action
        [action]          VARCHAR(500)  NOT NULL,
        [outcome]         VARCHAR(20)   NOT NULL,
        -- Resource
        [resource_type]   VARCHAR(50)   NULL,
        [resource_id]     VARCHAR(100)  NULL,
        [resource_name]   VARCHAR(200)  NULL,
        -- Context
        [metadata]        NVARCHAR(MAX) NULL, -- JSON
        [source]          VARCHAR(10)   NOT NULL,
        [module]          VARCHAR(100)  NULL,
        -- Timestamps
        [occurred_at]     DATETIME2     NOT NULL,
        [created_at]      DATETIME2     DEFAULT GETUTCDATE()
    );

    -- Indexes
    CREATE NONCLUSTERED INDEX [idx_audit_event_type]
        ON [dbo].[audit_event] ([event_type]);

    CREATE NONCLUSTERED INDEX [idx_audit_event_category]
        ON [dbo].[audit_event] ([category]);

    CREATE NONCLUSTERED INDEX [idx_audit_event_employee_occurred]
        ON [dbo].[audit_event] ([employee_id], [occurred_at]);

    CREATE NONCLUSTERED INDEX [idx_audit_event_correlation]
        ON [dbo].[audit_event] ([correlation_id]);

    CREATE NONCLUSTERED INDEX [idx_audit_event_resource]
        ON [dbo].[audit_event] ([resource_type], [resource_id]);

    CREATE NONCLUSTERED INDEX [idx_audit_event_occurred_at]
        ON [dbo].[audit_event] ([occurred_at]);

    CREATE NONCLUSTERED INDEX [idx_audit_event_severity_occurred]
        ON [dbo].[audit_event] ([severity], [occurred_at]);

    PRINT 'Created audit_event table with indexes';
END
ELSE
BEGIN
    PRINT 'audit_event table already exists';
END
GO
