/**
 * Database-agnostic query helpers
 * Provides cross-database compatible query functions
 */

import { sql, SQL } from 'drizzle-orm';
import { DB_DIALECT } from './dbConfig';

/**
 * Case-insensitive LIKE comparison
 * PostgreSQL: ILIKE
 * SQL Server: LIKE with COLLATE on column
 */
export function caseInsensitiveLike(column: any, pattern: string): SQL {
  if (DB_DIALECT === 'postgresql') {
    // PostgreSQL has native ILIKE
    return sql`${column} ILIKE ${pattern}`;
  } else {
    // SQL Server: Collation must be on the column, not after pattern
    return sql`${column} COLLATE Latin1_General_CI_AS LIKE ${pattern}`;
  }
}

/**
 * Helper to create LIKE pattern with wildcards
 */
export function likePattern(value: string): string {
  return `%${value}%`;
}

/**
 * JSON field access
 * PostgreSQL: ->>, ->, #>
 * SQL Server: JSON_VALUE, JSON_QUERY
 */
export function jsonExtractText(column: any, path: string): SQL {
  if (DB_DIALECT === 'postgresql') {
    return sql`${column}->>${path}`;
  } else {
    return sql`JSON_VALUE(${column}, ${path})`;
  }
}

/**
 * Array contains check
 * PostgreSQL: @> operator or = ANY()
 * SQL Server: STRING_SPLIT or JSON functions
 */
export function arrayContains(column: any, value: string): SQL {
  if (DB_DIALECT === 'postgresql') {
    return sql`${value} = ANY(${column})`;
  } else {
    // SQL Server: assume column is JSON array or delimited string
    return sql`${value} IN (SELECT value FROM STRING_SPLIT(${column}, ','))`;
  }
}

/**
 * Current timestamp function
 * PostgreSQL: NOW()
 * SQL Server: GETDATE()
 */
export function currentTimestamp(): SQL {
  if (DB_DIALECT === 'postgresql') {
    return sql`NOW()`;
  } else {
    return sql`GETDATE()`;
  }
}

/**
 * Date arithmetic
 * PostgreSQL: INTERVAL '1 day'
 * SQL Server: DATEADD
 */
export function dateAdd(column: any, days: number): SQL {
  if (DB_DIALECT === 'postgresql') {
    return sql`${column} + INTERVAL '${days} days'`;
  } else {
    return sql`DATEADD(day, ${days}, ${column})`;
  }
}

/**
 * String concatenation
 * PostgreSQL: ||
 * SQL Server: +
 */
export function concat(...args: any[]): SQL {
  if (DB_DIALECT === 'postgresql') {
    return sql.join(args, sql.raw(' || '));
  } else {
    return sql.join(args, sql.raw(' + '));
  }
}

/**
 * Limit/Offset for pagination
 * PostgreSQL: LIMIT x OFFSET y
 * SQL Server: OFFSET y ROWS FETCH NEXT x ROWS ONLY
 */
export function limitOffset(limit: number, offset: number = 0): SQL {
  if (DB_DIALECT === 'postgresql') {
    return sql`LIMIT ${limit} OFFSET ${offset}`;
  } else {
    // SQL Server requires ORDER BY before OFFSET
    return sql`OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
  }
}

/**
 * Boolean true value
 * PostgreSQL: true
 * SQL Server: 1
 */
export function booleanTrue(): SQL {
  if (DB_DIALECT === 'postgresql') {
    return sql`true`;
  } else {
    return sql`1`;
  }
}

/**
 * Boolean false value
 * PostgreSQL: false
 * SQL Server: 0
 */
export function booleanFalse(): SQL {
  if (DB_DIALECT === 'postgresql') {
    return sql`false`;
  } else {
    return sql`0`;
  }
}

// Logger imported lazily to avoid circular dependency
import('./services/logger').then(({ default: log }) => {
  log.debug({ module: 'db-helpers', dialect: DB_DIALECT }, `DB Helpers initialized for dialect: ${DB_DIALECT}`);
}).catch(() => {});
