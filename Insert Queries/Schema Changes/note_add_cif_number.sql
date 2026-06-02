-- Add denormalized Jack Henry CIF number to the note table for Operations queries.
-- Populated server-side on every note create/update; legacy rows remain NULL until edited.
-- Idempotent: safe to run multiple times.

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE Name = N'cif_number'
      AND Object_ID = OBJECT_ID(N'dbo.note')
)
BEGIN
    ALTER TABLE dbo.note ADD cif_number VARCHAR(20) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'idx_note_cif_number'
      AND object_id = OBJECT_ID(N'dbo.note')
)
BEGIN
    CREATE INDEX idx_note_cif_number ON dbo.note (cif_number);
END
GO
