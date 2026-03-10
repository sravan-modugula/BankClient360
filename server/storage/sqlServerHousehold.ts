/**
 * SQL Server Household Operations
 * Household management and member relationships for MS SQL Server
 */

import sql from 'mssql';
import type {
  Household,
  InsertHousehold,
  HouseholdMembership,
  Customer,
  Account
} from '@shared/schema';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-household' });

/**
 * Extended household member type for SQL Server views
 * Includes customer details with membership relationship info
 */
export interface HouseholdMemberView {
  customerId: number;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  businessName: string | null;
  fullName: string | null;
  customerType: string;
  customerStatus: string | null;
  dateOfBirth: Date | null;
  vipCustomer: boolean;
  isEmployee: boolean;
  relationshipRole: string;
  ownershipPercentage: string | null;
  membershipStartDate: Date | null;
  isPrimaryMember: boolean;
}

/**
 * Get household by ID
 */
export async function getHouseholdSqlServer(
  pool: sql.ConnectionPool,
  householdId: number
): Promise<Household | null> {
  try {
    const request = pool.request();
    request.input('householdId', sql.BigInt, householdId);

    const result = await request.query(`
      SELECT * FROM household WHERE household_id = @householdId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapHouseholdFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get household error');
    throw error;
  }
}

/**
 * Get household members with customer details
 */
export async function getHouseholdMembersSqlServer(
  pool: sql.ConnectionPool,
  householdId: number
): Promise<HouseholdMember[]> {
  try {
    const request = pool.request();
    request.input('householdId', sql.BigInt, householdId);

    const result = await request.query(`
      SELECT 
        c.customer_id,
        c.first_name,
        c.last_name,
        c.middle_name,
        c.business_name,
        c.full_name,
        c.customer_type,
        c.customer_status,
        c.date_of_birth,
        hm.relationship_role,
        hm.ownership_percentage,
        hm.is_primary_member
      FROM household_membership hm
      INNER JOIN customer c ON c.customer_id = hm.customer_id
      WHERE hm.household_id = @householdId
        AND hm.membership_end_date IS NULL
      ORDER BY hm.is_primary_member DESC, c.last_name, c.first_name
    `);

    return result.recordset.map(mapHouseholdMemberFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get household members error');
    throw error;
  }
}

/**
 * Get household accounts
 */
export async function getHouseholdAccountsSqlServer(
  pool: sql.ConnectionPool,
  householdId: number
): Promise<Account[]> {
  try {
    const request = pool.request();
    request.input('householdId', sql.BigInt, householdId);

    const result = await request.query(`
      SELECT a.*
      FROM account a
      WHERE a.household_id = @householdId
        AND a.account_status != 'closed'
      ORDER BY a.account_type, a.account_number
    `);

    return result.recordset.map(mapAccountFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get household accounts error');
    throw error;
  }
}

/**
 * Get subsidiary households (children) where this household is the parent
 */
export async function getSubsidiaryHouseholdsSqlServer(
  pool: sql.ConnectionPool,
  parentHouseholdId: number
): Promise<Household[]> {
  try {
    const request = pool.request();
    request.input('parentHouseholdId', sql.BigInt, parentHouseholdId);

    const result = await request.query(`
      SELECT *
      FROM household
      WHERE parent_household_id = @parentHouseholdId
      ORDER BY household_name
    `);

    return result.recordset.map(mapHouseholdFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get subsidiary households error');
    throw error;
  }
}

/**
 * Get households for a customer
 */
export async function getCustomerHouseholdsSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<Array<Household & { relationshipRole: string }>> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    const result = await request.query(`
      SELECT 
        h.*,
        hm.relationship_role
      FROM household_membership hm
      INNER JOIN household h ON h.household_id = hm.household_id
      WHERE hm.customer_id = @customerId
      ORDER BY hm.is_primary_member DESC, h.household_name
    `);

    return result.recordset.map(row => ({
      ...mapHouseholdFromDb(row),
      relationshipRole: row.relationship_role
    }));
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer households error');
    throw error;
  }
}

/**
 * Get household hierarchy (for B2B relationships)
 */
export async function getHouseholdHierarchySqlServer(
  pool: sql.ConnectionPool,
  householdId: number
): Promise<{
  household: Household;
  parent: Household | null;
  children: Household[];
}> {
  try {
    const request = pool.request();
    request.input('householdId', sql.BigInt, householdId);

    // Get household
    const mainResult = await request.query(`
      SELECT * FROM household WHERE household_id = @householdId
    `);

    if (mainResult.recordset.length === 0) {
      throw new Error(`Household ${householdId} not found`);
    }

    const household = mapHouseholdFromDb(mainResult.recordset[0]);

    // Get parent household if exists (full record)
    let parent: Household | null = null;
    if (household.parentHouseholdId) {
      const parentRequest = pool.request();
      parentRequest.input('parentId', sql.BigInt, household.parentHouseholdId);
      const parentResult = await parentRequest.query(`
        SELECT * FROM household WHERE household_id = @parentId
      `);
      if (parentResult.recordset.length > 0) {
        parent = mapHouseholdFromDb(parentResult.recordset[0]);
      }
    }

    // Get children
    const childRequest = pool.request();
    childRequest.input('householdId', sql.BigInt, householdId);

    const childResult = await childRequest.query(`
      SELECT * FROM household
      WHERE parent_household_id = @householdId
      ORDER BY household_name
    `);

    const children = childResult.recordset.map(mapHouseholdFromDb);

    return { household, parent, children };
  } catch (error) {
    fileLogger.error({ err: error }, 'Get household hierarchy error');
    throw error;
  }
}

/**
 * Create household
 */
export async function createHouseholdSqlServer(
  pool: sql.ConnectionPool,
  householdData: InsertHousehold
): Promise<Household> {
  try {
    const request = pool.request();

    request.input('householdName', sql.NVarChar, householdData.householdName);
    request.input('householdType', sql.NVarChar, householdData.householdType);
    request.input('taxIdentifier', sql.NVarChar, householdData.taxIdentifier || null);
    request.input('riskRating', sql.NVarChar, householdData.riskRating || null);
    request.input('parentHouseholdId', sql.BigInt, householdData.parentHouseholdId || null);
    request.input('consolidationMethod', sql.NVarChar, householdData.consolidationMethod || 'equity');

    const result = await request.query(`
      INSERT INTO household (
        household_name, household_type, tax_identifier, risk_rating,
        parent_household_id, consolidation_method
      )
      OUTPUT INSERTED.*
      VALUES (
        @householdName, @householdType, @taxIdentifier, @riskRating,
        @parentHouseholdId, @consolidationMethod
      )
    `);

    return mapHouseholdFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Create household error');
    throw error;
  }
}

/**
 * Add member to household
 */
export async function addHouseholdMemberSqlServer(
  pool: sql.ConnectionPool,
  householdId: number,
  customerId: number,
  membershipData: Partial<HouseholdMembership>
): Promise<HouseholdMembership> {
  try {
    const request = pool.request();

    request.input('householdId', sql.BigInt, householdId);
    request.input('customerId', sql.BigInt, customerId);
    request.input('relationshipRole', sql.NVarChar, membershipData.relationshipRole || 'member');
    request.input('ownershipPercentage', sql.Decimal(5, 2), membershipData.ownershipPercentage || 0);
    request.input('isPrimaryMember', sql.Bit, membershipData.isPrimaryMember ? 1 : 0);
    request.input('isHeadOfHousehold', sql.Bit, membershipData.isHeadOfHousehold ? 1 : 0);
    request.input('rollupAccounts', sql.Bit, membershipData.rollupAccounts !== false ? 1 : 0);
    request.input('rollupPercentage', sql.Decimal(5, 2), membershipData.rollupPercentage || 100);
    request.input('controlType', sql.NVarChar, membershipData.controlType || 'none');

    const result = await request.query(`
      INSERT INTO household_membership (
        household_id, customer_id, relationship_role, ownership_percentage,
        is_primary_member, is_head_of_household, rollup_accounts, rollup_percentage,
        control_type
      )
      OUTPUT INSERTED.*
      VALUES (
        @householdId, @customerId, @relationshipRole, @ownershipPercentage,
        @isPrimaryMember, @isHeadOfHousehold, @rollupAccounts, @rollupPercentage,
        @controlType
      )
    `);

    return mapHouseholdMembershipFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Add household member error');
    throw error;
  }
}

/**
 * Remove member from household (soft delete)
 */
export async function removeHouseholdMemberSqlServer(
  pool: sql.ConnectionPool,
  householdId: number,
  customerId: number
): Promise<void> {
  try {
    const request = pool.request();
    request.input('householdId', sql.BigInt, householdId);
    request.input('customerId', sql.BigInt, customerId);

    await request.query(`
      UPDATE household_membership
      SET membership_end_date = GETDATE()
      WHERE household_id = @householdId 
        AND customer_id = @customerId
    `);
  } catch (error) {
    fileLogger.error({ err: error }, 'Remove household member error');
    throw error;
  }
}

/**
 * Map database row to Household object
 * Matches shared/schema.ts Household type
 */
function mapHouseholdFromDb(row: any): Household {
  return {
    householdId: row.household_id,
    householdName: row.household_name,
    householdType: row.household_type,
    totalAssets: row.total_assets,
    totalLiabilities: row.total_liabilities,
    householdStatus: row.household_status,
    riskRating: row.risk_rating,
    relationshipManagerId: row.relationship_manager_id,
    establishedDate: row.established_date,
    taxFilingStatus: row.tax_filing_status,
    parentHouseholdId: row.parent_household_id,
    consolidationMethod: row.consolidation_method,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Map database row to HouseholdMemberView object
 * Used for joined queries that include customer and membership data
 */
function mapHouseholdMemberFromDb(row: any): HouseholdMemberView {
  return {
    customerId: row.customer_id,
    firstName: row.first_name,
    lastName: row.last_name,
    middleName: row.middle_name,
    businessName: row.business_name,
    fullName: row.full_name,
    customerType: row.customer_type,
    customerStatus: row.customer_status,
    dateOfBirth: row.date_of_birth,
    vipCustomer: row.vip_customer || false,
    isEmployee: row.is_employee || false,
    relationshipRole: row.relationship_role,
    ownershipPercentage: row.ownership_percentage,
    membershipStartDate: row.membership_start_date,
    isPrimaryMember: row.is_primary_member || false
  };
}

/**
 * Map database row to HouseholdMembership object
 * Matches shared/schema.ts HouseholdMembership type
 */
function mapHouseholdMembershipFromDb(row: any): HouseholdMembership {
  return {
    membershipId: row.membership_id,
    householdId: row.household_id,
    customerId: row.customer_id,
    relationshipRole: row.relationship_role,
    isPrimaryMember: row.is_primary_member,
    isHeadOfHousehold: row.is_head_of_household,
    membershipStartDate: row.membership_start_date,
    membershipEndDate: row.membership_end_date,
    rollupAccounts: row.rollup_accounts,
    rollupPercentage: row.rollup_percentage,
    ownershipPercentage: row.ownership_percentage,
    controlType: row.control_type,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Update household
 */
export async function updateHouseholdSqlServer(
  pool: sql.ConnectionPool,
  householdId: number,
  householdData: Partial<InsertHousehold>
): Promise<Household | null> {
  try {
    const request = pool.request();
    request.input('householdId', sql.BigInt, householdId);

    // Build dynamic UPDATE statement
    const updates: string[] = [];
    const params: Record<string, any> = {};

    if (householdData.householdName !== undefined) {
      updates.push('household_name = @householdName');
      params.householdName = householdData.householdName;
    }
    if (householdData.householdType !== undefined) {
      updates.push('household_type = @householdType');
      params.householdType = householdData.householdType;
    }
    if (householdData.taxIdentifier !== undefined) {
      updates.push('tax_identifier = @taxIdentifier');
      params.taxIdentifier = householdData.taxIdentifier;
    }
    if (householdData.riskRating !== undefined) {
      updates.push('risk_rating = @riskRating');
      params.riskRating = householdData.riskRating;
    }
    if (householdData.parentHouseholdId !== undefined) {
      updates.push('parent_household_id = @parentHouseholdId');
      params.parentHouseholdId = householdData.parentHouseholdId;
    }
    if (householdData.consolidationMethod !== undefined) {
      updates.push('consolidation_method = @consolidationMethod');
      params.consolidationMethod = householdData.consolidationMethod;
    }

    if (updates.length === 0) {
      // No updates specified, just return existing household
      return await getHouseholdSqlServer(pool, householdId);
    }

    // Add parameters
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });

    // Always update the updated_at timestamp
    updates.push('updated_at = GETDATE()');

    const result = await request.query(`
      UPDATE household
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE household_id = @householdId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapHouseholdFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Update household error');
    throw error;
  }
}

/**
 * Close household (set status to closed)
 */
export async function closeHouseholdSqlServer(
  pool: sql.ConnectionPool,
  householdId: number
): Promise<Household | null> {
  try {
    const request = pool.request();
    request.input('householdId', sql.BigInt, householdId);

    const result = await request.query(`
      UPDATE household
      SET household_status = 'closed',
          updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE household_id = @householdId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapHouseholdFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Close household error');
    throw error;
  }
}

/**
 * End household member (soft delete - set membership_end_date)
 */
export async function endHouseholdMemberSqlServer(
  pool: sql.ConnectionPool,
  membershipId: number
): Promise<HouseholdMembership | null> {
  try {
    const request = pool.request();
    request.input('membershipId', sql.BigInt, membershipId);

    const result = await request.query(`
      UPDATE household_membership
      SET membership_end_date = CAST(GETDATE() AS DATE),
          updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE membership_id = @membershipId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapHouseholdMembershipFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'End household member error');
    throw error;
  }
}

/**
 * Map database row to Account object
 * Matches shared/schema.ts Account type
 */
function mapAccountFromDb(row: any): Account {
  return {
    accountId: row.account_id,
    accountNumber: row.account_number,
    accountType: row.account_type,
    accountSubtype: row.account_subtype,
    accountStatus: row.account_status,
    balance: row.balance,
    availableBalance: row.available_balance,
    currency: row.currency,
    openDate: row.open_date,
    closeDate: row.close_date,
    interestRate: row.interest_rate,
    apy: row.apy,
    term: row.term,
    maturityDate: row.maturity_date,
    creditLimit: row.credit_limit,
    minimumPayment: row.minimum_payment,
    paymentDueDate: row.payment_due_date,
    lastPaymentDate: row.last_payment_date,
    lastPaymentAmount: row.last_payment_amount,
    productCode: row.product_code,
    branchId: row.branch_id,
    jackHenryAccountId: row.jack_henry_account_id,
    silverlakeAccountId: row.silverlake_account_id,
    lastMaintenanceDate: row.last_maintenance_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}