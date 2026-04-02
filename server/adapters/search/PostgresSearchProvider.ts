import { eq, ilike, or, and, asc, sql, isNotNull, count } from 'drizzle-orm';
import type { CustomerListItem, HouseholdListItem } from '@shared/schema';
import type { ISearchProvider, SearchProviderCapabilities } from './ISearchProvider';
import { db } from '../../db';
import { customer, household, householdMembership } from '@shared/schema';

/** SQL CASE expression for ordering by customer status priority */
const statusPriorityExpr = sql`CASE
  WHEN ${customer.customerStatus} = 'active' THEN 1
  WHEN ${customer.customerStatus} = 'prospect' THEN 2
  WHEN ${customer.customerStatus} = 'inactive' THEN 3
  WHEN ${customer.customerStatus} = 'closed' THEN 4
  ELSE 5
END`;

/**
 * PostgreSQL search provider using pg_trgm for fuzzy text matching
 * Requires: pg_trgm and fuzzystrmatch extensions
 */
export class PostgresSearchProvider implements ISearchProvider {
  private capabilities: SearchProviderCapabilities = {
    vendor: 'postgres',
    fuzzySearch: true,
    defaultThreshold: 0.3,
    maxThreshold: 1.0,
    minThreshold: 0.1,
    supportsIndexedSearch: true
  };

  getVendor(): 'postgres' {
    return 'postgres';
  }

  supportsFuzzySearch(): boolean {
    return this.capabilities.fuzzySearch;
  }

  getDefaultFuzzyThreshold(): number {
    return this.capabilities.defaultThreshold;
  }

  async searchByCustomerId(customerId: string, limit: number): Promise<CustomerListItem[]> {
    const id = parseInt(customerId);
    if (isNaN(id)) {
      return [];
    }

    const result = await db
      .select({
        customerId: customer.customerId,
        fullName: customer.fullName,
        customerType: customer.customerType,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId
      })
      .from(customer)
      .where(eq(customer.customerId, id))
      .limit(limit);

    return result.map((r: any) => ({
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
    // Use full_name for fuzzy search - works for both individuals and businesses
    const result = await db
      .select({
        customerId: customer.customerId,
        fullName: customer.fullName,
        customerType: customer.customerType,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId,
        score: sql<number>`similarity(${customer.fullName}, ${nameQuery})`.as('score'),
      })
      .from(customer)
      .where(sql`similarity(${customer.fullName}, ${nameQuery}) > ${threshold}`)
      .orderBy(sql`score DESC`, statusPriorityExpr, asc(customer.customerId))
      .limit(limit);

    return result.map((r: any) => ({
      ...this.maskPII(r),
      matchScore: Math.round(r.score * 100),
      matchType: r.score > 0.8 ? 'exact' as const : 'fuzzy' as const,
      matchedField: 'fullName'
    }));
  }

  async searchByName(nameQuery: string, limit: number, cursor?: string): Promise<CustomerListItem[]> {
    // Use full_name for prefix search - works for both individuals and businesses
    const condition = ilike(customer.fullName, `${nameQuery}%`);

    const result = await db
      .select({
        customerId: customer.customerId,
        fullName: customer.fullName,
        customerType: customer.customerType,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId
      })
      .from(customer)
      .where(condition)
      .orderBy(statusPriorityExpr, asc(customer.fullName), asc(customer.customerId))
      .limit(limit);

    return result.map(this.maskPII);
  }

  async searchByTaxId(
    taxId: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]> {
    const taxIdDigits = taxId.replace(/[^\d]/g, '');

    const result = await db
      .select({
        customerId: customer.customerId,
        fullName: customer.fullName,
        customerType: customer.customerType,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId
      })
      .from(customer)
      .where(eq(customer.taxIdentifier, taxIdDigits))
      .orderBy(statusPriorityExpr, asc(customer.customerId))
      .limit(limit);

    return result.map(this.maskPII);
  }

  async searchByGovernmentId(
    govId: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]> {
    const condition = exact
      ? eq(customer.governmentId, govId)
      : ilike(customer.governmentId, `${govId}%`);

    const result = await db
      .select({
        customerId: customer.customerId,
        fullName: customer.fullName,
        customerType: customer.customerType,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId
      })
      .from(customer)
      .where(condition)
      .orderBy(statusPriorityExpr, asc(customer.customerId))
      .limit(limit);

    return result.map(this.maskPII);
  }

  async searchBySilverlakeId(
    silverlakeId: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]> {
    const condition = exact
      ? eq(customer.silverlakeCustomerId, silverlakeId)
      : ilike(customer.silverlakeCustomerId, `${silverlakeId}%`);

    const result = await db
      .select({
        customerId: customer.customerId,
        fullName: customer.fullName,
        customerType: customer.customerType,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId
      })
      .from(customer)
      .where(condition)
      .orderBy(statusPriorityExpr, asc(customer.customerId))
      .limit(limit);

    return result.map(this.maskPII);
  }

  async searchByCifNumber(
    cif: string,
    exact: boolean,
    limit: number,
    cursor?: string
  ): Promise<CustomerListItem[]> {
    // Use case-insensitive matching with optional IS NOT NULL filter for performance
    const condition = exact
      ? ilike(customer.jackHenryCifNumber, cif)
      : ilike(customer.jackHenryCifNumber, `${cif}%`);

    const result = await db
      .select({
        customerId: customer.customerId,
        fullName: customer.fullName,
        customerType: customer.customerType,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId
      })
      .from(customer)
      .where(and(
        isNotNull(customer.jackHenryCifNumber),
        condition
      ))
      .orderBy(statusPriorityExpr, asc(customer.customerId))
      .limit(limit);

    return result.map((r: any) => ({
      ...this.maskPII(r),
      matchScore: 100,
      matchType: exact ? 'exact' : 'prefix',
      matchedField: 'cifNumber'
    }));
  }

  async searchHouseholdsByNameFuzzy(
    nameQuery: string,
    threshold: number,
    limit: number,
    cursor?: string
  ): Promise<HouseholdListItem[]> {
    const result = await db
      .select({
        householdId: household.householdId,
        householdName: household.householdName,
        householdType: household.householdType,
        householdStatus: household.householdStatus,
        totalAssets: household.totalAssets,
        totalLiabilities: household.totalLiabilities,
        riskRating: household.riskRating,
        memberCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${householdMembership} WHERE ${householdMembership.householdId} = ${household.householdId}), 0)`.as('memberCount'),
        score: sql<number>`similarity(${household.householdName}, ${nameQuery})`.as('score'),
      })
      .from(household)
      .where(sql`similarity(${household.householdName}, ${nameQuery}) > ${threshold}`)
      .orderBy(sql`score DESC`, asc(household.householdId))
      .limit(limit);

    return result.map((r: any) => ({
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
  }

  async searchHouseholdsByName(
    nameQuery: string,
    limit: number,
    cursor?: string
  ): Promise<HouseholdListItem[]> {
    const condition = ilike(household.householdName, `${nameQuery}%`);

    const result = await db
      .select({
        householdId: household.householdId,
        householdName: household.householdName,
        householdType: household.householdType,
        householdStatus: household.householdStatus,
        totalAssets: household.totalAssets,
        totalLiabilities: household.totalLiabilities,
        riskRating: household.riskRating,
        memberCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${householdMembership} WHERE ${householdMembership.householdId} = ${household.householdId}), 0)`.as('memberCount'),
      })
      .from(household)
      .where(condition)
      .orderBy(asc(household.householdName), asc(household.householdId))
      .limit(limit);

    return result.map((r: any) => ({
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
