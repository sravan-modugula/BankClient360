/* ============================================================================
   Grant the "Executive" role to specific employees  (ClientIQ — SQL Server)
   ----------------------------------------------------------------------------
   IMPORTANT: assigned_by MUST be non-NULL.

   The SAML/AD login sync (server/storage/sqlServerEmployee.ts:
   syncEmployeeRolesFromAdGroupsSqlServer) reconciles roles on EVERY login:
   it REVOKES any active role whose assigned_by IS NULL and is not in the
   user's current AD groups. There is no "Executive" AD group, so if you
   insert this grant with assigned_by = NULL it will be revoked on the user's
   next login. Setting assigned_by to a real employee marks it a manual admin
   grant, which the sync leaves untouched — so it persists.
   ============================================================================ */

DECLARE @executiveRoleId BIGINT =
    (SELECT role_id FROM role WHERE role_name = 'Executive' AND is_active = 1);

-- Grantor: any existing, non-deleted employee (e.g. a System Admin).
-- FK: employee_role.assigned_by -> employee.employee_id. MUST be non-NULL.
DECLARE @assignedBy BIGINT =
    (SELECT employee_id FROM employee
     WHERE employee_number = 'REPLACE_ADMIN_EMP_NUMBER' AND deleted_at IS NULL);

IF @executiveRoleId IS NULL
    THROW 50001, 'Executive role not found or inactive in [role].', 1;
IF @assignedBy IS NULL
    THROW 50002, 'Grantor employee not found — set @assignedBy to a valid employee.', 1;

/* Target employees to receive Executive — EDIT THIS LIST.
   Matching on employee_number; switch to email if you prefer. */
;WITH targets AS (
    SELECT employee_id
    FROM   employee
    WHERE  deleted_at IS NULL
      AND  employee_number IN ('REPLACE_EMP_1', 'REPLACE_EMP_2', 'REPLACE_EMP_3')
    -- Or:  AND email IN ('user1@fmb.com', 'user2@fmb.com')
)
MERGE employee_role AS tgt
USING (SELECT employee_id, @executiveRoleId AS role_id FROM targets) AS src
   ON tgt.employee_id = src.employee_id AND tgt.role_id = src.role_id
WHEN MATCHED THEN
    UPDATE SET is_active      = 1,
               assigned_by    = @assignedBy,
               assigned_date  = GETDATE(),
               effective_date = CAST(GETDATE() AS DATE),
               expiration_date = NULL
WHEN NOT MATCHED THEN
    INSERT (employee_id, role_id, is_primary, assigned_by,
            assigned_date, effective_date, is_active)
    VALUES (src.employee_id, src.role_id, 0, @assignedBy,
            GETDATE(), CAST(GETDATE() AS DATE), 1);

/* ---- Verify ---- */
SELECT e.employee_number, e.email, r.role_name, er.is_active,
       er.assigned_by, er.assigned_date, er.effective_date, er.expiration_date
FROM   employee_role er
JOIN   employee e ON e.employee_id = er.employee_id
JOIN   role r     ON r.role_id     = er.role_id
WHERE  r.role_name = 'Executive'
ORDER  BY e.employee_number;
