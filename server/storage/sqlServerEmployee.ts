/**
 * SQL Server Employee Operations
 * Employee management for MS SQL Server
 */

import sql from 'mssql';
import type { Employee, InsertEmployee } from '@shared/schema';

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
    console.error('[SQL Server] Get employee error:', error);
    throw error;
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
    console.error('[SQL Server] Get employees error:', error);
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
    console.error('[SQL Server] Create employee error:', error);
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
    console.error('[SQL Server] Update employee error:', error);
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
