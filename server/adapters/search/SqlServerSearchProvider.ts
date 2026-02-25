import type { CustomerListItem, HouseholdListItem } from '@shared/schema';
import type { ISearchProvider, SearchProviderCapabilities } from './ISearchProvider';
import { getMssqlPool } from '../../dbConnection';
import sqlServer from 'mssql';

/**
 * SQL Server search provider using Full-Text Search (FTS) for fuzzy matching
 * Requires: Full-Text Search enabled on customer table
 * 
 * SQL Server 2022+ provides STRING_SIMILARITY() function similar to PostgreSQL
 * For older versions, uses SOUNDEX, DIFFERENCE, and CONTAINSTABLE
 */
class SqlServerSearchProvider implements ISearchProvider {
  private capabilities: SearchProviderCapabilities = {
    vendor: 'sqlserver',
    fuzzySearch: true,
    defaultThreshold: 0.3,
    maxThreshold: 1.0,
    minThreshold: 0.1,
    supportsIndexedSearch: true
  };

  private sqlServerVersion: number | null = null;
  private poolPromise: Promise<sqlServer.ConnectionPool>;

  constructor() {
    this.poolPromise = getMssqlPool();
  }

  getVendor(): 'sqlserver' {
    return 'sqlserver';
  }

  supportsFuzzySearch(): boolean {
    return this.capabilities.fuzzySearch;
  }

  getDefaultFuzzyThreshold(): number {
    return this.capabilities.defaultThreshold;
  }

  /**
   * Detect SQL Server version to use appropriate fuzzy matching strategy
   */
  private async getSqlServerVersion(): Promise<number> {
    if (this.sqlServerVersion !== null) {
      return this.sqlServerVersion;
    }

    try {
      const pool = await this.poolPromise;
      const result = await pool.request().query(`SELECT SERVERPROPERTY('ProductMajorVersion') as version`);
      this.sqlServerVersion = parseInt(result.recordset[0]?.version || '15');
      return this.sqlServerVersion;
    } catch (error) {
      // Default to version 15 (SQL Server 2019) if detection fails
      this.sqlServerVersion = 15;
      return this.sqlServerVersion;
    }
  }

  async searchByCustomerId(customerId: string, limit: number): Promise<CustomerListItem[]> {
    const id = parseInt(customerId);
    if (isNaN(id)) {
      return [];
    }

    const pool = await this.poolPromise;
    const request = pool.request();
    request.input('customerId', sqlServer.Int, id);
    request.input('limit', sqlServer.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        customer_id as customerId,
        full_name as fullName,
        customer_type as customerType,
        customer_status as customerStatus,
        silverlake_customer_id as silverlakeCustomerId,
        tax_identifier as taxIdentifier,
        government_id as governmentId
      FROM customer
      WHERE customer_id = @customerId
    `);

    return result.recordset.map((r: any) => ({
      ...this.maskPII(r),
      matchScore: 100,
      matchType: 'exact' as const,
      matchedField: 'customerId'
    }));
  }

  async searchByNameFuzzy(
    nameQuery: string,
    threshold: number,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]> {
    const version = await this.getSqlServerVersion();

    // SQL Server 2022+ (version 16+) has STRING_SIMILARITY function
    // SQL Server 2019 and earlier (version 15 and below) use SOUNDEX/DIFFERENCE
    if (version >= 16) {
      try {
        return await this.searchByNameFuzzyModern(nameQuery, threshold, limit);
      } catch (error: any) {
        // Fallback to legacy if STRING_SIMILARITY fails
        if (error.number === 195) {
          console.log('[SQL Server] STRING_SIMILARITY not available, using legacy SOUNDEX search');
          return this.searchByNameFuzzyLegacy(nameQuery, threshold, limit);
        }
        throw error;
      }
    } else {
      // Use legacy SOUNDEX/DIFFERENCE for SQL Server 2019 and earlier
      console.log(`[SQL Server] Version ${version} detected, using legacy SOUNDEX search`);
      return this.searchByNameFuzzyLegacy(nameQuery, threshold, limit);
    }
  }

  /**
   * SQL Server 2022+ fuzzy search using STRING_SIMILARITY
   */
  private async searchByNameFuzzyModern(
    nameQuery: string,
    threshold: number,
    limit: number
  ): Promise<CustomerListItem[]> {
    const pool = await this.poolPromise;
    const request = pool.request();
    request.input('nameQuery', sqlServer.NVarChar, nameQuery);
    request.input('threshold', sqlServer.Float, threshold);
    request.input('limit', sqlServer.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        customer_id as customerId,
        full_name as fullName,
        customer_type as customerType,
        customer_status as customerStatus,
        silverlake_customer_id as silverlakeCustomerId,
        tax_identifier as taxIdentifier,
        government_id as governmentId,
        STRING_SIMILARITY(full_name, @nameQuery) as score
      FROM customer
      WHERE STRING_SIMILARITY(full_name, @nameQuery) > @threshold
      ORDER BY score DESC, customer_id ASC
    `);

    return result.recordset.map((r: any) => ({
      ...this.maskPII(r),
      matchScore: Math.round(r.score * 100),
      matchType: r.score > 0.8 ? 'exact' as const : 'fuzzy' as const,
      matchedField: 'fullName'
    }));
  }

