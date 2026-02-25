/**
 * Database client - backward compatibility wrapper
 * Uses new dbConnection.ts for dual-database support
 */

export { 
  pool, 
  db, 
  getPgDatabase, 
  getMssqlPool, 
  getDatabase, 
  closeDatabaseConnections 
} from './dbConnection';
