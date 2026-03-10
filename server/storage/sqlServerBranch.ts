
/**
 * SQL Server Branch Operations
 * Branch management for MS SQL Server
 */

import sql from 'mssql';
import type { Branch, InsertBranch } from '@shared/schema';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-branch' });

/**
 * Get branch by ID
 */
export async function getBranchSqlServer(
  pool: sql.ConnectionPool,
  branchId: number
): Promise<Branch | null> {
  try {
    const request = pool.request();
    request.input('branchId', sql.BigInt, branchId);

    const result = await request.query(`
      SELECT * FROM branch WHERE branch_id = @branchId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapBranchFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get branch error');
    throw error;
  }
}

/**
 * Get all branches
 */
export async function getBranchesSqlServer(
  pool: sql.ConnectionPool
): Promise<Branch[]> {
  try {
    const request = pool.request();

    const result = await request.query(`
      SELECT * FROM branch
      WHERE is_active = 1
      ORDER BY branch_name
    `);

    return result.recordset.map(mapBranchFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get branches error');
    throw error;
  }
}

/**
 * Create branch
 */
export async function createBranchSqlServer(
  pool: sql.ConnectionPool,
  branchData: InsertBranch
): Promise<Branch> {
  try {
    const request = pool.request();

    request.input('branchCode', sql.NVarChar, branchData.branchCode);
    request.input('branchName', sql.NVarChar, branchData.branchName);
    request.input('branchType', sql.NVarChar, branchData.branchType || null);
    request.input('regionId', sql.BigInt, branchData.regionId || null);
    request.input('isActive', sql.Bit, branchData.isActive !== false ? 1 : 0);

    const result = await request.query(`
      INSERT INTO branch (
        branch_code, branch_name, branch_type, region_id, is_active
      )
      OUTPUT INSERTED.*
      VALUES (
        @branchCode, @branchName, @branchType, @regionId, @isActive
      )
    `);

    return mapBranchFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Create branch error');
    throw error;
  }
}

/**
 * Update branch
 */
export async function updateBranchSqlServer(
  pool: sql.ConnectionPool,
  branchId: number,
  branchData: Partial<InsertBranch>
): Promise<Branch | undefined> {
  try {
    const request = pool.request();
    request.input('branchId', sql.BigInt, branchId);

    const updates: string[] = [];

    if (branchData.branchName !== undefined) {
      request.input('branchName', sql.NVarChar, branchData.branchName);
      updates.push('branch_name = @branchName');
    }
    if (branchData.branchType !== undefined) {
      request.input('branchType', sql.NVarChar, branchData.branchType);
      updates.push('branch_type = @branchType');
    }
    if (branchData.isActive !== undefined) {
      request.input('isActive', sql.Bit, branchData.isActive ? 1 : 0);
      updates.push('is_active = @isActive');
    }

    if (updates.length === 0) {
      return await getBranchSqlServer(pool, branchId) || undefined;
    }

    updates.push('updated_at = GETDATE()');

    const result = await request.query(`
      UPDATE branch
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE branch_id = @branchId
    `);

    if (result.recordset.length === 0) {
      return undefined;
    }

    return mapBranchFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Update branch error');
    throw error;
  }
}

/**
 * Deactivate branch
 */
export async function deactivateBranchSqlServer(
  pool: sql.ConnectionPool,
  branchId: number
): Promise<Branch | undefined> {
  return await updateBranchSqlServer(pool, branchId, { isActive: false });
}

/**
 * Map database row to Branch object
 */
function mapBranchFromDb(row: any): Branch {
  return {
    branchId: row.branch_id,
    branchCode: row.branch_code,
    branchName: row.branch_name,
    branchType: row.branch_type,
    addressId: row.address_id,
    regionId: row.region_id,
    isActive: row.is_active || false,
    openedDate: row.opened_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
