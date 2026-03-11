/**
 * Database Connection Manager
 * MS SQL Server only (on-prem deployment)
 */

import sql from 'mssql';
import logger from './services/logger';

const dbLogger = logger.child({ module: 'database' });

// SQL Server connection
let mssqlPool: sql.ConnectionPool | null = null;

/**
 * Initialize SQL Server connection
 */
async function initSQLServer(): Promise<sql.ConnectionPool> {
  if (mssqlPool && mssqlPool.connected) {
    return mssqlPool;
  }

  const config: sql.config = {
    user: process.env.MSSQL_USER || process.env.DB_USER,
    password: process.env.MSSQL_PASSWORD || process.env.DB_PASSWORD,
    server: process.env.MSSQL_SERVER || process.env.DB_SERVER || 'localhost',
    database: process.env.MSSQL_DATABASE || process.env.DB_NAME || 'ClientIQ',
    options: {
      encrypt: true,
      trustServerCertificate: process.env.NODE_ENV === 'development',
      enableArithAbort: true,
      connectTimeout: 30000,
      requestTimeout: 30000
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  mssqlPool = await new sql.ConnectionPool(config).connect();
  dbLogger.info('SQL Server connection initialized');
  return mssqlPool;
}

/**
 * Get database connection (MS SQL)
 */
export async function getDatabase() {
  const pool = await initSQLServer();
  return { type: 'mssql' as const, db: null, pool };
}

/**
 * Get SQL Server pool
 */
export async function getMssqlPool() {
  return await initSQLServer();
}

/**
 * Close database connections
 */
export async function closeDatabaseConnections() {
  if (mssqlPool) {
    await mssqlPool.close();
    mssqlPool = null;
    dbLogger.info('SQL Server connection closed');
  }
}

// Stubs for backward compatibility — these are never used on the MS SQL path
// but are still imported by storage.ts and routes.ts in their PostgreSQL branches.
export const pool = null;
export const db = null;

export function getPgDatabase(): never {
  throw new Error('getPgDatabase() is not available — this deployment uses MS SQL only');
}
