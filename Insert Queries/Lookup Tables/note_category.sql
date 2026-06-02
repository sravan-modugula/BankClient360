SET IDENTITY_INSERT [ClientIQPreProd].[dbo].[note_category] ON;

INSERT INTO [ClientIQPreProd].[dbo].[note_category]
(
    category_id,
    category_name,
    parent_category_id,
    [description],
    color_code,
    is_active,
    display_order,
    created_at,
    updated_at
)
VALUES
(1,  'General Note',            NULL, 'General customer or account notes',              '#1976d2', 1,  10, GETDATE(), GETDATE()),
(2,  'Credit Review',           NULL, 'Credit analysis and review notes',                '#d32f2f', 1,  20, GETDATE(), GETDATE()),
(3,  'Compliance Alert',        NULL, 'Compliance and regulatory notes',                 '#f57c00', 1,  30, GETDATE(), GETDATE()),
(4,  'Customer Request',        NULL, 'Customer service requests and inquiries',         '#388e3c', 1,  40, GETDATE(), GETDATE()),
(5,  'Account Maintenance',     NULL, 'Account maintenance and updates',                 '#7b1fa2', 1,  50, GETDATE(), GETDATE()),
(6,  'Risk Assessment',         NULL, 'Risk rating and assessment notes',                '#c62828', 1,  60, GETDATE(), GETDATE()),
(7,  'Relationship Management', NULL, 'Relationship manager notes and updates',          '#0288d1', 1,  70, GETDATE(), GETDATE()),
(8,  'Service Issue',           NULL, 'Service issues and resolutions',                  '#e64a19', 1,  80, GETDATE(), GETDATE()),
(9,  'Follow-up Required',      NULL, 'Notes requiring follow-up action',                '#fbc02d', 1,  90, GETDATE(), GETDATE()),
(10, 'Internal Communication',  NULL, 'Internal staff communication',                    '#455a64', 1, 100, GETDATE(), GETDATE());

SET IDENTITY_INSERT [ClientIQPreProd].[dbo].[note_category] OFF;