  /**
   * Legacy fuzzy search using SOUNDEX and DIFFERENCE for SQL Server < 2022
   */
  private async searchByNameFuzzyLegacy(
    nameQuery: string,
    threshold: number,
    limit: number
  ): Promise<CustomerListItem[]> {
    const pool = await this.poolPromise;
    const request = pool.request();
    request.input('nameQuery', sqlServer.NVarChar, nameQuery);
    request.input('threshold', sqlServer.Float, threshold);
    request.input('limit', sqlServer.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        customer_id as customerId,
        full_name as fullName,
        customer_type as customerType,
        customer_status as customerStatus,
        silverlake_customer_id as silverlakeCustomerId,
        tax_identifier as taxIdentifier,
        government_id as governmentId,
        DIFFERENCE(full_name, @nameQuery) / 4.0 as score
      FROM customer
      WHERE DIFFERENCE(full_name, @nameQuery) / 4.0 > @threshold
      ORDER BY score DESC, customer_id ASC
    `);

    return result.recordset.map((r: any) => ({
      ...this.maskPII(r),
      matchScore: Math.round(r.score * 100),
      matchType: r.score > 0.7 ? 'fuzzy' as const : 'partial' as const,
      matchedField: 'fullName'
    }));
  }

  async searchByName(nameQuery: string, limit: number, cursor?: string): Promise<CustomerListItem[]> {
    const pool = await this.poolPromise;
    const request = pool.request();
    request.input('nameQuery', sqlServer.NVarChar, `${nameQuery}%`);
    request.input('limit', sqlServer.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        customer_id as customerId,
        full_name as fullName,
        customer_type as customerType,
        customer_status as customerStatus,
        silverlake_customer_id as silverlakeCustomerId,
        tax_identifier as taxIdentifier,
        government_id as governmentId
      FROM customer
      WHERE full_name COLLATE SQL_Latin1_General_CP1_CI_AS LIKE @nameQuery
      ORDER BY full_name, customer_id
    `);

    return result.recordset.map(r => this.maskPII(r));
  }

