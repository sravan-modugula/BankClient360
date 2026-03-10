/**
 * Database Connection Manager
 * Supports both PostgreSQL (Neon) and SQL Server (MSSQL)
 */

import { DB_DIALECT, isPostgreSQL, isSQLServer } from './dbConfig';
import { Pool as PgPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as pgDrizzle } from 'drizzle-orm/neon-serverless';
import sql from 'mssql';
import ws from 'ws';
import * as schema from '@shared/schema';
import logger from './services/logger';

const dbLogger = logger.child({ module: 'database' });

// PostgreSQL connection (Neon serverless)
let pgPool: PgPool | null = null;
let pgDb: ReturnType<typeof pgDrizzle> | null = null;

// SQL Server connection
let mssqlPool: sql.ConnectionPool | null = null;

/**
 * Initialize PostgreSQL connection
 */
function initPostgreSQL() {
  if (pgDb) return pgDb;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for PostgreSQL connection');
  }

  neonConfig.webSocketConstructor = ws;
  pgPool = new PgPool({ connectionString: process.env.DATABASE_URL });
  pgDb = pgDrizzle({ client: pgPool, schema });

  dbLogger.info('PostgreSQL connection initialized');
  return pgDb;
}

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
 * Get database connection based on detected dialect
 */
export async function getDatabase() {
  if (isPostgreSQL()) {
    return { type: 'postgresql' as const, db: initPostgreSQL(), pool: null };
  } else {
    const pool = await initSQLServer();
    return { type: 'mssql' as const, db: null, pool };
  }
}

/**
 * Get PostgreSQL Drizzle instance (throws if not PostgreSQL)
 */
export function getPgDatabase() {
  if (!isPostgreSQL()) {
    throw new Error('getPgDatabase() called but database is not PostgreSQL');
  }
  return initPostgreSQL();
}

/**
 * Get SQL Server pool (throws if not SQL Server)
 */
export async function getMssqlPool() {
  if (!isSQLServer()) {
    throw new Error('getMssqlPool() called but database is not SQL Server');
  }
  return await initSQLServer();
}

/**
 * Close all database connections
 */
export async function closeDatabaseConnections() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    pgDb = null;
    dbLogger.info('PostgreSQL connection closed');
  }

  if (mssqlPool) {
    await mssqlPool.close();
    mssqlPool = null;
    dbLogger.info('SQL Server connection closed');
  }
}

// Export for backward compatibility
// Initialize immediately if PostgreSQL
if (isPostgreSQL()) {
  initPostgreSQL();
  
  // Assert that db is initialized
  if (!pgDb) {
    throw new Error('[Database] Failed to initialize PostgreSQL database');
  }
}

// Export pool and db
// Note: db will be null for SQL Server - use getMssqlPool() instead
export const pool = pgPool;
export const db = pgDb;
