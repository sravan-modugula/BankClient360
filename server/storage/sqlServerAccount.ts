/**
 * SQL Server Account Operations
 * Account management and balance operations for MS SQL Server
 */

import sql from 'mssql';
import type {
  Account,
  InsertAccount,
  AccountOwnership,
  FinancialTransaction,
  DebitCardWithLimitProfile,
  AccountSicCode
} from '@shared/schema';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-account' });

/**
 * Get account by ID
 */
export async function getAccountSqlServer(
  pool: sql.ConnectionPool,
  accountId: number
): Promise<Account | null> {
  try {
    const request = pool.request();
    request.input('accountId', sql.BigInt, accountId);

    const result = await request.query(`
      SELECT a.*, b.branch_name, b.branch_code
      FROM account a
      LEFT JOIN branch b ON b.branch_id = a.branch_id
      WHERE a.account_id = @accountId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapAccountFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get account error');
    throw error;
  }
}

/**
 * Get accounts by customer ID
 */
export async function getCustomerAccountsSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<Account[]> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    const result = await request.query(`
      SELECT DISTINCT a.*
      FROM account a
      INNER JOIN account_ownership ao ON ao.account_id = a.account_id
      WHERE ao.customer_id = @customerId
        AND a.account_status != 'closed'
      ORDER BY a.account_type, a.account_number
    `);

    return result.recordset.map(mapAccountFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer accounts error');
    throw error;
  }
}

/**
 * Get accounts by household ID
 */
export async function getHouseholdAccountsSqlServer(
  pool: sql.ConnectionPool,
  householdId: number
): Promise<Account[]> {
  try {
    const request = pool.request();
    request.input('householdId', sql.BigInt, householdId);

    const result = await request.query(`
      SELECT *
      FROM account
      WHERE household_id = @householdId
        AND account_status != 'closed'
      ORDER BY account_type, account_number
    `);

    return result.recordset.map(mapAccountFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get household accounts error');
    throw error;
  }
}

/**
 * Get account owners
 */
export async function getAccountOwnersSqlServer(
  pool: sql.ConnectionPool,
  accountId: number
): Promise<Array<AccountOwnership & { customerName: string }>> {
  try {
    const request = pool.request();
    request.input('accountId', sql.BigInt, accountId);

    const result = await request.query(`
      SELECT
        ao.*,
        c.full_name as customer_name,
        c.jack_henry_cif_number as cif_number
      FROM account_ownership ao
      INNER JOIN customer c ON c.customer_id = ao.customer_id
      WHERE ao.account_id = @accountId
      ORDER BY ao.ownership_percentage DESC, c.full_name
    `);

    return result.recordset.map(row => ({
      ...mapAccountOwnershipFromDb(row),
      customerName: row.customer_name,
      cifNumber: row.cif_number || null
    }));
  } catch (error) {
    fileLogger.error({ err: error }, 'Get account owners error');
    throw error;
  }
}

/**
 * Get account balance (current and available)
 */
export async function getAccountBalanceSqlServer(
  pool: sql.ConnectionPool,
  accountId: number
): Promise<{ balance: number; availableBalance: number } | null> {
  try {
    const request = pool.request();
    request.input('accountId', sql.BigInt, accountId);

    const result = await request.query(`
      SELECT balance, available_balance
      FROM account
      WHERE account_id = @accountId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return {
      balance: parseFloat(result.recordset[0].balance) || 0,
      availableBalance: parseFloat(result.recordset[0].available_balance) || 0
    };
  } catch (error) {
    fileLogger.error({ err: error }, 'Get account balance error');
    throw error;
  }
}

/**
 * Create account
 * Matches shared/schema.ts Account type
 */
export async function createAccountSqlServer(
  pool: sql.ConnectionPool,
  accountData: InsertAccount
): Promise<Account> {
  try {
    const request = pool.request();

    request.input('accountNumber', sql.NVarChar, accountData.accountNumber);
    request.input('accountType', sql.NVarChar, accountData.accountType);
    request.input('accountSubtype', sql.NVarChar, accountData.accountSubtype || null);
    request.input('accountStatus', sql.NVarChar, accountData.accountStatus || 'active');
    request.input('balance', sql.Decimal(15, 2), accountData.balance || 0);
    request.input('availableBalance', sql.Decimal(18, 2), accountData.availableBalance || 0);
    request.input('currency', sql.NVarChar, accountData.currency || 'USD');
    request.input('branchId', sql.BigInt, accountData.branchId || null);
    request.input('productCode', sql.NVarChar, accountData.productCode || null);
    request.input('interestRate', sql.Decimal(5, 4), accountData.interestRate || null);
    request.input('creditLimit', sql.Decimal(15, 2), accountData.creditLimit || null);

    const result = await request.query(`
      INSERT INTO account (
        account_number, account_type, account_subtype,
        account_status, balance, available_balance, currency,
        branch_id, product_code, interest_rate, credit_limit, opened_date
      )
      OUTPUT INSERTED.*
      VALUES (
        @accountNumber, @accountType, @accountSubtype,
        @accountStatus, @balance, @availableBalance, @currency,
        @branchId, @productCode, @interestRate, @creditLimit, CAST(GETDATE() AS DATE)
      )
    `);

    return mapAccountFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Create account error');
    throw error;
  }
}

/**
 * Update account
 */
export async function updateAccountSqlServer(
  pool: sql.ConnectionPool,
  accountId: number,
  accountData: Partial<InsertAccount>
): Promise<Account | undefined> {
  try {
    const request = pool.request();
    request.input('accountId', sql.BigInt, accountId);

    const updates: string[] = [];

    if (accountData.accountStatus !== undefined) {
      request.input('accountStatus', sql.NVarChar, accountData.accountStatus);
      updates.push('account_status = @accountStatus');
    }
    if (accountData.balance !== undefined) {
      request.input('balance', sql.Decimal(15, 2), accountData.balance);
      updates.push('balance = @balance');
    }
    if (accountData.availableBalance !== undefined) {
      request.input('availableBalance', sql.Decimal(18, 2), accountData.availableBalance);
      updates.push('available_balance = @availableBalance');
    }

    if (updates.length === 0) {
      return await getAccountSqlServer(pool, accountId) || undefined;
    }

    updates.push('updated_at = GETDATE()');

    const result = await request.query(`
      UPDATE account
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE account_id = @accountId
    `);

    if (result.recordset.length === 0) {
      return undefined;
    }

    return mapAccountFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Update account error');
    throw error;
  }
}

/**
 * Close account
 */
export async function closeAccountSqlServer(
  pool: sql.ConnectionPool,
  accountId: number
): Promise<Account | undefined> {
  try {
    const request = pool.request();
    request.input('accountId', sql.BigInt, accountId);

    const result = await request.query(`
      UPDATE account
      SET account_status = 'closed', close_date = GETDATE(), updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE account_id = @accountId
    `);

    if (result.recordset.length === 0) {
      return undefined;
    }

    return mapAccountFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Close account error');
    throw error;
  }
}

/**
 * Get recent transactions for account
 */
export async function getRecentTransactionsSqlServer(
  pool: sql.ConnectionPool,
  accountId: number,
  limit: number = 10
): Promise<FinancialTransaction[]> {
  try {
    const request = pool.request();
    request.input('accountId', sql.BigInt, accountId);
    request.input('limit', sql.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit) *
      FROM financial_transaction
      WHERE account_id = @accountId
      ORDER BY transaction_date DESC, transaction_id DESC
    `);

    return result.recordset.map(mapTransactionFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get recent transactions error');
    throw error;
  }
}

/**
 * Map database row to Account object
 * Matches shared/schema.ts Account type
 */
function mapAccountFromDb(row: any): Account & { branchName?: string; branchCode?: string } {
  return {
    accountId: row.account_id,
    accountNumber: row.account_number,
    accountType: row.account_type?.toLowerCase(),
    accountSubtype: row.account_subtype,
    accountStatus: row.account_status?.toLowerCase(),
    balance: row.balance,
    availableBalance: row.available_balance,
    currency: row.currency,
    interestRate: row.interest_rate != null ? parseFloat(row.interest_rate) * 100 : null,
    creditLimit: row.credit_limit,
    branchId: row.branch_id,
    productCode: row.product_code,
    openedDate: row.opened_date,
    closedDate: row.closed_date,
    lastTransactionDate: row.last_transaction_date,
    maturityDate: row.maturity_date,
    jackHenryAccountId: row.jack_henry_account_id,
    silverlakeAccountStructure: row.silverlake_account_structure,
    accountClass: row.account_class,
    statementCycle: row.statement_cycle,
    statementCodeDesc: row.statement_code_desc,
    averageBalance: row.average_balance,
    lastMaintenanceDate: row.last_maintenance_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.branch_name && { branchName: row.branch_name }),
    ...(row.branch_code && { branchCode: row.branch_code }),
    ...(row.ytd_interest != null && { ytdInterest: row.ytd_interest }),
    ...(row.interest_ytd != null && { ytdInterest: row.interest_ytd }),
  };
}

/**
 * Map database row to AccountOwnership object
 * Matches shared/schema.ts AccountOwnership type
 */
function mapAccountOwnershipFromDb(row: any): AccountOwnership {
  return {
    ownershipId: row.ownership_id,
    accountId: row.account_id,
    customerId: row.customer_id,
    ownershipType: row.ownership_type,
    ownershipPercentage: row.ownership_percentage,
    isPrimaryOwner: row.is_primary_owner,
    signingAuthority: row.signing_authority,
    canViewStatements: row.can_view_statements,
    canMakeTransactions: row.can_make_transactions,
    transactionLimit: row.transaction_limit,
    relationshipStartDate: row.relationship_start_date,
    relationshipEndDate: row.relationship_end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Map database row to FinancialTransaction object
 * Matches shared/schema.ts FinancialTransaction type
 */
function mapTransactionFromDb(row: any): FinancialTransaction {
  return {
    transactionId: row.transaction_id,
    accountId: row.account_id,
    amount: row.amount,
    transactionCode: row.transaction_code,
    transactionType: row.transaction_type,
    status: row.status,
    transactionDate: row.transaction_date,
    postingDate: row.posting_date,
    description: row.description,
    referenceNumber: row.reference_number,
    merchantName: row.merchant_name,
    merchantCategoryCode: row.merchant_category_code,
    categoryId: row.category_id,
    transferGroupId: row.transfer_group_id,
    counterpartyAccountId: row.counterparty_account_id,
    relatedTransactionId: row.related_transaction_id,
    ledgerBalanceAfter: row.ledger_balance_after,
    availableBalanceAfter: row.available_balance_after,
    sourceSystem: row.source_system,
    sourceTransactionId: row.source_transaction_id,
    rawPayload: row.raw_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Get debit cards for an account with limit profiles
 */
export async function getAccountDebitCardsSqlServer(
  pool: sql.ConnectionPool,
  accountId: number
): Promise<DebitCardWithLimitProfile[]> {
  try {
    const request = pool.request();
    request.input('accountId', sql.BigInt, accountId);

    const result = await request.query(`
      SELECT
        dc.account_id,
        dc.customer_id,
        dc.card_type,
        dc.card_status,
        dc.last_four_digits,
        dc.card_brand,
        dc.expiry_month,
        dc.expiry_year,
        dc.cardholder_name,
        dc.created_at
      FROM debit_card dc
      WHERE dc.account_id = @accountId
      ORDER BY dc.created_at DESC
    `);

    return result.recordset.map((row, index) => ({
      cardId: index + 1,
      accountId: row.account_id,
      customerId: row.customer_id,
      cardType: row.card_type,
      cardStatus: row.card_status,
      lastFourDigits: row.last_four_digits,
      cardBrand: row.card_brand,
      expiryMonth: row.expiry_month,
      expiryYear: row.expiry_year,
      cardholderName: row.cardholder_name,
      jackHenryCardId: row.jack_henry_card_id ?? null,
      silverlakeCardToken: row.silverlake_card_token ?? null,
      limitProfile: null
    }));
  } catch (error) {
    fileLogger.error({ err: error }, 'Get account debit cards error');
    throw error;
  }
}

/**
 * Get SIC codes for an account with descriptions
 */
export async function getAccountSicCodesWithDescriptionsSqlServer(
  pool: sql.ConnectionPool,
  accountId: number
): Promise<Array<{
  sicCode: number;
  description: string;
  effectiveDate: string | null;
  endDate: string | null;
}>> {
  try {
    const request = pool.request();
    request.input('accountId', sql.BigInt, accountId);

    const result = await request.query(`
      SELECT 
        asc.sic_code,
        sc.description,
        asc.effective_date,
        asc.end_date
      FROM account_sic_code asc
      INNER JOIN sic_code sc ON asc.sic_code = sc.sic_code
      WHERE asc.account_id = @accountId
      ORDER BY asc.effective_date
    `);

    return result.recordset.map(row => ({
      sicCode: row.sic_code,
      description: row.description,
      effectiveDate: row.effective_date,
      endDate: row.end_date
    }));
  } catch (error) {
    fileLogger.error({ err: error }, 'Get account SIC codes error');
    throw error;
  }
}

/**
 * Get deposit accounts for a customer (checking, savings, cd)
 */
export async function getCustomerDepositAccountsSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<Account[]> {
  try {
    fileLogger.debug({ customerId }, 'getCustomerDepositAccountsSqlServer called');
    
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    // Using LOWER for case-insensitive comparison
    const result = await request.query(`
      SELECT DISTINCT a.*
      FROM account a
      INNER JOIN account_ownership ao ON ao.account_id = a.account_id
      WHERE ao.customer_id = @customerId
        AND LOWER(a.account_status) = 'active'
        AND LOWER(a.account_type) IN ('checking', 'deposit checking', 'savings', 'cd')
      ORDER BY a.account_type, a.account_number
    `);

    fileLogger.debug({ customerId, count: result.recordset.length }, 'Found deposit accounts');
    
    return result.recordset.map(mapAccountFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer deposit accounts error');
    throw error;
  }
}

/**
 * Add account owner
 */
export async function addAccountOwnerSqlServer(
  pool: sql.ConnectionPool,
  ownershipData: any
): Promise<any> {
  try {
    const request = pool.request();

    request.input('accountId', sql.BigInt, ownershipData.accountId);
    request.input('customerId', sql.BigInt, ownershipData.customerId);
    request.input('ownershipType', sql.NVarChar, ownershipData.ownershipType);
    request.input('ownershipPercentage', sql.Decimal(5, 2), ownershipData.ownershipPercentage || 100.00);
    request.input('isPrimaryOwner', sql.Bit, ownershipData.isPrimaryOwner || false);
    request.input('signingAuthority', sql.Bit, ownershipData.signingAuthority !== undefined ? ownershipData.signingAuthority : true);
    request.input('canViewStatements', sql.Bit, ownershipData.canViewStatements !== undefined ? ownershipData.canViewStatements : true);
    request.input('canMakeTransactions', sql.Bit, ownershipData.canMakeTransactions !== undefined ? ownershipData.canMakeTransactions : true);
    request.input('transactionLimit', sql.Decimal(15, 2), ownershipData.transactionLimit || null);

    const result = await request.query(`
      INSERT INTO account_ownership (
        account_id, customer_id, ownership_type, ownership_percentage,
        is_primary_owner, signing_authority, can_view_statements,
        can_make_transactions, transaction_limit, relationship_start_date
      )
      OUTPUT INSERTED.*
      VALUES (
        @accountId, @customerId, @ownershipType, @ownershipPercentage,
        @isPrimaryOwner, @signingAuthority, @canViewStatements,
        @canMakeTransactions, @transactionLimit, CAST(GETDATE() AS DATE)
      )
    `);

    return mapAccountOwnershipFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Add account owner error');
    throw error;
  }
}

/**
 * Update account ownership
 */
export async function updateOwnershipSqlServer(
  pool: sql.ConnectionPool,
  ownershipId: number,
  ownershipData: any
): Promise<any | undefined> {
  try {
    const request = pool.request();
    request.input('ownershipId', sql.BigInt, ownershipId);

    const updates: string[] = [];

    if (ownershipData.ownershipType !== undefined) {
      request.input('ownershipType', sql.NVarChar, ownershipData.ownershipType);
      updates.push('ownership_type = @ownershipType');
    }
    if (ownershipData.ownershipPercentage !== undefined) {
      request.input('ownershipPercentage', sql.Decimal(5, 2), ownershipData.ownershipPercentage);
      updates.push('ownership_percentage = @ownershipPercentage');
    }
    if (ownershipData.isPrimaryOwner !== undefined) {
      request.input('isPrimaryOwner', sql.Bit, ownershipData.isPrimaryOwner);
      updates.push('is_primary_owner = @isPrimaryOwner');
    }
    if (ownershipData.signingAuthority !== undefined) {
      request.input('signingAuthority', sql.Bit, ownershipData.signingAuthority);
      updates.push('signing_authority = @signingAuthority');
    }
    if (ownershipData.canViewStatements !== undefined) {
      request.input('canViewStatements', sql.Bit, ownershipData.canViewStatements);
      updates.push('can_view_statements = @canViewStatements');
    }
    if (ownershipData.canMakeTransactions !== undefined) {
      request.input('canMakeTransactions', sql.Bit, ownershipData.canMakeTransactions);
      updates.push('can_make_transactions = @canMakeTransactions');
    }
    if (ownershipData.transactionLimit !== undefined) {
      request.input('transactionLimit', sql.Decimal(15, 2), ownershipData.transactionLimit);
      updates.push('transaction_limit = @transactionLimit');
    }

    if (updates.length === 0) {
      // No updates, just return existing record
      const selectResult = await request.query(`
        SELECT * FROM account_ownership WHERE ownership_id = @ownershipId
      `);
      return selectResult.recordset.length > 0 ? mapAccountOwnershipFromDb(selectResult.recordset[0]) : undefined;
    }

    updates.push('updated_at = GETDATE()');

    const result = await request.query(`
      UPDATE account_ownership
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE ownership_id = @ownershipId
    `);

    if (result.recordset.length === 0) {
      return undefined;
    }

    return mapAccountOwnershipFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Update ownership error');
    throw error;
  }
}

/**
 * Remove account ownership
 */
export async function removeOwnershipSqlServer(
  pool: sql.ConnectionPool,
  ownershipId: number
): Promise<boolean> {
  try {
    const request = pool.request();
    request.input('ownershipId', sql.BigInt, ownershipId);

    const result = await request.query(`
      UPDATE account_ownership
      SET relationship_end_date = CAST(GETDATE() AS DATE), updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE ownership_id = @ownershipId
    `);

    return result.recordset.length > 0;
  } catch (error) {
    fileLogger.error({ err: error }, 'Remove ownership error');
    throw error;
  }
}