  async searchByTaxId(
    taxId: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]> {
    const taxIdDigits = taxId.replace(/[^\d]/g, '');

    const pool = await this.poolPromise;
    const request = pool.request();
    request.input('taxId', sqlServer.NVarChar, taxIdDigits);
    request.input('limit', sqlServer.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        customer_id as customerId,
        full_name as fullName,
        customer_type as customerType,
        customer_status as customerStatus,
        silverlake_customer_id as silverlakeCustomerId,
        tax_identifier as taxIdentifier,
        government_id as governmentId
      FROM customer
      WHERE tax_identifier = @taxId
      ORDER BY customer_id
    `);

    return result.recordset.map(r => this.maskPII(r));
  }

  async searchByGovernmentId(
    govId: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]> {
    const pool = await this.poolPromise;
    const request = pool.request();
    request.input('govId', sqlServer.NVarChar, exact ? govId : `${govId}%`);
    request.input('limit', sqlServer.Int, limit);

    const whereClause = exact 
      ? 'WHERE government_id = @govId'
      : 'WHERE government_id COLLATE SQL_Latin1_General_CP1_CI_AS LIKE @govId';

    const result = await request.query(`
      SELECT TOP (@limit)
        customer_id as customerId,
        full_name as fullName,
        customer_type as customerType,
        customer_status as customerStatus,
        silverlake_customer_id as silverlakeCustomerId,
        tax_identifier as taxIdentifier,
        government_id as governmentId
      FROM customer
      ${whereClause}
      ORDER BY customer_id
    `);

    return result.recordset.map(r => this.maskPII(r));
  }

  async searchBySilverlakeId(
    silverlakeId: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]> {
    const pool = await this.poolPromise;
    const request = pool.request();
    request.input('silverlakeId', sqlServer.NVarChar, exact ? silverlakeId : `${silverlakeId}%`);
    request.input('limit', sqlServer.Int, limit);

    const whereClause = exact 
      ? 'WHERE silverlake_customer_id = @silverlakeId'
      : 'WHERE silverlake_customer_id COLLATE SQL_Latin1_General_CP1_CI_AS LIKE @silverlakeId';

    const result = await request.query(`
      SELECT TOP (@limit)
        customer_id as customerId,
        full_name as fullName,
        customer_type as customerType,
        customer_status as customerStatus,
        silverlake_customer_id as silverlakeCustomerId,
        tax_identifier as taxIdentifier,
        government_id as governmentId
      FROM customer
      ${whereClause}
      ORDER BY customer_id
    `);

    return result.recordset.map(r => this.maskPII(r));
  }

  async searchByCifNumber(
    cif: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]> {
    const pool = await this.poolPromise;
    const request = pool.request();
    request.input('cif', sqlServer.NVarChar, exact ? cif : `${cif}%`);
    request.input('limit', sqlServer.Int, limit);

    const whereClause = exact 
      ? 'WHERE jack_henry_cif_number COLLATE SQL_Latin1_General_CP1_CI_AS = @cif'
      : 'WHERE jack_henry_cif_number COLLATE SQL_Latin1_General_CP1_CI_AS LIKE @cif';

    const result = await request.query(`
      SELECT TOP (@limit)
        customer_id as customerId,
        full_name as fullName,
        customer_type as customerType,
        customer_status as customerStatus,
        silverlake_customer_id as silverlakeCustomerId,
        tax_identifier as taxIdentifier,
        government_id as governmentId
      FROM customer
      WHERE jack_henry_cif_number IS NOT NULL
        AND ${whereClause.replace('WHERE ', '')}
      ORDER BY customer_id
    `);

    return result.recordset.map((r: any) => ({
      ...this.maskPII(r),
      matchScore: 100,
      matchType: exact ? 'exact' as const : 'prefix' as const,
      matchedField: 'cifNumber'
    }));
  }

  async searchHouseholdsByNameFuzzy(
    nameQuery: string,
    threshold: number,
    limit: number,
    cursor?: string
  ): Promise<HouseholdListItem[]> {
    const version = await this.getSqlServerVersion();

    // SQL Server 2022+ (version 16+) has STRING_SIMILARITY
    // SQL Server 2019 and earlier (version 15 and below) use SOUNDEX/DIFFERENCE
    if (version >= 16) {
      try {
        const pool = await this.poolPromise;
        const request = pool.request();
        request.input('nameQuery', sqlServer.NVarChar, nameQuery);
        request.input('threshold', sqlServer.Float, threshold);
        request.input('limit', sqlServer.Int, limit);

        const result = await request.query(`
          SELECT TOP (@limit)
            h.household_id as householdId,
            h.household_name as householdName,
            h.household_type as householdType,
            h.household_status as householdStatus,
            h.total_assets as totalAssets,
            h.total_liabilities as totalLiabilities,
            h.risk_rating as riskRating,
            COALESCE((SELECT COUNT(*) FROM household_membership WHERE household_id = h.household_id), 0) as memberCount,
            STRING_SIMILARITY(h.household_name, @nameQuery) as score
          FROM household h
          WHERE STRING_SIMILARITY(h.household_name, @nameQuery) > @threshold
          ORDER BY score DESC, h.household_id ASC
        `);

        return result.recordset.map((r: any) => ({
          householdId: r.householdId,
          householdName: r.householdName || '',
          householdType: r.householdType || '',
          householdStatus: r.householdStatus || '',
          totalAssets: r.totalAssets || '0',
          totalLiabilities: r.totalLiabilities || '0',
          memberCount: r.memberCount || 0,
          riskRating: r.riskRating,
          matchScore: Math.round(r.score * 100),
          matchType: r.score > 0.8 ? 'exact' as const : 'fuzzy' as const,
          matchedField: 'householdName'
        }));
      } catch (error: any) {
        // If STRING_SIMILARITY fails (error 195), fall back to legacy method
        if (error.number === 195) {
          console.log('[SQL Server] STRING_SIMILARITY not available for households, using legacy SOUNDEX search');
          return this.searchHouseholdsByNameLegacy(nameQuery, threshold, limit);
        }
        throw error;
      }
    } else {
      // Use legacy SOUNDEX/DIFFERENCE for SQL Server 2019 and earlier
      console.log(`[SQL Server] Version ${version} detected for households, using legacy SOUNDEX search`);
      return this.searchHouseholdsByNameLegacy(nameQuery, threshold, limit);
    }
  }

  async searchHouseholdsByName(
    nameQuery: string,
    limit: number,
    cursor?: string
  ): Promise<HouseholdListItem[]> {
    const pool = await this.poolPromise;
    const request = pool.request();
    request.input('nameQuery', sqlServer.NVarChar, `${nameQuery}%`);
    request.input('limit', sqlServer.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        h.household_id as householdId,
        h.household_name as householdName,
        h.household_type as householdType,
        h.household_status as householdStatus,
        h.total_assets as totalAssets,
        h.total_liabilities as totalLiabilities,
        h.risk_rating as riskRating,
        COALESCE((SELECT COUNT(*) FROM household_membership WHERE household_id = h.household_id), 0) as memberCount
      FROM household h
      WHERE h.household_name COLLATE SQL_Latin1_General_CP1_CI_AS LIKE @nameQuery
      ORDER BY h.household_name, h.household_id
    `);

    return result.recordset.map((r: any) => ({
      householdId: r.householdId,
      householdName: r.householdName || '',
      householdType: r.householdType || '',
      householdStatus: r.householdStatus || '',
      totalAssets: r.totalAssets || '0',
      totalLiabilities: r.totalLiabilities || '0',
      memberCount: r.memberCount || 0,
      riskRating: r.riskRating
    }));
  }

