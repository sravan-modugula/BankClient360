
/**
 * SQL Server Customer-Officer Assignment Operations
 * Handles relationship between customers and their assigned officers
 */

import sql from 'mssql';
import type { CustomerOfficerAssignment, InsertCustomerOfficerAssignment } from '@shared/schema';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-officer' });

/**
 * Get all officers assigned to a customer
 */
export async function getCustomerOfficersSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<CustomerOfficerAssignment[]> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    const result = await request.query(`
      SELECT 
        customer_id,
        officer_code,
        relationship_type,
        assigned_at,
        created_at,
        updated_at
      FROM customer_officer_assignment
      WHERE customer_id = @customerId
      ORDER BY 
        CASE WHEN relationship_type = 'primary' THEN 1 ELSE 2 END,
        assigned_at DESC
    `);

    return result.recordset.map(mapOfficerAssignmentFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer officers error');
    throw error;
  }
}

/**
 * Get all customers assigned to an officer
 */
export async function getOfficerCustomersSqlServer(
  pool: sql.ConnectionPool,
  officerCode: string
): Promise<CustomerOfficerAssignment[]> {
  try {
    const request = pool.request();
    request.input('officerCode', sql.NVarChar, officerCode);

    const result = await request.query(`
      SELECT 
        customer_id,
        officer_code,
        relationship_type,
        assigned_at,
        created_at,
        updated_at
      FROM customer_officer_assignment
      WHERE officer_code = @officerCode
      ORDER BY 
        CASE WHEN relationship_type = 'primary' THEN 1 ELSE 2 END,
        assigned_at DESC
    `);

    return result.recordset.map(mapOfficerAssignmentFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get officer customers error');
    throw error;
  }
}

/**
 * Get customer officers with full employee details (for officer adapter)
 */
export async function getCustomerOfficersWithDetailsSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<Array<{
  officerCode: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
  relationshipType: 'primary' | 'secondary';
  assignedAt: Date | null;
}>> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    const result = await request.query(`
      SELECT 
        e.officer_code,
        e.first_name,
        e.last_name,
        e.title,
        e.department,
        coa.relationship_type,
        coa.assigned_at
      FROM customer_officer_assignment coa
      INNER JOIN employee e ON e.officer_code = coa.officer_code
      WHERE coa.customer_id = @customerId
        AND e.officer_code IS NOT NULL
        AND e.is_active = 1
      ORDER BY 
        CASE WHEN coa.relationship_type = 'primary' THEN 1 ELSE 2 END,
        e.last_name,
        e.first_name
    `);

    return result.recordset.map(row => ({
      officerCode: row.officer_code,
      firstName: row.first_name,
      lastName: row.last_name,
      title: row.title,
      department: row.department,
      relationshipType: row.relationship_type as 'primary' | 'secondary',
      assignedAt: row.assigned_at
    }));
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer officers with details error');
    throw error;
  }
}

/**
 * Add officer assignment to customer
 */
export async function addCustomerOfficerSqlServer(
  pool: sql.ConnectionPool,
  assignmentData: InsertCustomerOfficerAssignment
): Promise<CustomerOfficerAssignment> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, assignmentData.customerId);
    request.input('officerCode', sql.NVarChar, assignmentData.officerCode);
    request.input('relationshipType', sql.NVarChar, assignmentData.relationshipType);
    request.input('assignedAt', sql.DateTime2, assignmentData.assignedAt || new Date());

    const result = await request.query(`
      INSERT INTO customer_officer_assignment (
        customer_id,
        officer_code,
        relationship_type,
        assigned_at
      )
      OUTPUT 
        INSERTED.customer_id,
        INSERTED.officer_code,
        INSERTED.relationship_type,
        INSERTED.assigned_at,
        INSERTED.created_at,
        INSERTED.updated_at
      VALUES (
        @customerId,
        @officerCode,
        @relationshipType,
        @assignedAt
      )
    `);

    return mapOfficerAssignmentFromDb(result.recordset[0]);
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.number === 2627) { // SQL Server unique constraint error
      const err = new Error('Officer already assigned to customer');
      (err as any).code = '23505';
      throw err;
    }
    
    // Handle filtered unique constraint violation (multiple primary officers)
    if (error.message?.includes('unq_customer_primary_officer')) {
      const err = new Error('Customer already has a primary officer');
      (err as any).message = 'unq_customer_primary_officer';
      throw err;
    }

    fileLogger.error({ err: error }, 'Add customer officer error');
    throw error;
  }
}

/**
 * Update officer relationship type
 */
export async function updateCustomerOfficerSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  officerCode: string,
  relationshipType: string
): Promise<CustomerOfficerAssignment | undefined> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);
    request.input('officerCode', sql.NVarChar, officerCode);
    request.input('relationshipType', sql.NVarChar, relationshipType);

    const result = await request.query(`
      UPDATE customer_officer_assignment
      SET 
        relationship_type = @relationshipType,
        updated_at = GETDATE()
      OUTPUT 
        INSERTED.customer_id,
        INSERTED.officer_code,
        INSERTED.relationship_type,
        INSERTED.assigned_at,
        INSERTED.created_at,
        INSERTED.updated_at
      WHERE customer_id = @customerId
        AND officer_code = @officerCode
    `);

    if (result.recordset.length === 0) {
      return undefined;
    }

    return mapOfficerAssignmentFromDb(result.recordset[0]);
  } catch (error: any) {
    // Handle filtered unique constraint violation (multiple primary officers)
    if (error.message?.includes('unq_customer_primary_officer')) {
      const err = new Error('Customer already has a primary officer');
      (err as any).message = 'unq_customer_primary_officer';
      throw err;
    }

    fileLogger.error({ err: error }, 'Update customer officer error');
    throw error;
  }
}

/**
 * Remove officer assignment from customer
 */
export async function removeCustomerOfficerSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  officerCode: string
): Promise<boolean> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);
    request.input('officerCode', sql.NVarChar, officerCode);

    const result = await request.query(`
      DELETE FROM customer_officer_assignment
      OUTPUT DELETED.customer_id
      WHERE customer_id = @customerId
        AND officer_code = @officerCode
    `);

    return result.recordset.length > 0;
  } catch (error) {
    fileLogger.error({ err: error }, 'Remove customer officer error');
    throw error;
  }
}

/**
 * Map database row to CustomerOfficerAssignment object
 */
function mapOfficerAssignmentFromDb(row: any): CustomerOfficerAssignment {
  return {
    customerId: row.customer_id,
    officerCode: row.officer_code,
    relationshipType: row.relationship_type,
    assignedAt: row.assigned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
