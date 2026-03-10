import type { ISearchProvider } from './ISearchProvider';
import { PostgresSearchProvider } from './PostgresSearchProvider';
import { SqlServerSearchProvider } from './SqlServerSearchProvider';
import logger from '../../services/logger';

const fileLogger = logger.child({ module: 'search-provider-factory' });

/**
 * Database vendor type
 */
export type DatabaseVendor = 'postgres' | 'sqlserver';

/**
 * Search provider factory - creates appropriate search provider based on database vendor
 */
export class SearchProviderFactory {
  private static provider: ISearchProvider | null = null;
  private static detectedVendor: DatabaseVendor | null = null;

  /**
   * Detect database vendor from environment or connection string
   */
  private static detectDatabaseVendor(): DatabaseVendor {
    // Check explicit DB_VENDOR environment variable
    const explicitVendor = process.env.DB_VENDOR?.toLowerCase();
    if (explicitVendor === 'postgres' || explicitVendor === 'postgresql') {
      return 'postgres';
    }
    if (explicitVendor === 'sqlserver' || explicitVendor === 'mssql') {
      return 'sqlserver';
    }

    // Detect from DATABASE_URL if no explicit vendor
    const databaseUrl = process.env.DATABASE_URL || '';
    
    // PostgreSQL connection strings typically start with postgres:// or postgresql://
    if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
      return 'postgres';
    }
    
    // SQL Server connection strings typically contain Server= or start with mssql://
    if (databaseUrl.includes('Server=') || databaseUrl.startsWith('mssql://')) {
      return 'sqlserver';
    }

    // Default to PostgreSQL if unable to detect
    fileLogger.warn('Unable to detect database vendor, defaulting to PostgreSQL. Set DB_VENDOR environment variable to specify explicitly.');
    return 'postgres';
  }

  /**
   * Get the appropriate search provider for the current database
   */
  static getProvider(): ISearchProvider {
    if (this.provider) {
      return this.provider;
    }

    const vendor = this.detectDatabaseVendor();
    this.detectedVendor = vendor;

    switch (vendor) {
      case 'sqlserver':
        fileLogger.info('Using SQL Server search provider');
        this.provider = new SqlServerSearchProvider();
        break;
      case 'postgres':
      default:
        fileLogger.info('Using PostgreSQL search provider');
        this.provider = new PostgresSearchProvider();
        break;
    }

    return this.provider;
  }

  /**
   * Get the detected database vendor
   */
  static getVendor(): DatabaseVendor {
    if (!this.detectedVendor) {
      this.detectDatabaseVendor();
    }
    return this.detectedVendor || 'postgres';
  }

  /**
   * Reset provider (useful for testing)
   */
  static reset(): void {
    this.provider = null;
    this.detectedVendor = null;
  }
}
