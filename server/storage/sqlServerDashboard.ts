/**
 * SQL Server Dashboard Operations
 * Dashboard metrics and analytics for MS SQL Server
 */

import sql from 'mssql';
import {
  GROUP_CODE_TO_ACTIVITY,
  createDefaultActivity,
  activityFromTransactionType,
} from '../../shared/constants';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-dashboard' });

/**
 * Get customer officers with full employee details
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
      INNER JOIN employee e ON coa.officer_code = e.officer_code
      WHERE coa.customer_id = @customerId
        AND e.officer_code IS NOT NULL
        AND e.is_active = 1
      ORDER BY 
        CASE WHEN coa.relationship_type = 'primary' THEN 0 ELSE 1 END,
        e.last_name, e.first_name
    `);

    return result.recordset.map(row => ({
      officerCode: row.officer_code,
      firstName: row.first_name,
      lastName: row.last_name,
      title: row.title,
      department: row.department,
      relationshipType: row.relationship_type,
      assignedAt: row.assigned_at
    }));
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer officers error');
    throw error;
  }
}

/**
 * Get client engagement metrics
 */
export async function getClientEngagementSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  days: 30 | 60 | 90,
): Promise<{
  loginId: string | null;
  lastLoginAt: Date | null;
  days: 30 | 60 | 90;
  activity: Record<string, number>;
}> {
  try {
    // Get online banking user (optional — on-prem may not have a row)
    const userRequest = pool.request();
    userRequest.input('customerId', sql.BigInt, customerId);

    const userResult = await userRequest.query(`
      SELECT
        login_id,
        last_login_at
      FROM online_banking_user
      WHERE customer_id = @customerId
    `);

    const user = userResult.recordset[0];

    // Get rolling-window transaction activity grouped by transaction_category.group_code.
    // Snap to start-of-day so a transaction posted at 00:00 on the cutoff day
    // is inside the window — without this, the boundary is the current time of
    // day, which silently excludes midnight-stamped rows on the final day.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const activityRequest = pool.request();
    activityRequest.input('customerId', sql.BigInt, customerId);
    activityRequest.input('cutoff', sql.DateTime2, cutoff);

    // LEFT JOIN transaction_category so transactions without a category row
    // (or without category_id set) are still counted — on-prem datasets often
    // populate ft.transaction_type but leave the category linkage empty.
    const activityResult = await activityRequest.query(`
      SELECT
        tc.group_code,
        ft.transaction_type,
        ft.transaction_code,
        COUNT(*) as count
      FROM financial_transaction ft
      INNER JOIN account_ownership ao ON ao.account_id = ft.account_id
      LEFT JOIN transaction_category tc ON tc.category_id = ft.category_id
      WHERE ao.customer_id = @customerId
        AND ft.transaction_date >= @cutoff
      GROUP BY tc.group_code, ft.transaction_type, ft.transaction_code
    `);

    const activityByCategory = createDefaultActivity();

    // Build a case- and separator-insensitive lookup so DB rows like
    // 'ACH', 'ach', 'Cash Withdrawal', 'cash_withdrawal', or
    // 'CASH-WITHDRAWAL' all resolve to the correct activity key.
    const normalizeKey = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, '_');
    const groupCodeLookup = Object.fromEntries(
      Object.entries(GROUP_CODE_TO_ACTIVITY).map(([k, v]) => [normalizeKey(k), v])
    );

    const seenGroupCodes: string[] = [];
    const unmappedSamples: string[] = [];
    let unmappedCount = 0;
    activityResult.recordset.forEach(row => {
      const count = Number(row.count) || 0;
      const groupCode = (row.group_code || '').toString().trim();
      const txType = (row.transaction_type || '').toString().trim();
      const txCode = (row.transaction_code || '').toString().trim();

      if (groupCode) seenGroupCodes.push(groupCode);

      // 1) Prefer category group_code when present and known.
      const groupKey = groupCode ? groupCodeLookup[normalizeKey(groupCode)] : undefined;
      if (groupKey) {
        activityByCategory[groupKey] += count;
        return;
      }

      // 2) Fall back to transaction_type, then transaction_code.
      const fallback = activityFromTransactionType(txType) || activityFromTransactionType(txCode);
      if (fallback) {
        activityByCategory[fallback] += count;
        return;
      }

      unmappedCount += count;
      const sample = txType || txCode || groupCode;
      if (sample && unmappedSamples.length < 10 && !unmappedSamples.includes(sample)) {
        unmappedSamples.push(sample);
      }
    });

    fileLogger.info(
      { customerId, days, rows: activityResult.recordset.length, unmappedCount, unmappedSamples, seenGroupCodes, activityByCategory },
      `Client engagement ${days}-day activity computed`,
    );

    return {
      loginId: user?.login_id ?? null,
      lastLoginAt: user?.last_login_at ?? null,
      days,
      activity: activityByCategory,
    };
  } catch (error) {
    fileLogger.error({ err: error }, 'Get client engagement error');
    throw error;
  }
}

