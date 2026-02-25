/**
 * Database configuration and dialect detection
 * Supports both PostgreSQL and SQL Server
 */

export type DatabaseDialect = 'postgresql' | 'mssql';

/**
 * Detect database dialect from environment variables
 */
export function detectDatabaseDialect(): DatabaseDialect {
  const databaseUrl = process.env.DATABASE_URL || '';
  const explicitDialect = process.env.DATABASE_DIALECT?.toLowerCase();

  // Explicit configuration takes precedence
  if (explicitDialect === 'mssql' || explicitDialect === 'sqlserver') {
    return 'mssql';
  }
  if (explicitDialect === 'postgresql' || explicitDialect === 'postgres' || explicitDialect === 'pg') {
    return 'postgresql';
  }

  // Auto-detect from connection string
  if (databaseUrl.includes('Server=') || databaseUrl.startsWith('mssql://') || databaseUrl.includes('sqlserver://')) {
    return 'mssql';
  }

  // Default to PostgreSQL (current production setup)
  return 'postgresql';
}

/**
 * Get the current database dialect
 */
export const DB_DIALECT = detectDatabaseDialect();

/**
 * Check if currently using PostgreSQL
 */
export const isPostgreSQL = () => DB_DIALECT === 'postgresql';

/**
 * Check if currently using SQL Server
 */
export const isSQLServer = () => DB_DIALECT === 'mssql';

console.log(`[Database] Detected dialect: ${DB_DIALECT}`);
