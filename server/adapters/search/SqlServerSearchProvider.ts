import type { AccountListItem, CustomerListItem, HouseholdListItem, SearchEntityItem } from '@shared/schema';
import type { ISearchProvider, SearchProviderCapabilities } from './ISearchProvider';
import { getMssqlPool } from '../../dbConnection';
import sqlServer from 'mssql';
import logger from '../../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-search-provider' });

/** SQL CASE expression for ordering by customer status priority */
const STATUS_ORDER_SQL = `CASE
  WHEN customer_status = 'active' THEN 1
  WHEN customer_status = 'prospect' THEN 2
  WHEN customer_status = 'inactive' THEN 3
  WHEN customer_status = 'closed' THEN 4
  ELSE 5
END`;

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
          fileLogger.info('STRING_SIMILARITY not available, using legacy SOUNDEX search');
          return this.searchByNameFuzzyLegacy(nameQuery, threshold, limit);
        }
        throw error;
      }
    } else {
      // Use legacy SOUNDEX/DIFFERENCE for SQL Server 2019 and earlier
      fileLogger.info({ version }, 'Using legacy SOUNDEX search for detected version');
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
      ORDER BY score DESC, ${STATUS_ORDER_SQL}, customer_id ASC
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
      ORDER BY score DESC, ${STATUS_ORDER_SQL}, customer_id ASC
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
      ORDER BY ${STATUS_ORDER_SQL}, full_name, customer_id
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
      ORDER BY ${STATUS_ORDER_SQL}, customer_id
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
      ORDER BY ${STATUS_ORDER_SQL}, customer_id
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
      ORDER BY ${STATUS_ORDER_SQL}, customer_id
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
      ORDER BY ${STATUS_ORDER_SQL}, customer_id
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
          riskRating: null,
          matchScore: Math.round(r.score * 100),
          matchType: r.score > 0.8 ? 'exact' as const : 'fuzzy' as const,
          matchedField: 'householdName'
        }));
      } catch (error: any) {
        // If STRING_SIMILARITY fails (error 195), fall back to legacy method
        if (error.number === 195) {
          fileLogger.info('STRING_SIMILARITY not available for households, using legacy SOUNDEX search');
          return this.searchHouseholdsByNameLegacy(nameQuery, threshold, limit);
        }
        throw error;
      }
    } else {
      // Use legacy SOUNDEX/DIFFERENCE for SQL Server 2019 and earlier
      fileLogger.info({ version }, 'Using legacy SOUNDEX search for households for detected version');
      return this.searchHouseholdsByNameLegacy(nameQuery, threshold, limit);
    }
  }

  private snakeCaseToProperCase(value: string): string {
    if (typeof value !== "string" || value.length === 0) {
      return "";
    }

    return value
      .split("_")
      .filter(Boolean)
      .map(
        (word) =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(" ");
  }

  private formatCurrency(amount: number): string {
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(1)}M`;
    } else if (amount >= 1_000) {
      return `$${(amount / 1_000).toFixed(1)}K`;
    } else {
      return `$${amount.toFixed(0)}`;
    }
  }

  async prefixSearchGlobal(query: string, limit: number): Promise<SearchEntityItem[]> {

    const pool = await this.poolPromise;
    const request = pool.request();
    request.input('query', sqlServer.NVarChar, query);
    request.input('limit', sqlServer.Int, limit);

    // First, run a SQL query with the query string and the limit to fetch all entity results
    // also include the additional data that needs to be extracted for each entity type

    const entities = await request.query(`
      /* 
        Customer Record
          entity_type, 
          entity_id, 
          display_name, 
          status, 
          customer_id (field_1), 
          full_name (field_2), 
          customer_type (field_3), 
          customer_status (field_4), 
          silver_lake_customer_id (field_5), 
          tax_identifier_last_4 (field_6),
          government_id_last_4 (field_7), 
          jack_henry_cif_number (field_8)
      */

      select distinct top (@limit)
        search.entity_type,
        search.entity_id,
        customer.full_name as display_name,
        customer.customer_status as status,
        customer.customer_id as field_1,
        convert(varchar(100), customer.full_name) as field_2,
        convert(varchar(100), customer.customer_type) as field_3,
        convert(varchar(100), customer.customer_status) as field_4,
        convert(varchar(100), customer.silverlake_customer_id) as field_5,
        convert(varchar(100), right(customer.tax_identifier, 4)) as field_6,
        convert(varchar(100), right(customer.government_id, 4)) as field_7,
        convert(varchar(100), customer.jack_henry_cif_number) as field_8
      from search
      join customer
      on customer.customer_id = search.customer_id
      where search.search_value like @query + '%' and search.entity_type = 2

      /* 
        Household Record
          entity_type, 
          entity_id, 
          display_name, 
          status, 
          household_id (field_1), 
          household_name (field_2), 
          household_type (field_3), 
          household_status (field_4), 
          total_assets (field_5), 
          total_liabilities (field_6),
          member_count (field_7),
          risk_rating (field_8)
      */

      union all

      select distinct top (@limit)
        search.entity_type,
        search.entity_id,
        household.household_name as display_name,
        household.household_status as status,
        household.household_id as field_1,
        convert(varchar(100), household.household_name) as field_2,
        convert(varchar(100), household.household_type) as field_3,
        convert(varchar(100), household.household_status) as field_4,
        convert(varchar(100), household.total_assets) as field_5,
        convert(varchar(100), household.total_liabilities) as field_6,
        convert(varchar(100), coalesce((select count(*) from household_membership where household_membership.household_id = household.household_id), 0)) as field_7,
        -- convert(varchar(100), household.risk_rating) as field_8
        null as field_8
      from search
      join household
      on household.household_id = search.household_id
      where search.search_value like @query + '%' and search.entity_type = 3

      /* 
        Account Record
          entity_type, 
          entity_id, 
          display_name, 
          status, 
          account_id (field_1), 
          account_number (field_2), 
          account_type (field_3), 
          household_status (field_4), 
          account_subtype (field_5), 
          balance (field_6),
          interest_rate (field_7),
          null (field_8)
      */

      union all

      select distinct top (@limit) 
        search.entity_type,
        search.entity_id,
        convert(varchar(100), account.account_number) as display_name,
        account.account_status as status,
        account.account_id as field_1,
        convert(varchar(100), account.account_number) as field_2,
        convert(varchar(100), account.account_type) as field_3,
        convert(varchar(100), account.account_status) as field_4,
        convert(varchar(100), account.account_subtype) as field_5,
        convert(varchar(100), account.balance) as field_6,
        ao.customer_id as field_7,
        null as field_8
      from search
      join account
      on account.account_number = search.search_value
      inner join account_ownership ao 
        ON ao.account_id = account.account_id 
        and (ao.ownership_type = 'Primary' or ao.ownership_type = 'Primary account owner')
      where 
        search.search_value like @query + '%' and search.entity_type = 1
      
      order by status asc;
    `)

    return entities.recordset.map((r: any) => {
      if (r.entity_type === 1) {
        // entity_type = Account
        return {
          entityType: 'account',
          entityId: r.field_1,
          displayName: r.display_name,
          primaryIdentifiers: [
            this.snakeCaseToProperCase(r.field_5 || 'Unknown'),
            `Balance: ${this.formatCurrency(parseFloat(r.field_6))}`
          ],
          status: r.status,
          account: {
            accountId: r.field_1,
            accountNumber: r.field_2,
            accountType: r.field_3,
            accountStatus: r.field_4,
            accountSubtype: r.field_5,
            balance: r.field_6,
            customerId: r.field_7
          } as AccountListItem
        } as SearchEntityItem
      } else if (r.entity_type === 2) {
        // entity_type = Customer
        return {
          entityType: 'customer',
          entityId: r.field_1,
          displayName: r.display_name,
          primaryIdentifiers: [
            // cif
            `CIF: ${r.field_8}`,
            // customer type
            this.snakeCaseToProperCase(r.field_3 || 'Unknown'),
            // customer status
            this.snakeCaseToProperCase(r.field_4 || 'Unknown')
          ].filter(Boolean),
          status: r.status,
          customer: this.maskPII({
            customerId: r.field_1,
            fullName: r.field_2,
            customerType: r.field_3,
            customerStatus: r.field_4,
            silverlakeCustomerId: r.field_5,
            taxIdentifierLast4: r.field_6,
            governmentIdLast4: r.field_7,
          } as CustomerListItem)
        } as SearchEntityItem
      } else {
        // if (r.entity_type === 3)
        // entity_type = Household

        const memberText = r.field_7 === 1 ? '1 member' : `${r.field_7} members`;
        const assetsText = this.formatCurrency(parseFloat(r.field_5));

        return {
          entityType: 'household',
          entityId: r.field_1,
          displayName: r.display_name,
          primaryIdentifiers: [
            memberText,
            `${assetsText} assets`
          ].filter(Boolean),
          status: r.status,
          household: {
            householdId: r.field_1,
            householdName: r.field_2,
            householdType: r.field_3,
            householdStatus: r.field_4,
            totalAssets: r.field_5,
            totalLiabilities: r.field_6,
            memberCount: r.field_7,
            riskRating: r.field_8,
          } as HouseholdListItem
        } as SearchEntityItem
      }
    })
  };

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
      riskRating: null
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
      riskRating: null,
      matchScore: Math.round(r.score * 100),
      matchType: r.score > 0.7 ? 'fuzzy' as const : 'partial' as const,
      matchedField: 'householdName'
    }));
  }

  /** Trim trailing whitespace from SQL Server CHAR/NCHAR column padding */
  private trim(value: any): string {
    return typeof value === 'string' ? value.trimEnd() : value ?? '';
  }

  private maskPII(row: any): CustomerListItem {
    return {
      customerId: row.customerId,
      fullName: this.trim(row.fullName),
      customerType: this.trim(row.customerType),
      customerStatus: this.trim(row.customerStatus),
      silverlakeCustomerId: this.trim(row.silverlakeCustomerId),
      taxIdentifierLast4: row.taxIdentifier ? `***-**-${row.taxIdentifier.trimEnd().slice(-4)}` : undefined,
      governmentIdLast4: row.governmentId ? `****${row.governmentId.trimEnd().slice(-4)}` : undefined
    };
  }
}

export { SqlServerSearchProvider };