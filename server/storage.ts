import { eq, ilike, or, and, desc, asc, sql, isNotNull } from "drizzle-orm";
import { db, getPgDatabase } from "./db";
import { isPostgreSQL, isSQLServer } from "./dbConfig";
import { caseInsensitiveLike } from "./dbHelpers";
import { SearchProviderFactory } from "./adapters/search";
import type { ISearchProvider } from "./adapters/search";
import { analyzeQuery, mergeResults, getStatusPriority } from "./adapters/search/queryStrategy";
import logger from './services/logger';

const fileLogger = logger.child({ module: 'storage' });
import { 
  type Customer, 
  type InsertCustomer, 
  type CustomerWithDetails,
  type CustomerSearchResult,
  type SearchCustomerParams,
  type CustomerListItem,
  type HouseholdListItem,
  type SmartSearchParams,
  type SmartSearchResult,
  type UnifiedSearchResult,
  type SearchEntityItem,
  type SearchType,
  type SearchField,
  type ContactInfo,
  type ContactInfoUI,
  type InsertContactInfo,
  type Address,
  type InsertAddress,
  type Household,
  type InsertHousehold,
  type HouseholdMembership,
  type InsertHouseholdMembership,
  type HouseholdMemberWithCustomer,
  type Account,
  type InsertAccount,
  type AccountOwnership,
  type InsertAccountOwnership,
  type Branch,
  type InsertBranch,
  type Employee,
  type InsertEmployee,
  type CustomerOfficerAssignment,
  type InsertCustomerOfficerAssignment,
  type CustomerSicCode,
  type InsertCustomerSicCode,
  type AccountSicCode,
  type InsertAccountSicCode,
  type FinancialTransaction,
  type InsertFinancialTransaction,
  type TransactionCategory,
  type OnlineBankingUser,
  type OnlineBankingLoginEvent,
  type ContactHistory,
  type DebitCardWithLimitProfile,
  type NoteCategory,
  type Note,
  type NoteVersion,
  type NoteAuditLog,
  type UserPermissions,
  type PermissionContext,
  type PermissionCheckResult,
  customer,
  contactInfo,
  address,
  household,
  account,
  branch,
  entityContact,
  entityAddress,
  householdMembership,
  accountOwnership,
  employee,
  customerOfficerAssignment,
  customerSicCode,
  accountSicCode,
  sicCode,
  financialTransaction,
  transactionCategory,
  onlineBankingUser,
  onlineBankingLoginEvent,
  contactHistory,
  debitCard,
  debitCardLimitProfile,
  noteCategory,
  note,
  noteVersion,
  noteAuditLog
} from "@shared/schema";
import { CODE_TO_ACTIVITY, createDefaultActivity } from "../shared/constants";

// Notes helper types
export interface NoteWithCurrentVersion {
  noteId: number;
  customerId: number | null;
  accountId: number | null;
  targetType: string;
  categoryId: number | null;
  categoryName: string | null;
  importance: string;
  visibility: string;
  legalHold: boolean;
  retentionYears: number | null;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  currentVersion: {
    versionId: number;
    versionNumber: number;
    title: string;
    body: string;
    authorEmployeeId: number;
    authorEmployeeName: string | null;
    isSoftDeleted: boolean;
    createdAt: Date;
    modifiedAt: Date;
  };
}

export interface CreateNoteData {
  customerId?: number;
  accountId?: number;
  targetType: 'customer' | 'account';
  categoryId?: number;
  importance?: 'low' | 'medium' | 'high' | 'urgent';
  visibility?: 'public' | 'internal' | 'confidential';
  title: string;
  body: string;
  legalHold?: boolean;
  retentionYears?: number;
  isPinned?: boolean;
}

export interface UpdateNoteData {
  title?: string;
  body?: string;
  categoryId?: number | null;
  importance?: 'low' | 'medium' | 'high' | 'urgent';
  visibility?: 'public' | 'internal' | 'confidential';
  legalHold?: boolean;
  retentionYears?: number | null;
  isPinned?: boolean;
}

export interface SearchNotesParams {
  query?: string;
  targetType?: 'customer' | 'account';
  targetId?: number;
  categoryId?: number;
  importance?: string;
  visibility?: string;
  authorEmployeeId?: number;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

// Banking storage interface for CRUD operations
export interface IBankingStorage {
  // Customer operations
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByTaxId(taxId: string): Promise<Customer | undefined>;
  getCustomerByCifNumber(cifNumber: string): Promise<Customer | undefined>;
  getCustomerWithDetails(id: number): Promise<CustomerWithDetails | undefined>;
  createCustomer(customerData: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customerData: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deactivateCustomer(id: number): Promise<Customer | undefined>;
  searchCustomers(params: SearchCustomerParams): Promise<CustomerSearchResult>;

  // Contact operations
  getCustomerContacts(customerId: number): Promise<ContactInfo[]>;
  addCustomerContact(customerId: number, contactData: InsertContactInfo): Promise<ContactInfo>;
  updateContact(contactId: number, contactData: Partial<InsertContactInfo>): Promise<ContactInfo | undefined>;
  deactivateCustomerContact(customerId: number, contactId: number): Promise<boolean>;

  // Address operations  
  getCustomerAddresses(customerId: number): Promise<Address[]>;
  addCustomerAddress(customerId: number, addressData: InsertAddress): Promise<Address>;
  updateAddress(addressId: number, addressData: Partial<InsertAddress>): Promise<Address | undefined>;
  deactivateCustomerAddress(customerId: number, addressId: number): Promise<boolean>;

  // Household operations
  getHousehold(id: number): Promise<Household | undefined>;
  getCustomerHouseholds(customerId: number): Promise<Household[]>;
  createHousehold(householdData: InsertHousehold): Promise<Household>;
  updateHousehold(id: number, householdData: Partial<InsertHousehold>): Promise<Household | undefined>;
  closeHousehold(id: number): Promise<Household | undefined>;
  addHouseholdMember(membershipData: InsertHouseholdMembership): Promise<HouseholdMembership>;
  endHouseholdMember(membershipId: number): Promise<HouseholdMembership | undefined>;
  getHouseholdMembers(householdId: number): Promise<HouseholdMemberWithCustomer[]>;
  getSubsidiaryHouseholds(parentHouseholdId: number): Promise<Household[]>;

  // Account operations
  getAccount(id: number): Promise<Account | undefined>;
  getCustomerAccounts(customerId: number): Promise<Account[]>;
  createAccount(accountData: InsertAccount): Promise<Account>;
  updateAccount(id: number, accountData: Partial<InsertAccount>): Promise<Account | undefined>;
  closeAccount(id: number): Promise<Account | undefined>;
  getAccountOwners(accountId: number): Promise<AccountOwnership[]>;
  addAccountOwner(ownershipData: InsertAccountOwnership): Promise<AccountOwnership>;
  updateOwnership(ownershipId: number, ownershipData: Partial<InsertAccountOwnership>): Promise<AccountOwnership | undefined>;
  removeOwnership(ownershipId: number): Promise<boolean>;
  getAccounts(filters?: { accountType?: string; accountStatus?: string; branchId?: number }): Promise<Account[]>;
  getCustomerDepositAccounts(customerId: number): Promise<Account[]>;
  getDepositAccountAnalytics(customerId: number): Promise<{
    totalBalance: number;
    accounts: Account[];
    balanceByType: { checking: number; savings: number; cd: number };
  }>;

  // Debit Card operations
  getAccountDebitCards(accountId: number): Promise<DebitCardWithLimitProfile[]>;

  // Branch operations
  getBranch(id: number): Promise<Branch | undefined>;
  getBranches(): Promise<Branch[]>;
  createBranch(branchData: InsertBranch): Promise<Branch>;
  updateBranch(id: number, branchData: Partial<InsertBranch>): Promise<Branch | undefined>;
  deactivateBranch(id: number): Promise<Branch | undefined>;

  // Employee operations  
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployees(branchId?: number): Promise<Employee[]>;
  createEmployee(employeeData: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employeeData: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deactivateEmployee(id: number): Promise<Employee | undefined>;

  // Customer-Officer assignment operations
  getCustomerOfficers(customerId: number): Promise<CustomerOfficerAssignment[]>;
  getOfficerCustomers(officerCode: string): Promise<CustomerOfficerAssignment[]>;
  getCustomerOfficersWithDetails(customerId: number): Promise<Array<{
    officerCode: string | null;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    department: string | null;
    relationshipType: 'primary' | 'secondary';
    assignedAt: Date | null;
  }>>;
  addCustomerOfficer(assignmentData: InsertCustomerOfficerAssignment): Promise<CustomerOfficerAssignment>;
  updateCustomerOfficer(customerId: number, officerCode: string, relationshipType: string): Promise<CustomerOfficerAssignment | undefined>;
  removeCustomerOfficer(customerId: number, officerCode: string): Promise<boolean>;

  // Customer-SIC Code assignment operations
  getCustomerSicCodes(customerId: number): Promise<CustomerSicCode[]>;
  getSicCodeCustomers(sicCode: number): Promise<CustomerSicCode[]>;
  addCustomerSicCode(assignmentData: InsertCustomerSicCode): Promise<CustomerSicCode>;
  removeCustomerSicCode(customerId: number, sicCode: number): Promise<boolean>;

  // Account-SIC Code assignment operations
  getAccountSicCodes(accountId: number): Promise<AccountSicCode[]>;
  getAccountSicCodesWithDescriptions(accountId: number): Promise<Array<{
    sicCode: number;
    description: string;
    effectiveDate: string | null;
    endDate: string | null;
  }>>;
  getSicCodeAccounts(sicCode: number): Promise<AccountSicCode[]>;
  addAccountSicCode(assignmentData: InsertAccountSicCode): Promise<AccountSicCode>;
  updateAccountSicCode(accountSicCodeId: number, updateData: Partial<InsertAccountSicCode>): Promise<AccountSicCode | undefined>;
  removeAccountSicCode(accountId: number, sicCode: number): Promise<boolean>;

  // Smart search operations
  smartSearchCustomers(params: SmartSearchParams): Promise<SmartSearchResult>;
  searchEntities(params: SmartSearchParams): Promise<UnifiedSearchResult>;
  getCustomerByGovernmentId(govId: string): Promise<Customer | undefined>;

  // Transaction operations
  getTransactions(params: {
    accountId?: number;
    customerId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: FinancialTransaction[]; totalCount: number }>;
  getTransactionsByAccount(accountId: number, limit?: number, offset?: number): Promise<FinancialTransaction[]>;
  getTransactionsByCustomer(customerId: number, limit?: number, offset?: number): Promise<FinancialTransaction[]>;
  getTransactionCategories(): Promise<TransactionCategory[]>;

  // Dashboard Cards operations
  getClientEngagement(customerId: number): Promise<{
    loginId: string;
    lastLoginAt: Date | null;
    thirtyDayActivity: Record<string, number>;
  } | null>;
  getRelationshipSummary(customerId: number): Promise<{
    totalDeposits: number;
    totalLoans: number;
    depositsQoQ: {
      amountChange: number;
      percentChange: number;
    };
    loansQoQ: {
      amountChange: number;
      percentChange: number;
    };
  }>;
  getContactHistory(customerId: number, limit?: number): Promise<Array<{
    contactType: string;
    occurredAt: Date;
    employeeName: string;
  }>>;

  // Notes operations
  getNoteCategories(includeInactive?: boolean): Promise<NoteCategory[]>;
  getCustomerNotes(customerId: number, includeDeleted?: boolean): Promise<NoteWithCurrentVersion[]>;
  getAccountNotes(accountId: number, includeDeleted?: boolean): Promise<NoteWithCurrentVersion[]>;
  getNote(noteId: number): Promise<NoteWithCurrentVersion | undefined>;
  createNote(noteData: CreateNoteData, authorEmployeeId: number): Promise<NoteWithCurrentVersion>;
  updateNote(noteId: number, updateData: UpdateNoteData, authorEmployeeId: number): Promise<NoteWithCurrentVersion | undefined>;
  softDeleteNote(noteId: number, deletedByEmployeeId: number): Promise<boolean>;
  restoreNote(noteId: number, restoredByEmployeeId: number): Promise<boolean>;
  pinNote(noteId: number, isPinned: boolean): Promise<boolean>;
  getNoteVersions(noteId: number): Promise<NoteVersion[]>;

  // RBAC operations
  getEmployeePermissions(employeeId: number): Promise<UserPermissions>;
  checkPermission(employeeId: number, permissionCode: string, context: PermissionContext): Promise<PermissionCheckResult>;
  searchNotes(params: SearchNotesParams): Promise<{ notes: NoteWithCurrentVersion[]; totalCount: number }>;
}

export class DatabaseStorage implements IBankingStorage {
  private searchProvider: ISearchProvider;

  constructor() {
    this.searchProvider = SearchProviderFactory.getProvider();
    fileLogger.info({ vendor: this.searchProvider.getVendor() }, 'Search provider initialized');
  }

  // Person/Customer operations
  async getCustomer(id: number): Promise<Customer | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerByIdSqlServer } = await import('./storage/sqlServerCustomer');
      const pool = await getMssqlPool();
      const result = await getCustomerByIdSqlServer(pool, id);
      return result || undefined;
    }

    // PostgreSQL implementation
    const result = await db
      .select()
      .from(customer)
      .where(eq(customer.customerId, id))
      .limit(1);

    return result[0];
  }

  async getCustomerByTaxId(taxId: string): Promise<Customer | undefined> {
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerByTaxIdSqlServer } = await import('./storage/sqlServerCustomer');
      const pool = await getMssqlPool();
      return await getCustomerByTaxIdSqlServer(pool, taxId);
    }
    const result = await db
      .select()
      .from(customer)
      .where(eq(customer.taxIdentifier, taxId))
      .limit(1);