/**
 * Get relationship summary metrics
 */
export async function getRelationshipSummarySqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<{
  totalDeposits: number;
  totalLoans: number;
  depositsQoQ: {
    amountChange: number;
    percentChange: number;
  };
  loansQoQ: {
    amountChange: number;
    percentChange: number;
  };
}> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    // Calculate current deposits total
    const depositResult = await request.query(`
      SELECT COALESCE(SUM(a.balance), 0) as total
      FROM account a
      INNER JOIN account_ownership ao ON ao.account_id = a.account_id
      WHERE ao.customer_id = @customerId
        AND LOWER(a.account_type) IN ('checking', 'deposit checking', 'savings', 'money_market', 'cd', 'time deposit', 'christmas club depo')
    `);

    // Calculate current loans total (using absolute value)
    const request2 = pool.request();
    request2.input('customerId', sql.BigInt, customerId);

    const loanResult = await request2.query(`
      SELECT COALESCE(SUM(ABS(a.balance)), 0) as total
      FROM account a
      INNER JOIN account_ownership ao ON ao.account_id = a.account_id
      WHERE ao.customer_id = @customerId
        AND LOWER(a.account_type) IN ('loan', 'mortgage', 'heloc', 'auto_loan', 'personal_loan', 'business_loan')
    `);

    const currentDeposits = parseFloat(depositResult.recordset[0].total || '0');
    const currentLoans = parseFloat(loanResult.recordset[0].total || '0');

    // Calculate Q-1 deposits (90 days ago). Snap to start-of-day so the
    // window boundary doesn't silently drop midnight-stamped rows.
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    const request3 = pool.request();
    request3.input('customerId', sql.BigInt, customerId);
    request3.input('ninetyDaysAgo', sql.DateTime2, ninetyDaysAgo);

    const depositQ1Result = await request3.query(`
      SELECT COALESCE(AVG(ft.ledger_balance_after), 0) as avg_balance
      FROM financial_transaction ft
      INNER JOIN account_ownership ao ON ao.account_id = ft.account_id
      INNER JOIN account a ON a.account_id = ft.account_id
      WHERE ao.customer_id = @customerId
        AND LOWER(a.account_type) IN ('checking', 'deposit checking', 'savings', 'money_market', 'cd', 'time deposit', 'christmas club depo')
        AND ft.transaction_date >= @ninetyDaysAgo
        AND ft.ledger_balance_after IS NOT NULL
    `);

    const request4 = pool.request();
    request4.input('customerId', sql.BigInt, customerId);
    request4.input('ninetyDaysAgo', sql.DateTime2, ninetyDaysAgo);

    const loanQ1Result = await request4.query(`
      SELECT COALESCE(AVG(ABS(ft.ledger_balance_after)), 0) as avg_balance
      FROM financial_transaction ft
      INNER JOIN account_ownership ao ON ao.account_id = ft.account_id
      INNER JOIN account a ON a.account_id = ft.account_id
      WHERE ao.customer_id = @customerId
        AND LOWER(a.account_type) IN ('loan', 'mortgage', 'heloc', 'auto_loan', 'personal_loan', 'business_loan')
        AND ft.transaction_date >= @ninetyDaysAgo
        AND ft.ledger_balance_after IS NOT NULL
    `);

    const previousDeposits = parseFloat(depositQ1Result.recordset[0].avg_balance || '0');
    const previousLoans = parseFloat(loanQ1Result.recordset[0].avg_balance || '0');

    // Calculate QoQ changes
    const depositChange = currentDeposits - previousDeposits;
    const depositPercent = previousDeposits > 0 
      ? (depositChange / previousDeposits) * 100 
      : 0;

    const loanChange = currentLoans - previousLoans;
    const loanPercent = previousLoans > 0 
      ? (loanChange / previousLoans) * 100 
      : 0;

    return {
      totalDeposits: currentDeposits,
      totalLoans: currentLoans,
      depositsQoQ: {
        amountChange: depositChange,
        percentChange: depositPercent
      },
      loansQoQ: {
        amountChange: loanChange,
        percentChange: loanPercent
      }
    };
  } catch (error) {
    fileLogger.error({ err: error }, 'Get relationship summary error');
    throw error;
  }
}

