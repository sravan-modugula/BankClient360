/**
 * SQL Server Customer CRUD Operations
 * Comprehensive customer management for MS SQL Server
 */

import sql from 'mssql';
import type {
  Customer,
  InsertCustomer,
  CustomerWithDetails,
  ContactInfo,
  Address
} from '@shared/schema';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-customer' });

/**
 * Get customer by ID
 */
export async function getCustomerByIdSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<Customer | null> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    const result = await request.query(`
      SELECT * FROM customer WHERE customer_id = @customerId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapCustomerFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer by ID error');
    throw error;
  }
}

/**
 * Get customer with full details (contacts, addresses, accounts)
 */
export async function getCustomerWithDetailsSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<CustomerWithDetails | null> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    // Get customer with contacts and addresses in one query
    const result = await request.query(`
      SELECT 
        c.*,
        -- Contact info
        ci.contact_id,
        ci.contact_type,
        ci.contact_value,
        ci.contact_subtype,
        ci.is_primary as contact_is_primary,
        -- Address info
        a.address_id,
        a.address_line1,
        a.address_line2,
        a.city,
        a.state,
        a.postal_code,
        a.country,
        a.address_type,
        a.is_primary as address_is_primary,
        -- Branch info
        b.branch_name,
        b.branch_code,
        -- Class description
        cc.description as class_description
      FROM customer c
      LEFT JOIN entity_contact ec ON ec.entity_id = c.customer_id
        AND ec.entity_type = 'customer'
        AND ec.is_current = 1
      LEFT JOIN contact_info ci ON ci.contact_id = ec.contact_id
      LEFT JOIN entity_address ea ON ea.entity_id = c.customer_id
        AND ea.entity_type = 'customer'
        AND ea.is_current = 1
      LEFT JOIN address a ON a.address_id = ea.address_id
      LEFT JOIN branch b ON b.branch_id = c.branch_id
      LEFT JOIN customer_class cc ON cc.class_code = c.class_code
      WHERE c.customer_id = @customerId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    // Map the joined result
    const customer = mapCustomerFromDb(result.recordset[0]);
    const contacts: ContactInfo[] = [];
    const addresses: Address[] = [];
    const contactIds = new Set<number>();
    const addressIds = new Set<number>();

    for (const row of result.recordset) {
      // Collect unique contacts
      if (row.contact_id && !contactIds.has(row.contact_id)) {
        contactIds.add(row.contact_id);
        contacts.push({
          contactId: row.contact_id,
          contactType: row.contact_type,
          contactValue: row.contact_value,
          contactSubtype: row.contact_subtype,
          isPrimary: row.contact_is_primary,
          isVerified: false,
          verificationDate: null,
          canContact: true,
          preferredTime: null,
          createdAt: null,
          updatedAt: null
        });
      }

      // Collect unique addresses
      if (row.address_id && !addressIds.has(row.address_id)) {
        addressIds.add(row.address_id);
        addresses.push({
          addressId: row.address_id,
          addressLine1: row.address_line1,
          addressLine2: row.address_line2,
          city: row.city,
          state: row.state,
          postalCode: row.postal_code,
          country: row.country,
          addressType: row.address_type,
          isPrimary: row.address_is_primary,
          validated: false,
          validationDate: null,
          createdAt: null,
          updatedAt: null
        });
      }
    }

    return {
      ...customer,
      contacts,
      addresses,
      branchName: result.recordset[0].branch_name,
      branchCode: result.recordset[0].branch_code,
      classDescription: result.recordset[0].class_description || null
    } as CustomerWithDetails;
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer with details error');
    throw error;
  }
}

/**
 * Create new customer
 */
export async function createCustomerSqlServer(
  pool: sql.ConnectionPool,
  customerData: InsertCustomer
): Promise<Customer> {
  try {
    const request = pool.request();

    // Map all customer fields
    request.input('firstName', sql.NVarChar, customerData.firstName || null);
    request.input('lastName', sql.NVarChar, customerData.lastName || null);
    request.input('middleName', sql.NVarChar, customerData.middleName || null);
    request.input('preferredName', sql.NVarChar, customerData.preferredName || null);
    request.input('title', sql.NVarChar, customerData.title || null);
    request.input('suffix', sql.NVarChar, customerData.suffix || null);
    request.input('dateOfBirth', sql.Date, customerData.dateOfBirth || null);
    request.input('gender', sql.NVarChar, customerData.gender || null);
    request.input('maritalStatus', sql.NVarChar, customerData.maritalStatus || null);
    request.input('businessName', sql.NVarChar, customerData.businessName || null);
    request.input('fullName', sql.NVarChar, customerData.fullName || null);
    request.input('taxIdentifier', sql.NVarChar, customerData.taxIdentifier || null);
    request.input('governmentId', sql.NVarChar, customerData.governmentId || null);
    request.input('governmentIdType', sql.NVarChar, customerData.governmentIdType || null);
    request.input('citizenship', sql.NVarChar, customerData.citizenship || null);
    request.input('customerType', sql.NVarChar, customerData.customerType || 'regular');
    request.input('customerStatus', sql.NVarChar, customerData.customerStatus || 'active');
    request.input('customerSince', sql.Date, customerData.customerSince || new Date());
    request.input('kycStatus', sql.NVarChar, customerData.kycStatus || null);
    request.input('kycLastUpdated', sql.Date, customerData.kycLastUpdated || null);
    request.input('riskRating', sql.NVarChar, customerData.riskRating || null);
    request.input('languagePreference', sql.NVarChar, customerData.languagePreference || 'en');

    const result = await request.query(`
      INSERT INTO customer (
        first_name, last_name, middle_name, preferred_name, title, suffix,
        date_of_birth, gender, marital_status, business_name, full_name,
        tax_identifier, government_id, government_id_type, citizenship,
        customer_type, customer_status, customer_since, kyc_status,
        kyc_last_updated, risk_rating, language_preference
      )
      OUTPUT INSERTED.*
      VALUES (
        @firstName, @lastName, @middleName, @preferredName, @title, @suffix,
        @dateOfBirth, @gender, @maritalStatus, @businessName, @fullName,
        @taxIdentifier, @governmentId, @governmentIdType, @citizenship,
        @customerType, @customerStatus, @customerSince, @kycStatus,
        @kycLastUpdated, @riskRating, @languagePreference
      )
    `);

    return mapCustomerFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Create customer error');
    throw error;
  }
}