    return result[0];
  }

  async getCustomerByCifNumber(cifNumber: string): Promise<Customer | undefined> {
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerByCifNumberSqlServer } = await import('./storage/sqlServerCustomer');
      const pool = await getMssqlPool();
      const result = await getCustomerByCifNumberSqlServer(pool, cifNumber);
      return result || undefined;
    }
    const result = await db
      .select()
      .from(customer)
      .where(eq(customer.jackHenryCifNumber, cifNumber))
      .limit(1);

    return result[0];
  }

  async getCustomerByGovernmentId(govId: string): Promise<Customer | undefined> {
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerByGovernmentIdSqlServer } = await import('./storage/sqlServerCustomer');
      const pool = await getMssqlPool();
      return await getCustomerByGovernmentIdSqlServer(pool, govId);
    }
    const result = await db
      .select()
      .from(customer)
      .where(eq(customer.governmentId, govId))
      .limit(1);

    return result[0];
  }

  async getCustomerWithDetails(id: number): Promise<CustomerWithDetails | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerWithDetailsSqlServer } = await import('./storage/sqlServerCustomer');
      const pool = await getMssqlPool();
      const result = await getCustomerWithDetailsSqlServer(pool, id);
      return result || undefined;
    }

    // PostgreSQL implementation using Drizzle ORM
    // Get person with primary email, phone, address, and branch
    const result = await db
      .select({
        customer: customer,
        primaryEmail: contactInfo.contactValue,
        primaryPhone: {
          value: contactInfo.contactValue,
          subtype: contactInfo.contactSubtype
        },
        primaryAddress: {
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country
        },
        branchName: branch.branchName,
        branchCode: branch.branchCode
      })
      .from(customer)
      .leftJoin(
        entityContact,
        and(
          eq(entityContact.entityId, customer.customerId),
          eq(entityContact.entityType, 'customer'),
          eq(entityContact.contactPurpose, 'primary'),
          eq(entityContact.isCurrent, true)
        )
      )
      .leftJoin(
        contactInfo,
        and(
          eq(contactInfo.contactId, entityContact.contactId),
          eq(contactInfo.contactType, 'email'),
          eq(contactInfo.isPrimary, true)
        )
      )
      .leftJoin(
        entityAddress,
        and(
          eq(entityAddress.entityId, customer.customerId),
          eq(entityAddress.entityType, 'customer'),
          eq(entityAddress.addressPurpose, 'primary'),
          eq(entityAddress.isCurrent, true)
        )
      )
      .leftJoin(address, eq(address.addressId, entityAddress.addressId))
      .leftJoin(branch, eq(branch.branchId, customer.branchId))
      .where(eq(customer.customerId, id))
      .limit(1);

    if (!result[0]?.customer) return undefined;

    // Get primary phone separately (different contact type)
    const phoneResult = await db
      .select({ contactValue: contactInfo.contactValue })
      .from(entityContact)
      .innerJoin(contactInfo, eq(contactInfo.contactId, entityContact.contactId))
      .where(
        and(
          eq(entityContact.entityId, id),
          eq(entityContact.entityType, 'customer'),
          eq(entityContact.contactPurpose, 'primary'),
          eq(contactInfo.contactType, 'phone'),
          eq(contactInfo.isPrimary, true)
        )
      )
      .limit(1);

    const personData = result[0];
    return {
      ...personData.customer,
      primaryEmail: personData.primaryEmail || undefined,
      primaryPhone: phoneResult[0]?.contactValue || undefined,
      primaryAddress: personData.primaryAddress?.addressLine1 ? {
        addressLine1: personData.primaryAddress.addressLine1,
        addressLine2: personData.primaryAddress.addressLine2 || undefined,
        city: personData.primaryAddress.city,
        state: personData.primaryAddress.state || undefined,
        postalCode: personData.primaryAddress.postalCode || undefined,
        country: personData.primaryAddress.country
      } : undefined,
      branchName: personData.branchName || undefined,
      branchCode: personData.branchCode || undefined
    };
  }

  async createCustomer(personData: InsertCustomer): Promise<Customer> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { createCustomerSqlServer } = await import('./storage/sqlServerCustomer');
      const pool = await getMssqlPool();
      return await createCustomerSqlServer(pool, personData);
    }

    // PostgreSQL implementation
    const result = await db
      .insert(customer)
      .values(personData)
      .returning();

    return result[0];
  }

  async updateCustomer(id: number, personData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { updateCustomerSqlServer } = await import('./storage/sqlServerCustomer');
      const pool = await getMssqlPool();
      return await updateCustomerSqlServer(pool, id, personData);
    }

    // PostgreSQL implementation
    const result = await db
      .update(customer)
      .set(personData)
      .where(eq(customer.customerId, id))
      .returning();

    return result[0];
  }

  async deactivateCustomer(id: number): Promise<Customer | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { deactivateCustomerSqlServer } = await import('./storage/sqlServerCustomer');
      const pool = await getMssqlPool();
      return await deactivateCustomerSqlServer(pool, id);
    }

    // PostgreSQL implementation
    const result = await db
      .update(customer)
      .set({ customerStatus: 'inactive' })
      .where(eq(customer.customerId, id))
      .returning();

    return result[0];
  }

  async searchCustomers(params: SearchCustomerParams): Promise<CustomerSearchResult> {
    // SQL Server implementation using raw SQL
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { searchCustomersSqlServer } = await import('./storage/sqlServerCustomerSearch');
      const pool = await getMssqlPool();
      return await searchCustomersSqlServer(pool, params);
    }

    // PostgreSQL implementation using Drizzle ORM
    const { query, limit, offset } = params;

    // Build search conditions - handle both individual fields and full name searches
    const searchConditions = or(
      ilike(customer.firstName, `%${query}%`),
      ilike(customer.lastName, `%${query}%`),
      ilike(customer.taxIdentifier, `%${query}%`),
      ilike(customer.silverlakeCustomerId, `%${query}%`),
      // Support full name search by concatenating first and last name
      ilike(sql`CONCAT(${customer.firstName}, ' ', ${customer.lastName})`, `%${query}%`)
    );

    // Get persons with basic details
    const persons = await db
      .select()
      .from(customer)
      .where(searchConditions)
      .orderBy(asc(customer.lastName), asc(customer.firstName))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination using efficient COUNT query
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(customer)
      .where(searchConditions);

    const totalCount = Number(totalResult[0]?.count ?? 0);
    const hasMore = offset + limit < totalCount;

    // Enhance persons with basic contact details
    const personsWithDetails: CustomerWithDetails[] = await Promise.all(
      persons.map(async (p) => {
        const details = await this.getCustomerWithDetails(p.customerId);
        return details || p;
      })
    );

    return {
      customers: personsWithDetails,
      totalCount,
      hasMore
    };
  }

  // Contact operations - Returns contact info
  async getCustomerContacts(customerId: number): Promise<ContactInfo[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerContactsSqlServer } = await import('./storage/sqlServerContact');
      const pool = await getMssqlPool();
      return await getCustomerContactsSqlServer(pool, customerId);
    }

    // PostgreSQL implementation
    // Fetch contact info (emails, phones)
    const contactResult = await db
      .select({ 
        contact: contactInfo,
        purpose: entityContact.contactPurpose
      })
      .from(entityContact)
      .innerJoin(contactInfo, eq(contactInfo.contactId, entityContact.contactId))
      .where(
        and(
          eq(entityContact.entityId, customerId),
          eq(entityContact.entityType, 'customer'),
          eq(entityContact.isCurrent, true)
        )
      );

    // Return raw ContactInfo objects from database
    return contactResult.map(r => r.contact);
  }

  // Get contacts and addresses combined for complete contact information
  async getCustomerContactsAndAddresses(customerId: number): Promise<{
    contacts: ContactInfo[], 
    addresses: Address[]
  }> {
    // Fetch contact info (emails, phones)
    const contacts = await this.getCustomerContacts(customerId);

    // Fetch addresses
    const addresses = await this.getCustomerAddresses(customerId);

    return { contacts, addresses };
  }

  async addCustomerContact(customerId: number, contactData: InsertContactInfo): Promise<ContactInfo> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { addCustomerContactSqlServer } = await import('./storage/sqlServerContact');
      const pool = await getMssqlPool();
      return await addCustomerContactSqlServer(pool, customerId, contactData);
    }

    // PostgreSQL implementation
    // First create the contact info
    const contactResult = await db
      .insert(contactInfo)
      .values(contactData)
      .returning();

    const newContact = contactResult[0];

    // If this is a primary contact, deactivate any existing primary contacts
    if (contactData.contactType === 'email' || contactData.contactType === 'phone') {
      await db
        .update(entityContact)
        .set({ 
          isCurrent: false,
          endDate: sql`CURRENT_DATE`
        })
        .where(
          and(
            eq(entityContact.entityId, customerId),
            eq(entityContact.entityType, 'customer'),
            eq(entityContact.contactPurpose, 'primary'),
            eq(entityContact.isCurrent, true)
          )
        );
    }

    // Then link it to the person
    await db
      .insert(entityContact)
      .values({
        entityType: 'person',
        entityId: customerId,
        contactId: newContact.contactId,
        contactPurpose: 'primary',
        isCurrent: true
      });

    return newContact;
  }

  async updateContact(contactId: number, contactData: Partial<InsertContactInfo>): Promise<ContactInfo | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { updateContactSqlServer } = await import('./storage/sqlServerContact');
      const pool = await getMssqlPool();
      return await updateContactSqlServer(pool, contactId, contactData);
    }

    // PostgreSQL implementation
    const result = await db
      .update(contactInfo)
      .set(contactData)
      .where(eq(contactInfo.contactId, contactId))
      .returning();

    return result[0];
  }

  async deactivateCustomerContact(customerId: number, contactId: number): Promise<boolean> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { deactivateCustomerContactSqlServer } = await import('./storage/sqlServerContact');
      const pool = await getMssqlPool();
      return await deactivateCustomerContactSqlServer(pool, customerId, contactId);
    }

    // PostgreSQL implementation
    const result = await db
      .update(entityContact)
      .set({ 
        isCurrent: false,
        endDate: sql`CURRENT_DATE`
      })
      .where(
        and(
          eq(entityContact.entityId, customerId),
          eq(entityContact.entityType, 'customer'),
          eq(entityContact.contactId, contactId)
        )
      );

    return (result.rowCount ?? 0) > 0;
  }

  // Address operations
  async getCustomerAddresses(customerId: number): Promise<Address[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerAddressesSqlServer } = await import('./storage/sqlServerContact');
      const pool = await getMssqlPool();
      return await getCustomerAddressesSqlServer(pool, customerId);
    }

    // PostgreSQL implementation
    const result = await db
      .select({ address: address })
      .from(entityAddress)
      .innerJoin(address, eq(address.addressId, entityAddress.addressId))
      .where(
        and(
          eq(entityAddress.entityId, customerId),
          eq(entityAddress.entityType, 'customer'),
          eq(entityAddress.isCurrent, true)
        )
      );

    return result.map(r => r.address);
  }

  async addCustomerAddress(customerId: number, addressData: InsertAddress): Promise<Address> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { addCustomerAddressSqlServer } = await import('./storage/sqlServerContact');
      const pool = await getMssqlPool();
      return await addCustomerAddressSqlServer(pool, customerId, addressData);
    }

    // PostgreSQL implementation
    // First create the address
    const addressResult = await db
      .insert(address)
      .values(addressData)
      .returning();

    const newAddress = addressResult[0];

    // If this is a primary address, deactivate any existing primary addresses
    if (addressData.addressType === 'primary' || addressData.addressType === 'mailing') {
      await db
        .update(entityAddress)
        .set({ 
          isCurrent: false,
          endDate: sql`CURRENT_DATE`
        })
        .where(
          and(
            eq(entityAddress.entityId, customerId),
            eq(entityAddress.entityType, 'customer'),
            eq(entityAddress.addressPurpose, 'primary'),
            eq(entityAddress.isCurrent, true)
          )
        );
    }

    // Then link it to the person
    await db
      .insert(entityAddress)
      .values({
        entityType: 'person',
        entityId: customerId,
        addressId: newAddress.addressId,
        addressPurpose: 'primary',
        isCurrent: true
      });

    return newAddress;
  }

  async updateAddress(addressId: number, addressData: Partial<InsertAddress>): Promise<Address | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { updateAddressSqlServer } = await import('./storage/sqlServerContact');
      const pool = await getMssqlPool();
      return await updateAddressSqlServer(pool, addressId, addressData);
    }

    // PostgreSQL implementation
    const result = await db
      .update(address)
      .set(addressData)
      .where(eq(address.addressId, addressId))
      .returning();

    return result[0];
  }

  async deactivateCustomerAddress(customerId: number, addressId: number): Promise<boolean> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { deactivateCustomerAddressSqlServer } = await import('./storage/sqlServerContact');
      const pool = await getMssqlPool();
      return await deactivateCustomerAddressSqlServer(pool, customerId, addressId);
    }

    // PostgreSQL implementation
    const result = await db
      .update(entityAddress)
      .set({ 
        isCurrent: false,
        endDate: sql`CURRENT_DATE`
      })
      .where(
        and(
          eq(entityAddress.entityId, customerId),
          eq(entityAddress.entityType, 'customer'),
          eq(entityAddress.addressId, addressId)
        )
      );

    return (result.rowCount ?? 0) > 0;
  }

  // Household operations
  async getHousehold(id: number): Promise<Household | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getHouseholdSqlServer } = await import('./storage/sqlServerHousehold');
      const pool = await getMssqlPool();
      const result = await getHouseholdSqlServer(pool, id);
      return result || undefined;
    }

    // PostgreSQL implementation
    const result = await db
      .select()
      .from(household)
      .where(eq(household.householdId, id))
      .limit(1);

    return result[0];
  }

  async getCustomerHouseholds(customerId: number): Promise<Household[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerHouseholdsSqlServer } = await import('./storage/sqlServerHousehold');
      const pool = await getMssqlPool();
      return await getCustomerHouseholdsSqlServer(pool, customerId);
    }

    // PostgreSQL implementation
    const result = await db
      .select({ household: household })
      .from(householdMembership)
      .innerJoin(household, eq(household.householdId, householdMembership.householdId))
      .where(
        and(
          eq(householdMembership.customerId, customerId),
          eq(household.householdStatus, 'active')
        )
      );

    return result.map(r => r.household);
  }

  async createHousehold(householdData: InsertHousehold): Promise<Household> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { createHouseholdSqlServer } = await import('./storage/sqlServerHousehold');
      const pool = await getMssqlPool();
      return await createHouseholdSqlServer(pool, householdData);
    }

    // PostgreSQL implementation
    const result = await db
      .insert(household)
      .values(householdData)
      .returning();

    return result[0];
  }

  async addHouseholdMember(membershipData: InsertHouseholdMembership): Promise<HouseholdMembership> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { addHouseholdMemberSqlServer } = await import('./storage/sqlServerHousehold');
      const pool = await getMssqlPool();
      return await addHouseholdMemberSqlServer(
        pool, 
        membershipData.householdId, 
        membershipData.customerId, 
        membershipData
      );
    }

    // PostgreSQL implementation
    const result = await db
      .insert(householdMembership)
      .values(membershipData)
      .returning();

    return result[0];
  }

  async updateHousehold(id: number, householdData: Partial<InsertHousehold>): Promise<Household | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { updateHouseholdSqlServer } = await import('./storage/sqlServerHousehold');
      const pool = await getMssqlPool();
      const result = await updateHouseholdSqlServer(pool, id, householdData);
      return result || undefined;
    }

    // PostgreSQL implementation
    const result = await db
      .update(household)
      .set(householdData)
      .where(eq(household.householdId, id))
      .returning();

    return result[0];
  }

  async closeHousehold(id: number): Promise<Household | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { closeHouseholdSqlServer } = await import('./storage/sqlServerHousehold');
      const pool = await getMssqlPool();
      const result = await closeHouseholdSqlServer(pool, id);
      return result || undefined;
    }

    // PostgreSQL implementation
    const result = await db
      .update(household)
      .set({ householdStatus: 'closed' })
      .where(eq(household.householdId, id))
      .returning();

    return result[0];
  }

  async endHouseholdMember(membershipId: number): Promise<HouseholdMembership | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { endHouseholdMemberSqlServer } = await import('./storage/sqlServerHousehold');
      const pool = await getMssqlPool();
      const result = await endHouseholdMemberSqlServer(pool, membershipId);
      return result || undefined;
    }

    // PostgreSQL implementation
    const result = await db
      .update(householdMembership)
      .set({ membershipEndDate: sql`CURRENT_DATE` })
      .where(eq(householdMembership.membershipId, membershipId))
      .returning();

    return result[0];
  }

  async getHouseholdMembers(householdId: number): Promise<HouseholdMemberWithCustomer[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getHouseholdMembersSqlServer } = await import('./storage/sqlServerHousehold');
      const pool = await getMssqlPool();
      return await getHouseholdMembersSqlServer(pool, householdId) as any;
    }

    // PostgreSQL implementation
    const result = await db
      .select({
        membershipId: householdMembership.membershipId,
        householdId: householdMembership.householdId,
        customerId: householdMembership.customerId,
        relationshipRole: householdMembership.relationshipRole,
        isPrimaryMember: householdMembership.isPrimaryMember,
        isHeadOfHousehold: householdMembership.isHeadOfHousehold,
        membershipStartDate: householdMembership.membershipStartDate,
        membershipEndDate: householdMembership.membershipEndDate,
        firstName: customer.firstName,
        lastName: customer.lastName,
        fullName: customer.fullName,
        dateOfBirth: customer.dateOfBirth,
        customerSince: customer.customerSince
      })
      .from(householdMembership)
      .innerJoin(customer, eq(customer.customerId, householdMembership.customerId))
      .where(eq(householdMembership.householdId, householdId))
      .orderBy(asc(householdMembership.membershipId));

    return result.map(r => ({
      ...r,
      isPrimaryMember: r.isPrimaryMember ?? false,
      isHeadOfHousehold: r.isHeadOfHousehold ?? false
    }));
  }

  async getSubsidiaryHouseholds(parentHouseholdId: number): Promise<Household[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getSubsidiaryHouseholdsSqlServer } = await import('./storage/sqlServerHousehold');
      const pool = await getMssqlPool();
      return await getSubsidiaryHouseholdsSqlServer(pool, parentHouseholdId);
    }

    // PostgreSQL implementation
    const result = await db
      .select()
      .from(household)
      .where(eq(household.parentHouseholdId, parentHouseholdId))
      .orderBy(asc(household.householdName));

    return result;
  }

  // Account operations
  async getAccount(id: number): Promise<Account | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getAccountSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      const result = await getAccountSqlServer(pool, id);
      return result || undefined;
    }

    // PostgreSQL implementation
    const result = await db
      .select()
      .from(account)
      .where(eq(account.accountId, id))
      .limit(1);

    return result[0];
  }

  async getCustomerAccounts(customerId: number): Promise<Account[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerAccountsSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      return await getCustomerAccountsSqlServer(pool, customerId);
    }

    // PostgreSQL implementation
    const result = await db
      .select({ account: account })
      .from(accountOwnership)
      .innerJoin(account, eq(account.accountId, accountOwnership.accountId))
      .where(
        and(
          eq(accountOwnership.customerId, customerId),
          eq(account.accountStatus, 'active')
        )
      );

    return result.map(r => r.account);
  }

  async createAccount(accountData: InsertAccount): Promise<Account> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { createAccountSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      return await createAccountSqlServer(pool, accountData);
    }

    // PostgreSQL implementation
    const result = await db
      .insert(account)
      .values(accountData)
      .returning();

    return result[0];
  }

  async updateAccount(id: number, accountData: Partial<InsertAccount>): Promise<Account | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { updateAccountSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      return await updateAccountSqlServer(pool, id, accountData);
    }

    // PostgreSQL implementation
    const result = await db
      .update(account)
      .set(accountData)
      .where(eq(account.accountId, id))
      .returning();

    return result[0];
  }

  async getAccountOwners(accountId: number): Promise<AccountOwnership[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getAccountOwnersSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      return await getAccountOwnersSqlServer(pool, accountId);
    }

    // PostgreSQL implementation
    const result = await db
      .select()
      .from(accountOwnership)
      .where(eq(accountOwnership.accountId, accountId));

    return result;
  }

  async addAccountOwner(ownershipData: InsertAccountOwnership): Promise<AccountOwnership> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { addAccountOwnerSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      return await addAccountOwnerSqlServer(pool, ownershipData);
    }

    // PostgreSQL implementation
    const result = await db
      .insert(accountOwnership)
      .values(ownershipData)
      .returning();

    return result[0];
  }

  async closeAccount(id: number): Promise<Account | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { closeAccountSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      return await closeAccountSqlServer(pool, id);
    }

    // PostgreSQL implementation
    const result = await db
      .update(account)
      .set({ 
        accountStatus: 'closed',
        closedDate: sql`CURRENT_DATE`
      })
      .where(eq(account.accountId, id))
      .returning();

    return result[0];
  }

  async updateOwnership(ownershipId: number, ownershipData: Partial<InsertAccountOwnership>): Promise<AccountOwnership | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { updateOwnershipSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      return await updateOwnershipSqlServer(pool, ownershipId, ownershipData);
    }

    // PostgreSQL implementation
    const result = await db
      .update(accountOwnership)
      .set(ownershipData)
      .where(eq(accountOwnership.ownershipId, ownershipId))
      .returning();

    return result[0];
  }

  async removeOwnership(ownershipId: number): Promise<boolean> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { removeOwnershipSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      return await removeOwnershipSqlServer(pool, ownershipId);
    }

    // PostgreSQL implementation
    const result = await db
      .update(accountOwnership)
      .set({ 
        relationshipEndDate: sql`CURRENT_DATE`
      })
      .where(eq(accountOwnership.ownershipId, ownershipId));

    return (result.rowCount ?? 0) > 0;
  }

  async getAccounts(filters?: { accountType?: string; accountStatus?: string; branchId?: number }): Promise<Account[]> {
    if (!filters) {
      return await db.select().from(account);
    }

    const conditions = [];
    if (filters.accountType) {
      conditions.push(eq(account.accountType, filters.accountType));
    }
    if (filters.accountStatus) {
      conditions.push(eq(account.accountStatus, filters.accountStatus));
    }
    if (filters.branchId) {
      conditions.push(eq(account.branchId, filters.branchId));
    }

    if (conditions.length === 0) {
      return await db.select().from(account);
    }

    return await db
      .select()
      .from(account)
      .where(and(...conditions));
  }

  async getCustomerDepositAccounts(customerId: number): Promise<Account[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerDepositAccountsSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      return await getCustomerDepositAccountsSqlServer(pool, customerId);
    }

    // PostgreSQL implementation
    const result = await db
      .select({ account: account })
      .from(accountOwnership)
      .innerJoin(account, eq(account.accountId, accountOwnership.accountId))
      .where(
        and(
          eq(accountOwnership.customerId, customerId),
          eq(account.accountStatus, 'active'),
          or(
            eq(account.accountType, 'checking'),
            eq(account.accountType, 'savings'),
            eq(account.accountType, 'cd')
          )
        )
      );

    return result.map(r => r.account);
  }

  async getDepositAccountAnalytics(customerId: number): Promise<{
    totalBalance: number;
    accounts: Account[];
    balanceByType: { checking: number; savings: number; cd: number };
  }> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getDepositAccountAnalyticsSqlServer } = await import('./storage/sqlServerDashboard');
      const pool = await getMssqlPool();
      const result = await getDepositAccountAnalyticsSqlServer(pool, customerId);
      return {
        totalBalance: result.totalBalance,
        accounts: result.accounts,
        balanceByType: result.balanceByType
      };
    }

    // PostgreSQL implementation
    const accounts = await this.getCustomerDepositAccounts(customerId);

    const balanceByType = {
      checking: 0,
      savings: 0,
      cd: 0
    };

    let totalBalance = 0;

    accounts.forEach(acc => {
      const balance = parseFloat(acc.balance || '0');
      totalBalance += balance;

      const accType = acc.accountType?.toLowerCase();
      if (accType === 'checking' || accType === 'deposit checking') {
        balanceByType.checking += balance;
      } else if (accType === 'savings') {
        balanceByType.savings += balance;
      } else if (accType === 'cd' || accType === 'certificate') {
        balanceByType.cd += balance;
      }
    });

    return {
      totalBalance,
      accounts,
      balanceByType
    };
  }

  // Debit Card operations
  async getAccountDebitCards(accountId: number): Promise<DebitCardWithLimitProfile[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getAccountDebitCardsSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      return await getAccountDebitCardsSqlServer(pool, accountId);
    }

    // PostgreSQL implementation
    const result = await db
      .select({
        cardId: debitCard.cardId,
        accountId: debitCard.accountId,
        customerId: debitCard.customerId,
        cardType: debitCard.cardType,
        cardStatus: debitCard.cardStatus,
        lastFourDigits: debitCard.lastFourDigits,
        cardBrand: debitCard.cardBrand,
        expiryMonth: debitCard.expiryMonth,
        expiryYear: debitCard.expiryYear,
        cardholderName: debitCard.cardholderName,
        jackHenryCardId: debitCard.jackHenryCardId,
        silverlakeCardToken: debitCard.silverlakeCardToken,
        profileId: debitCardLimitProfile.profileId,
        profileName: debitCardLimitProfile.profileName,
        profileDescription: debitCardLimitProfile.profileDescription,
        dailyPurchaseLimit: debitCardLimitProfile.dailyPurchaseLimit,
        dailyAtmLimit: debitCardLimitProfile.dailyAtmLimit,
        singleTransactionLimit: debitCardLimitProfile.singleTransactionLimit,
        monthlyLimit: debitCardLimitProfile.monthlyLimit
      })
      .from(debitCard)
      .leftJoin(
        debitCardLimitProfile,
        eq(debitCard.limitProfileId, debitCardLimitProfile.profileId)
      )
      .where(eq(debitCard.accountId, accountId))
      .orderBy(desc(debitCard.cardId)); // Most recent cards first

    // Transform to DebitCardWithLimitProfile format
    return result.map(row => ({
      cardId: row.cardId,
      accountId: row.accountId,
      customerId: row.customerId,
      cardType: row.cardType,
      cardStatus: row.cardStatus,
      lastFourDigits: row.lastFourDigits,
      cardBrand: row.cardBrand,
      expiryMonth: row.expiryMonth,
      expiryYear: row.expiryYear,
      cardholderName: row.cardholderName,
      jackHenryCardId: row.jackHenryCardId,
      silverlakeCardToken: row.silverlakeCardToken,
      limitProfile: row.profileId ? {
        profileId: row.profileId,
        profileName: row.profileName!,
        profileDescription: row.profileDescription,
        dailyPurchaseLimit: row.dailyPurchaseLimit!,
        dailyAtmLimit: row.dailyAtmLimit!,
        singleTransactionLimit: row.singleTransactionLimit,
        monthlyLimit: row.monthlyLimit
      } : null
    }));
  }

  // Branch operations
  async getBranch(id: number): Promise<Branch | undefined> {
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getBranchSqlServer } = await import('./storage/sqlServerBranch');
      const pool = await getMssqlPool();
      return await getBranchSqlServer(pool, id);
    }
    const result = await db
      .select()
      .from(branch)
      .where(eq(branch.branchId, id))
      .limit(1);

    return result[0];
  }

  async getBranches(): Promise<Branch[]> {
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getBranchesSqlServer } = await import('./storage/sqlServerBranch');
      const pool = await getMssqlPool();
      return await getBranchesSqlServer(pool);
    }
    const result = await db
      .select()
      .from(branch)
      .where(eq(branch.isActive, true))
      .orderBy(asc(branch.branchName));

    return result;
  }

  async createBranch(branchData: InsertBranch): Promise<Branch> {
    const result = await db
      .insert(branch)
      .values(branchData)
      .returning();

    return result[0];
  }

  async updateBranch(id: number, branchData: Partial<InsertBranch>): Promise<Branch | undefined> {
    const result = await db
      .update(branch)
      .set(branchData)
      .where(eq(branch.branchId, id))
      .returning();

    return result[0];
  }

  async deactivateBranch(id: number): Promise<Branch | undefined> {
    const result = await db
      .update(branch)
      .set({ isActive: false })
      .where(eq(branch.branchId, id))
      .returning();

    return result[0];
  }

  // Employee operations
  async getEmployee(id: number): Promise<Employee | undefined> {
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getEmployeeSqlServer } = await import('./storage/sqlServerEmployee');
      const pool = await getMssqlPool();
      return await getEmployeeSqlServer(pool, id);
    }
    const result = await db
      .select()
      .from(employee)
      .where(eq(employee.employeeId, id))
      .limit(1);

    return result[0];
  }

  async getEmployees(branchId?: number): Promise<Employee[]> {
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getEmployeesSqlServer } = await import('./storage/sqlServerEmployee');
      const pool = await getMssqlPool();
      return await getEmployeesSqlServer(pool, branchId);
    }
    if (branchId !== undefined) {
      return await db
        .select({ employee })
        .from(employee)
        .innerJoin(employeeBranch, eq(employeeBranch.employeeId, employee.employeeId))
        .where(and(eq(employee.isActive, true), eq(employeeBranch.branchId, branchId)))
        .then(rows => rows.map(r => r.employee));
    }
    return await db.select().from(employee).where(eq(employee.isActive, true)).orderBy(employee.lastName, employee.firstName);
  }

  async createEmployee(employeeData: InsertEmployee): Promise<Employee> {
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { createEmployeeSqlServer } = await import('./storage/sqlServerEmployee');
      const pool = await getMssqlPool();
      return await createEmployeeSqlServer(pool, employeeData);
    }
    const result = await db
      .insert(employee)
      .values(employeeData)
      .returning();

    return result[0];
  }

  async updateEmployee(id: number, employeeData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { updateEmployeeSqlServer } = await import('./storage/sqlServerEmployee');
      const pool = await getMssqlPool();
      return await updateEmployeeSqlServer(pool, id, employeeData);
    }
    const result = await db
      .update(employee)
      .set(employeeData)
      .where(eq(employee.employeeId, id))
      .returning();

    return result[0];
  }

  async deactivateEmployee(id: number): Promise<Employee | undefined> {
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { deactivateEmployeeSqlServer } = await import('./storage/sqlServerEmployee');
      const pool = await getMssqlPool();
      return await deactivateEmployeeSqlServer(pool, id);
    }
    const result = await db
      .update(employee)
      .set({ isActive: false })
      .where(eq(employee.employeeId, id))
      .returning();

    return result[0];
  }

  // Customer-Officer assignment operations
  async getCustomerOfficers(customerId: number): Promise<CustomerOfficerAssignment[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerOfficersSqlServer } = await import('./storage/sqlServerOfficer');
      const pool = await getMssqlPool();
      return await getCustomerOfficersSqlServer(pool, customerId);
    }

    // PostgreSQL implementation
    const result = await db
      .select()
      .from(customerOfficerAssignment)
      .where(eq(customerOfficerAssignment.customerId, customerId))
      .orderBy(desc(sql`CASE WHEN ${customerOfficerAssignment.relationshipType} = 'primary' THEN 1 ELSE 2 END`));

    return result;
  }

  async getOfficerCustomers(officerCode: string): Promise<CustomerOfficerAssignment[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getOfficerCustomersSqlServer } = await import('./storage/sqlServerOfficer');
      const pool = await getMssqlPool();
      return await getOfficerCustomersSqlServer(pool, officerCode);
    }

    // PostgreSQL implementation
    const result = await db
      .select()
      .from(customerOfficerAssignment)
      .where(eq(customerOfficerAssignment.officerCode, officerCode))
      .orderBy(desc(sql`CASE WHEN ${customerOfficerAssignment.relationshipType} = 'primary' THEN 1 ELSE 2 END`));

    return result;
  }

  async getCustomerOfficersWithDetails(customerId: number): Promise<Array<{
    officerCode: string | null;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    department: string | null;
    relationshipType: 'primary' | 'secondary';
    assignedAt: Date | null;
  }>> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerOfficersWithDetailsSqlServer } = await import('./storage/sqlServerOfficer');
      const pool = await getMssqlPool();
      return await getCustomerOfficersWithDetailsSqlServer(pool, customerId);
    }

    // PostgreSQL implementation
    const result = await db
      .select({
        officerCode: employee.officerCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        title: employee.title,
        department: employee.department,
        relationshipType: customerOfficerAssignment.relationshipType,
        assignedAt: customerOfficerAssignment.assignedAt
      })
      .from(customerOfficerAssignment)
      .innerJoin(
        employee,
        eq(customerOfficerAssignment.officerCode, employee.officerCode)
      )
      .where(
        and(
          eq(customerOfficerAssignment.customerId, customerId),
          isNotNull(employee.officerCode),
          eq(employee.isActive, true)
        )
      )
      .orderBy(
        desc(sql`CASE WHEN ${customerOfficerAssignment.relationshipType} = 'primary' THEN 1 ELSE 2 END`),
        employee.lastName,
        employee.firstName
      );

    return result.map(row => ({
      ...row,
      relationshipType: row.relationshipType as 'primary' | 'secondary'
    }));
  }

  async addCustomerOfficer(assignmentData: InsertCustomerOfficerAssignment): Promise<CustomerOfficerAssignment> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { addCustomerOfficerSqlServer } = await import('./storage/sqlServerOfficer');
      const pool = await getMssqlPool();
      return await addCustomerOfficerSqlServer(pool, assignmentData);
    }

    // PostgreSQL implementation
    const result = await db
      .insert(customerOfficerAssignment)
      .values(assignmentData)
      .returning();

    return result[0];
  }

  async updateCustomerOfficer(
    customerId: number, 
    officerCode: string, 
    relationshipType: string
  ): Promise<CustomerOfficerAssignment | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { updateCustomerOfficerSqlServer } = await import('./storage/sqlServerOfficer');
      const pool = await getMssqlPool();
      return await updateCustomerOfficerSqlServer(pool, customerId, officerCode, relationshipType);
    }

    // PostgreSQL implementation
    const result = await db
      .update(customerOfficerAssignment)
      .set({ 
        relationshipType,
        updatedAt: sql`NOW()` 
      })
      .where(
        and(
          eq(customerOfficerAssignment.customerId, customerId),
          eq(customerOfficerAssignment.officerCode, officerCode)
        )
      )
      .returning();

    return result[0];
  }

  async removeCustomerOfficer(customerId: number, officerCode: string): Promise<boolean> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { removeCustomerOfficerSqlServer } = await import('./storage/sqlServerOfficer');
      const pool = await getMssqlPool();
      return await removeCustomerOfficerSqlServer(pool, customerId, officerCode);
    }

    // PostgreSQL implementation
    const result = await db
      .delete(customerOfficerAssignment)
      .where(
        and(
          eq(customerOfficerAssignment.customerId, customerId),
          eq(customerOfficerAssignment.officerCode, officerCode)
        )
      )
      .returning();

    return result.length > 0;
  }

  // Customer-SIC Code assignment operations
  async getCustomerSicCodes(customerId: number): Promise<CustomerSicCode[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const pool = await getMssqlPool();
      const request = pool.request();
      request.input('customerId', sql.BigInt, customerId);
      const result = await request.query(`
        SELECT * FROM customer_sic_code 
        WHERE customer_id = @customerId 
        ORDER BY sic_code
      `);
      return result.recordset.map((row: any) => ({
        customerId: row.customer_id,
        sicCode: row.sic_code,
        effectiveDate: row.effective_date,
        endDate: row.end_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }

    const result = await db
      .select()
      .from(customerSicCode)
      .where(eq(customerSicCode.customerId, customerId))
      .orderBy(customerSicCode.sicCode);

    return result;
  }

  async getSicCodeCustomers(sicCode: number): Promise<CustomerSicCode[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const pool = await getMssqlPool();
      const request = pool.request();
      request.input('sicCode', sql.Int, sicCode);
      const result = await request.query(`
        SELECT * FROM customer_sic_code 
        WHERE sic_code = @sicCode 
        ORDER BY customer_id
      `);
      return result.recordset.map((row: any) => ({
        customerId: row.customer_id,
        sicCode: row.sic_code,
        effectiveDate: row.effective_date,
        endDate: row.end_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }

    const result = await db
      .select()
      .from(customerSicCode)
      .where(eq(customerSicCode.sicCode, sicCode))
      .orderBy(customerSicCode.customerId);

    return result;
  }

  async addCustomerSicCode(assignmentData: InsertCustomerSicCode): Promise<CustomerSicCode> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const pool = await getMssqlPool();
      const request = pool.request();
      request.input('customerId', sql.BigInt, assignmentData.customerId);
      request.input('sicCode', sql.Int, assignmentData.sicCode);
      request.input('effectiveDate', sql.Date, assignmentData.effectiveDate || null);
      request.input('endDate', sql.Date, assignmentData.endDate || null);
      const result = await request.query(`
        INSERT INTO customer_sic_code (customer_id, sic_code, effective_date, end_date)
        OUTPUT INSERTED.*
        VALUES (@customerId, @sicCode, @effectiveDate, @endDate)
      `);
      return {
        customerId: result.recordset[0].customer_id,
        sicCode: result.recordset[0].sic_code,
        effectiveDate: result.recordset[0].effective_date,
        endDate: result.recordset[0].end_date,
        createdAt: result.recordset[0].created_at,
        updatedAt: result.recordset[0].updated_at
      };
    }

    const result = await db
      .insert(customerSicCode)
      .values(assignmentData)
      .returning();

    return result[0];
  }

  async removeCustomerSicCode(customerId: number, sicCode: number): Promise<boolean> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const pool = await getMssqlPool();
      const request = pool.request();
      request.input('customerId', sql.BigInt, customerId);
      request.input('sicCode', sql.Int, sicCode);
      const result = await request.query(`
        DELETE FROM customer_sic_code 
        OUTPUT DELETED.customer_id
        WHERE customer_id = @customerId AND sic_code = @sicCode
      `);
      return result.recordset.length > 0;
    }

    const result = await db
      .delete(customerSicCode)
      .where(
        and(
          eq(customerSicCode.customerId, customerId),
          eq(customerSicCode.sicCode, sicCode)
        )
      )
      .returning();

    return result.length > 0;
  }

  // Account-SIC Code assignment operations
  async getAccountSicCodes(accountId: number): Promise<AccountSicCode[]> {
    const result = await db
      .select()
      .from(accountSicCode)
      .where(eq(accountSicCode.accountId, accountId))
      .orderBy(accountSicCode.effectiveDate);

    return result;
  }

  async getAccountSicCodesWithDescriptions(accountId: number): Promise<Array<{
    sicCode: number;
    description: string;
    effectiveDate: string | null;
    endDate: string | null;
  }>> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getAccountSicCodesWithDescriptionsSqlServer } = await import('./storage/sqlServerAccount');
      const pool = await getMssqlPool();
      return await getAccountSicCodesWithDescriptionsSqlServer(pool, accountId);
    }

    // PostgreSQL implementation
    const result = await db
      .select({
        sicCode: accountSicCode.sicCode,
        description: sicCode.description,
        effectiveDate: accountSicCode.effectiveDate,
        endDate: accountSicCode.endDate
      })
      .from(accountSicCode)
      .innerJoin(sicCode, eq(accountSicCode.sicCode, sicCode.sicCode))
      .where(eq(accountSicCode.accountId, accountId))
      .orderBy(accountSicCode.effectiveDate);

    return result;
  }

  async getSicCodeAccounts(sicCode: number): Promise<AccountSicCode[]> {
    const result = await db
      .select()
      .from(accountSicCode)
      .where(eq(accountSicCode.sicCode, sicCode))
      .orderBy(accountSicCode.accountId);

    return result;
  }

  async addAccountSicCode(assignmentData: InsertAccountSicCode): Promise<AccountSicCode> {
    const result = await db
      .insert(accountSicCode)
      .values(assignmentData)
      .returning();

    return result[0];
  }

  async updateAccountSicCode(
    accountSicCodeId: number, 
    updateData: Partial<InsertAccountSicCode>
  ): Promise<AccountSicCode | undefined> {
    const result = await db
      .update(accountSicCode)
      .set({ 
        ...updateData,
        updatedAt: sql`NOW()` 
      })
      .where(eq(accountSicCode.accountSicCodeId, accountSicCodeId))
      .returning();

    return result[0];
  }

  async removeAccountSicCode(accountId: number, sicCode: number): Promise<boolean> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const pool = await getMssqlPool();
      const request = pool.request();
      request.input('accountId', sql.BigInt, accountId);
      request.input('sicCode', sql.Int, sicCode);
      const result = await request.query(`
        DELETE FROM account_sic_code 
        OUTPUT DELETED.account_id
        WHERE account_id = @accountId AND sic_code = @sicCode
      `);
      return result.recordset.length > 0;
    }

    const result = await db
      .delete(accountSicCode)
      .where(
        and(
          eq(accountSicCode.accountId, accountId),
          eq(accountSicCode.sicCode, sicCode)
        )
      )
      .returning();

    return result.length > 0;
  }

  // Smart search operations
  async smartSearchCustomers(params: SmartSearchParams): Promise<SmartSearchResult> {
    const { q, fields, type, exact, limit, cursor, includeTotal } = params;

    // Normalize query
    const normalizedQuery = this.normalizeSearchQuery(q);

    // Detect search type if auto
    const detectedType = type === 'auto' 
      ? this.detectSearchType(normalizedQuery) 
      : type;

    let searchFields: SearchField[] = [];
    let persons: CustomerListItem[] = [];

    // Execute search based on detected type using database-agnostic provider
    if (fields) {
      // Field-specific search
      searchFields = fields;
      persons = await this.searchByFields(normalizedQuery, fields, limit + 1, cursor);
    } else {
      // Smart type-based search using SearchProvider
      switch (detectedType) {
        case 'cif':
          // Apply result cap for very short CIF prefix queries to prevent overwhelming results
          const cifQueryLength = normalizedQuery.length;
          const isShortCifPrefix = cifQueryLength <= 3;
          const effectiveLimit = isShortCifPrefix ? Math.min(limit, 20) : limit;

          persons = await this.searchProvider.searchByCifNumber(normalizedQuery, exact, effectiveLimit + 1, cursor);
          searchFields = ['cifNumber'];
          // Fallback: if no CIF match and query is pure digits, try as customer ID
          if (persons.length === 0 && /^\d+$/.test(normalizedQuery)) {
            persons = await this.searchProvider.searchByCustomerId(normalizedQuery, limit + 1);
            searchFields = ['customerId'];
          }
          break;
        case 'ambiguousNumeric':
          // 3-5 digit inputs: Try customer ID first, fallback to CIF prefix search
          // This handles queries like "100", "003", "12345"
          persons = await this.searchProvider.searchByCustomerId(normalizedQuery, limit + 1);
          if (persons.length === 0) {
            // No customer ID match - try as CIF prefix with result cap
            const ambiguousCifLimit = Math.min(limit, 20);
            persons = await this.searchProvider.searchByCifNumber(normalizedQuery, false, ambiguousCifLimit + 1, cursor);
            searchFields = ['cifNumber'];
          } else {
            searchFields = ['customerId'];
          }
          break;
        case 'customerId':
          persons = await this.searchProvider.searchByCustomerId(normalizedQuery, limit + 1);
          searchFields = ['customerId'];
          break;
        case 'taxId':
          persons = await this.searchProvider.searchByTaxId(normalizedQuery, exact, limit + 1, cursor);
          searchFields = ['taxIdentifier'];
          break;
        case 'govId':
          // Alphanumeric queries are ambiguous - could be Government ID, CIF, or Silverlake ID
          // Try Government ID first, then fall back to CIF, then Silverlake ID
          persons = await this.searchProvider.searchByGovernmentId(normalizedQuery, exact, limit + 1, cursor);
          searchFields = ['governmentId'];
          if (persons.length === 0) {
            persons = await this.searchProvider.searchByCifNumber(normalizedQuery, exact, limit + 1, cursor);
            searchFields = ['cifNumber'];
          }
          if (persons.length === 0) {
            persons = await this.searchProvider.searchBySilverlakeId(normalizedQuery, exact, limit + 1, cursor);
            searchFields = ['silverlakeCustomerId'];
          }
          break;
        case 'silverlakeId':
          // Alphanumeric queries are ambiguous - could be Silverlake ID, CIF, or Government ID
          // Try Silverlake ID first, then fall back to CIF, then Government ID
          persons = await this.searchProvider.searchBySilverlakeId(normalizedQuery, exact, limit + 1, cursor);
          searchFields = ['silverlakeCustomerId'];
          if (persons.length === 0) {
            persons = await this.searchProvider.searchByCifNumber(normalizedQuery, exact, limit + 1, cursor);
            searchFields = ['cifNumber'];
          }
          if (persons.length === 0) {
            persons = await this.searchProvider.searchByGovernmentId(normalizedQuery, exact, limit + 1, cursor);
            searchFields = ['governmentId'];
          }
          break;
        case 'name':
        default:
          // Use hybrid search strategy based on query length
          if (exact) {
            persons = await this.searchProvider.searchByName(normalizedQuery, limit + 1, cursor);
          } else {
            persons = await this.hybridNameSearch(normalizedQuery, limit + 1, cursor, params.fuzzyThreshold);
          }
          searchFields = ['fullName'];
          break;
      }
    }

    // Handle pagination
    const hasMore = persons.length > limit;
    if (hasMore) {
      persons.pop(); // Remove extra record
    }

    // Generate cursor for next page
    const nextCursor = hasMore && persons.length > 0 
      ? this.generateCursor(persons[persons.length - 1]) 
      : undefined;

    // Get total count if requested
    let totalCount: number | undefined;
    if (includeTotal) {
      totalCount = await this.getSearchCount(normalizedQuery, detectedType, fields);
    }

    return {
      data: persons,
      page: {
        cursor: nextCursor,
        hasMore,
        totalCount
      },
      diagnostics: {
        detectedType,
        fieldsUsed: searchFields,
        queryNormalized: normalizedQuery
      }
    };
  }

  async searchEntities(params: SmartSearchParams): Promise<UnifiedSearchResult> {
    const { q, entityTypes, limit = 25, exact, cursor, includeTotal } = params;

    // Determine which entities to search
    const searchCustomers = !entityTypes || entityTypes.includes('customer');
    const searchHouseholds = !entityTypes || entityTypes.includes('household');

    // If not searching households or query is not name-based, fall back to customer-only search
    const normalizedQuery = this.normalizeSearchQuery(q);
    const detectedType = params.type === 'auto' 
      ? this.detectSearchType(normalizedQuery) 
      : params.type;

    // Only search households for name queries (household-specific fields don't exist for other types)
    const shouldSearchHouseholds = searchHouseholds && 
      (detectedType === 'name' || detectedType === 'household' || detectedType === 'auto');

    // Calculate proportional limits (70% customers, 30% households)
    const customerLimit = searchCustomers && shouldSearchHouseholds 
      ? Math.ceil(limit * 0.7) 
      : limit;
    const householdLimit = shouldSearchHouseholds && searchCustomers 
      ? Math.ceil(limit * 0.3) 
      : limit;

    // For non-name ID-type queries, delegate customer search to smartSearchCustomers
    // which has proper type-specific logic (CIF, Tax ID, Customer ID, etc.)
    const isIdSearch = detectedType && !['name', 'household', 'auto'].includes(detectedType);

    let customerResults: CustomerListItem[];
    let householdResults: HouseholdListItem[];

    if (isIdSearch && searchCustomers) {
      // Use type-specific search for customers; skip household search for ID queries
      const smartResult = await this.smartSearchCustomers({
        ...params,
        limit: customerLimit,
      });
      customerResults = smartResult.data;
      householdResults = [];
    } else {
      // Name-type query: use hybrid search (prefix + fuzzy) for proper ranking
      [customerResults, householdResults] = await Promise.all([
        searchCustomers
          ? this.hybridNameSearch(normalizedQuery, customerLimit + 1, cursor, params.fuzzyThreshold)
          : Promise.resolve([]),
        shouldSearchHouseholds
          ? this.hybridHouseholdNameSearch(normalizedQuery, householdLimit + 1, cursor, params.fuzzyThreshold)
          : Promise.resolve([])
      ]);
    }

    // Convert to unified format
    const customerEntities: SearchEntityItem[] = customerResults.map(c => ({
      entityType: 'customer' as const,
      entityId: c.customerId,
      displayName: c.fullName,
      primaryIdentifiers: [
        `CID: ${c.customerId}`,
        c.customerType || 'Unknown',
        c.customerStatus || 'Unknown'
      ].filter(Boolean),
      status: c.customerStatus,
      matchScore: c.matchScore,
      matchType: c.matchType,
      matchedField: c.matchedField,
      customer: c
    }));

    const householdEntities: SearchEntityItem[] = householdResults.map(h => {
      const memberText = h.memberCount === 1 ? '1 member' : `${h.memberCount} members`;
      const assetsText = this.formatCurrency(parseFloat(h.totalAssets));

      return {
        entityType: 'household' as const,
        entityId: h.householdId,
        displayName: h.householdName,
        primaryIdentifiers: [
          memberText,
          `${assetsText} assets`,
          h.householdStatus
        ].filter(Boolean),
        status: h.householdStatus,
        matchScore: h.matchScore,
        matchType: h.matchType,
        matchedField: h.matchedField,
        household: h
      };
    });

    // Merge and sort by match score
    const mergedResults = [...customerEntities, ...householdEntities].sort((a, b) => {
      const scoreA = a.matchScore || 0;
      const scoreB = b.matchScore || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      // Active/prospect accounts before inactive/closed
      const statusA = getStatusPriority(a.status);
      const statusB = getStatusPriority(b.status);
      if (statusA !== statusB) return statusA - statusB;
      // Tie-breaker: customers first, then by ID
      if (a.entityType !== b.entityType) return a.entityType === 'customer' ? -1 : 1;
      return a.entityId - b.entityId;
    });

    // Apply final limit and pagination
    const hasMore = mergedResults.length > limit;
    const data = hasMore ? mergedResults.slice(0, limit) : mergedResults;

    // Generate cursor
    const nextCursor = hasMore && data.length > 0 
      ? `${data[data.length - 1].entityType}:${data[data.length - 1].entityId}` 
      : undefined;

    return {
      data,
      page: {
        cursor: nextCursor,
        hasMore,
        totalCount: includeTotal ? mergedResults.length : undefined
      },
      diagnostics: {
        detectedType,
        fieldsUsed: isIdSearch
          ? (customerResults.length > 0 ? [customerResults[0].matchedField || detectedType] : [detectedType as string])
          : ['fullName', ...(shouldSearchHouseholds ? ['householdName'] : [])],
        queryNormalized: normalizedQuery
      }
    };
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

  async getCustomerByGovernmentId(govId: string): Promise<Customer | undefined> {
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getCustomerByGovernmentIdSqlServer } = await import('./storage/sqlServerCustomer');
      const pool = await getMssqlPool();
      return await getCustomerByGovernmentIdSqlServer(pool, govId);
    }
    const result = await db
      .select()
      .from(customer)
      .where(eq(customer.governmentId, govId))
      .limit(1);

    return result[0];
  }

  // Search type detection
  private detectSearchType(query: string): SearchType {
    // CIF Number pattern: "CIF" prefix (case-insensitive) followed by 1-20 digits
    // Examples: "CIF0", "CIF1", "CIF000001", "CIF100002", "cif123456"
    // Must be placed BEFORE other ID heuristics to take precedence
    if (/^CIF\d{1,20}$/i.test(query)) {
      return 'cif';
    }

    // Customer ID pattern: pure digits 1-2 chars only (very short IDs)
    // Longer numeric patterns checked later with fallback logic
    if (/^\d{1,2}$/.test(query)) {
      return 'customerId';
    }

    // Digit-only CIF pattern: 6-20 digits (assumes longer digit sequences are CIF numbers)
    // Examples: "000001", "100002", "123456"
    if (/^\d{6,20}$/.test(query)) {
      return 'cif';
    }

    // Ambiguous range: 3-5 digits could be customer ID or CIF prefix
    // Mark as special type to handle with fallback logic
    if (/^\d{3,5}$/.test(query)) {
      return 'ambiguousNumeric';
    }

    // Tax ID pattern: 123-45-6789 or 123456789
    if (/^\d{3}-?\d{2}-?\d{4}$/.test(query)) {
      return 'taxId';
    }

    // Name pattern: pure letters (with optional spaces/hyphens), 2-50 chars
    // This must come before silverlake/govId to catch names first
    if (/^[A-Za-z][\sA-Za-z'-]*[A-Za-z]$/.test(query) || /^[A-Za-z]$/.test(query)) {
      return 'name';
    }

    // Silverlake ID pattern: alphanumeric 6-20 chars (not pure digits, not pure letters)
    if (/^[A-Za-z0-9]{6,20}$/.test(query) && !/^\d+$/.test(query) && !/^[A-Za-z]+$/.test(query)) {
      return 'silverlakeId';
    }

    // Government ID: alphanumeric 4-30 chars with mixed letters and digits
    if (/^[A-Za-z0-9]{4,30}$/.test(query) && /[A-Za-z]/.test(query) && /\d/.test(query)) {
      return 'govId';
    }

    // Default to name search
    return 'name';
  }

  private normalizeSearchQuery(query: string): string {
    return query.trim().replace(/\s+/g, ' ');
  }

  /**
   * Hybrid name search that adapts to query length
   * - Short queries (3-4 chars): Prefix matching only
   * - Medium queries (5-6 chars): Prefix + fuzzy with low threshold (0.2)
   * - Long queries (7+ chars): Prefix + fuzzy with standard threshold (0.3)
   */
  private async hybridNameSearch(
    nameQuery: string,
    limit: number,
    cursor?: string,
    userThreshold?: number
  ): Promise<CustomerListItem[]> {
    const strategy = analyzeQuery(nameQuery);

    // Suppress very short queries
    if (strategy.mode === 'suppress') {
      return [];
    }

    let prefixResults: CustomerListItem[] = [];
    let fuzzyResults: CustomerListItem[] = [];

    // Always run prefix search if strategy allows
    if (strategy.usePrefix) {
      prefixResults = await this.searchProvider.searchByName(nameQuery, limit, cursor);
    }

    // Run fuzzy search if strategy allows
    if (strategy.useFuzzy) {
      const threshold = userThreshold ?? strategy.fuzzyThreshold ?? 0.3;
      fuzzyResults = await this.searchProvider.searchByNameFuzzy(nameQuery, threshold, limit, cursor);
    }

    // Merge results with prefix matches prioritized
    const merged = mergeResults(prefixResults, fuzzyResults);

    // Return up to limit results
    return merged.slice(0, limit);
  }

  /**
   * Hybrid household name search that adapts to query length (mirrors hybridNameSearch)
   */
  private async hybridHouseholdNameSearch(
    nameQuery: string,
    limit: number,
    cursor?: string,
    userThreshold?: number
  ): Promise<HouseholdListItem[]> {
    const strategy = analyzeQuery(nameQuery);

    if (strategy.mode === 'suppress') {
      return [];
    }

    let prefixResults: HouseholdListItem[] = [];
    let fuzzyResults: HouseholdListItem[] = [];

    if (strategy.usePrefix) {
      prefixResults = await this.searchProvider.searchHouseholdsByName(nameQuery, limit, cursor);
    }

    if (strategy.useFuzzy) {
      const threshold = userThreshold ?? strategy.fuzzyThreshold ?? 0.3;
      fuzzyResults = await this.searchProvider.searchHouseholdsByNameFuzzy(nameQuery, threshold, limit, cursor);
    }

    // Merge: prefix matches get priority with score 100
    const merged = new Map<number, HouseholdListItem>();
    for (const result of prefixResults) {
      if (!merged.has(result.householdId)) {
        merged.set(result.householdId, { ...result, matchType: 'prefix', matchScore: result.matchScore ?? 100 });
      }
    }
    for (const result of fuzzyResults) {
      if (!merged.has(result.householdId)) {
        merged.set(result.householdId, result);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => {
        const scoreA = a.matchScore ?? 0;
        const scoreB = b.matchScore ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.householdId - b.householdId;
      })
      .slice(0, limit);
  }

  // Search implementations
  private async searchByTaxId(normalizedTaxId: string, exact: boolean, limit: number, cursor?: string): Promise<CustomerListItem[]> {
    // Normalize tax ID by removing dashes
    const taxIdDigits = normalizedTaxId.replace(/[^\d]/g, '');

    const result = await db
      .select({
        customerId: customer.customerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId
      })
      .from(customer)
      .where(eq(customer.taxIdentifier, taxIdDigits))
      .orderBy(asc(customer.customerId))
      .limit(limit);

    return result.map(this.maskPersonPII);
  }

  private async searchByGovernmentId(govId: string, exact: boolean, limit: number, cursor?: string): Promise<CustomerListItem[]> {
    const condition = exact 
      ? eq(customer.governmentId, govId)
      : ilike(customer.governmentId, `${govId}%`);

    const result = await db
      .select({
        customerId: customer.customerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId
      })
      .from(customer)
      .where(condition)
      .orderBy(asc(customer.customerId))
      .limit(limit);

    return result.map(this.maskPersonPII);
  }

  private async searchBySilverlakeId(silverlakeId: string, exact: boolean, limit: number, cursor?: string): Promise<CustomerListItem[]> {
    const condition = exact 
      ? eq(customer.silverlakeCustomerId, silverlakeId)
      : ilike(customer.silverlakeCustomerId, `${silverlakeId}%`);

    const result = await db
      .select({
        customerId: customer.customerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId
      })
      .from(customer)
      .where(condition)
      .orderBy(asc(customer.customerId))
      .limit(limit);

    return result.map(this.maskPersonPII);
  }

  private async searchByCustomerId(customerId: string, limit: number): Promise<CustomerListItem[]> {
    const id = parseInt(customerId);
    if (isNaN(id)) {
      return [];
    }

    const result = await db
      .select({
        customerId: customer.customerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId
      })
      .from(customer)
      .where(eq(customer.customerId, id))
      .limit(limit);

    return result.map((r) => ({
      ...this.maskPersonPII(r),
      matchScore: 100,
      matchType: 'exact' as const,
      matchedField: 'customerId'
    }));
  }

  private async searchByNameFuzzy(nameQuery: string, threshold: number, limit: number, cursor?: string): Promise<CustomerListItem[]> {
    const tokens = nameQuery.split(' ').filter(Boolean);

    if (tokens.length >= 2) {
      // Multi-token: try "first last" and "last first" with fuzzy matching
      const [token1, token2] = tokens;

      const result = await db
        .select({
          customerId: customer.customerId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          customerStatus: customer.customerStatus,
          silverlakeCustomerId: customer.silverlakeCustomerId,
          taxIdentifier: customer.taxIdentifier,
          governmentId: customer.governmentId,
          // Calculate similarity scores for both name combinations
          score1: sql<number>`GREATEST(
            similarity(${customer.firstName}, ${token1}) + similarity(${customer.lastName}, ${token2}),
            similarity(${customer.firstName}, ${token2}) + similarity(${customer.lastName}, ${token1})
          )`.as('score'),
        })
        .from(customer)
        .where(
          sql`(
            similarity(${customer.firstName}, ${token1}) + similarity(${customer.lastName}, ${token2}) > ${threshold * 2}
            OR
            similarity(${customer.firstName}, ${token2}) + similarity(${customer.lastName}, ${token1}) > ${threshold * 2}
          )`
        )
        .orderBy(sql`score DESC`, asc(customer.customerId))
        .limit(limit);

      return result.map((r) => ({
        ...this.maskPersonPII(r),
        matchScore: Math.round((r.score1 / 2) * 100),
        matchType: (r.score1 / 2) > 0.8 ? 'exact' as const : 'fuzzy' as const,
        matchedField: 'firstName,lastName'
      }));
    } else {
      // Single token: fuzzy search on first OR last name
      const token = tokens[0];

      const result = await db
        .select({
          customerId: customer.customerId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          customerStatus: customer.customerStatus,
          silverlakeCustomerId: customer.silverlakeCustomerId,
          taxIdentifier: customer.taxIdentifier,
          governmentId: customer.governmentId,
          score: sql<number>`GREATEST(
            similarity(${customer.firstName}, ${token}),
            similarity(${customer.lastName}, ${token})
          )`.as('score'),
        })
        .from(customer)
        .where(
          sql`(
            similarity(${customer.firstName}, ${token}) > ${threshold}
            OR
            similarity(${customer.lastName}, ${token}) > ${threshold}
          )`
        )
        .orderBy(sql`score DESC`, asc(customer.customerId))
        .limit(limit);

      return result.map((r) => ({
        ...this.maskPersonPII(r),
        matchScore: Math.round(r.score * 100),
        matchType: r.score > 0.8 ? 'exact' as const : 'fuzzy' as const,
        matchedField: r.score === sql`similarity(${customer.firstName}, ${token})` ? 'firstName' : 'lastName'
      }));
    }
  }

  private async searchByName(nameQuery: string, limit: number, cursor?: string): Promise<CustomerListItem[]> {
    const tokens = nameQuery.split(' ').filter(Boolean);

    let conditions;
    let orderByClause;

    if (tokens.length >= 2) {
      // Multi-token: try "first last" and "last first" with relevance scoring
      const [token1, token2] = tokens;
      conditions = or(
        and(
          ilike(customer.firstName, `${token1}%`),
          ilike(customer.lastName, `${token2}%`)
        ),
        and(
          ilike(customer.firstName, `${token2}%`),
          ilike(customer.lastName, `${token1}%`)
        )
      );

      // Order by match quality: exact matches first, then alphabetical
      orderByClause = [
        // Exact first+last match gets priority
        sql`CASE 
          WHEN ${customer.firstName} ILIKE ${token1 + '%'} AND ${customer.lastName} ILIKE ${token2 + '%'} THEN 1 
          WHEN ${customer.firstName} ILIKE ${token2 + '%'} AND ${customer.lastName} ILIKE ${token1 + '%'} THEN 2
          ELSE 3 
        END`,
        asc(customer.lastName), 
        asc(customer.firstName), 
        asc(customer.customerId)
      ];
    } else {
      // Single token: search first OR last name
      const token = tokens[0];
      conditions = or(
        ilike(customer.firstName, `${token}%`),
        ilike(customer.lastName, `${token}%`)
      );

      // Order by match quality: exact first name match, then last name match, then alphabetical
      orderByClause = [
        sql`CASE 
          WHEN ${customer.firstName} ILIKE ${token + '%'} THEN 1 
          WHEN ${customer.lastName} ILIKE ${token + '%'} THEN 2
          ELSE 3 
        END`,
        asc(customer.lastName), 
        asc(customer.firstName), 
        asc(customer.customerId)
      ];
    }

    const result = await db
      .select({
        customerId: customer.customerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        customerStatus: customer.customerStatus,
        silverlakeCustomerId: customer.silverlakeCustomerId,
        taxIdentifier: customer.taxIdentifier,
        governmentId: customer.governmentId
      })
      .from(customer)
      .where(conditions)
      .orderBy(...orderByClause)
      .limit(limit);

    return result.map(this.maskPersonPII);
  }

  private async searchByFields(query: string, fields: SearchField[], limit: number, cursor?: string): Promise<CustomerListItem[]> {
    const conditions = fields.map(field => {
      switch (field) {
        case 'firstName':
          return ilike(customer.firstName, `${query}%`);
        case 'lastName':
          return ilike(customer.lastName, `${query}%`);
        case 'taxIdentifier':
          return eq(customer.taxIdentifier, query.replace(/[^\d]/g, ''));
        case 'governmentId':
          return ilike(customer.governmentId, `${query}%`);
        case 'silverlakeCustomerId':
          return ilike(customer.silverlakeCustomerId, `${query}%`);
        default:
          return sql`false`;
      }
    });

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
      .where(or(...conditions))
      .orderBy(asc(customer.fullName), asc(customer.customerId))
      .limit(limit);

    return result.map(this.maskPersonPII);
  }

  private async getSearchCount(query: string, type: SearchType, fields?: SearchField[]): Promise<number> {
    // Implementation for count queries - simplified for brevity
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(customer)
      .where(sql`true`); // Placeholder - would implement actual count logic

    return Number(result[0]?.count ?? 0);
  }

  private generateCursor(lastPerson: CustomerListItem): string {
    // Generate base64 cursor from last person's sort keys
    const sortKey = `${lastPerson.fullName}-${lastPerson.customerId}`;
    return Buffer.from(sortKey).toString('base64');
  }

  private maskPersonPII(person: any): CustomerListItem {
    return {
      customerId: person.customerId,
      fullName: person.fullName || '',
      customerType: person.customerType,
      customerStatus: person.customerStatus,
      silverlakeCustomerId: person.silverlakeCustomerId,
      taxIdentifierLast4: person.taxIdentifier ? `***-**-${person.taxIdentifier.slice(-4)}` : undefined,
      governmentIdLast4: person.governmentId ? `****${person.governmentId.slice(-4)}` : undefined
    };
  }

  // Transaction operations
  async getTransactions(params: {
    accountId?: number;
    customerId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: FinancialTransaction[]; totalCount: number }> {
    const { accountId, customerId, startDate, endDate, limit = 100, offset = 0 } = params;

    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getTransactionsSqlServer, getTransactionCountSqlServer } = await import('./storage/sqlServerTransaction');
      const pool = await getMssqlPool();
      const transactions = await getTransactionsSqlServer(pool, params);
      const totalCount = await getTransactionCountSqlServer(pool, params);
      return { transactions, totalCount };
    }

    // PostgreSQL implementation
    const conditions = [];

    if (accountId) {
      conditions.push(eq(financialTransaction.accountId, accountId));
    }

    if (customerId) {
      // Get all accounts for this person first
      const personAccounts = await this.getCustomerAccounts(customerId);
      const accountIds = personAccounts.map(acc => acc.accountId);
      if (accountIds.length > 0) {
        conditions.push(sql`${financialTransaction.accountId} IN (${sql.join(accountIds, sql`, `)})`);
      }
    }

    if (startDate) {
      conditions.push(sql`${financialTransaction.transactionDate} >= ${startDate}`);
    }

    if (endDate) {
      conditions.push(sql`${financialTransaction.transactionDate} <= ${endDate}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get transactions with ordering by date descending
    const transactions = await db
      .select()
      .from(financialTransaction)
      .where(whereClause)
      .orderBy(desc(financialTransaction.transactionDate))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(financialTransaction)
      .where(whereClause);

    const totalCount = Number(countResult[0]?.count ?? 0);

    return { transactions, totalCount };
  }

  async getTransactionsByAccount(accountId: number, limit: number = 100, offset: number = 0): Promise<FinancialTransaction[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getTransactionsByAccountSqlServer } = await import('./storage/sqlServerTransaction');
      const pool = await getMssqlPool();
      return await getTransactionsByAccountSqlServer(pool, accountId, limit, offset);
    }

    // PostgreSQL implementation
    const result = await db
      .select()
      .from(financialTransaction)
      .where(eq(financialTransaction.accountId, accountId))
      .orderBy(desc(financialTransaction.transactionDate))
      .limit(limit)
      .offset(offset);

    return result;
  }

  async getTransactionsByCustomer(customerId: number, limit: number = 100, offset: number = 0): Promise<FinancialTransaction[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getTransactionsByCustomerSqlServer } = await import('./storage/sqlServerTransaction');
      const pool = await getMssqlPool();
      return await getTransactionsByCustomerSqlServer(pool, customerId, limit, offset);
    }

    // PostgreSQL implementation
    // Get all accounts for this person
    const personAccounts = await this.getCustomerAccounts(customerId);
    const accountIds = personAccounts.map(acc => acc.accountId);

    if (accountIds.length === 0) {
      return [];
    }

    const result = await db
      .select()
      .from(financialTransaction)
      .where(sql`${financialTransaction.accountId} IN (${sql.join(accountIds, sql`, `)})`)
      .orderBy(desc(financialTransaction.transactionDate))
      .limit(limit)
      .offset(offset);

    return result;
  }

  async getTransactionCategories(): Promise<TransactionCategory[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getTransactionCategoriesSqlServer } = await import('./storage/sqlServerTransaction');
      const pool = await getMssqlPool();
      return await getTransactionCategoriesSqlServer(pool);
    }

    // PostgreSQL implementation
    const result = await db
      .select()
      .from(transactionCategory)
      .orderBy(asc(transactionCategory.categoryId));

    return result;
  }

  // Dashboard Cards operations
  async getClientEngagement(customerId: number): Promise<{
    loginId: string;
    lastLoginAt: Date | null;
    thirtyDayActivity: Record<string, number>;
  } | null> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getClientEngagementSqlServer } = await import('./storage/sqlServerDashboard');
      const pool = await getMssqlPool();
      return await getClientEngagementSqlServer(pool, customerId);
    }

    // PostgreSQL implementation
    // Get online banking user info
    const bankingUser = await db
      .select()
      .from(onlineBankingUser)
      .where(eq(onlineBankingUser.customerId, customerId))
      .limit(1);

    if (!bankingUser[0]) {
      return null;
    }

    const user = bankingUser[0];

    // Get 30-day transaction activity by category group
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get person's accounts first
    const personAccounts = await this.getCustomerAccounts(customerId);
    const accountIds = personAccounts.map(acc => acc.accountId);

    if (accountIds.length === 0) {
      return {
        loginId: user.loginId,
        lastLoginAt: user.lastLoginAt,
        thirtyDayActivity: createDefaultActivity()
      };
    }

    // Get transaction activity grouped by transaction code
    const activityResult = await db
      .select({
        transactionCode: financialTransaction.transactionCode,
        count: sql<number>`count(*)`
      })
      .from(financialTransaction)
      .where(
        and(
          sql`${financialTransaction.accountId} IN (${sql.join(accountIds, sql`, `)})`,
          sql`${financialTransaction.transactionDate} >= ${thirtyDaysAgo}`,
          sql`${financialTransaction.transactionCode} IS NOT NULL`
        )
      )
      .groupBy(financialTransaction.transactionCode);

    // Map results to expected activity structure using CODE_TO_ACTIVITY mapping
    const thirtyDayActivity = createDefaultActivity();

    activityResult.forEach(row => {
      if (row.transactionCode && CODE_TO_ACTIVITY[row.transactionCode as keyof typeof CODE_TO_ACTIVITY]) {
        const activityType = CODE_TO_ACTIVITY[row.transactionCode as keyof typeof CODE_TO_ACTIVITY];
        thirtyDayActivity[activityType] = Number(row.count);
      }
    });

    return {
      loginId: user.loginId,
      lastLoginAt: user.lastLoginAt,
      thirtyDayActivity
    };
  }

  async getRelationshipSummary(customerId: number): Promise<{
    totalDeposits: number;
    totalLoans: number;
    depositsQoQ: {
      amountChange: number;
      percentChange: number;
    };
    loansQoQ: {
      amountChange: number;
      percentChange: number;
    };
  }> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getRelationshipSummarySqlServer } = await import('./storage/sqlServerDashboard');
      const pool = await getMssqlPool();
      return await getRelationshipSummarySqlServer(pool, customerId);
    }

    // PostgreSQL implementation
    // Get person's accounts first to get account IDs
    const personAccounts = await this.getCustomerAccounts(customerId);
    const accountIds = personAccounts.map(acc => acc.accountId);

    if (accountIds.length === 0) {
      return {
        totalDeposits: 0,
        totalLoans: 0,
        depositsQoQ: {
          amountChange: 0,
          percentChange: 0
        },
        loansQoQ: {
          amountChange: 0,
          percentChange: 0
        }
      };
    }

    // Calculate current deposits total directly from account table
    const depositResult = await db.execute(sql`
      SELECT COALESCE(SUM(a.balance), 0) as total
      FROM account a
      WHERE a.account_id IN (${sql.join(accountIds, sql`, `)})
        AND a.account_type IN ('checking', 'deposit checking', 'savings', 'money_market', 'cd')
    `);

    // Calculate current loans total directly from account table (using absolute value)
    const loanResult = await db.execute(sql`
      SELECT COALESCE(SUM(ABS(a.balance)), 0) as total
      FROM account a
      WHERE a.account_id IN (${sql.join(accountIds, sql`, `)})
        AND a.account_type IN ('loan', 'credit_card', 'mortgage', 'line_of_credit')
    `);

    const totalDeposits = Number(depositResult.rows[0]?.total || 0);
    const totalLoans = Number(loanResult.rows[0]?.total || 0);

    // Calculate quarter-over-quarter comparison using transaction history (90 days ago)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

    // Get deposits total from 3 months ago using transaction history
    const depositResultQoQ = await db.execute(sql`
      WITH historical_balances AS (
        SELECT DISTINCT ON (ft.account_id)
          ft.account_id,
          ft.ledger_balance_after as balance
        FROM financial_transaction ft
        WHERE ft.account_id IN (${sql.join(accountIds, sql`, `)})
          AND ft.transaction_date <= ${threeMonthsAgo}
        ORDER BY ft.account_id, ft.transaction_date DESC, ft.transaction_id DESC
      )
      SELECT COALESCE(SUM(hb.balance), 0) as total
      FROM historical_balances hb
      INNER JOIN account a ON a.account_id = hb.account_id
      WHERE a.account_type IN ('checking', 'deposit checking', 'savings', 'money_market', 'cd')
    `);

    // Get loans total from 3 months ago using transaction history
    const loanResultQoQ = await db.execute(sql`
      WITH historical_balances AS (
        SELECT DISTINCT ON (ft.account_id)
          ft.account_id,
          ft.ledger_balance_after as balance
        FROM financial_transaction ft
        WHERE ft.account_id IN (${sql.join(accountIds, sql`, `)})
          AND ft.transaction_date <= ${threeMonthsAgo}
        ORDER BY ft.account_id, ft.transaction_date DESC, ft.transaction_id DESC
      )
      SELECT COALESCE(SUM(ABS(hb.balance)), 0) as total
      FROM historical_balances hb
      INNER JOIN account a ON a.account_id = hb.account_id
      WHERE a.account_type IN ('loan', 'credit_card', 'mortgage', 'line_of_credit')
    `);

    const totalDepositsQoQ = Number(depositResultQoQ.rows[0]?.total || 0);
    const totalLoansQoQ = Number(loanResultQoQ.rows[0]?.total || 0);

    // Calculate separate QoQ for deposits
    const depositsAmountChange = totalDeposits - totalDepositsQoQ;
    const depositsPercentChange = totalDepositsQoQ > 0 ? (depositsAmountChange / totalDepositsQoQ) * 100 : 0;

    // Calculate separate QoQ for loans
    const loansAmountChange = totalLoans - totalLoansQoQ;
    const loansPercentChange = totalLoansQoQ > 0 ? (loansAmountChange / totalLoansQoQ) * 100 : 0;

    return {
      totalDeposits,
      totalLoans,
      depositsQoQ: {
        amountChange: depositsAmountChange,
        percentChange: depositsPercentChange
      },
      loansQoQ: {
        amountChange: loansAmountChange,
        percentChange: loansPercentChange
      }
    };
  }

  async getContactHistory(customerId: number, limit: number = 5): Promise<Array<{
    contactType: string;
    occurredAt: Date;
    employeeName: string;
  }>> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getContactHistorySqlServer } = await import('./storage/sqlServerDashboard');
      const pool = await getMssqlPool();
      return await getContactHistorySqlServer(pool, customerId, limit);
    }

    // PostgreSQL implementation
    const result = await db
      .select({
        contactType: contactHistory.contactType,
        occurredAt: contactHistory.occurredAt,
        employeeName: contactHistory.employeeName
      })
      .from(contactHistory)
      .where(eq(contactHistory.customerId, customerId))
      .orderBy(desc(contactHistory.occurredAt))
      .limit(limit);

    return result.map(row => ({
      contactType: row.contactType,
      occurredAt: row.occurredAt,
      employeeName: row.employeeName || 'Unknown Employee'
    }));
  }

  // Notes operations
  async getNoteCategories(includeInactive: boolean = false): Promise<NoteCategory[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getNoteCategoriesSqlServer } = await import('./storage/sqlServerNotes');
      const pool = await getMssqlPool();
      return await getNoteCategoriesSqlServer(pool, includeInactive);
    }

    // PostgreSQL implementation
    const conditions = includeInactive ? [] : [eq(noteCategory.isActive, true)];

    return await db
      .select()
      .from(noteCategory)
      .where(and(...conditions))
      .orderBy(asc(noteCategory.displayOrder));
  }

  async getCustomerNotes(customerId: number, includeDeleted: boolean = false): Promise<NoteWithCurrentVersion[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getNotesSqlServer } = await import('./storage/sqlServerNotes');
      const pool = await getMssqlPool();
      const notes = await getNotesSqlServer(pool, {
        customerId,
        targetType: 'customer'
      });
      return includeDeleted ? notes : notes.filter(n => !n.currentVersion.isSoftDeleted);
    }

    // PostgreSQL implementation
    const result = await db
      .select({
        note: note,
        version: noteVersion,
        category: noteCategory
      })
      .from(note)
      .innerJoin(noteVersion, and(
        eq(noteVersion.noteId, note.noteId),
        eq(noteVersion.isCurrent, true)
      ))
      .leftJoin(noteCategory, eq(noteCategory.categoryId, note.categoryId))
      .where(
        and(
          eq(note.customerId, customerId),
          includeDeleted ? undefined : eq(noteVersion.isSoftDeleted, false)
        )
      )
      .orderBy(desc(note.isPinned), desc(note.createdAt));

    return result.map(row => ({
      noteId: row.note.noteId!,
      customerId: row.note.customerId!,
      accountId: row.note.accountId!,
      targetType: row.note.targetType,
      categoryId: row.note.categoryId!,
      categoryName: row.category?.categoryName || null,
      importance: row.note.importance,
      visibility: row.note.visibility,
      legalHold: row.note.legalHold || false,
      retentionYears: row.note.retentionYears!,
      isPinned: row.note.isPinned || false,
      createdAt: row.note.createdAt!,
      updatedAt: row.note.updatedAt!,
      currentVersion: {
        versionId: row.version.versionId!,
        versionNumber: row.version.versionNumber!,
        title: row.version.title,
        body: row.version.body,
        authorEmployeeId: row.version.authorEmployeeId!,
        authorEmployeeName: row.version.authorEmployeeName,
        isSoftDeleted: row.version.isSoftDeleted || false,
        createdAt: row.version.createdAt!,
        modifiedAt: row.version.modifiedAt!
      }
    }));
  }

  async getAccountNotes(accountId: number, includeDeleted: boolean = false): Promise<NoteWithCurrentVersion[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getNotesSqlServer } = await import('./storage/sqlServerNotes');
      const pool = await getMssqlPool();
      const notes = await getNotesSqlServer(pool, {
        accountId,
        targetType: 'account'
      });
      return includeDeleted ? notes : notes.filter(n => !n.currentVersion.isSoftDeleted);
    }

    // PostgreSQL implementation
    const result = await db
      .select({
        note: note,
        version: noteVersion,
        category: noteCategory
      })
      .from(note)
      .innerJoin(noteVersion, and(
        eq(noteVersion.noteId, note.noteId),
        eq(noteVersion.isCurrent, true)
      ))
      .leftJoin(noteCategory, eq(noteCategory.categoryId, note.categoryId))
      .where(
        and(
          eq(note.accountId, accountId),
          includeDeleted ? undefined : eq(noteVersion.isSoftDeleted, false)
        )
      )
      .orderBy(desc(note.isPinned), desc(note.createdAt));

    return result.map(row => ({
      noteId: row.note.noteId!,
      customerId: row.note.customerId!,
      accountId: row.note.accountId!,
      targetType: row.note.targetType,
      categoryId: row.note.categoryId!,
      categoryName: row.category?.categoryName || null,
      importance: row.note.importance,
      visibility: row.note.visibility,
      legalHold: row.note.legalHold || false,
      retentionYears: row.note.retentionYears!,
      isPinned: row.note.isPinned || false,
      createdAt: row.note.createdAt!,
      updatedAt: row.note.updatedAt!,
      currentVersion: {
        versionId: row.version.versionId!,
        versionNumber: row.version.versionNumber!,
        title: row.version.title,
        body: row.version.body,
        authorEmployeeId: row.version.authorEmployeeId!,
        authorEmployeeName: row.version.authorEmployeeName,
        isSoftDeleted: row.version.isSoftDeleted || false,
        createdAt: row.version.createdAt!,
        modifiedAt: row.version.modifiedAt!
      }
    }));
  }

  async getNote(noteId: number): Promise<NoteWithCurrentVersion | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getNoteSqlServer } = await import('./storage/sqlServerNotes');
      const pool = await getMssqlPool();
      return await getNoteSqlServer(pool, noteId);
    }

    // PostgreSQL implementation
    const result = await db
      .select({
        note: note,
        version: noteVersion,
        category: noteCategory
      })
      .from(note)
      .innerJoin(noteVersion, and(
        eq(noteVersion.noteId, note.noteId),
        eq(noteVersion.isCurrent, true)
      ))
      .leftJoin(noteCategory, eq(noteCategory.categoryId, note.categoryId))
      .where(eq(note.noteId, noteId))
      .limit(1);

    if (result.length === 0) {
      return undefined;
    }

    const row = result[0];
    return {
      noteId: row.note.noteId!,
      customerId: row.note.customerId!,
      accountId: row.note.accountId!,
      targetType: row.note.targetType,
      categoryId: row.note.categoryId!,
      categoryName: row.category?.categoryName || null,
      importance: row.note.importance,
      visibility: row.note.visibility,
      legalHold: row.note.legalHold || false,
      retentionYears: row.note.retentionYears!,
      isPinned: row.note.isPinned || false,
      createdAt: row.note.createdAt!,
      updatedAt: row.note.updatedAt!,
      currentVersion: {
        versionId: row.version.versionId!,
        versionNumber: row.version.versionNumber!,
        title: row.version.title,
        body: row.version.body,
        authorEmployeeId: row.version.authorEmployeeId!,
        authorEmployeeName: row.version.authorEmployeeName,
        isSoftDeleted: row.version.isSoftDeleted || false,
        createdAt: row.version.createdAt!,
        modifiedAt: row.version.modifiedAt!
      }
    };
  }

  async createNote(noteData: CreateNoteData, authorEmployeeId: number): Promise<NoteWithCurrentVersion> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { createNoteSqlServer } = await import('./storage/sqlServerNotes');
      const pool = await getMssqlPool();
      return await createNoteSqlServer(pool, noteData, authorEmployeeId);
    }

    // PostgreSQL implementation
    const authorEmployee = await this.getEmployee(authorEmployeeId);
    const authorName = authorEmployee ? `${authorEmployee.firstName} ${authorEmployee.lastName}` : null;

    const [newNote] = await db.insert(note).values({
      customerId: noteData.customerId || null,
      accountId: noteData.accountId || null,
      targetType: noteData.targetType,
      categoryId: noteData.categoryId || null,
      importance: noteData.importance || 'medium',
      visibility: noteData.visibility || 'internal',
      legalHold: noteData.legalHold || false,
      retentionYears: noteData.retentionYears || null,
      isPinned: noteData.isPinned || false
    }).returning();

    const [newVersion] = await db.insert(noteVersion).values({
      noteId: newNote.noteId!,
      versionNumber: 1,
      title: noteData.title,
      body: noteData.body,
      authorEmployeeId,
      authorEmployeeName: authorName,
      isCurrent: true
    }).returning();

    await db.insert(noteAuditLog).values({
      noteId: newNote.noteId!,
      versionId: newVersion.versionId!,
      action: 'create',
      actorEmployeeId: authorEmployeeId,
      actorEmployeeName: authorName
    });

    const category = newNote.categoryId 
      ? await db.select().from(noteCategory).where(eq(noteCategory.categoryId, newNote.categoryId)).limit(1)
      : [];

    return {
      noteId: newNote.noteId!,
      customerId: newNote.customerId!,
      accountId: newNote.accountId!,
      targetType: newNote.targetType,
      categoryId: newNote.categoryId!,
      categoryName: category[0]?.categoryName || null,
      importance: newNote.importance,
      visibility: newNote.visibility,
      legalHold: newNote.legalHold || false,
      retentionYears: newNote.retentionYears!,
      isPinned: newNote.isPinned || false,
      createdAt: newNote.createdAt!,
      updatedAt: newNote.updatedAt!,
      currentVersion: {
        versionId: newVersion.versionId!,
        versionNumber: newVersion.versionNumber!,
        title: newVersion.title,
        body: newVersion.body,
        authorEmployeeId: newVersion.authorEmployeeId!,
        authorEmployeeName: newVersion.authorEmployeeName,
        isSoftDeleted: newVersion.isSoftDeleted || false,
        createdAt: newVersion.createdAt!,
        modifiedAt: newVersion.modifiedAt!
      }
    };
  }

  async updateNote(noteId: number, updateData: UpdateNoteData, authorEmployeeId: number): Promise<NoteWithCurrentVersion | undefined> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { updateNoteSqlServer } = await import('./storage/sqlServerNotes');
      const pool = await getMssqlPool();
      return await updateNoteSqlServer(pool, noteId, updateData, authorEmployeeId);
    }

    // PostgreSQL implementation
    const existingNote = await this.getNote(noteId);
    if (!existingNote) {
      return undefined;
    }

    const authorEmployee = await this.getEmployee(authorEmployeeId);
    const authorName = authorEmployee ? `${authorEmployee.firstName} ${authorEmployee.lastName}` : null;

    await db.update(noteVersion)
      .set({ isCurrent: false })
      .where(and(
        eq(noteVersion.noteId, noteId),
        eq(noteVersion.isCurrent, true)
      ));

    const nextVersionNumber = existingNote.currentVersion.versionNumber + 1;

    const [newVersion] = await db.insert(noteVersion).values({
      noteId,
      versionNumber: nextVersionNumber,
      title: updateData.title || existingNote.currentVersion.title,
      body: updateData.body || existingNote.currentVersion.body,
      authorEmployeeId,
      authorEmployeeName: authorName,
      isCurrent: true
    }).returning();

    if (updateData.categoryId !== undefined || updateData.importance !== undefined || 
        updateData.visibility !== undefined || updateData.legalHold !== undefined ||
        updateData.retentionYears !== undefined || updateData.isPinned !== undefined) {
      const updateFields: any = {};
      if (updateData.categoryId !== undefined) updateFields.categoryId = updateData.categoryId;
      if (updateData.importance !== undefined) updateFields.importance = updateData.importance;
      if (updateData.visibility !== undefined) updateFields.visibility = updateData.visibility;
      if (updateData.legalHold !== undefined) updateFields.legalHold = updateData.legalHold;
      if (updateData.retentionYears !== undefined) updateFields.retentionYears = updateData.retentionYears;
      if (updateData.isPinned !== undefined) updateFields.isPinned = updateData.isPinned;
      updateFields.updatedAt = new Date();

      await db.update(note)
        .set(updateFields)
        .where(eq(note.noteId, noteId));
    }

    await db.insert(noteAuditLog).values({
      noteId,
      versionId: newVersion.versionId!,
      action: 'update',
      actorEmployeeId: authorEmployeeId,
      actorEmployeeName: authorName
    });

    return await this.getNote(noteId);
  }

  async softDeleteNote(noteId: number, deletedByEmployeeId: number): Promise<boolean> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { deleteNoteSqlServer } = await import('./storage/sqlServerNotes');
      const pool = await getMssqlPool();
      return await deleteNoteSqlServer(pool, noteId, deletedByEmployeeId);
    }

    // PostgreSQL implementation
    const deletedEmployee = await this.getEmployee(deletedByEmployeeId);
    const deletedByName = deletedEmployee ? `${deletedEmployee.firstName} ${deletedEmployee.lastName}` : null;

    const result = await db.update(noteVersion)
      .set({
        isSoftDeleted: true,
        deletedAt: new Date(),
        deletedByEmployeeId
      })
      .where(and(
        eq(noteVersion.noteId, noteId),
        eq(noteVersion.isCurrent, true)
      ))
      .returning();

    if (result.length > 0) {
      await db.insert(noteAuditLog).values({
        noteId,
        versionId: result[0].versionId!,
        action: 'delete',
        actorEmployeeId: deletedByEmployeeId,
        actorEmployeeName: deletedByName
      });
      return true;
    }

    return false;
  }

  async restoreNote(noteId: number, restoredByEmployeeId: number): Promise<boolean> {
    const restoredEmployee = await this.getEmployee(restoredByEmployeeId);
    const restoredByName = restoredEmployee ? `${restoredEmployee.firstName} ${restoredEmployee.lastName}` : null;

    const result = await db.update(noteVersion)
      .set({
        isSoftDeleted: false,
        deletedAt: null,
        deletedByEmployeeId: null
      })
      .where(and(
        eq(noteVersion.noteId, noteId),
        eq(noteVersion.isCurrent, true)
      ))
      .returning();

    if (result.length > 0) {
      await db.insert(noteAuditLog).values({
        noteId,
        versionId: result[0].versionId!,
        action: 'restore',
        actorEmployeeId: restoredByEmployeeId,
        actorEmployeeName: restoredByName
      });
      return true;
    }

    return false;
  }

  async pinNote(noteId: number, isPinned: boolean): Promise<boolean> {
    const result = await db.update(note)
      .set({ isPinned, updatedAt: new Date() })
      .where(eq(note.noteId, noteId))
      .returning();

    return result.length > 0;
  }

  async getNoteVersions(noteId: number): Promise<NoteVersion[]> {
    // SQL Server implementation
    if (isSQLServer()) {
      const { getMssqlPool } = await import('./dbConnection');
      const { getNoteVersionsSqlServer } = await import('./storage/sqlServerNotes');
      const pool = await getMssqlPool();
      return await getNoteVersionsSqlServer(pool, noteId);
    }

    // PostgreSQL implementation
    return await db
      .select()
      .from(noteVersion)
      .where(eq(noteVersion.noteId, noteId))
      .orderBy(desc(noteVersion.versionNumber));
  }

  async searchNotes(params: SearchNotesParams): Promise<{ notes: NoteWithCurrentVersion[]; totalCount: number }> {
    const conditions = [];

    if (params.targetType && params.targetId) {
      if (params.targetType === 'customer') {
        conditions.push(eq(note.customerId, params.targetId));
      } else if (params.targetType === 'account') {
        conditions.push(eq(note.accountId, params.targetId));
      }
    }

    if (params.categoryId) {
      conditions.push(eq(note.categoryId, params.categoryId));
    }

    if (params.importance) {
      conditions.push(eq(note.importance, params.importance));
    }

    if (params.visibility) {
      conditions.push(eq(note.visibility, params.visibility));
    }

    if (params.authorEmployeeId) {
      conditions.push(eq(noteVersion.authorEmployeeId, params.authorEmployeeId));
    }

    if (!params.includeDeleted) {
      conditions.push(eq(noteVersion.isSoftDeleted, false));
    }

    if (params.query) {
      conditions.push(
        or(
          ilike(noteVersion.title, `%${params.query}%`),
          ilike(noteVersion.body, `%${params.query}%`)
        )
      );
    }

    const result = await db
      .select({
        note: note,
        version: noteVersion,
        category: noteCategory
      })
      .from(note)
      .innerJoin(noteVersion, and(
        eq(noteVersion.noteId, note.noteId),
        eq(noteVersion.isCurrent, true)
      ))
      .leftJoin(noteCategory, eq(noteCategory.categoryId, note.categoryId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(note.isPinned), desc(note.createdAt))
      .limit(params.limit || 50)
      .offset(params.offset || 0);

    const notes = result.map(row => ({
      noteId: row.note.noteId!,
      customerId: row.note.customerId!,
      accountId: row.note.accountId!,
      targetType: row.note.targetType,
      categoryId: row.note.categoryId!,
      categoryName: row.category?.categoryName || null,
      importance: row.note.importance,
      visibility: row.note.visibility,
      legalHold: row.note.legalHold || false,
      retentionYears: row.note.retentionYears!,
      isPinned: row.note.isPinned || false,
      createdAt: row.note.createdAt!,
      updatedAt: row.note.updatedAt!,
      currentVersion: {
        versionId: row.version.versionId!,
        versionNumber: row.version.versionNumber!,
        title: row.version.title,
        body: row.version.body,
        authorEmployeeId: row.version.authorEmployeeId!,
        authorEmployeeName: row.version.authorEmployeeName,
        isSoftDeleted: row.version.isSoftDeleted || false,
        createdAt: row.version.createdAt!,
        modifiedAt: row.version.modifiedAt!
      }
    }));

    const totalCount = notes.length;

    return { notes, totalCount };
  }

  async getEmployeePermissions(employeeId: number): Promise<UserPermissions> {
    const { permissionService } = await import("./services/permissionService");
    return permissionService.getUserPermissions(employeeId);
  }

  async checkPermission(
    employeeId: number,
    permissionCode: string,
    context: PermissionContext
  ): Promise<PermissionCheckResult> {
    const { permissionService } = await import("./services/permissionService");
    return permissionService.checkPermission(employeeId, permissionCode, context);
  }

  async listUsers(filters?: {
    search?: string;
    roleId?: number;
    isActive?: boolean;
    department?: string;
  }) {
    const { userManagementService } = await import("./services/userManagementService");
    return userManagementService.listUsers(filters);
  }

  async getUserById(employeeId: number, requestingUserId: number) {
    const { userManagementService } = await import("./services/userManagementService");
    return userManagementService.getUserById(employeeId, requestingUserId);
  }

  async assignRole(employeeId: number, data: any, assignedByUserId: number) {
    const { userManagementService } = await import("./services/userManagementService");
    return userManagementService.assignRole(employeeId, data, assignedByUserId);
  }

  async removeRole(employeeId: number, data: any, removedByUserId: number) {
    const { userManagementService } = await import("./services/userManagementService");
    return userManagementService.removeRole(employeeId, data, removedByUserId);
  }

  async getAllRoles() {
    const { userManagementService } = await import("./services/userManagementService");
    return userManagementService.getAllRoles();
  }
}

export const storage = new DatabaseStorage();