// Deposit account-type filter used by every deposit endpoint. Keep in sync
// with the Postgres path in storage.ts so both DB paths see the same accounts.
const DEPOSIT_ACCOUNT_TYPES_SQL = `
  'checking', 'deposit checking', 'savings', 'money_market',
  'cd', 'time deposit', 'christmas club depo'
`;

// Subquery that resolves a customer's active deposit account ids via
// account_ownership. Parameterized through @customerId so the optimizer can
// reuse plans across customers and avoid the 3 KB IN-list problem we hit at
// 167 accounts.
const DEPOSIT_ACCOUNTS_SUBQUERY = `
  SELECT a.account_id, a.account_type, a.interest_rate, a.balance
  FROM account a
  INNER JOIN account_ownership ao ON ao.account_id = a.account_id
  WHERE ao.customer_id = @customerId
    AND LOWER(a.account_status) = 'active'
    AND LOWER(a.account_type) IN (${DEPOSIT_ACCOUNT_TYPES_SQL})
`;

function bucketAccountType(accType: string | null | undefined): 'checking' | 'savings' | 'cd' | null {
  const t = accType?.toLowerCase();
  if (t === 'checking' || t === 'deposit checking') return 'checking';
  if (t === 'savings' || t === 'money_market' || t === 'christmas club depo') return 'savings';
  if (t === 'cd' || t === 'time deposit') return 'cd';
  return null;
}

export interface DepositSummary {
  totalBalance: number;
  accounts: any[];
  balanceByType: { checking: number; savings: number; cd: number };
}

export interface DepositTrendPoint {
  month: string;
  date: string;
  balance: number;
  checking: number;
  savings: number;
  cd: number;
  weightedAverage: number;
  weightedAvgChecking: number;
  weightedAvgSavings: number;
  weightedAvgCD: number;
}

export interface DepositRecentTransaction {
  accountType: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  balance: number;
}

/**
 * Deposit summary — totals + balanceByType, plus the raw account rows so
 * downstream code can use them for follow-up queries. Pure SUM over the
 * customer's active deposit accounts; sub-second even for 1000+ accounts.
 */
export async function getDepositSummarySqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
): Promise<DepositSummary> {
  try {
    const start = Date.now();
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    const result = await request.query(`
      SELECT a.*
      FROM account a
      INNER JOIN account_ownership ao ON ao.account_id = a.account_id
      WHERE ao.customer_id = @customerId
        AND LOWER(a.account_status) = 'active'
        and (ao.ownership_type = 'Primary account owner' or ao.ownership_type = 'primary')
        AND LOWER(a.account_type) IN (${DEPOSIT_ACCOUNT_TYPES_SQL})
      ORDER BY a.account_type, a.account_number
    `);

    const accounts = result.recordset;
    let totalBalance = 0;
    const balanceByType = { checking: 0, savings: 0, cd: 0 };

    accounts.forEach(acc => {
      const balance = parseFloat(acc.balance || '0');
      totalBalance += balance;
      const bucket = bucketAccountType(acc.account_type);
      if (bucket) balanceByType[bucket] += balance;
    });

    fileLogger.info(
      { customerId, accountCount: accounts.length, durationMs: Date.now() - start },
      'Deposit summary computed',
    );

    return { totalBalance, accounts, balanceByType };
  } catch (error) {
    fileLogger.error({ err: error, customerId }, 'Deposit summary error');
    throw error;
  }
}

