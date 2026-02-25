import type { CustomerListItem, HouseholdListItem, SearchType, SmartSearchParams } from '@shared/schema';

/**
 * Database-agnostic search provider interface
 * Implementations handle vendor-specific fuzzy search logic
 */
export interface ISearchProvider {
  /**
   * Search customers by ID with exact matching
   * @returns Array of customers with 100% match score
   */
  searchByCustomerId(customerId: string, limit: number): Promise<CustomerListItem[]>;

  /**
   * Search customers by name with fuzzy matching
   * @param nameQuery - Name search query (can be first, last, or "first last")
   * @param threshold - Fuzzy matching threshold (0.1-1.0)
   * @param limit - Maximum results to return
   * @param cursor - Pagination cursor (optional)
   * @returns Array of customers with match scores
   */
  searchByNameFuzzy(
    nameQuery: string,
    threshold: number,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]>;

  /**
   * Search customers by name with exact prefix matching
   * @param nameQuery - Name search query
   * @param limit - Maximum results to return
   * @param cursor - Pagination cursor (optional)
   * @returns Array of customers
   */
  searchByName(nameQuery: string, limit: number, cursor?: string): Promise<CustomerListItem[]>;

  /**
   * Search customers by tax ID
   * @param taxId - Tax identifier (SSN format)
   * @param exact - Use exact matching vs prefix
   * @param limit - Maximum results to return
   * @param cursor - Pagination cursor (optional)
   */
  searchByTaxId(
    taxId: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]>;

  /**
   * Search customers by government ID
   * @param govId - Government-issued ID
   * @param exact - Use exact matching vs prefix
   * @param limit - Maximum results to return
   * @param cursor - Pagination cursor (optional)
   */
  searchByGovernmentId(
    govId: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]>;

  /**
   * Search customers by Silverlake customer ID
   * @param silverlakeId - Silverlake customer identifier
   * @param exact - Use exact matching vs prefix
   * @param limit - Maximum results to return
   * @param cursor - Pagination cursor (optional)
   */
  searchBySilverlakeId(
    silverlakeId: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]>;

  /**
   * Search customers by CIF number (Jack Henry Customer Information File number)
   * @param cif - CIF number (with or without "CIF" prefix)
   * @param exact - Use exact matching vs prefix
   * @param limit - Maximum results to return
   * @param cursor - Pagination cursor (optional)
   * @returns Array of customers with match scores
   */
  searchByCifNumber(
    cif: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]>;

  /**
   * Search households by name with fuzzy matching
   * @param nameQuery - Household name search query
   * @param threshold - Fuzzy matching threshold (0.1-1.0)
   * @param limit - Maximum results to return
   * @param cursor - Pagination cursor (optional)
   * @returns Array of households with match scores
   */
  searchHouseholdsByNameFuzzy(
    nameQuery: string,
    threshold: number,
    limit: number,
    cursor?: string
  ): Promise<HouseholdListItem[]>;

  /**
   * Search households by exact prefix matching
   * @param nameQuery - Household name search query
   * @param limit - Maximum results to return
   * @param cursor - Pagination cursor (optional)
   * @returns Array of households
   */
  searchHouseholdsByName(
    nameQuery: string,
    limit: number,
    cursor?: string
  ): Promise<HouseholdListItem[]>;

  /**
   * Get database vendor name
   */
  getVendor(): 'postgres' | 'sqlserver';

  /**
   * Check if database supports fuzzy search
   */
  supportsFuzzySearch(): boolean;

  /**
   * Get recommended fuzzy threshold for this database
   */
  getDefaultFuzzyThreshold(): number;
}

/**
 * Search provider capabilities
 */
export interface SearchProviderCapabilities {
  vendor: 'postgres' | 'sqlserver';
  fuzzySearch: boolean;
  defaultThreshold: number;
  maxThreshold: number;
  minThreshold: number;
  supportsIndexedSearch: boolean;
}
