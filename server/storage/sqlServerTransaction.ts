/**
 * SQL Server Transaction Operations
 * Read-only transaction history for MS SQL Server
 */

import sql from 'mssql';
import type { FinancialTransaction } from '@shared/schema';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-transaction' });

/**
 * Get transactions with filters
 */
export async function getTransactionsSqlServer(
  pool: sql.ConnectionPool,
  params: {
    accountId?: number;
    customerId?: number;
    startDate?: Date;
    endDate?: Date;
    transactionType?: string;
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    offset?: number;
  }
): Promise<FinancialTransaction[]> {
  try {
    const request = pool.request();
    const conditions: string[] = [];

    if (params.accountId !== undefined) {
      request.input('accountId', sql.BigInt, params.accountId);
      conditions.push('ft.account_id = @accountId');
    }

    if (params.customerId !== undefined) {
      request.input('customerId', sql.BigInt, params.customerId);
      conditions.push(`ft.account_id IN (
        SELECT account_id FROM account_ownership WHERE customer_id = @customerId
      )`);
    }

    if (params.startDate) {
      request.input('startDate', sql.DateTime2, params.startDate);
      conditions.push('ft.transaction_date >= @startDate');
    }

    if (params.endDate) {
      request.input('endDate', sql.DateTime2, params.endDate);
      conditions.push('ft.transaction_date <= @endDate');
    }

    if (params.transactionType) {
      request.input('transactionType', sql.NVarChar, params.transactionType);
      conditions.push('ft.transaction_type = @transactionType');
    }

    if (params.minAmount !== undefined) {
      request.input('minAmount', sql.Decimal(18, 2), params.minAmount);
      conditions.push('ft.amount >= @minAmount');
    }

    if (params.maxAmount !== undefined) {
      request.input('maxAmount', sql.Decimal(18, 2), params.maxAmount);
      conditions.push('ft.amount <= @maxAmount');
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    request.input('limit', sql.Int, params.limit || 100);
    request.input('offset', sql.Int, params.offset || 0);

    const result = await request.query(`
      SELECT ft.*
      FROM financial_transaction ft
      ${whereClause}
      ORDER BY ft.transaction_date DESC, ft.transaction_id DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    return result.recordset.map(mapTransactionFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get transactions error');
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
  return await getTransactionsSqlServer(pool, { accountId, limit });
}

/**
 * Get transaction count
 */
export async function getTransactionCountSqlServer(
  pool: sql.ConnectionPool,
  params: {
    accountId?: number;
    customerId?: number;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<number> {
  try {
    const request = pool.request();
    const conditions: string[] = [];

    if (params.accountId !== undefined) {
      request.input('accountId', sql.BigInt, params.accountId);
      conditions.push('ft.account_id = @accountId');
    }

    if (params.customerId !== undefined) {
      request.input('customerId', sql.BigInt, params.customerId);
      conditions.push(`ft.account_id IN (
        SELECT account_id FROM account_ownership WHERE customer_id = @customerId
      )`);
    }

    if (params.startDate) {
      request.input('startDate', sql.DateTime2, params.startDate);
      conditions.push('ft.transaction_date >= @startDate');
    }

    if (params.endDate) {
      request.input('endDate', sql.DateTime2, params.endDate);
      conditions.push('ft.transaction_date <= @endDate');
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await request.query(`
      SELECT COUNT(*) as total
      FROM financial_transaction ft
      ${whereClause}
    `);

    return result.recordset[0].total || 0;
  } catch (error) {
    fileLogger.error({ err: error }, 'Get transaction count error');
    throw error;
  }
}

/**
 * Get transactions by account ID
 */
export async function getTransactionsByAccountSqlServer(
  pool: sql.ConnectionPool,
  accountId: number,
  limit: number = 100,
  offset: number = 0
): Promise<FinancialTransaction[]> {
  return await getTransactionsSqlServer(pool, { accountId, limit, offset });
}

/**
 * Get transactions by customer ID
 */
export async function getTransactionsByCustomerSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  limit: number = 100,
  offset: number = 0
): Promise<FinancialTransaction[]> {
  return await getTransactionsSqlServer(pool, { customerId, limit, offset });
}

/**
 * Get all transaction categories
 */
export async function getTransactionCategoriesSqlServer(
  pool: sql.ConnectionPool
): Promise<Array<{ categoryId: number; categoryName: string; description: string | null }>> {
  try {
    const request = pool.request();

    const result = await request.query(`
      SELECT 
        category_id,
        category_name,
        description
      FROM transaction_category
      ORDER BY category_id
    `);

    return result.recordset.map(row => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      description: row.description
    }));
  } catch (error) {
    fileLogger.error({ err: error }, 'Get transaction categories error');
    throw error;
  }
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