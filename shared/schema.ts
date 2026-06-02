import { sql } from "drizzle-orm";
import { 
  pgTable, 
  bigserial,
  bigint,
  text, 
  varchar, 
  boolean,
  decimal,
  date,
  timestamp,
  jsonb,
  index,
  uuid,
  unique
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================================================================================
// CORE BANKING TABLES - JACK HENRY INTEGRATION
// ==================================================================================

export const region = pgTable("region", {
  regionId: bigserial("region_id", { mode: "number" }).primaryKey(),
  regionName: varchar("region_name", { length: 100 }).notNull(),
  regionCode: varchar("region_code", { length: 10 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const branch = pgTable("branch", {
  branchId: bigserial("branch_id", { mode: "number" }).primaryKey(),
  branchCode: varchar("branch_code", { length: 10 }).notNull().unique(),
  branchName: varchar("branch_name", { length: 100 }).notNull(),
  branchType: varchar("branch_type", { length: 20 }),
  addressId: bigint("address_id", { mode: "number" }).references(() => address.addressId),
  regionId: bigint("region_id", { mode: "number" }).references(() => region.regionId),
  isActive: boolean("is_active").default(true),
  openedDate: date("opened_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const employee = pgTable("employee", {
  employeeId: bigserial("employee_id", { mode: "number" }).primaryKey(),
  employeeNumber: varchar("employee_number", { length: 20 }).notNull().unique(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  title: varchar("title", { length: 50 }),
  position: varchar("position", { length: 100 }),
  officerCode: varchar("officer_code", { length: 20 }).unique(),
  department: varchar("department", { length: 50 }),
  isActive: boolean("is_active").default(true),
  hireDate: date("hire_date"),
  // SAML SSO fields
  ssoSubject: varchar("sso_subject", { length: 255 }).unique(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  lastSeenSamlRole: text("last_seen_saml_role"),
  lastLoginAt: timestamp("last_login_at"),
  deletedAt: timestamp("deleted_at"),
  modifiedBy: bigint("modified_by", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const address = pgTable("address", {
  addressId: bigserial("address_id", { mode: "number" }).primaryKey(),
  addressLine1: varchar("address_line1", { length: 200 }).notNull(),
  addressLine2: varchar("address_line2", { length: 200 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 50 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 50 }).notNull().default("US"),
  addressType: varchar("address_type", { length: 20 }),
  isPrimary: boolean("is_primary").default(false),
  validated: boolean("validated").default(false),
  validationDate: timestamp("validation_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const contactInfo = pgTable("contact_info", {
  contactId: bigserial("contact_id", { mode: "number" }).primaryKey(),
  contactType: varchar("contact_type", { length: 20 }).notNull(),
  contactValue: varchar("contact_value", { length: 200 }).notNull(),
  contactSubtype: varchar("contact_subtype", { length: 20 }),
  isPrimary: boolean("is_primary").default(false),
  isVerified: boolean("is_verified").default(false),
  verificationDate: timestamp("verification_date"),
  canContact: boolean("can_contact").default(true),
  preferredTime: varchar("preferred_time", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  contactTypeValueIdx: index("idx_contact_info_type").on(table.contactType, table.contactValue)
}));

export const customer = pgTable("customer", {
  customerId: bigserial("customer_id", { mode: "number" }).primaryKey(),
  // Individual customer fields (required for individual/premium/regular types)
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  middleName: varchar("middle_name", { length: 100 }),
  preferredName: varchar("preferred_name", { length: 100 }),
  title: varchar("title", { length: 20 }),
  suffix: varchar("suffix", { length: 20 }),
  dateOfBirth: date("date_of_birth"),
  gender: varchar("gender", { length: 20 }),
  maritalStatus: varchar("marital_status", { length: 20 }),
  // Business/organization fields (required for business/trust types)
  businessName: varchar("business_name", { length: 200 }),
  // Generated full name field for unified search
  fullName: varchar("full_name", { length: 200 }),
  // Identification
  taxIdentifier: varchar("tax_identifier", { length: 20 }).unique(),
  governmentId: varchar("government_id", { length: 50 }),
  governmentIdType: varchar("government_id_type", { length: 20 }),
  citizenship: varchar("citizenship", { length: 50 }),
  // Customer classification
  customerType: varchar("customer_type", { length: 20 }).notNull().default("regular"),
  customerStatus: varchar("customer_status", { length: 20 }).default("active"),
  customerSince: date("customer_since").defaultNow(),
  // Compliance
  kycStatus: varchar("kyc_status", { length: 20 }),
  kycLastUpdated: date("kyc_last_updated"),
  riskRating: varchar("risk_rating", { length: 20 }),
  // Preferences
  languagePreference: varchar("language_preference", { length: 10 }).default("en"),
  // Professional information (for individual customers)
  occupation: varchar("occupation", { length: 100 }),
  employerName: varchar("employer_name", { length: 200 }),
  // Business classification (for business/trust customers)
  naicsCode: varchar("naics_code", { length: 10 }),
  // DBA (Doing Business As) name - optional alternate business name
  dbaName: varchar("dba_name", { length: 200 }),
  // Branch assignment
  branchId: bigint("branch_id", { mode: "number" }).references(() => branch.branchId),
  // Core banking integration
  jackHenryCifNumber: varchar("jack_henry_cif_number", { length: 20 }),
  silverlakeCustomerId: varchar("silverlake_customer_id", { length: 20 }),
  // Banking codes
  inquiryCode: varchar("inquiry_code", { length: 20 }),
  insideCode: varchar("inside_code", { length: 20 }),
  salesAssociateCode: varchar("sales_associate_code", { length: 20 }),
  classCode: varchar("class_code", { length: 20 }),
  // Flags
  isEmployee: boolean("is_employee").default(false),
  vipCustomer: boolean("vip_customer").default(false),
  isDeceased: boolean("is_deceased").default(false),
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  taxIdIdx: index("idx_customer_tax_id").on(table.taxIdentifier),
  fullNameIdx: index("idx_customer_full_name").on(table.fullName),
  statusIdx: index("idx_customer_status").on(table.customerStatus),
  branchIdx: index("idx_customer_branch").on(table.branchId),
  jackHenryIdx: index("idx_customer_jack_henry_cif").on(table.jackHenryCifNumber),
  silverlakeIdx: index("idx_customer_silverlake_id").on(table.silverlakeCustomerId),
  govIdIdx: index("idx_customer_government_id").on(table.governmentId)
}));

export const household = pgTable("household", {
  householdId: bigserial("household_id", { mode: "number" }).primaryKey(),
  householdName: varchar("household_name", { length: 200 }).notNull(),
  householdType: varchar("household_type", { length: 50 }).default("family"),
  totalAssets: decimal("total_assets", { precision: 15, scale: 2 }).default("0"),
  totalLiabilities: decimal("total_liabilities", { precision: 15, scale: 2 }).default("0"),
  householdStatus: varchar("household_status", { length: 20 }).default("active"),
  riskRating: varchar("risk_rating", { length: 20 }),
  relationshipManagerId: bigint("relationship_manager_id", { mode: "number" }).references(() => employee.employeeId),
  establishedDate: date("established_date").defaultNow(),
  taxFilingStatus: varchar("tax_filing_status", { length: 20 }),
  // B2B Relationship Fields
  parentHouseholdId: bigint("parent_household_id", { mode: "number" }).references(() => household.householdId),
  consolidationMethod: varchar("consolidation_method", { length: 20 }).default("equity"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  statusIdx: index("idx_household_status").on(table.householdStatus),
  rmIdx: index("idx_household_rm").on(table.relationshipManagerId),
  parentIdx: index("idx_household_parent").on(table.parentHouseholdId),
  parentTypeIdx: index("idx_household_parent_type").on(table.parentHouseholdId, table.householdType)
}));

export const account = pgTable("account", {
  accountId: bigserial("account_id", { mode: "number" }).primaryKey(),
  accountNumber: varchar("account_number", { length: 50 }).notNull().unique(),
  accountType: varchar("account_type", { length: 50 }).notNull(),
  accountSubtype: varchar("account_subtype", { length: 50 }),
  accountStatus: varchar("account_status", { length: 20 }).notNull().default("active"),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0"),
  availableBalance: decimal("available_balance", { precision: 15, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 3 }).default("USD"),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }),
  creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }),
  branchId: bigint("branch_id", { mode: "number" }).references(() => branch.branchId),
  productCode: varchar("product_code", { length: 50 }),
  openedDate: date("opened_date").defaultNow(),
  closedDate: date("closed_date"),
  lastTransactionDate: date("last_transaction_date"),
  maturityDate: date("maturity_date"),
  jackHenryAccountId: varchar("jack_henry_account_id", { length: 50 }),
  silverlakeAccountStructure: varchar("silverlake_account_structure", { length: 200 }),
  accountClass: varchar("account_class", { length: 50 }),
  statementCycle: varchar("statement_cycle", { length: 20 }),
  statementCodeDesc: varchar("statement_code_desc", { length: 200 }),
  averageBalance: decimal("average_balance", { precision: 15, scale: 2 }),
  lastMaintenanceDate: date("last_maintenance_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  numberIdx: index("idx_account_number").on(table.accountNumber),
  typeIdx: index("idx_account_type").on(table.accountType),
  statusIdx: index("idx_account_status").on(table.accountStatus),
  jackHenryIdx: index("idx_account_jack_henry").on(table.jackHenryAccountId)
}));

// Relationship tables
export const entityAddress = pgTable("entity_address", {
  entityAddressId: bigserial("entity_address_id", { mode: "number" }).primaryKey(),
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  entityId: bigint("entity_id", { mode: "number" }).notNull(),
  addressId: bigint("address_id", { mode: "number" }).notNull().references(() => address.addressId),
  addressPurpose: varchar("address_purpose", { length: 20 }).notNull().default("primary"),
  isCurrent: boolean("is_current").default(true),
  startDate: date("start_date").defaultNow(),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const entityContact = pgTable("entity_contact", {
  entityContactId: bigserial("entity_contact_id", { mode: "number" }).primaryKey(),
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  entityId: bigint("entity_id", { mode: "number" }).notNull(),
  contactId: bigint("contact_id", { mode: "number" }).notNull().references(() => contactInfo.contactId),
  contactPurpose: varchar("contact_purpose", { length: 20 }).default("primary"),
  isCurrent: boolean("is_current").default(true),
  startDate: date("start_date").defaultNow(),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  contactTypeCached: varchar("contact_type_cached", { length: 20 })
});

export const householdMembership = pgTable("household_membership", {
  membershipId: bigserial("membership_id", { mode: "number" }).primaryKey(),
  householdId: bigint("household_id", { mode: "number" }).notNull().references(() => household.householdId),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customer.customerId),
  relationshipRole: varchar("relationship_role", { length: 50 }).notNull(),
  isPrimaryMember: boolean("is_primary_member").default(false),
  isHeadOfHousehold: boolean("is_head_of_household").default(false),
  membershipStartDate: date("membership_start_date").defaultNow(),
  membershipEndDate: date("membership_end_date"),
  rollupAccounts: boolean("rollup_accounts").default(true),
  rollupPercentage: decimal("rollup_percentage", { precision: 5, scale: 2 }).default("100.00"),
  // B2B Relationship Fields
  ownershipPercentage: decimal("ownership_percentage", { precision: 5, scale: 2 }).default("0").notNull(),
  controlType: varchar("control_type", { length: 30 }).default("none"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  householdRoleIdx: index("idx_household_membership_household_role").on(table.householdId, table.relationshipRole),
  ownershipIdx: index("idx_household_membership_ownership").on(table.householdId, table.ownershipPercentage)
}));

export const accountOwnership = pgTable("account_ownership", {
  ownershipId: bigserial("ownership_id", { mode: "number" }).primaryKey(),
  accountId: bigint("account_id", { mode: "number" }).notNull().references(() => account.accountId),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customer.customerId),
  ownershipType: varchar("ownership_type", { length: 50 }).notNull(),
  ownershipPercentage: decimal("ownership_percentage", { precision: 5, scale: 2 }).default("100.00"),
  isPrimaryOwner: boolean("is_primary_owner").default(false),
  signingAuthority: boolean("signing_authority").default(true),
  canViewStatements: boolean("can_view_statements").default(true),
  canMakeTransactions: boolean("can_make_transactions").default(true),
  transactionLimit: decimal("transaction_limit", { precision: 15, scale: 2 }),
  relationshipStartDate: date("relationship_start_date").defaultNow(),
  relationshipEndDate: date("relationship_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const employeeBranch = pgTable("employee_branch", {
  employeeBranchId: bigserial("employee_branch_id", { mode: "number" }).primaryKey(),
  employeeId: bigint("employee_id", { mode: "number" }).notNull().references(() => employee.employeeId),
  branchId: bigint("branch_id", { mode: "number" }).notNull().references(() => branch.branchId),
  assignmentRole: varchar("assignment_role", { length: 100 }),
  isPrimary: boolean("is_primary").default(false),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  uniqueEmployeeBranch: unique("unq_employee_branch").on(table.employeeId, table.branchId),
  employeeIdx: index("idx_employee_branch_employee").on(table.employeeId),
  branchIdx: index("idx_employee_branch_branch").on(table.branchId),
  primaryIdx: index("idx_employee_branch_primary").on(table.employeeId, table.isPrimary)
}));

export const customerOfficerAssignment = pgTable("customer_officer_assignment", {
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customer.customerId),
  officerCode: varchar("officer_code", { length: 20 }).notNull(),
  relationshipType: varchar("relationship_type", { length: 20 }).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  pk: unique("pk_customer_officer").on(table.customerId, table.officerCode),
  customerIdx: index("idx_customer_officer_customer").on(table.customerId),
  officerIdx: index("idx_customer_officer_code").on(table.officerCode),
  officerTypeIdx: index("idx_customer_officer_type").on(table.officerCode, table.relationshipType)
}));

// ==================================================================================
// REFERENCE/LOOKUP TABLES
// ==================================================================================

// SIC (Standard Industrial Classification) Code lookup table
export const sicCode = pgTable("sic_code", {
  sicCode: bigint("sic_code", { mode: "number" }).primaryKey(),
  description: varchar("description", { length: 500 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  descriptionIdx: index("idx_sic_code_description").on(table.description)
}));

// Customer-SIC Code junction table (many-to-many relationship)
export const customerSicCode = pgTable("customer_sic_code", {
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customer.customerId),
  sicCode: bigint("sic_code", { mode: "number" }).notNull().references(() => sicCode.sicCode),
  assignedAt: timestamp("assigned_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  pk: unique("pk_customer_sic").on(table.customerId, table.sicCode),
  customerIdx: index("idx_customer_sic_customer").on(table.customerId),
  sicCodeIdx: index("idx_customer_sic_code").on(table.sicCode)
}));

// Account-SIC Code junction table (many-to-many relationship)
// Allows accounts to have multiple SIC codes with effective dates
export const accountSicCode = pgTable("account_sic_code", {
  accountSicCodeId: bigserial("account_sic_code_id", { mode: "number" }).primaryKey(),
  accountId: bigint("account_id", { mode: "number" }).notNull().references(() => account.accountId),
  sicCode: bigint("sic_code", { mode: "number" }).notNull().references(() => sicCode.sicCode),
  effectiveDate: date("effective_date").defaultNow(),
  endDate: date("end_date"),
  assignmentSource: varchar("assignment_source", { length: 50 }).default("manual"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  uniqueAccountSic: unique("unq_account_sic").on(table.accountId, table.sicCode),
  accountIdx: index("idx_account_sic_junction_account").on(table.accountId),
  sicCodeIdx: index("idx_account_sic_junction_code").on(table.sicCode),
  accountEffectiveIdx: index("idx_account_sic_junction_effective").on(table.accountId, table.effectiveDate),
  sicAccountIdx: index("idx_account_sic_junction_reverse").on(table.sicCode, table.accountId)
}));

// ==================================================================================
// FINANCIAL TRANSACTIONS TABLES
// ==================================================================================

// Transaction category lookup table
export const transactionCategory = pgTable("transaction_category", {
  categoryId: bigserial("category_id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  parentId: bigint("parent_id", { mode: "number" }),
  groupCode: varchar("group_code", { length: 30 }), // For dashboard card activity grouping: direct_deposit, atm, billpay, mobile_check_deposit, zelle, wire, ach
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Financial transactions table with core banking balances
export const financialTransaction = pgTable("financial_transaction", {
  transactionId: bigserial("transaction_id", { mode: "number" }).primaryKey(),
  accountId: bigint("account_id", { mode: "number" }).notNull().references(() => account.accountId),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  transactionCode: varchar("transaction_code", { length: 30 }),
  transactionType: varchar("transaction_type", { length: 30 }),
  status: varchar("status", { length: 20 }).notNull(),
  transactionDate: timestamp("transaction_date").notNull(),
  postingDate: timestamp("posting_date").notNull(),
  description: text("description"),
  referenceNumber: varchar("reference_number", { length: 64 }),
  merchantName: varchar("merchant_name", { length: 200 }),
  merchantCategoryCode: varchar("merchant_category_code", { length: 4 }),
  categoryId: bigint("category_id", { mode: "number" }).references(() => transactionCategory.categoryId),
  transferGroupId: uuid("transfer_group_id"),
  counterpartyAccountId: bigint("counterparty_account_id", { mode: "number" }).references(() => account.accountId),
  relatedTransactionId: bigint("related_transaction_id", { mode: "number" }),
  ledgerBalanceAfter: decimal("ledger_balance_after", { precision: 15, scale: 2 }).notNull(),
  availableBalanceAfter: decimal("available_balance_after", { precision: 15, scale: 2 }).notNull(),
  sourceSystem: varchar("source_system", { length: 32 }).notNull().default("jack_henry"),
  sourceTransactionId: varchar("source_transaction_id", { length: 128 }),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  // Primary query index
  accountPostingIdx: index("idx_transaction_account_posting").on(table.accountId, table.postingDate, table.transactionId),
  // Status filtering
  accountStatusIdx: index("idx_transaction_account_status").on(table.accountId, table.status, table.postingDate),
  // Transaction date queries
  accountDateIdx: index("idx_transaction_account_date").on(table.accountId, table.transactionDate),
  // Transfer lookup
  transferGroupIdx: index("idx_transaction_transfer_group").on(table.transferGroupId),
  // Counterparty lookup
  counterpartyIdx: index("idx_transaction_counterparty").on(table.counterpartyAccountId),
  // Category indexes
  merchantCategoryIdx: index("idx_transaction_merchant_category").on(table.merchantCategoryCode),
  categoryIdx: index("idx_transaction_category").on(table.categoryId),
  // Deduplication - unique constraint on source system and transaction ID per account
  uniqueSourceTxn: unique("unq_account_source_txn").on(table.accountId, table.sourceSystem, table.sourceTransactionId)
}));

// ==================================================================================
// DEBIT CARD TABLES
// ==================================================================================
//
// BUSINESS RULE ENFORCEMENT:
// - Debit cards can ONLY be issued to accounts with account_type = 'checking' or 'business_checking'
// - This rule is enforced at the database level via triggers in both PostgreSQL and SQL Server
// - The trigger validates account_type before INSERT/UPDATE operations on debit_card table
// - Any attempt to create a card for savings/investment/other account types will be rejected
//
// CUSTOMER OWNERSHIP VALIDATION:
// - Every debit_card MUST have a customer_id that references an actual account owner
// - Database trigger validates that customer_id exists in account_ownership for the linked account_id
// - This ensures cardholders are always valid account owners (prevents orphaned cards)
// - Supports primary cards, companion cards, and authorized users on joint accounts
//
// PCI COMPLIANCE:
// - Only last 4 digits, card brand, and token references are stored (PCI-DSS compliant)
// - Never store full PAN, CVV, PIN, or other sensitive card data
//
// ARCHITECTURE:
// - Debit card transactions are linked via debit_card_id in financial_transaction table
// - Maintains single source of truth for all transactions (no duplicate transaction tables)
// ==================================================================================

// Debit card limit profiles - reusable limit templates
export const debitCardLimitProfile = pgTable("debit_card_limit_profile", {
  profileId: bigserial("profile_id", { mode: "number" }).primaryKey(),
  profileName: varchar("profile_name", { length: 100 }).notNull(),
  profileDescription: text("profile_description"),
  dailyPurchaseLimit: decimal("daily_purchase_limit", { precision: 15, scale: 2 }).notNull(),
  dailyAtmLimit: decimal("daily_atm_limit", { precision: 15, scale: 2 }).notNull(),
  singleTransactionLimit: decimal("single_transaction_limit", { precision: 15, scale: 2 }),
  monthlyLimit: decimal("monthly_limit", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Debit card information (read-only display from core banking)
export const debitCard = pgTable("debit_card", {
  cardId: bigserial("card_id", { mode: "number" }).primaryKey(),
  accountId: bigint("account_id", { mode: "number" }).notNull().references(() => account.accountId),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customer.customerId),
  limitProfileId: bigint("limit_profile_id", { mode: "number" }).references(() => debitCardLimitProfile.profileId),
  cardType: varchar("card_type", { length: 30 }).notNull(),
  cardStatus: varchar("card_status", { length: 30 }).notNull(),
  lastFourDigits: varchar("last_four_digits", { length: 4 }).notNull(),
  cardBrand: varchar("card_brand", { length: 20 }),
  expiryMonth: bigint("expiry_month", { mode: "number" }).notNull(),
  expiryYear: bigint("expiry_year", { mode: "number" }).notNull(),
  cardholderName: varchar("cardholder_name", { length: 100 }).notNull(),
  jackHenryCardId: varchar("jack_henry_card_id", { length: 50 }),
  silverlakeCardToken: varchar("silverlake_card_token", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  accountIdx: index("idx_debit_card_account").on(table.accountId),
  customerIdx: index("idx_debit_card_customer").on(table.customerId),
  statusIdx: index("idx_debit_card_status").on(table.cardStatus),
  lastFourIdx: index("idx_debit_card_last_four").on(table.accountId, table.lastFourDigits),
  customerAccountIdx: index("idx_debit_card_customer_account").on(table.customerId, table.accountId)
}));

// ==================================================================================
// DASHBOARD CARDS TABLES
// ==================================================================================

// Online banking user authentication
export const onlineBankingUser = pgTable("online_banking_user", {
  onlineBankingUserId: bigserial("online_banking_user_id", { mode: "number" }).primaryKey(),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customer.customerId),
  loginId: varchar("login_id", { length: 50 }).notNull().unique(),
  status: varchar("status", { length: 20 }).default("active"), // active, locked, suspended
  lastLoginAt: timestamp("last_login_at"),
  failedAttempts: bigint("failed_attempts", { mode: "number" }).default(0),
  lockedAt: timestamp("locked_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  customerIdx: index("idx_online_banking_customer").on(table.customerId),
  loginIdIdx: index("idx_online_banking_login_id").on(table.loginId),
  statusIdx: index("idx_online_banking_status").on(table.status)
}));

// Online banking login event tracking
export const onlineBankingLoginEvent = pgTable("online_banking_login_event", {
  eventId: bigserial("event_id", { mode: "number" }).primaryKey(),
  onlineBankingUserId: bigint("online_banking_user_id", { mode: "number" }).notNull().references(() => onlineBankingUser.onlineBankingUserId),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  channel: varchar("channel", { length: 20 }).default("web"), // web, mobile, api
  result: varchar("result", { length: 20 }).notNull(), // success, failure
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  userTimeIdx: index("idx_login_event_user_time").on(table.onlineBankingUserId, table.occurredAt),
  resultIdx: index("idx_login_event_result").on(table.result, table.occurredAt)
}));

// Contact history for recent interactions
export const contactHistory = pgTable("contact_history", {
  contactId: bigserial("contact_id", { mode: "number" }).primaryKey(),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customer.customerId),
  employeeId: bigint("employee_id", { mode: "number" }).references(() => employee.employeeId),
  contactType: varchar("contact_type", { length: 30 }).notNull(), // phone, email, in_person, meeting, chat
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  employeeName: varchar("employee_name", { length: 200 }), // Denormalized for display
  summary: text("summary"),
  channel: varchar("channel", { length: 30 }), // phone, email, branch, online, mobile
  outcome: varchar("outcome", { length: 50 }), // resolved, pending, escalated, informational
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  customerTimeIdx: index("idx_contact_history_customer_time").on(table.customerId, table.occurredAt),
  typeIdx: index("idx_contact_history_type").on(table.contactType),
  employeeIdx: index("idx_contact_history_employee").on(table.employeeId)
}));

// ==================================================================================
// NOTES MODULE - ENTERPRISE CUSTOMER & ACCOUNT NOTES
// ==================================================================================
// ARCHITECTURE:
// - Supports notes at customer level and account level
// - Full version history with audit trails for compliance
// - Soft deletes with audit retention
// - Category-based organization with hierarchical support
// - Visibility controls (public/internal/confidential)
// - Full-text search capability
// - PST timezone formatting for all timestamps
// ==================================================================================

// Note categories - hierarchical organization
export const noteCategory = pgTable("note_category", {
  categoryId: bigserial("category_id", { mode: "number" }).primaryKey(),
  categoryName: varchar("category_name", { length: 100 }).notNull(),
  parentCategoryId: bigint("parent_category_id", { mode: "number" }).references((): any => noteCategory.categoryId),
  description: text("description"),
  colorCode: varchar("color_code", { length: 7 }), // Hex color for UI
  isActive: boolean("is_active").default(true),
  displayOrder: bigint("display_order", { mode: "number" }).default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  parentIdx: index("idx_note_category_parent").on(table.parentCategoryId),
  activeIdx: index("idx_note_category_active").on(table.isActive, table.displayOrder)
}));

// Note - immutable identity and target reference
export const note = pgTable("note", {
  noteId: bigserial("note_id", { mode: "number" }).primaryKey(),
  customerId: bigint("customer_id", { mode: "number" }).references(() => customer.customerId),
  accountId: bigint("account_id", { mode: "number" }).references(() => account.accountId),
  targetType: varchar("target_type", { length: 20 }).notNull(), // customer, account
  categoryId: bigint("category_id", { mode: "number" }).references(() => noteCategory.categoryId),
  importance: varchar("importance", { length: 20 }).notNull().default("medium"), // low, medium, high, urgent
  visibility: varchar("visibility", { length: 20 }).notNull().default("internal"), // public, internal, confidential
  legalHold: boolean("legal_hold").default(false), // Prevent deletion
  retentionYears: bigint("retention_years", { mode: "number" }), // null = indefinite
  isPinned: boolean("is_pinned").default(false), // Pin important notes to top
  cifNumber: varchar("cif_number", { length: 20 }), // Denormalized Jack Henry CIF for Operations queries
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  customerIdx: index("idx_note_customer").on(table.customerId, table.createdAt),
  accountIdx: index("idx_note_account").on(table.accountId, table.createdAt),
  targetTypeIdx: index("idx_note_target_type").on(table.targetType, table.targetType),
  categoryIdx: index("idx_note_category").on(table.categoryId),
  importanceIdx: index("idx_note_importance").on(table.importance),
  pinnedIdx: index("idx_note_pinned").on(table.isPinned, table.createdAt),
  cifNumberIdx: index("idx_note_cif_number").on(table.cifNumber),
  // Enforce exactly one target: either customer_id or account_id must be set
  checkOneTarget: sql`CONSTRAINT check_note_one_target CHECK (
    (customer_id IS NOT NULL AND account_id IS NULL) OR
    (customer_id IS NULL AND account_id IS NOT NULL)
  )`
}));

// Note version - content and history
export const noteVersion = pgTable("note_version", {
  versionId: bigserial("version_id", { mode: "number" }).primaryKey(),
  noteId: bigint("note_id", { mode: "number" }).notNull().references(() => note.noteId, { onDelete: "cascade" }),
  versionNumber: bigint("version_number", { mode: "number" }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(), // Rich text JSON or markdown
  authorEmployeeId: bigint("author_employee_id", { mode: "number" }).notNull().references(() => employee.employeeId),
  authorEmployeeName: varchar("author_employee_name", { length: 200 }), // Denormalized for display
  isCurrent: boolean("is_current").default(false),
  isSoftDeleted: boolean("is_soft_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  deletedByEmployeeId: bigint("deleted_by_employee_id", { mode: "number" }).references(() => employee.employeeId),
  encryptedPayload: text("encrypted_payload"), // For confidential notes
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at").defaultNow()
}, (table) => ({
  noteVersionIdx: index("idx_note_version_note").on(table.noteId, table.versionNumber),
  currentIdx: index("idx_note_version_current").on(table.noteId, table.isCurrent),
  authorIdx: index("idx_note_version_author").on(table.authorEmployeeId),
  deletedIdx: index("idx_note_version_deleted").on(table.isSoftDeleted, table.deletedAt),
  // Unique constraint: one current version per note
  uniqueCurrentVersion: unique("uq_note_current_version").on(table.noteId, table.isCurrent).nullsNotDistinct()
}));

// Note audit log - tracks all operations
export const noteAuditLog = pgTable("note_audit_log", {
  auditId: bigserial("audit_id", { mode: "number" }).primaryKey(),
  noteId: bigint("note_id", { mode: "number" }).notNull().references(() => note.noteId, { onDelete: "cascade" }),
  versionId: bigint("version_id", { mode: "number" }).references(() => noteVersion.versionId),
  action: varchar("action", { length: 30 }).notNull(), // create, update, delete, restore, view
  actorEmployeeId: bigint("actor_employee_id", { mode: "number" }).notNull().references(() => employee.employeeId),
  actorEmployeeName: varchar("actor_employee_name", { length: 200 }), // Denormalized
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  context: jsonb("context"), // Additional metadata (IP, user agent, etc.)
  correlationId: uuid("correlation_id"), // For tracking related operations
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  noteTimeIdx: index("idx_note_audit_note_time").on(table.noteId, table.occurredAt),
  actionIdx: index("idx_note_audit_action").on(table.action, table.occurredAt),
  actorIdx: index("idx_note_audit_actor").on(table.actorEmployeeId, table.occurredAt),
  correlationIdx: index("idx_note_audit_correlation").on(table.correlationId)
}));

// ==================================================================================
// RBAC - ROLE-BASED ACCESS CONTROL TABLES
// ==================================================================================

// Privilege levels (1-4)
export const privilegeLevel = pgTable("privilege_level", {
  level: bigint("level", { mode: "number" }).primaryKey(),
  levelName: varchar("level_name", { length: 50 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow()
});

// Roles with privilege levels
export const role = pgTable("role", {
  roleId: bigserial("role_id", { mode: "number" }).primaryKey(),
  roleName: varchar("role_name", { length: 100 }).notNull().unique(),
  privilegeLevel: bigint("privilege_level", { mode: "number" }).notNull().references(() => privilegeLevel.level),
  description: text("description"),
  isSystemRole: boolean("is_system_role").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: bigint("created_by", { mode: "number" }).references(() => employee.employeeId)
}, (table) => ({
  privilegeLevelIdx: index("idx_role_privilege_level").on(table.privilegeLevel),
  activeIdx: index("idx_role_active").on(table.isActive)
}));

// Permissions with attribute-based support
export const permission = pgTable("permission", {
  permissionId: bigserial("permission_id", { mode: "number" }).primaryKey(),
  permissionCode: varchar("permission_code", { length: 100 }).notNull().unique(),
  resource: varchar("resource", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  description: text("description"),
  minPrivilegeLevel: bigint("min_privilege_level", { mode: "number" }).references(() => privilegeLevel.level),
  isAttributeBased: boolean("is_attribute_based").default(false),
  attributeConfig: jsonb("attribute_config"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  resourceIdx: index("idx_permission_resource").on(table.resource),
  codeIdx: index("idx_permission_code").on(table.permissionCode),
  attributeBasedIdx: index("idx_permission_attribute_based").on(table.isAttributeBased),
  resourceActionUnique: unique("uq_permission_resource_action").on(table.resource, table.action)
}));

// Role to permission mapping
export const rolePermission = pgTable("role_permission", {
  roleId: bigint("role_id", { mode: "number" }).notNull().references(() => role.roleId, { onDelete: "cascade" }),
  permissionId: bigint("permission_id", { mode: "number" }).notNull().references(() => permission.permissionId, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at").defaultNow(),
  grantedBy: bigint("granted_by", { mode: "number" }).references(() => employee.employeeId)
}, (table) => ({
  pk: { primaryKey: true, columns: [table.roleId, table.permissionId] },
  roleIdx: index("idx_role_permission_role").on(table.roleId),
  permissionIdx: index("idx_role_permission_permission").on(table.permissionId)
}));

// Employee to role assignment
export const employeeRole = pgTable("employee_role", {
  employeeId: bigint("employee_id", { mode: "number" }).notNull().references(() => employee.employeeId, { onDelete: "cascade" }),
  roleId: bigint("role_id", { mode: "number" }).notNull().references(() => role.roleId),
  isPrimary: boolean("is_primary").default(false),
  assignedBy: bigint("assigned_by", { mode: "number" }).references(() => employee.employeeId),
  assignedDate: timestamp("assigned_date").defaultNow(),
  effectiveDate: date("effective_date").defaultNow(),
  expirationDate: date("expiration_date"),
  isActive: boolean("is_active").default(true),
  notes: text("notes")
}, (table) => ({
  pk: { primaryKey: true, columns: [table.employeeId, table.roleId] },
  employeeIdx: index("idx_employee_role_employee").on(table.employeeId),
  roleIdx: index("idx_employee_role_role").on(table.roleId),
  activeIdx: index("idx_employee_role_active").on(table.isActive),
  primaryIdx: index("idx_employee_role_primary").on(table.employeeId, table.isPrimary)
}));

// SAML role mapping for auto-assignment
export const samlRoleMapping = pgTable("saml_role_mapping", {
  mappingId: bigserial("mapping_id", { mode: "number" }).primaryKey(),
  samlRoleKey: varchar("saml_role_key", { length: 255 }).notNull().unique(),
  roleId: bigint("role_id", { mode: "number" }).notNull().references(() => role.roleId, { onDelete: "cascade" }),
  syncMode: varchar("sync_mode", { length: 20 }).notNull().default("initial"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: bigint("created_by", { mode: "number" }).references(() => employee.employeeId)
}, (table) => ({
  activeIdx: index("idx_saml_role_mapping_active").on(table.isActive),
  roleIdx: index("idx_saml_role_mapping_role").on(table.roleId)
}));

// Role audit log for compliance tracking
export const roleAuditLog = pgTable("role_audit_log", {
  auditId: bigserial("audit_id", { mode: "number" }).primaryKey(),
  auditType: varchar("audit_type", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: bigint("entity_id", { mode: "number" }),
  employeeId: bigint("employee_id", { mode: "number" }).references(() => employee.employeeId),
  roleId: bigint("role_id", { mode: "number" }).references(() => role.roleId),
  permissionId: bigint("permission_id", { mode: "number" }).references(() => permission.permissionId),
  actionBy: bigint("action_by", { mode: "number" }).notNull().references(() => employee.employeeId),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  reason: text("reason"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  employeeIdx: index("idx_role_audit_employee").on(table.employeeId),
  typeIdx: index("idx_role_audit_type").on(table.auditType),
  createdIdx: index("idx_role_audit_created").on(table.createdAt)
}));

// Permission denial audit log
export const permissionDenialLog = pgTable("permission_denial_log", {
  logId: bigserial("log_id", { mode: "number" }).primaryKey(),
  employeeId: bigint("employee_id", { mode: "number" }).references(() => employee.employeeId),
  permissionCode: varchar("permission_code", { length: 100 }),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: bigint("resource_id", { mode: "number" }),
  denialReason: text("denial_reason"),
  contextData: jsonb("context_data"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  employeeIdx: index("idx_permission_denial_employee").on(table.employeeId),
  createdIdx: index("idx_permission_denial_created").on(table.createdAt)
}));

// ==================================================================================
// USER MANAGEMENT TABLES (Migration 0008)
// ==================================================================================

// Employee status history for audit trail
export const employeeStatusHistory = pgTable("employee_status_history", {
  statusHistoryId: bigserial("status_history_id", { mode: "number" }).primaryKey(),
  employeeId: bigint("employee_id", { mode: "number" }).notNull().references(() => employee.employeeId, { onDelete: "cascade" }),
  statusType: varchar("status_type", { length: 50 }).notNull(),
  oldValue: varchar("old_value", { length: 255 }),
  newValue: varchar("new_value", { length: 255 }),
  reason: text("reason"),
  changedBy: bigint("changed_by", { mode: "number" }).notNull().references(() => employee.employeeId),
  changedAt: timestamp("changed_at").defaultNow(),
  metadata: jsonb("metadata")
}, (table) => ({
  employeeIdx: index("idx_employee_status_history_employee").on(table.employeeId),
  changedAtIdx: index("idx_employee_status_history_changed_at").on(table.changedAt),
  changedByIdx: index("idx_employee_status_history_changed_by").on(table.changedBy)
}));

// Employee role history for audit trail
export const employeeRoleHistory = pgTable("employee_role_history", {
  roleHistoryId: bigserial("role_history_id", { mode: "number" }).primaryKey(),
  employeeId: bigint("employee_id", { mode: "number" }).notNull().references(() => employee.employeeId, { onDelete: "cascade" }),
  roleId: bigint("role_id", { mode: "number" }).notNull().references(() => role.roleId),
  action: varchar("action", { length: 20 }).notNull(),
  oldRoleId: bigint("old_role_id", { mode: "number" }).references(() => role.roleId),
  newRoleId: bigint("new_role_id", { mode: "number" }).references(() => role.roleId),
  isPrimary: boolean("is_primary"),
  reason: text("reason"),
  assignedBy: bigint("assigned_by", { mode: "number" }).references(() => employee.employeeId),
  assignedAt: timestamp("assigned_at").defaultNow(),
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"),
  metadata: jsonb("metadata"),
  source: varchar("source", { length: 20 }).notNull(),
  samlRoleAttribute: varchar("saml_role_attribute", { length: 255 })
}, (table) => ({
  employeeIdx: index("idx_employee_role_history_employee").on(table.employeeId),
  assignedAtIdx: index("idx_employee_role_history_assigned_at").on(table.assignedAt),
  sourceIdx: index("idx_employee_role_history_source").on(table.source)
}));

// Role change request workflow
export const roleChangeRequest = pgTable("role_change_request", {
  requestId: bigserial("request_id", { mode: "number" }).primaryKey(),
  employeeId: bigint("employee_id", { mode: "number" }).notNull().references(() => employee.employeeId, { onDelete: "cascade" }),
  currentRoleId: bigint("current_role_id", { mode: "number" }).references(() => role.roleId),
  requestedRoleId: bigint("requested_role_id", { mode: "number" }).notNull().references(() => role.roleId),
  requestedBy: bigint("requested_by", { mode: "number" }).notNull().references(() => employee.employeeId),
  requestedAt: timestamp("requested_at").defaultNow(),
  status: varchar("status", { length: 20 }).default("pending"),
  reason: text("reason"),
  justification: text("justification"),
  reviewedBy: bigint("reviewed_by", { mode: "number" }).references(() => employee.employeeId),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  approvedBy: bigint("approved_by", { mode: "number" }).references(() => employee.employeeId),
  approvedAt: timestamp("approved_at"),
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"),
  metadata: jsonb("metadata")
}, (table) => ({
  employeeIdx: index("idx_role_change_request_employee").on(table.employeeId),
  statusIdx: index("idx_role_change_request_status").on(table.status),
  requestedByIdx: index("idx_role_change_request_requested_by").on(table.requestedBy),
  requestedAtIdx: index("idx_role_change_request_requested_at").on(table.requestedAt)
}));

// ==================================================================================
// AUDIT EVENT TABLE
// ==================================================================================

export const auditEvent = pgTable("audit_event", {
  eventId: bigserial("event_id", { mode: "number" }).primaryKey(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  correlationId: uuid("correlation_id"),
  // Actor
  employeeId: bigint("employee_id", { mode: "number" }).references(() => employee.employeeId),
  sessionId: varchar("session_id", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 500 }),
  // Action
  action: varchar("action", { length: 500 }).notNull(),
  outcome: varchar("outcome", { length: 20 }).notNull(),
  // Resource
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: varchar("resource_id", { length: 100 }),
  resourceName: varchar("resource_name", { length: 200 }),
  // Context
  metadata: jsonb("metadata"),
  source: varchar("source", { length: 10 }).notNull(), // 'server' | 'client'
  module: varchar("module", { length: 100 }),
  // Timestamps
  occurredAt: timestamp("occurred_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  eventTypeIdx: index("idx_audit_event_type").on(table.eventType),
  categoryIdx: index("idx_audit_event_category").on(table.category),
  employeeOccurredIdx: index("idx_audit_event_employee_occurred").on(table.employeeId, table.occurredAt),
  correlationIdx: index("idx_audit_event_correlation").on(table.correlationId),
  resourceIdx: index("idx_audit_event_resource").on(table.resourceType, table.resourceId),
  occurredAtIdx: index("idx_audit_event_occurred_at").on(table.occurredAt),
  severityOccurredIdx: index("idx_audit_event_severity_occurred").on(table.severity, table.occurredAt),
}));

export const insertAuditEventSchema = createInsertSchema(auditEvent).omit({
  eventId: true,
  createdAt: true,
});

// ==================================================================================
// ZOD SCHEMAS FOR VALIDATION
// ==================================================================================

// Base customer schema without type-specific validation
const baseCustomerSchema = createInsertSchema(customer).omit({
  customerId: true,
  fullName: true, // Generated column, not manually inserted
  createdAt: true,
  updatedAt: true
});

// Conditional customer validation using discriminated union
export const insertCustomerSchema = z.discriminatedUnion("customerType", [
  // Individual customers (individual, premium, regular)
  baseCustomerSchema.extend({
    customerType: z.enum(["individual", "premium", "regular"]),
    firstName: z.string().trim().min(1, "First name is required for individual customers"),
    lastName: z.string().trim().min(1, "Last name is required for individual customers"),
    businessName: z.null().or(z.undefined()).or(z.literal("")),
  }),
  // Business customers
  baseCustomerSchema.extend({
    customerType: z.literal("business"),
    businessName: z.string().trim().min(1, "Business name is required for business customers"),
    firstName: z.null().or(z.undefined()).or(z.literal("")),
    lastName: z.null().or(z.undefined()).or(z.literal("")),
  }),
  // Trust customers
  baseCustomerSchema.extend({
    customerType: z.literal("trust"),
    businessName: z.string().trim().min(1, "Business name is required for trust customers"),
    firstName: z.null().or(z.undefined()).or(z.literal("")),
    lastName: z.null().or(z.undefined()).or(z.literal("")),
  }),
]);

export const searchCustomerSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
});

export const insertContactInfoSchema = createInsertSchema(contactInfo).omit({
  contactId: true,
  createdAt: true,
  updatedAt: true
});

export const insertAddressSchema = createInsertSchema(address).omit({
  addressId: true,
  createdAt: true,
  updatedAt: true
});

export const insertHouseholdSchema = createInsertSchema(household).omit({
  householdId: true,
  createdAt: true,
  updatedAt: true
});

export const insertHouseholdMembershipSchema = createInsertSchema(householdMembership).omit({
  membershipId: true,
  createdAt: true,
  updatedAt: true
});

export const insertAccountSchema = createInsertSchema(account).omit({
  accountId: true,
  createdAt: true,
  updatedAt: true
});

export const insertAccountOwnershipSchema = createInsertSchema(accountOwnership).omit({
  ownershipId: true,
  createdAt: true,
  updatedAt: true
});

export const insertEmployeeBranchSchema = createInsertSchema(employeeBranch).omit({
  employeeBranchId: true,
  createdAt: true,
  updatedAt: true
});

export const insertCustomerOfficerAssignmentSchema = createInsertSchema(customerOfficerAssignment).omit({
  assignedAt: true,
  updatedAt: true
}).extend({
  relationshipType: z.enum(['primary', 'secondary'], {
    errorMap: () => ({ message: "Relationship type must be 'primary' or 'secondary'" })
  })
});

export const insertSicCodeSchema = createInsertSchema(sicCode).omit({
  createdAt: true,
  updatedAt: true
});

export const insertCustomerSicCodeSchema = createInsertSchema(customerSicCode).omit({
  assignedAt: true,
  updatedAt: true
});

export const insertAccountSicCodeSchema = createInsertSchema(accountSicCode).omit({
  accountSicCodeId: true,
  createdAt: true,
  updatedAt: true
});

export const insertTransactionCategorySchema = createInsertSchema(transactionCategory).omit({
  categoryId: true,
  createdAt: true,
  updatedAt: true
});

export const insertFinancialTransactionSchema = createInsertSchema(financialTransaction).omit({
  transactionId: true,
  createdAt: true,
  updatedAt: true
});

export const insertRegionSchema = createInsertSchema(region).omit({
  regionId: true,
  createdAt: true,
  updatedAt: true
});

export const insertBranchSchema = createInsertSchema(branch).omit({
  branchId: true,
  createdAt: true,
  updatedAt: true
});

export const insertEmployeeSchema = createInsertSchema(employee).omit({
  employeeId: true,
  createdAt: true,
  updatedAt: true
});

// Role assignment schema for SSO users
export const assignRoleSchema = z.object({
  roleId: z.number().int().positive(),
  isPrimary: z.boolean().default(false),
  reason: z.string().min(1, "Reason for role assignment is required"),
  effectiveDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional()
});

export const removeRoleSchema = z.object({
  roleId: z.number().int().positive(),
  reason: z.string().min(1, "Reason for role removal is required")
});

// SAML SSO user provisioning schema
export const upsertSsoUserSchema = z.object({
  ssoSubject: z.string().min(1, "SAML NameID is required"),
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional()
});

export const insertOnlineBankingUserSchema = createInsertSchema(onlineBankingUser).omit({
  onlineBankingUserId: true,
  createdAt: true,
  updatedAt: true
});

export const insertOnlineBankingLoginEventSchema = createInsertSchema(onlineBankingLoginEvent).omit({
  eventId: true,
  createdAt: true
});

export const insertContactHistorySchema = createInsertSchema(contactHistory).omit({
  contactId: true,
  createdAt: true,
  updatedAt: true
});

// Notes module schemas
export const insertNoteCategorySchema = createInsertSchema(noteCategory).omit({
  categoryId: true,
  createdAt: true,
  updatedAt: true
});

export const insertNoteSchema = createInsertSchema(note).omit({
  noteId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  targetType: z.enum(['customer', 'account']),
  importance: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  visibility: z.enum(['public', 'internal', 'confidential']).default('internal')
});

export const insertNoteVersionSchema = createInsertSchema(noteVersion).omit({
  versionId: true,
  createdAt: true,
  modifiedAt: true
}).extend({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  body: z.string().min(1, "Note body is required")
});

export const insertNoteAuditLogSchema = createInsertSchema(noteAuditLog).omit({
  auditId: true,
  createdAt: true
}).extend({
  action: z.enum(['create', 'update', 'delete', 'restore', 'view'])
});

export const insertDebitCardLimitProfileSchema = createInsertSchema(debitCardLimitProfile).omit({
  profileId: true,
  createdAt: true,
  updatedAt: true
});

// Debit card insert schema - customer_id is REQUIRED (enforced by .notNull() in table definition)
// Database trigger validates that customer_id is an active account owner
export const insertDebitCardSchema = createInsertSchema(debitCard).omit({
  cardId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(new Date().getFullYear())
});

// RBAC insert schemas
export const insertPrivilegeLevelSchema = createInsertSchema(privilegeLevel).omit({
  createdAt: true
});

export const insertRoleSchema = createInsertSchema(role).omit({
  roleId: true,
  createdAt: true,
  updatedAt: true
});

export const insertPermissionSchema = createInsertSchema(permission).omit({
  permissionId: true,
  createdAt: true
});

export const insertRolePermissionSchema = createInsertSchema(rolePermission).omit({
  grantedAt: true
});

export const insertEmployeeRoleSchema = createInsertSchema(employeeRole).omit({
  assignedDate: true
});

export const insertSamlRoleMappingSchema = createInsertSchema(samlRoleMapping).omit({
  mappingId: true,
  createdAt: true,
  updatedAt: true
});

export const insertEmployeeRoleHistorySchema = createInsertSchema(employeeRoleHistory).omit({
  historyId: true,
  createdAt: true
});

export const insertRoleAuditLogSchema = createInsertSchema(roleAuditLog).omit({
  auditId: true,
  createdAt: true
});

export const insertPermissionDenialLogSchema = createInsertSchema(permissionDenialLog).omit({
  logId: true,
  createdAt: true
});

// ==================================================================================
// TYPES FOR API RESPONSES
// ==================================================================================

export type Customer = typeof customer.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type SearchCustomerParams = z.infer<typeof searchCustomerSchema>;

export type ContactInfo = typeof contactInfo.$inferSelect;
export type InsertContactInfo = z.infer<typeof insertContactInfoSchema>;

// UI-friendly contact interface that matches frontend expectations
export interface ContactInfoUI {
  id: string;
  type: 'phone' | 'email' | 'address';
  value: string;
  subtype: string;
  isPrimary: boolean;
  purpose: string;
}

export type Address = typeof address.$inferSelect;
export type InsertAddress = z.infer<typeof insertAddressSchema>;

export type Household = typeof household.$inferSelect;
export type InsertHousehold = z.infer<typeof insertHouseholdSchema>;

export type HouseholdMembership = typeof householdMembership.$inferSelect;
export type InsertHouseholdMembership = z.infer<typeof insertHouseholdMembershipSchema>;

// Joined type for household members with customer details
export interface HouseholdMemberWithCustomer {
  membershipId: number;
  householdId: number;
  customerId: number;
  relationshipRole: string;
  isPrimaryMember: boolean;
  isHeadOfHousehold: boolean;
  membershipStartDate: string | null;
  membershipEndDate: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  customerSince: string | null;
}

export type Account = typeof account.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;

export type AccountOwnership = typeof accountOwnership.$inferSelect;
export type InsertAccountOwnership = z.infer<typeof insertAccountOwnershipSchema>;

export type EmployeeBranch = typeof employeeBranch.$inferSelect;
export type InsertEmployeeBranch = z.infer<typeof insertEmployeeBranchSchema>;

export type CustomerOfficerAssignment = typeof customerOfficerAssignment.$inferSelect;
export type InsertCustomerOfficerAssignment = z.infer<typeof insertCustomerOfficerAssignmentSchema>;

export type SicCode = typeof sicCode.$inferSelect;
export type InsertSicCode = z.infer<typeof insertSicCodeSchema>;

export type CustomerSicCode = typeof customerSicCode.$inferSelect;
export type InsertCustomerSicCode = z.infer<typeof insertCustomerSicCodeSchema>;

export type AccountSicCode = typeof accountSicCode.$inferSelect;
export type InsertAccountSicCode = z.infer<typeof insertAccountSicCodeSchema>;

export type TransactionCategory = typeof transactionCategory.$inferSelect;
export type InsertTransactionCategory = z.infer<typeof insertTransactionCategorySchema>;

export type FinancialTransaction = typeof financialTransaction.$inferSelect;
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;

export type Region = typeof region.$inferSelect;
export type InsertRegion = z.infer<typeof insertRegionSchema>;

export type Branch = typeof branch.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;

export type Employee = typeof employee.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type OnlineBankingUser = typeof onlineBankingUser.$inferSelect;
export type InsertOnlineBankingUser = z.infer<typeof insertOnlineBankingUserSchema>;

export type OnlineBankingLoginEvent = typeof onlineBankingLoginEvent.$inferSelect;
export type InsertOnlineBankingLoginEvent = z.infer<typeof insertOnlineBankingLoginEventSchema>;

export type ContactHistory = typeof contactHistory.$inferSelect;
export type InsertContactHistory = z.infer<typeof insertContactHistorySchema>;

export type DebitCardLimitProfile = typeof debitCardLimitProfile.$inferSelect;
export type InsertDebitCardLimitProfile = z.infer<typeof insertDebitCardLimitProfileSchema>;

export type DebitCard = typeof debitCard.$inferSelect;
export type InsertDebitCard = z.infer<typeof insertDebitCardSchema>;

// Notes module types
export type NoteCategory = typeof noteCategory.$inferSelect;
export type InsertNoteCategory = z.infer<typeof insertNoteCategorySchema>;

export type Note = typeof note.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;

export type NoteVersion = typeof noteVersion.$inferSelect;
export type InsertNoteVersion = z.infer<typeof insertNoteVersionSchema>;

export type NoteAuditLog = typeof noteAuditLog.$inferSelect;
export type InsertNoteAuditLog = z.infer<typeof insertNoteAuditLogSchema>;

// RBAC types
export type PrivilegeLevel = typeof privilegeLevel.$inferSelect;
export type InsertPrivilegeLevel = z.infer<typeof insertPrivilegeLevelSchema>;

export type Role = typeof role.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type Permission = typeof permission.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type RolePermission = typeof rolePermission.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type EmployeeRole = typeof employeeRole.$inferSelect;
export type InsertEmployeeRole = z.infer<typeof insertEmployeeRoleSchema>;

export type SamlRoleMapping = typeof samlRoleMapping.$inferSelect;
export type InsertSamlRoleMapping = z.infer<typeof insertSamlRoleMappingSchema>;

export type EmployeeRoleHistory = typeof employeeRoleHistory.$inferSelect;
export type InsertEmployeeRoleHistory = z.infer<typeof insertEmployeeRoleHistorySchema>;

export type RoleAuditLog = typeof roleAuditLog.$inferSelect;
export type InsertRoleAuditLog = z.infer<typeof insertRoleAuditLogSchema>;

export type PermissionDenialLog = typeof permissionDenialLog.$inferSelect;
export type InsertPermissionDenialLog = z.infer<typeof insertPermissionDenialLogSchema>;

// Debit card with joined limit profile for API responses
export interface DebitCardWithLimitProfile {
  cardId: number;
  accountId: number;
  customerId: number;
  cardType: string;
  cardStatus: string;
  lastFourDigits: string;
  cardBrand: string | null;
  expiryMonth: number;
  expiryYear: number;
  cardholderName: string;
  jackHenryCardId: string | null;
  silverlakeCardToken: string | null;
  limitProfile: {
    profileId: number;
    profileName: string;
    profileDescription: string | null;
    dailyPurchaseLimit: string;
    dailyAtmLimit: string;
    singleTransactionLimit: string | null;
    monthlyLimit: string | null;
  } | null;
}

// Complex types for API responses
export interface CustomerWithDetails extends Customer {
  primaryEmail?: string;
  primaryPhone?: string;
  primaryAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  branchName?: string;
  branchCode?: string;
}

export interface CustomerSearchResult {
  customers: CustomerWithDetails[];
  totalCount: number;
  hasMore: boolean;
}

// ==================================================================================
// SMART SEARCH TYPES AND SCHEMAS
// ==================================================================================

export type SearchType = 'name' | 'taxId' | 'govId' | 'silverlakeId' | 'customerId' | 'cif' | 'ambiguousNumeric' | 'household' | 'auto';

export type SearchField = 'fullName' | 'firstName' | 'lastName' | 'silverlakeCustomerId' | 'taxIdentifier' | 'governmentId' | 'customerId' | 'cifNumber' | 'householdName';

export type MatchType = 'exact' | 'fuzzy' | 'partial';

export type EntityType = 'customer' | 'household' | 'account';

// Lean search result for performance
export interface CustomerListItem {
  customerId: number;
  fullName: string; // Generated field combining first+last or business name
  customerType: string | null; // individual, business, trust, etc.
  customerStatus: string | null;
  silverlakeCustomerId: string | null;
  taxIdentifierLast4?: string; // Masked PII
  governmentIdLast4?: string; // Masked PII
  matchScore?: number; // 0-100 relevance score
  matchType?: MatchType; // How the result matched
  matchedField?: string; // Which field matched
}

// Account search result item
export interface HouseholdListItem {
  householdId: number;
  householdName: string;
  householdType: string;
  householdStatus: string;
  totalAssets: string; // Decimal as string
  totalLiabilities: string; // Decimal as string
  memberCount: number; // Aggregated count of members
  riskRating: string | null;
  matchScore?: number; // 0-100 relevance score
  matchType?: MatchType;
  matchedField?: string;
}

// Household search result item
export interface AccountListItem {
  accountId: number;
  accountNumber: string;
  accountType: string;
  accountStatus: string;
  accountSubtype: string; 
  balance: number; 
  customerId: number | null;
  matchScore?: number; // 0-100 relevance score
  matchType?: MatchType;
  matchedField?: string;
}

// Unified search entity (customer OR household)
export interface SearchEntityItem {
  entityType: EntityType;
  entityId: number; // customerId or householdId
  displayName: string; // fullName or householdName
  primaryIdentifiers: string[]; // e.g., ["CID: 5"] or ["1 member", "$13.8K assets"]
  status: string | null;
  matchScore?: number;
  matchType?: MatchType;
  matchedField?: string;
  // Entity-specific optional fields
  customer?: CustomerListItem;
  household?: HouseholdListItem;
  account?: AccountListItem;
}

export interface SmartSearchDiagnostics {
  detectedType: SearchType;
  fieldsUsed: SearchField[];
  queryNormalized: string;
}

export interface SmartSearchPage {
  cursor?: string;
  hasMore: boolean;
  totalCount?: number;
}

export interface SmartSearchResult {
  data: CustomerListItem[];
  page: SmartSearchPage;
  diagnostics: SmartSearchDiagnostics;
}

// Unified search result supporting both customers and households
export interface UnifiedSearchResult {
  data: SearchEntityItem[];
  page: SmartSearchPage;
  diagnostics: SmartSearchDiagnostics;
}

// Smart search parameters schema
export const smartSearchParamsSchema = z.object({
  q: z.string().min(1, "Search query is required").max(200),
  fields: z.array(z.enum(['firstName', 'lastName', 'silverlakeCustomerId', 'taxIdentifier', 'governmentId', 'customerId', 'cifNumber', 'householdName'])).optional(),
  type: z.enum(['name', 'taxId', 'govId', 'silverlakeId', 'customerId', 'cif', 'household', 'auto']).default('auto'),
  entityTypes: z.array(z.enum(['customer', 'household', 'account'])).optional(), // Filter by entity type
  exact: z.boolean().default(false),
  fuzzyThreshold: z.number().min(0.1).max(1.0).default(0.3),
  limit: z.number().min(1).max(100).default(25),
  cursor: z.string().optional(),
  includeTotal: z.boolean().default(false)
});

export type SmartSearchParams = z.infer<typeof smartSearchParamsSchema>;

// ==================================================================================
// RBAC PERMISSION INTERFACES
// ==================================================================================

// Permission condition for attribute-based access control
export interface PermissionCondition {
  attribute: string;           // e.g., "customer.isEmployee"
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
  denyIfMatch: boolean;        // If true, deny permission when condition matches
  minPrivilegeOverride?: number;  // Required privilege level when condition matches
  reason: string;
}

// Attribute configuration for permissions
export interface AttributeConfig {
  conditions: PermissionCondition[];
}

// Permission context for evaluation
export interface PermissionContext {
  customer?: Customer;
  account?: Account;
  note?: Note;
  [key: string]: any;
}

// Permission check result
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  matchedCondition?: PermissionCondition;
}

// User permissions response for frontend
export interface UserPermissions {
  employeeId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  primaryRoleName: string | null;
  privilegeLevel: number | null;
  permissions: string[];  // array of permission codes
  maxPrivilegeLevel: number;
  roles: Role[];
  isRoleTesting?: boolean;
  originalRoleId?: number | null;
  testingRoleId?: number | null;
}

// ==================================================================================
// USER MANAGEMENT TYPES
// ==================================================================================

// Employee with roles for user management
export interface EmployeeWithRoles extends Employee {
  roles?: Array<{
    roleId: number;
    roleName: string;
    privilegeLevel: number;
    isPrimary: boolean;
    isActive: boolean;
  }>;
  primaryRole?: {
    roleId: number;
    roleName: string;
    privilegeLevel: number;
  };
}

// User list item for DataGrid (SSO users)
export interface UserListItem {
  employeeId: number;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  department: string | null;
  primaryRoleName: string | null;
  privilegeLevel: number | null;
  isActive: boolean;
  isLocked: boolean;
  ssoSubject: string | null;
  lastLoginAt: Date | null;
  lastSeenSamlRole: string | null;
  roleAssignmentSource: 'saml' | 'manual' | null;
  samlRoleAttribute: string | null;
}

// User detail response
export interface UserDetail extends EmployeeWithRoles {
  permissions: string[];
  statusHistory?: Array<{
    statusType: string;
    oldValue: string | null;
    newValue: string | null;
    changedBy: string;
    changedAt: Date;
    reason: string | null;
  }>;
  roleHistory?: Array<{
    action: string;
    oldRoleName: string | null;
    newRoleName: string | null;
    assignedBy: string;
    assignedAt: Date;
    reason: string | null;
  }>;
}

// Request/Response types for role assignment (SSO model)
export type AssignRoleRequest = z.infer<typeof assignRoleSchema>;
export type RemoveRoleRequest = z.infer<typeof removeRoleSchema>;
export type UpsertSsoUserRequest = z.infer<typeof upsertSsoUserSchema>;

// User management table types
export type EmployeeStatusHistory = typeof employeeStatusHistory.$inferSelect;
export type RoleChangeRequest = typeof roleChangeRequest.$inferSelect;

// Audit event types
export type AuditEventRow = typeof auditEvent.$inferSelect;
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;