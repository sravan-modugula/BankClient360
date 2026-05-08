/**
 * SQL Server Employee Operations
 * Employee management for MS SQL Server
 */

import sql from 'mssql';
import type { Employee, InsertEmployee } from '@shared/schema';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-employee' });

/**
 * Get employee by ID
 */
export async function getEmployeeSqlServer(
  pool: sql.ConnectionPool,
  employeeId: number
): Promise<Employee | null> {
  try {
    const request = pool.request();
    request.input('employeeId', sql.BigInt, employeeId);

    const result = await request.query(`
      SELECT * FROM employee WHERE employee_id = @employeeId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapEmployeeFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get employee error');
    throw error;
  }
}

/**
 * Resolve a SAML-authenticated user to a DB employee record. Tries
 * sso_subject first (preferred — populated when employees are linked
 * to a SAML identity), falls back to email.
 */
export async function getEmployeeBySsoSubjectOrEmailSqlServer(
  pool: sql.ConnectionPool,
  ssoSubject: string | null,
  email: string | null,
): Promise<Employee | null> {
  try {
    if (ssoSubject) {
      const request = pool.request();
      request.input('ssoSubject', sql.NVarChar, ssoSubject);
      const result = await request.query(`
        SELECT TOP 1 * FROM employee
        WHERE sso_subject = @ssoSubject AND deleted_at IS NULL
      `);
      if (result.recordset.length > 0) {
        return mapEmployeeFromDb(result.recordset[0]);
      }
    }

    if (email) {
      const request = pool.request();
      request.input('email', sql.NVarChar, email);
      const result = await request.query(`
        SELECT TOP 1 * FROM employee
        WHERE email = @email AND deleted_at IS NULL
      `);
      if (result.recordset.length > 0) {
        return mapEmployeeFromDb(result.recordset[0]);
      }
    }

    return null;
  } catch (error) {
    fileLogger.error({ err: error, ssoSubject, email }, 'Get employee by SSO/email error');
    throw error;
  }
}

/**
 * Find-or-create the employee row for a SAML-authenticated user.
 * Resolution order:
 *   1. existing row with matching sso_subject or email
 *   2. existing row with matching employee_number (link it to the SAML identity)
 *   3. insert a new row from the SAML attributes
 *
 * Existing rows have their last_login_at and last_seen_saml_role refreshed,
 * and any null sso_subject/email/department gets backfilled from the SAML
 * profile. Returns null if the upsert fails (the caller falls back to a
 * read-only "no permissions" session).
 */
export async function upsertEmployeeFromSamlSqlServer(
  pool: sql.ConnectionPool,
  samlData: {
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    ssoSubject: string;
    department: string | null;
    samlRoleKey: string | null;
  },
): Promise<Employee | null> {
  try {
    let existing = await getEmployeeBySsoSubjectOrEmailSqlServer(
      pool, samlData.ssoSubject, samlData.email,
    );

    if (!existing && samlData.employeeNumber) {
      const r = pool.request();
      r.input('en', sql.NVarChar, samlData.employeeNumber);
      const result = await r.query(`
        SELECT TOP 1 * FROM employee
        WHERE employee_number = @en AND deleted_at IS NULL
      `);
      if (result.recordset.length > 0) {
        existing = mapEmployeeFromDb(result.recordset[0]);
      }
    }

    if (existing) {
      const r = pool.request();
      r.input('id', sql.BigInt, existing.employeeId);
      r.input('ssoSubject', sql.NVarChar, samlData.ssoSubject);
      r.input('email', sql.NVarChar, samlData.email);
      r.input('firstName', sql.NVarChar, samlData.firstName);
      r.input('lastName', sql.NVarChar, samlData.lastName);
      r.input('department', sql.NVarChar, samlData.department);
      r.input('samlRoleKey', sql.NVarChar, samlData.samlRoleKey);

      await r.query(`
        UPDATE employee
        SET
          sso_subject = ISNULL(sso_subject, @ssoSubject),
          email = ISNULL(email, @email),
          department = ISNULL(department, @department),
          last_seen_saml_role = @samlRoleKey,
          last_login_at = GETDATE(),
          updated_at = GETDATE()
        WHERE employee_id = @id
      `);

      fileLogger.info({ employeeId: existing.employeeId, email: samlData.email }, 'Updated existing employee from SAML');
      return { ...existing, lastLoginAt: new Date() };
    }

    const r = pool.request();
    r.input('en', sql.NVarChar, samlData.employeeNumber);
    r.input('firstName', sql.NVarChar, samlData.firstName);
    r.input('lastName', sql.NVarChar, samlData.lastName);
    r.input('email', sql.NVarChar, samlData.email);
    r.input('ssoSubject', sql.NVarChar, samlData.ssoSubject);
    r.input('department', sql.NVarChar, samlData.department);
    r.input('samlRoleKey', sql.NVarChar, samlData.samlRoleKey);

    const result = await r.query(`
      INSERT INTO employee (
        employee_number, first_name, last_name, email, sso_subject,
        department, last_seen_saml_role, is_active, last_login_at,
        created_at, updated_at
      )
      OUTPUT INSERTED.*
      VALUES (
        @en, @firstName, @lastName, @email, @ssoSubject,
        @department, @samlRoleKey, 1, GETDATE(),
        GETDATE(), GETDATE()
      )
    `);

    const created = mapEmployeeFromDb(result.recordset[0]);
    fileLogger.info({
      employeeId: created.employeeId,
      employeeNumber: created.employeeNumber,
      email: created.email,
    }, 'Auto-created employee from SAML — admin must assign roles');
    return created;
  } catch (error) {
    fileLogger.error({ err: error, email: samlData.email }, 'Failed to upsert employee from SAML');
    return null;
  }
}

/**
 * Ensure the employee has at least one active role. If they have none,
 * find a default role and insert an employee_role row.
 *
 * Lookup strategy (each is case-insensitive):
 *   1. exact match on role_name
 *   2. trimmed equality (handles trailing whitespace in seed data)
 *   3. LIKE %defaultRoleName% (handles "Branch Manager (Test)" etc.)
 * If nothing matches, logs the full list of available active role names
 * so the operator can adjust SAML_DEFAULT_ROLE_NAME or seed the role.
 *
 * Returns the assigned role name on insert, null if nothing was done.
 */
export async function ensureEmployeeHasDefaultRoleSqlServer(
  pool: sql.ConnectionPool,
  employeeId: number,
  defaultRoleName: string,
): Promise<string | null> {
  try {
    const checkRequest = pool.request();
    checkRequest.input('employeeId', sql.BigInt, employeeId);
    const existing = await checkRequest.query(`
      SELECT TOP 1 r.role_name
      FROM employee_role er
      INNER JOIN role r ON r.role_id = er.role_id
      WHERE er.employee_id = @employeeId
        AND er.is_active = 1
        AND r.is_active = 1
        AND er.effective_date <= GETDATE()
        AND (er.expiration_date IS NULL OR er.expiration_date >= GETDATE())
    `);

    if (existing.recordset.length > 0) {
      return null;
    }

    const wanted = defaultRoleName.trim();

    const findRequest = pool.request();
    findRequest.input('roleName', sql.NVarChar, wanted);
    findRequest.input('roleNameLike', sql.NVarChar, `%${wanted}%`);
    const roleResult = await findRequest.query(`
      SELECT TOP 1 role_id, role_name FROM role
      WHERE is_active = 1
        AND (
          UPPER(role_name) = UPPER(@roleName)
          OR UPPER(LTRIM(RTRIM(role_name))) = UPPER(@roleName)
          OR UPPER(role_name) LIKE UPPER(@roleNameLike)
        )
      ORDER BY
        CASE
          WHEN UPPER(role_name) = UPPER(@roleName) THEN 0
          WHEN UPPER(LTRIM(RTRIM(role_name))) = UPPER(@roleName) THEN 1
          ELSE 2
        END,
        role_id ASC
    `);

    if (roleResult.recordset.length === 0) {
      const allRolesRequest = pool.request();
      const allRolesResult = await allRolesRequest.query(`
        SELECT role_name, is_active FROM role ORDER BY role_name
      `);
      const availableRoles = allRolesResult.recordset.map((r: any) => ({
        roleName: r.role_name,
        isActive: !!r.is_active,
      }));
      fileLogger.warn({
        defaultRoleName,
        employeeId,
        availableRoles,
      }, 'Default role not found — set SAML_DEFAULT_ROLE_NAME to one of the available role names, or seed the role table');
      return null;
    }

    const matchedRoleName = roleResult.recordset[0].role_name as string;
    const roleId = roleResult.recordset[0].role_id;

    const assignRequest = pool.request();
    assignRequest.input('employeeId', sql.BigInt, employeeId);
    assignRequest.input('roleId', sql.BigInt, roleId);
    await assignRequest.query(`
      INSERT INTO employee_role (
        employee_id, role_id, is_primary, assigned_date, effective_date, is_active
      ) VALUES (
        @employeeId, @roleId, 1, GETDATE(), CAST(GETDATE() AS DATE), 1
      )
    `);

    fileLogger.info({ employeeId, defaultRoleName, matchedRoleName }, 'Auto-assigned default role to employee');
    return matchedRoleName;
  } catch (error) {
    fileLogger.error({ err: error, employeeId, defaultRoleName }, 'Failed to assign default role');
    return null;
  }
}

/**
 * Get all employees (optionally filtered by branch)
 */
export async function getEmployeesSqlServer(
  pool: sql.ConnectionPool,
  branchId?: number
): Promise<Employee[]> {
  try {
    const request = pool.request();

    let query = `
      SELECT DISTINCT e.*
      FROM employee e
      WHERE e.is_active = 1
    `;

    if (branchId !== undefined) {
      request.input('branchId', sql.BigInt, branchId);
      query = `
        SELECT DISTINCT e.*
        FROM employee e
        INNER JOIN employee_branch eb ON eb.employee_id = e.employee_id
        WHERE e.is_active = 1 AND eb.branch_id = @branchId AND eb.is_active = 1
      `;
    }

    query += ' ORDER BY e.last_name, e.first_name';

    const result = await request.query(query);

    return result.recordset.map(mapEmployeeFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get employees error');
    throw error;
  }
}

/**
 * Create employee
 */
export async function createEmployeeSqlServer(
  pool: sql.ConnectionPool,
  employeeData: InsertEmployee
): Promise<Employee> {
  try {
    const request = pool.request();

    request.input('employeeNumber', sql.NVarChar, employeeData.employeeNumber);
    request.input('firstName', sql.NVarChar, employeeData.firstName);
    request.input('lastName', sql.NVarChar, employeeData.lastName);
    request.input('title', sql.NVarChar, employeeData.title || null);
    request.input('position', sql.NVarChar, employeeData.position || null);
    request.input('officerCode', sql.NVarChar, employeeData.officerCode || null);
    request.input('department', sql.NVarChar, employeeData.department || null);
    request.input('isActive', sql.Bit, employeeData.isActive !== false ? 1 : 0);
    request.input('hireDate', sql.Date, employeeData.hireDate || null);
    request.input('ssoSubject', sql.NVarChar, employeeData.ssoSubject || null);
    request.input('email', sql.NVarChar, employeeData.email || null);
    request.input('phone', sql.NVarChar, employeeData.phone || null);

    const result = await request.query(`
      INSERT INTO employee (
        employee_number, first_name, last_name, title, position,
        officer_code, department, is_active, hire_date, sso_subject, email, phone
      )
      OUTPUT INSERTED.*
      VALUES (
        @employeeNumber, @firstName, @lastName, @title, @position,
        @officerCode, @department, @isActive, @hireDate, @ssoSubject, @email, @phone
      )
    `);

    return mapEmployeeFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Create employee error');
    throw error;
  }
}

/**
 * Update employee
 */
export async function updateEmployeeSqlServer(
  pool: sql.ConnectionPool,
  employeeId: number,
  employeeData: Partial<InsertEmployee>
): Promise<Employee | undefined> {
  try {
    const request = pool.request();
    request.input('employeeId', sql.BigInt, employeeId);

    const updates: string[] = [];

    if (employeeData.firstName !== undefined) {
      request.input('firstName', sql.NVarChar, employeeData.firstName);
      updates.push('first_name = @firstName');
    }
    if (employeeData.lastName !== undefined) {
      request.input('lastName', sql.NVarChar, employeeData.lastName);
      updates.push('last_name = @lastName');
    }
    if (employeeData.title !== undefined) {
      request.input('title', sql.NVarChar, employeeData.title);
      updates.push('title = @title');
    }
    if (employeeData.position !== undefined) {
      request.input('position', sql.NVarChar, employeeData.position);
      updates.push('position = @position');
    }
    if (employeeData.department !== undefined) {
      request.input('department', sql.NVarChar, employeeData.department);
      updates.push('department = @department');
    }
    if (employeeData.isActive !== undefined) {
      request.input('isActive', sql.Bit, employeeData.isActive ? 1 : 0);
      updates.push('is_active = @isActive');
    }
    if (employeeData.email !== undefined) {
      request.input('email', sql.NVarChar, employeeData.email);
      updates.push('email = @email');
    }
    if (employeeData.phone !== undefined) {
      request.input('phone', sql.NVarChar, employeeData.phone);
      updates.push('phone = @phone');
    }

    if (updates.length === 0) {
      return await getEmployeeSqlServer(pool, employeeId) || undefined;
    }

    updates.push('updated_at = GETDATE()');

    const result = await request.query(`
      UPDATE employee
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE employee_id = @employeeId
    `);

    if (result.recordset.length === 0) {
      return undefined;
    }

    return mapEmployeeFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Update employee error');
    throw error;
  }
}

/**
 * Deactivate employee
 */
export async function deactivateEmployeeSqlServer(
  pool: sql.ConnectionPool,
  employeeId: number
): Promise<Employee | undefined> {
  return await updateEmployeeSqlServer(pool, employeeId, { isActive: false });
}

/**
 * Map database row to Employee object
 * Matches shared/schema.ts Employee type
 */
function mapEmployeeFromDb(row: any): Employee {
  return {
    employeeId: row.employee_id,
    employeeNumber: row.employee_number,
    firstName: row.first_name,
    lastName: row.last_name,
    title: row.title,
    position: row.position,
    officerCode: row.officer_code,
    department: row.department,
    isActive: row.is_active || false,
    hireDate: row.hire_date,
    ssoSubject: row.sso_subject,
    email: row.email,
    phone: row.phone,
    lastSeenSamlRole: row.last_seen_saml_role,
    lastLoginAt: row.last_login_at,
    deletedAt: row.deleted_at,
    modifiedBy: row.modified_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
