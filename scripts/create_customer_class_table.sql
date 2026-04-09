-- Create customer_class lookup table for class code descriptions
-- Run this against the SQL Server database

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'customer_class')
BEGIN
  CREATE TABLE customer_class (
    class_code VARCHAR(20) PRIMARY KEY,
    description VARCHAR(200) NOT NULL,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
  );

  -- Seed with common class codes (update descriptions to match your core banking system)
  INSERT INTO customer_class (class_code, description) VALUES
    ('1', 'Regular Individual'),
    ('2', 'Business'),
    ('3', 'Trust'),
    ('4', 'Non-Profit'),
    ('5', 'Government'),
    ('6', 'Estate'),
    ('7', 'Minor'),
    ('8', 'Employee'),
    ('9', 'VIP/Preferred');

  PRINT 'customer_class table created and seeded successfully';
END
ELSE
BEGIN
  PRINT 'customer_class table already exists';
END