/**
 * Update customer
 */
export async function updateCustomerSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  customerData: Partial<InsertCustomer>
): Promise<Customer | undefined> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    // Build dynamic UPDATE statement
    const updates: string[] = [];

    if (customerData.firstName !== undefined) {
      request.input('firstName', sql.NVarChar, customerData.firstName);
      updates.push('first_name = @firstName');
    }
    if (customerData.lastName !== undefined) {
      request.input('lastName', sql.NVarChar, customerData.lastName);
      updates.push('last_name = @lastName');
    }
    if (customerData.businessName !== undefined) {
      request.input('businessName', sql.NVarChar, customerData.businessName);
      updates.push('business_name = @businessName');
    }
    if (customerData.customerStatus !== undefined) {
      request.input('customerStatus', sql.NVarChar, customerData.customerStatus);
      updates.push('customer_status = @customerStatus');
    }
    if (customerData.riskRating !== undefined) {
      request.input('riskRating', sql.NVarChar, customerData.riskRating);
      updates.push('risk_rating = @riskRating');
    }

    if (updates.length === 0) {
      // No updates to make - convert null to undefined for consistent return type
      const existing = await getCustomerByIdSqlServer(pool, customerId);
      return existing || undefined;
    }

    // Always update updated_at
    updates.push('updated_at = GETDATE()');

    const result = await request.query(`
      UPDATE customer
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE customer_id = @customerId
    `);

    if (result.recordset.length === 0) {
      return undefined;
    }

    return mapCustomerFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Update customer error');
    throw error;
  }
}

/**
 * Deactivate customer
 */
export async function deactivateCustomerSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<Customer | undefined> {
  return await updateCustomerSqlServer(pool, customerId, { customerStatus: 'inactive' });
}

/**
 * Map database row to Customer object
 * Matches shared/schema.ts Customer type
 */
function mapCustomerFromDb(row: any): Customer {
  return {
    customerId: row.customer_id,
    firstName: row.first_name,
    lastName: row.last_name,
    middleName: row.middle_name,
    preferredName: row.preferred_name,
    title: row.title,
    suffix: row.suffix,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    maritalStatus: row.marital_status,
    businessName: row.business_name,
    fullName: row.full_name,
    taxIdentifier: row.tax_identifier,
    governmentId: row.government_id,
    governmentIdType: row.government_id_type,
    citizenship: row.citizenship,
    customerType: row.customer_type,
    customerStatus: row.customer_status,
    customerSince: row.customer_since,
    kycStatus: row.kyc_status,
    kycLastUpdated: row.kyc_last_updated,
    riskRating: row.risk_rating,
    languagePreference: row.language_preference,
    occupation: row.occupation,
    employerName: row.employer_name,
    naicsCode: row.naics_code,
    dbaName: row.dba_name,
    branchId: row.branch_id,
    jackHenryCifNumber: row.jack_henry_cif_number,
    silverlakeCustomerId: row.silverlake_customer_id,
    inquiryCode: row.inquiry_code,
    insideCode: row.inside_code,
    salesAssociateCode: row.sales_associate_code,
    classCode: row.class_code,
    isEmployee: row.is_employee,
    vipCustomer: row.vip_customer,
    isDeceased: row.is_deceased,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Get customer by tax identifier
 */
export async function getCustomerByTaxIdSqlServer(
  pool: sql.ConnectionPool,
  taxId: string
): Promise<Customer | null> {
  try {
    const request = pool.request();
    request.input('taxId', sql.NVarChar, taxId);

    const result = await request.query(`
      SELECT * FROM customer 
      WHERE tax_identifier = @taxId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapCustomerFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer by tax ID error');
    throw error;
  }
}

/**
 * Get customer by CIF number (Jack Henry)
 */
export async function getCustomerByCifNumberSqlServer(
  pool: sql.ConnectionPool,
  cifNumber: string
): Promise<Customer | null> {
  try {
    const request = pool.request();
    request.input('cifNumber', sql.NVarChar, cifNumber);

    const result = await request.query(`
      SELECT * FROM customer 
      WHERE jack_henry_cif_number = @cifNumber
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapCustomerFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer by CIF error');
    throw error;
  }
}

/**
 * Get customer by government ID
 */
export async function getCustomerByGovernmentIdSqlServer(
  pool: sql.ConnectionPool,
  governmentId: string
): Promise<Customer | null> {
  try {
    const request = pool.request();
    request.input('governmentId', sql.NVarChar, governmentId);

    const result = await request.query(`
      SELECT * FROM customer 
      WHERE government_id = @governmentId
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapCustomerFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer by government ID error');
    throw error;
  }
}

