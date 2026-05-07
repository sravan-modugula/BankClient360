import session from 'express-session';
import MSSQLStore from 'connect-mssql-v2';
import sql from 'mssql';

export function createSessionMiddleware() {
  // SQL Server session configuration
  const config: sql.config = {
    user: process.env.MSSQL_USER || process.env.DB_USER,
    password: process.env.MSSQL_PASSWORD || process.env.DB_PASSWORD,
    server: process.env.MSSQL_SERVER || process.env.DB_SERVER || 'localhost',
    database: process.env.MSSQL_DATABASE || process.env.DB_NAME || 'ClientIQ',
    connectionTimeout: 30000,
    requestTimeout: 30000,
    options: {
      encrypt: true, // Use encryption for Azure SQL Database
      trustServerCertificate: process.env.NODE_ENV === 'development', // Trust cert in dev
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  return session({
    store: new MSSQLStore(config, {
      table: 'sessions', // Session table name
      ttl: 12 * 60 * 60, // 12 hours in seconds
      autoRemove: true,  // Auto-remove expired sessions
      autoRemoveInterval: 15 // Check every 15 minutes
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,                   // Don't save unchanged sessions
    saveUninitialized: false,        // Don't save empty sessions
    rolling: true,                   // Refresh session on activity
    cookie: {
      maxAge: 12 * 60 * 60 * 1000,  // 12 hours
      httpOnly: true,                // Prevent XSS
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: 'lax',               // CSRF protection
      path: '/'
    },
    name: 'clientiq.sid'             // Custom cookie name
  });
}