/**
 * Deposit trend — N-month time series of ending balances per account type,
 * with weighted-by-interest-rate averages. Set-based ROW_NUMBER picks the
 * last ledger balance per (account, month); carry-forward across months is
 * done in TypeScript so we avoid the per-cell correlated subquery that
 * blew up the previous implementation at 167 accounts.
 */
export async function getDepositTrendSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  months: number = 12,
): Promise<DepositTrendPoint[]> {
  try {
    const start = Date.now();
    const monthCount = Math.max(1, Math.min(12, Math.floor(months)));
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);
    request.input('months', sql.Int, monthCount);

    // One row per (account, month) with that month's last ledger balance.
    // Plus current account metadata (interest_rate, account_type, balance)
    // so we don't need a second query. Months are emitted as the first of
    // the month so the JS side can group them deterministically.
    const result = await request.query(`
      WITH customer_accounts AS (
        ${DEPOSIT_ACCOUNTS_SUBQUERY}
      ),
      monthly_endings AS (
        SELECT
          ft.account_id,
          DATEFROMPARTS(YEAR(ft.transaction_date), MONTH(ft.transaction_date), 1) AS month,
          ft.ledger_balance_after,
          ROW_NUMBER() OVER (
            PARTITION BY ft.account_id,
              DATEFROMPARTS(YEAR(ft.transaction_date), MONTH(ft.transaction_date), 1)
            ORDER BY ft.transaction_date DESC, ft.transaction_id DESC
          ) AS rn
        FROM financial_transaction ft
        WHERE ft.account_id IN (SELECT account_id FROM customer_accounts)
          AND ft.transaction_date >= DATEADD(month, -@months, GETDATE())
      )
      SELECT
        ca.account_id,
        ca.account_type,
        ca.interest_rate,
        ca.balance AS current_balance,
        me.month,
        me.ledger_balance_after
      FROM customer_accounts ca
      LEFT JOIN monthly_endings me
        ON me.account_id = ca.account_id AND me.rn = 1
      ORDER BY ca.account_id, me.month;
    `);

    // Build the month axis (oldest first).
    const monthKeys: string[] = [];
    const monthLabels: Array<{ key: string; month: string; date: string }> = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().substring(0, 7);
      monthKeys.push(key);
      monthLabels.push({
        key,
        month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
        date: d.toISOString(),
      });
    }
    const monthIndex = new Map(monthKeys.map((k, i) => [k, i]));

    // Group rows by account, then carry-forward ledger_balance_after across
    // months that have no transactions (matches the previous semantics).
    interface AcctRow {
      accountType: string | null;
      interestRate: number;
      currentBalance: number;
      byMonth: Map<string, number>;
    }
    const byAccount = new Map<string, AcctRow>();

    for (const row of result.recordset) {
      const acctId = String(row.account_id);
      let acct = byAccount.get(acctId);
      if (!acct) {
        const rawRate = parseFloat(row.interest_rate ?? '0') || 0;
        acct = {
          accountType: row.account_type,
          // Normalize 0–1 decimals to percent so display math is consistent.
          interestRate: rawRate <= 1 ? rawRate * 100 : rawRate,
          currentBalance: parseFloat(row.current_balance ?? '0') || 0,
          byMonth: new Map(),
        };
        byAccount.set(acctId, acct);
      }
      if (row.month) {
        const key = new Date(row.month).toISOString().substring(0, 7);
        if (monthIndex.has(key)) {
          acct.byMonth.set(key, parseFloat(row.ledger_balance_after ?? '0') || 0);
        }
      }
    }

    // For each account, walk months oldest→newest carrying forward the last
    // seen balance; fall back to the account's current balance for trailing
    // months still unset (i.e. no transactions during the whole window).
    const points: DepositTrendPoint[] = monthLabels.map(({ key, month, date }) => ({
      month, date,
      balance: 0, checking: 0, savings: 0, cd: 0,
      weightedAverage: 0, weightedAvgChecking: 0, weightedAvgSavings: 0, weightedAvgCD: 0,
    }));

    // Track weighted sums so we can divide at the end.
    const wbsTotal = new Array(monthCount).fill(0);
    const tbwTotal = new Array(monthCount).fill(0);
    const wbsByBucket = { checking: new Array(monthCount).fill(0), savings: new Array(monthCount).fill(0), cd: new Array(monthCount).fill(0) };
    const tbwByBucket = { checking: new Array(monthCount).fill(0), savings: new Array(monthCount).fill(0), cd: new Array(monthCount).fill(0) };

    for (const acct of Array.from(byAccount.values())) {
      const bucket = bucketAccountType(acct.accountType);
      if (!bucket) continue;

      let lastSeen: number | null = null;
      for (let i = 0; i < monthCount; i++) {
        const key = monthKeys[i];
        const v = acct.byMonth.get(key);
        if (v !== undefined) lastSeen = v;
        const bal = lastSeen ?? acct.currentBalance;

        points[i][bucket] += bal;
        const w = bal * acct.interestRate;
        wbsTotal[i] += w;
        tbwTotal[i] += bal;
        wbsByBucket[bucket][i] += w;
        tbwByBucket[bucket][i] += bal;
      }
    }

    for (let i = 0; i < monthCount; i++) {
      const p = points[i];
      p.balance = p.checking + p.savings + p.cd;
      p.weightedAverage = tbwTotal[i] > 0 ? wbsTotal[i] / tbwTotal[i] : 0;
      p.weightedAvgChecking = tbwByBucket.checking[i] > 0 ? wbsByBucket.checking[i] / tbwByBucket.checking[i] : 0;
      p.weightedAvgSavings = tbwByBucket.savings[i] > 0 ? wbsByBucket.savings[i] / tbwByBucket.savings[i] : 0;
      p.weightedAvgCD = tbwByBucket.cd[i] > 0 ? wbsByBucket.cd[i] / tbwByBucket.cd[i] : 0;
    }

    fileLogger.info(
      { customerId, months: monthCount, accounts: byAccount.size, rows: result.recordset.length, durationMs: Date.now() - start },
      'Deposit trend computed',
    );

    return points;
  } catch (error) {
    fileLogger.error({ err: error, customerId }, 'Deposit trend error');
    throw error;
  }
}