  // Legacy search for households by name using SOUNDEX/DIFFERENCE
  private async searchHouseholdsByNameLegacy(
    nameQuery: string,
    threshold: number,
    limit: number
  ): Promise<HouseholdListItem[]> {
    const pool = await this.poolPromise;
    const request = pool.request();
    request.input('nameQuery', sqlServer.NVarChar, nameQuery);
    request.input('threshold', sqlServer.Float, threshold);
    request.input('limit', sqlServer.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        h.household_id as householdId,
        h.household_name as householdName,
        h.household_type as householdType,
        h.household_status as householdStatus,
        h.total_assets as totalAssets,
        h.total_liabilities as totalLiabilities,
        h.risk_rating as riskRating,
        COALESCE((SELECT COUNT(*) FROM household_membership WHERE household_id = h.household_id), 0) as memberCount,
        DIFFERENCE(h.household_name, @nameQuery) / 4.0 as score
      FROM household h
      WHERE DIFFERENCE(h.household_name, @nameQuery) / 4.0 > @threshold
      ORDER BY score DESC, h.household_id ASC
    `);

    return result.recordset.map((r: any) => ({
      householdId: r.householdId,
      householdName: r.householdName || '',
      householdType: r.householdType || '',
      householdStatus: r.householdStatus || '',
      totalAssets: r.totalAssets || '0',
      totalLiabilities: r.totalLiabilities || '0',
      memberCount: r.memberCount || 0,
      riskRating: r.riskRating,
      matchScore: Math.round(r.score * 100),
      matchType: r.score > 0.7 ? 'fuzzy' as const : 'partial' as const,
      matchedField: 'householdName'
    }));
  }

  private maskPII(row: any): CustomerListItem {
    return {
      customerId: row.customerId,
      fullName: row.fullName || '',
      customerType: row.customerType,
      customerStatus: row.customerStatus,
      silverlakeCustomerId: row.silverlakeCustomerId,
      taxIdentifierLast4: row.taxIdentifier ? `***-**-${row.taxIdentifier.slice(-4)}` : undefined,
      governmentIdLast4: row.governmentId ? `****${row.governmentId.slice(-4)}` : undefined
    };
  }
}

export { SqlServerSearchProvider };