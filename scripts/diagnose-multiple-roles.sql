/* ============================================================================
   Diagnose employees with multiple ACTIVE roles  (ClientIQ — SQL Server)
   ----------------------------------------------------------------------------
   assigned_by tells you the source of each role:
     NULL      -> AD/SAML-derived. Reconciled on every login: revoked when the
                  matching AD group is removed. Should mirror current AD groups.
     NOT NULL  -> manual/admin grant. NEVER revoked by the login sync (by design).
                  Legacy rows and manual grants live here and can accumulate.

   A user legitimately has >1 AD-derived role if they belong to >1 ClientIQ AD
   group. "Stale" accumulation is almost always NOT-NULL assigned_by rows.
   ============================================================================ */

-- 1) Everyone with more than one active role, newest assignment first.
SELECT  e.employee_number, e.email,
        COUNT(*)                                   AS active_role_count,
        STRING_AGG(r.role_name, ', ')              AS roles,
        SUM(CASE WHEN er.assigned_by IS NULL THEN 1 ELSE 0 END) AS ad_derived,
        SUM(CASE WHEN er.assigned_by IS NOT NULL THEN 1 ELSE 0 END) AS manual
FROM    employee_role er
JOIN    employee e ON e.employee_id = er.employee_id
JOIN    role r     ON r.role_id     = er.role_id
WHERE   er.is_active = 1
  AND   e.deleted_at IS NULL
GROUP BY e.employee_number, e.email
HAVING  COUNT(*) > 1
ORDER BY active_role_count DESC, e.employee_number;

-- 2) Full per-row detail for a specific employee (set the identifier).
SELECT  e.employee_number, e.email, r.role_name, r.privilege_level,
        er.is_active, er.is_primary, er.assigned_by,
        CASE WHEN er.assigned_by IS NULL THEN 'AD/SAML' ELSE 'manual/admin' END AS source,
        er.assigned_date, er.effective_date, er.expiration_date
FROM    employee_role er
JOIN    employee e ON e.employee_id = er.employee_id
JOIN    role r     ON r.role_id     = er.role_id
WHERE   e.employee_number = 'REPLACE_EMP_NUMBER'
ORDER BY er.is_active DESC, er.assigned_date DESC;