/**
 * Most recent N transactions across a customer's deposit accounts. Scoped
 * via account_ownership subquery (not a string-interpolated IN list) so the
 * optimizer can use IX_account_ownership_customer.
 */
export async function getDepositRecentTransactionsSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  limit: number = 5,
): Promise<DepositRecentTransaction[]> {
  try {
    const start = Date.now();
    const cappedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);
    request.input('limit', sql.Int, cappedLimit);

    const result = await request.query(`
      SELECT TOP (@limit)
        a.account_type,
        ft.transaction_date,
        ft.transaction_code,
        ft.description,
        ft.amount,
        ft.ledger_balance_after
      FROM financial_transaction ft
      INNER JOIN account a ON a.account_id = ft.account_id
      INNER JOIN account_ownership ao ON ao.account_id = ft.account_id
      WHERE ao.customer_id = @customerId
        AND LOWER(a.account_status) = 'active'
        AND LOWER(a.account_type) IN (${DEPOSIT_ACCOUNT_TYPES_SQL})
        AND ft.transaction_date IS NOT NULL
      ORDER BY ft.transaction_date DESC, ft.transaction_id DESC
    `);

    const txns: DepositRecentTransaction[] = result.recordset.map(t => ({
      accountType: t.account_type,
      date: t.transaction_date ? new Date(t.transaction_date).toISOString() : new Date().toISOString(),
      type: t.transaction_code || 'Transaction',
      description: t.description || 'Transaction',
      amount: parseFloat(t.amount) || 0,
      balance: parseFloat(t.ledger_balance_after) || 0,
    }));

    fileLogger.info(
      { customerId, limit: cappedLimit, returned: txns.length, durationMs: Date.now() - start },
      'Deposit recent transactions computed',
    );

    return txns;
  } catch (error) {
    fileLogger.error({ err: error, customerId }, 'Deposit recent transactions error');
    throw error;
  }
}

/**
 * Backward-compat shim: fan out the three new endpoints in parallel and
 * return the combined payload in the legacy shape. Existing callers of
 * /api/customers/:id/deposit-analytics keep working until they migrate.
 */
export async function getDepositAccountAnalyticsSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
): Promise<DepositSummary & {
  trendData: DepositTrendPoint[];
  recentTransactions: DepositRecentTransaction[];
}> {
  const [summary, trendData, recentTransactions] = await Promise.all([
    getDepositSummarySqlServer(pool, customerId),
    getDepositTrendSqlServer(pool, customerId),
    getDepositRecentTransactionsSqlServer(pool, customerId),
  ]);
  return { ...summary, trendData, recentTransactions };
}

/**
 * Get 12-month balance history for a single account
 */
export async function getAccountBalanceHistorySqlServer(
  pool: sql.ConnectionPool,
  accountId: number
): Promise<Array<{ month: string; date: string; balance: number }>> {
  try {
    const request = pool.request();
    request.input('accountId', sql.BigInt, accountId);

    const result = await request.query(`
      WITH month_series AS (
        SELECT DATEADD(month, n, DATEADD(month, -11, DATEADD(day, 1-DAY(GETDATE()), GETDATE()))) as month
        FROM (
          SELECT 0 as n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
          SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL
          SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
        ) numbers
      ),
      account_monthly_balances AS (
        SELECT DISTINCT
          ft.account_id,
          DATEADD(day, 1-DAY(ft.transaction_date), ft.transaction_date) as month,
          FIRST_VALUE(ft.ledger_balance_after) OVER (
            PARTITION BY ft.account_id, DATEADD(day, 1-DAY(ft.transaction_date), ft.transaction_date)
            ORDER BY ft.transaction_date DESC, ft.transaction_id DESC
          ) as ledger_balance_after
        FROM financial_transaction ft
        WHERE ft.account_id = @accountId
          AND ft.transaction_date >= DATEADD(month, -12, GETDATE())
      ),
      filled_balances AS (
        SELECT
          ms.month,
          COALESCE(
            amb.ledger_balance_after,
            (
              SELECT TOP 1 amb2.ledger_balance_after
              FROM account_monthly_balances amb2
              WHERE amb2.month < ms.month
              ORDER BY amb2.month DESC
            )
          ) as balance
        FROM month_series ms
        LEFT JOIN account_monthly_balances amb
          ON amb.month = ms.month
      )
      SELECT
        month,
        COALESCE(balance, 0) as balance
      FROM filled_balances
      ORDER BY month ASC
    `);

    const trendData = result.recordset.map((row: any) => {
      const monthDate = new Date(row.month);
      return {
        month: monthDate.toLocaleString('default', { month: 'short', year: '2-digit' }),
        date: monthDate.toISOString(),
        balance: Number(row.balance) || 0
      };
    });

    // If all balances are 0, fall back to the account's current balance for the latest month
    if (trendData.length > 0 && trendData.every(d => d.balance === 0)) {
      const acctRequest = pool.request();
      acctRequest.input('acctId', sql.BigInt, accountId);
      const acctResult = await acctRequest.query(`
        SELECT balance FROM account WHERE account_id = @acctId
      `);
      const currentBal = Number(acctResult.recordset?.[0]?.balance) || 0;
      if (currentBal !== 0) {
        trendData[trendData.length - 1].balance = currentBal;
      }
    }

    return trendData;
  } catch (error) {
    fileLogger.error({ err: error }, 'Get account balance history error');
    throw error;
  }
}

/**
 * Get contact history
 */
export async function getContactHistorySqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  limit: number = 5
): Promise<Array<{
  contactType: string;
  occurredAt: Date;
  employeeName: string;
  contactDescription: string | null;
}>> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);
    request.input('limit', sql.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        contact_type,
        created_at as occurred_at,
        employee_name,
        summary
      FROM contact_history
      WHERE customer_id = @customerId
      ORDER BY occurred_at DESC
    `);

    return result.recordset.map(row => ({
      contactType: row.contact_type,
      occurredAt: row.occurred_at,
      employeeName: row.employee_name || 'Unknown Employee',
      contactDescription: row.summary || null
    }));
  } catch (error) {
    fileLogger.error({ err: error }, 'Get contact history error');
    throw error;
  }
}
