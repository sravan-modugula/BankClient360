/**
 * SQL Server Dashboard Operations
 * Dashboard metrics and analytics for MS SQL Server
 */

import sql from 'mssql';
import { CODE_TO_ACTIVITY, createDefaultActivity } from '../../shared/constants';
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
  customerId: number
): Promise<{
  loginId: string;
  lastLoginAt: Date | null;
  thirtyDayActivity: Record<string, number>;
} | null> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    // Get online banking user
    const userResult = await request.query(`
      SELECT 
        login_id,
        last_login_at
      FROM online_banking_user
      WHERE customer_id = @customerId
    `);

    if (userResult.recordset.length === 0) {
      return null;
    }

    const user = userResult.recordset[0];

    // Get 30-day transaction activity by transaction code
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const request2 = pool.request();
    request2.input('customerId', sql.BigInt, customerId);
    request2.input('thirtyDaysAgo', sql.DateTime2, thirtyDaysAgo);

    const activityResult = await request2.query(`
      SELECT 
        ft.transaction_code,
        COUNT(*) as count
      FROM financial_transaction ft
      INNER JOIN account_ownership ao ON ao.account_id = ft.account_id
      WHERE ao.customer_id = @customerId
        AND ft.transaction_date >= @thirtyDaysAgo
        AND ft.transaction_code IS NOT NULL
      GROUP BY ft.transaction_code
    `);

    // Map transaction codes to activity categories
    const activityByCategory: Record<string, number> = createDefaultActivity();

    activityResult.recordset.forEach(row => {
      const code = row.transaction_code;
      const category = CODE_TO_ACTIVITY[code] || 'Other';
      activityByCategory[category] += row.count;
    });

    return {
      loginId: user.login_id,
      lastLoginAt: user.last_login_at,
      thirtyDayActivity: activityByCategory
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
        AND a.account_type IN ('checking', 'savings', 'money_market', 'cd')
    `);

    // Calculate current loans total (using absolute value)
    const request2 = pool.request();
    request2.input('customerId', sql.BigInt, customerId);

    const loanResult = await request2.query(`
      SELECT COALESCE(SUM(ABS(a.balance)), 0) as total
      FROM account a
      INNER JOIN account_ownership ao ON ao.account_id = a.account_id
      WHERE ao.customer_id = @customerId
        AND a.account_type IN ('mortgage', 'heloc', 'auto_loan', 'personal_loan', 'business_loan')
    `);

    const currentDeposits = parseFloat(depositResult.recordset[0].total || '0');
    const currentLoans = parseFloat(loanResult.recordset[0].total || '0');

    // Calculate Q-1 deposits (90 days ago)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const request3 = pool.request();
    request3.input('customerId', sql.BigInt, customerId);
    request3.input('ninetyDaysAgo', sql.DateTime2, ninetyDaysAgo);

    const depositQ1Result = await request3.query(`
      SELECT COALESCE(AVG(ft.ledger_balance_after), 0) as avg_balance
      FROM financial_transaction ft
      INNER JOIN account_ownership ao ON ao.account_id = ft.account_id
      INNER JOIN account a ON a.account_id = ft.account_id
      WHERE ao.customer_id = @customerId
        AND a.account_type IN ('checking', 'savings', 'money_market', 'cd')
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
        AND a.account_type IN ('mortgage', 'heloc', 'auto_loan', 'personal_loan', 'business_loan')
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

/**
 * Get deposit account analytics with trend data
 */
export async function getDepositAccountAnalyticsSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<{
  totalBalance: number;
  accounts: any[];
  balanceByType: { checking: number; savings: number; cd: number };
  trendData: Array<{
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
  }>;
  recentTransactions: Array<{
    accountType: string;
    date: string;
    type: string;
    description: string;
    amount: number;
    balance: number;
  }>;
}> {
  try {
    fileLogger.debug({ customerId }, 'getDepositAccountAnalyticsSqlServer called');
    
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    // Get deposit accounts for customer (using LOWER for case-insensitive comparison)
    const accountsResult = await request.query(`
      SELECT a.*
      FROM account a
      INNER JOIN account_ownership ao ON ao.account_id = a.account_id
      WHERE ao.customer_id = @customerId
        AND LOWER(a.account_status) = 'active'
        AND LOWER(a.account_type) IN ('checking', 'savings', 'money_market', 'cd')
      ORDER BY a.account_type, a.account_number
    `);

    const accounts = accountsResult.recordset;
    const accountIds = accounts.map(a => a.account_id);
    
    fileLogger.debug({ customerId, count: accounts.length, accountIds }, 'Found deposit accounts');

    if (accountIds.length === 0) {
      fileLogger.debug({ customerId }, 'No deposit accounts found, returning empty result');
      return {
        totalBalance: 0,
        accounts: [],
        balanceByType: { checking: 0, savings: 0, cd: 0 },
        trendData: [],
        recentTransactions: []
      };
    }

    // Calculate current balances by type
    let totalBalance = 0;
    const balanceByType = {
      checking: 0,
      savings: 0,
      cd: 0
    };

    accounts.forEach(acc => {
      const balance = parseFloat(acc.balance || '0');
      totalBalance += balance;

      const accType = acc.account_type?.toLowerCase();
      if (accType === 'checking') {
        balanceByType.checking += balance;
      } else if (accType === 'savings' || accType === 'money_market') {
        balanceByType.savings += balance;
      } else if (accType === 'cd') {
        balanceByType.cd += balance;
      }
    });

    // Get 12-month trend data with continuous series
    const request2 = pool.request();
    const accountIdList = accountIds.join(',');

    const trendResult = await request2.query(`
      WITH month_series AS (
        -- Generate 12-month series
        SELECT DATEADD(month, n, DATEADD(month, -11, DATEADD(day, 1-DAY(GETDATE()), GETDATE()))) as month
        FROM (
          SELECT 0 as n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL 
          SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL 
          SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11
        ) numbers
      ),
      account_monthly_balances AS (
        -- Get last transaction per account per month
        SELECT DISTINCT 
          ft.account_id,
          a.account_type,
          DATEADD(day, 1-DAY(ft.transaction_date), ft.transaction_date) as month,
          FIRST_VALUE(ft.ledger_balance_after) OVER (
            PARTITION BY ft.account_id, DATEADD(day, 1-DAY(ft.transaction_date), ft.transaction_date)
            ORDER BY ft.transaction_date DESC, ft.transaction_id DESC
          ) as ledger_balance_after
        FROM financial_transaction ft
        INNER JOIN account a ON a.account_id = ft.account_id
        WHERE ft.account_id IN (${accountIdList})
          AND ft.transaction_date >= DATEADD(month, -12, GETDATE())
      ),
      filled_balances AS (
        -- Carry forward balances for months with no transactions
        SELECT 
          ms.month,
          acc.account_id,
          acc.account_type,
          acc.interest_rate,
          COALESCE(
            amb.ledger_balance_after,
            (
              SELECT TOP 1 amb2.ledger_balance_after
              FROM account_monthly_balances amb2
              WHERE amb2.account_id = acc.account_id
                AND amb2.month < ms.month
              ORDER BY amb2.month DESC
            )
          ) as balance
        FROM month_series ms
        CROSS JOIN (
          SELECT account_id, account_type, interest_rate
          FROM account
          WHERE account_id IN (${accountIdList})
        ) acc
        LEFT JOIN account_monthly_balances amb 
          ON amb.account_id = acc.account_id 
          AND amb.month = ms.month
      )
      -- Aggregate by month and account type
      SELECT 
        month,
        account_type,
        SUM(COALESCE(balance, 0)) as balance,
        SUM(COALESCE(balance, 0) * CASE 
          WHEN COALESCE(interest_rate, 0) <= 1 THEN COALESCE(interest_rate, 0) * 100
          ELSE COALESCE(interest_rate, 0)
        END) as weighted_balance_sum,
        SUM(COALESCE(balance, 0)) as total_balance_for_weighted
      FROM filled_balances
      GROUP BY month, account_type
      ORDER BY month ASC, account_type
    `);

    // Build continuous 12-month trend data
    const monthMap = new Map();
    
    // Initialize all 12 months
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      monthDate.setDate(1);
      monthDate.setHours(0, 0, 0, 0);
      
      const monthKey = monthDate.toISOString().substring(0, 7);
      const monthLabel = monthDate.toLocaleString('default', { month: 'short', year: '2-digit' });
      
      monthMap.set(monthKey, {
        month: monthLabel,
        date: monthDate.toISOString(),
        balance: 0,
        checking: 0,
        savings: 0,
        cd: 0,
        weightedBalanceSum: 0,
        totalBalanceForWeighted: 0,
        weightedBalanceSumChecking: 0,
        totalBalanceForWeightedChecking: 0,
        weightedBalanceSumSavings: 0,
        totalBalanceForWeightedSavings: 0,
        weightedBalanceSumCD: 0,
        totalBalanceForWeightedCD: 0
      });
    }

    // Fill in actual data from query
    trendResult.recordset.forEach(row => {
      const monthDate = new Date(row.month);
      const monthKey = monthDate.toISOString().substring(0, 7);
      const data = monthMap.get(monthKey);
      
      if (data) {
        const accountType = row.account_type;
        const balance = parseFloat(row.balance) || 0;
        const weightedBalanceSum = parseFloat(row.weighted_balance_sum) || 0;
        const totalBalanceForWeighted = parseFloat(row.total_balance_for_weighted) || 0;
        
        if (accountType === 'checking') {
          data.checking += balance;
          data.weightedBalanceSumChecking += weightedBalanceSum;
          data.totalBalanceForWeightedChecking += totalBalanceForWeighted;
        } else if (accountType === 'savings' || accountType === 'money_market') {
          data.savings += balance;
          data.weightedBalanceSumSavings += weightedBalanceSum;
          data.totalBalanceForWeightedSavings += totalBalanceForWeighted;
        } else if (accountType === 'cd') {
          data.cd += balance;
          data.weightedBalanceSumCD += weightedBalanceSum;
          data.totalBalanceForWeightedCD += totalBalanceForWeighted;
        }
        
        data.balance = data.checking + data.savings + data.cd;
        data.weightedBalanceSum += weightedBalanceSum;
        data.totalBalanceForWeighted += totalBalanceForWeighted;
      }
    });

    // Calculate weighted averages
    const trendData = Array.from(monthMap.values()).map(monthData => {
      const weightedAverage = monthData.totalBalanceForWeighted > 0 
        ? monthData.weightedBalanceSum / monthData.totalBalanceForWeighted
        : 0;
      
      const weightedAvgChecking = monthData.totalBalanceForWeightedChecking > 0
        ? monthData.weightedBalanceSumChecking / monthData.totalBalanceForWeightedChecking
        : 0;
      
      const weightedAvgSavings = monthData.totalBalanceForWeightedSavings > 0
        ? monthData.weightedBalanceSumSavings / monthData.totalBalanceForWeightedSavings
        : 0;
      
      const weightedAvgCD = monthData.totalBalanceForWeightedCD > 0
        ? monthData.weightedBalanceSumCD / monthData.totalBalanceForWeightedCD
        : 0;
      
      return {
        month: monthData.month,
        date: monthData.date,
        balance: monthData.balance,
        checking: monthData.checking,
        savings: monthData.savings,
        cd: monthData.cd,
        weightedAverage,
        weightedAvgChecking,
        weightedAvgSavings,
        weightedAvgCD
      };
    });

    // Get recent transactions
    const request3 = pool.request();
    const transactionsResult = await request3.query(`
      SELECT TOP 5
        a.account_type,
        ft.transaction_date,
        ft.transaction_code,
        ft.description,
        ft.amount,
        ft.ledger_balance_after
      FROM financial_transaction ft
      INNER JOIN account a ON a.account_id = ft.account_id
      WHERE ft.account_id IN (${accountIdList})
      ORDER BY ft.transaction_date DESC, ft.transaction_id DESC
    `);

    const recentTransactions = transactionsResult.recordset.map(t => ({
      accountType: t.account_type,
      date: t.transaction_date.toISOString(),
      type: t.transaction_code || 'Transaction',
      description: t.description || 'Transaction',
      amount: parseFloat(t.amount),
      balance: parseFloat(t.ledger_balance_after)
    }));

    return {
      totalBalance,
      accounts,
      balanceByType,
      trendData,
      recentTransactions
    };
  } catch (error) {
    fileLogger.error({ err: error }, 'Get deposit analytics error');
    throw error;
  }
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
        SELECT current_ledger_balance FROM account WHERE account_id = @acctId
      `);
      const currentBal = Number(acctResult.recordset?.[0]?.current_ledger_balance) || 0;
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
}>> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);
    request.input('limit', sql.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        contact_type,
        occurred_at,
        employee_name
      FROM contact_history
      WHERE customer_id = @customerId
      ORDER BY occurred_at DESC
    `);

    return result.recordset.map(row => ({
      contactType: row.contact_type,
      occurredAt: row.occurred_at,
      employeeName: row.employee_name || 'Unknown Employee'
    }));
  } catch (error) {
    fileLogger.error({ err: error }, 'Get contact history error');
    throw error;
  }
}
