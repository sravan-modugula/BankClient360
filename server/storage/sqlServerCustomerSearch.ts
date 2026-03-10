/**
 * SQL Server-specific Customer Search Implementation
 * Proof-of-concept for dual-database support
 */

import sql from 'mssql';
import type { SearchCustomerParams, CustomerSearchResult, CustomerWithDetails } from '@shared/schema';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-customer-search' });

/**
 * Search customers using SQL Server
 * This is a proof-of-concept implementation demonstrating the hybrid approach
 */
export async function searchCustomersSqlServer(
  pool: sql.ConnectionPool,
  params: SearchCustomerParams
): Promise<CustomerSearchResult> {
  const { query, limit = 50, offset = 0 } = params;

  try {
    const request = pool.request();
    
    // Parameterize the search query
    const searchPattern = `%${query}%`;
    request.input('searchPattern', sql.NVarChar, searchPattern);
    request.input('limit', sql.Int, limit);
    request.input('offset', sql.Int, offset);

    // Main search query with case-insensitive LIKE
    // SQL Server uses COLLATE for case-insensitive search
    const searchQuery = `
      SELECT 
        c.customer_id as customerId,
        c.first_name as firstName,
        c.last_name as lastName,
        c.middle_name as middleName,
        c.preferred_name as preferredName,
        c.title,
        c.suffix,
        c.date_of_birth as dateOfBirth,
        c.gender,
        c.marital_status as maritalStatus,
        c.business_name as businessName,
        c.full_name as fullName,
        c.tax_identifier as taxIdentifier,
        c.government_id as governmentId,
        c.government_id_type as governmentIdType,
        c.citizenship,
        c.customer_type as customerType,
        c.customer_status as customerStatus,
        c.customer_since as customerSince,
        c.kyc_status as kycStatus,
        c.kyc_last_updated as kycLastUpdated,
        c.risk_rating as riskRating,
        c.language_preference as languagePreference,
        c.occupation,
        c.employer_name as employerName,
        c.industry,
        c.annual_income as annualIncome,
        c.net_worth as netWorth,
        c.source_of_wealth as sourceOfWealth,
        c.pep_status as pepStatus,
        c.sanctions_check_status as sanctionsCheckStatus,
        c.sanctions_check_date as sanctionsCheckDate,
        c.aml_risk_score as amlRiskScore,
        c.last_aml_review as lastAmlReview,
        c.incorporation_date as incorporationDate,
        c.incorporation_state as incorporationState,
        c.incorporation_country as incorporationCountry,
        c.business_structure as businessStructure,
        c.number_of_employees as numberOfEmployees,
        c.tin,
        c.duns_number as dunsNumber,
        c.naics_code as naicsCode,
        c.primary_contact_name as primaryContactName,
        c.primary_contact_title as primaryContactTitle,
        c.website,
        c.is_vip as isVip,
        c.is_employee as isEmployee,
        c.is_politically_exposed as isPoliticallyExposed,
        c.referral_source as referralSource,
        c.silverlake_customer_id as silverlakeCustomerId,
        c.silverlake_sync_status as silverlakeSyncStatus,
        c.silverlake_last_synced as silverlakeLastSynced,
        c.dba_name as dbaName,
        c.created_at as createdAt,
        c.updated_at as updatedAt
      FROM customer c
      WHERE 
        c.first_name COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR c.last_name COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR c.business_name COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR c.full_name COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR c.tax_identifier COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR c.silverlake_customer_id COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR CONCAT(c.first_name, ' ', c.last_name) COLLATE Latin1_General_CI_AS LIKE @searchPattern
      ORDER BY c.last_name, c.first_name
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as totalCount
      FROM customer c
      WHERE 
        c.first_name COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR c.last_name COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR c.business_name COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR c.full_name COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR c.tax_identifier COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR c.silverlake_customer_id COLLATE Latin1_General_CI_AS LIKE @searchPattern
        OR CONCAT(c.first_name, ' ', c.last_name) COLLATE Latin1_General_CI_AS LIKE @searchPattern
    `;

    // Execute both queries
    const [customersResult, countResult] = await Promise.all([
      request.query(searchQuery),
      pool.request()
        .input('searchPattern', sql.NVarChar, searchPattern)
        .query(countQuery)
    ]);

    const customers = customersResult.recordset as CustomerWithDetails[];
    const totalCount = countResult.recordset[0]?.totalCount || 0;
    const hasMore = offset + limit < totalCount;

    return {
      customers,
      totalCount,
      hasMore
    };
  } catch (error) {
    fileLogger.error({ err: error }, 'Customer search error');
    throw new Error(`SQL Server customer search failed: ${error}`);
  }
}

/**
 * Get customer by ID using SQL Server
 */
export async function getCustomerByIdSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<CustomerWithDetails | null> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    const query = `
      SELECT 
        c.customer_id as customerId,
        c.first_name as firstName,
        c.last_name as lastName,
        c.middle_name as middleName,
        c.preferred_name as preferredName,
        c.title,
        c.suffix,
        c.date_of_birth as dateOfBirth,
        c.gender,
        c.marital_status as maritalStatus,
        c.business_name as businessName,
        c.full_name as fullName,
        c.tax_identifier as taxIdentifier,
        c.government_id as governmentId,
        c.government_id_type as governmentIdType,
        c.citizenship,
        c.customer_type as customerType,
        c.customer_status as customerStatus,
        c.customer_since as customerSince,
        c.kyc_status as kycStatus,
        c.kyc_last_updated as kycLastUpdated,
        c.risk_rating as riskRating,
        c.language_preference as languagePreference,
        c.occupation,
        c.employer_name as employerName,
        c.industry,
        c.annual_income as annualIncome,
        c.net_worth as netWorth,
        c.source_of_wealth as sourceOfWealth,
        c.pep_status as pepStatus,
        c.sanctions_check_status as sanctionsCheckStatus,
        c.sanctions_check_date as sanctionsCheckDate,
        c.aml_risk_score as amlRiskScore,
        c.last_aml_review as lastAmlReview,
        c.incorporation_date as incorporationDate,
        c.incorporation_state as incorporationState,
        c.incorporation_country as incorporationCountry,
        c.business_structure as businessStructure,
        c.number_of_employees as numberOfEmployees,
        c.tin,
        c.duns_number as dunsNumber,
        c.naics_code as naicsCode,
        c.primary_contact_name as primaryContactName,
        c.primary_contact_title as primaryContactTitle,
        c.website,
        c.is_vip as isVip,
        c.is_employee as isEmployee,
        c.is_politically_exposed as isPoliticallyExposed,
        c.referral_source as referralSource,
        c.silverlake_customer_id as silverlakeCustomerId,
        c.silverlake_sync_status as silverlakeSyncStatus,
        c.silverlake_last_synced as silverlakeLastSynced,
        c.dba_name as dbaName,
        c.created_at as createdAt,
        c.updated_at as updatedAt
      FROM customer c
      WHERE c.customer_id = @customerId
    `;

    const result = await request.query(query);
    
    if (result.recordset.length === 0) {
      return null;
    }

    return result.recordset[0] as CustomerWithDetails;
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer by ID error');
    throw new Error(`SQL Server get customer failed: ${error}`);
  }
}
