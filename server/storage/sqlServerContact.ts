/**
 * SQL Server Contact and Address Operations
 * Contact and address CRUD operations for MS SQL Server
 */

import sql from 'mssql';
import type { ContactInfo, Address, InsertContactInfo, InsertAddress } from '@shared/schema';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-contact' });

/**
 * Get customer contacts
 */
export async function getCustomerContactsSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<ContactInfo[]> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    const result = await request.query(`
      SELECT ci.*
      FROM contact_info ci
      INNER JOIN entity_contact ec ON ec.contact_id = ci.contact_id
      WHERE ec.entity_id = @customerId
        AND ec.entity_type = 'customer'
        AND ec.is_current = 1
      ORDER BY ci.is_primary DESC, ci.contact_type, ci.contact_id
    `);

    return result.recordset.map(mapContactFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer contacts error');
    throw error;
  }
}

/**
 * Add customer contact
 */
export async function addCustomerContactSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  contactData: InsertContactInfo
): Promise<ContactInfo> {
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // Create contact info
    const contactRequest = new sql.Request(transaction);
    contactRequest.input('contactType', sql.NVarChar, contactData.contactType);
    contactRequest.input('contactValue', sql.NVarChar, contactData.contactValue);
    contactRequest.input('contactSubtype', sql.NVarChar, contactData.contactSubtype || null);
    contactRequest.input('isPrimary', sql.Bit, contactData.isPrimary ? 1 : 0);
    contactRequest.input('isVerified', sql.Bit, contactData.isVerified ? 1 : 0);
    contactRequest.input('canContact', sql.Bit, contactData.canContact !== false ? 1 : 0);

    const contactResult = await contactRequest.query(`
      INSERT INTO contact_info (
        contact_type, contact_value, contact_subtype, 
        is_primary, is_verified, can_contact
      )
      OUTPUT INSERTED.*
      VALUES (
        @contactType, @contactValue, @contactSubtype,
        @isPrimary, @isVerified, @canContact
      )
    `);

    const newContact = contactResult.recordset[0];

    // If this is a primary contact, deactivate existing primary contacts
    if (contactData.isPrimary) {
      const deactivateRequest = new sql.Request(transaction);
      deactivateRequest.input('customerId', sql.BigInt, customerId);
      deactivateRequest.input('contactId', sql.BigInt, newContact.contact_id);

      await deactivateRequest.query(`
        UPDATE entity_contact
        SET is_current = 0, end_date = CAST(GETDATE() AS DATE)
        WHERE entity_id = @customerId
          AND entity_type = 'customer'
          AND contact_purpose = 'primary'
          AND is_current = 1
          AND contact_id != @contactId
      `);
    }

    // Link contact to customer
    const linkRequest = new sql.Request(transaction);
    linkRequest.input('customerId', sql.BigInt, customerId);
    linkRequest.input('contactId', sql.BigInt, newContact.contact_id);

    await linkRequest.query(`
      INSERT INTO entity_contact (
        entity_type, entity_id, contact_id, contact_purpose, is_current
      )
      VALUES (
        'customer', @customerId, @contactId, 'primary', 1
      )
    `);

    await transaction.commit();
    return mapContactFromDb(newContact);
  } catch (error) {
    await transaction.rollback();
    fileLogger.error({ err: error }, 'Add customer contact error');
    throw error;
  }
}

/**
 * Update contact
 */
export async function updateContactSqlServer(
  pool: sql.ConnectionPool,
  contactId: number,
  contactData: Partial<InsertContactInfo>
): Promise<ContactInfo | undefined> {
  try {
    const request = pool.request();
    request.input('contactId', sql.BigInt, contactId);

    const updates: string[] = [];

    if (contactData.contactValue !== undefined) {
      request.input('contactValue', sql.NVarChar, contactData.contactValue);
      updates.push('contact_value = @contactValue');
    }
    if (contactData.contactSubtype !== undefined) {
      request.input('contactSubtype', sql.NVarChar, contactData.contactSubtype);
      updates.push('contact_subtype = @contactSubtype');
    }
    if (contactData.isPrimary !== undefined) {
      request.input('isPrimary', sql.Bit, contactData.isPrimary ? 1 : 0);
      updates.push('is_primary = @isPrimary');
    }
    if (contactData.isVerified !== undefined) {
      request.input('isVerified', sql.Bit, contactData.isVerified ? 1 : 0);
      updates.push('is_verified = @isVerified');
    }
    if (contactData.canContact !== undefined) {
      request.input('canContact', sql.Bit, contactData.canContact ? 1 : 0);
      updates.push('can_contact = @canContact');
    }

    if (updates.length === 0) {
      const result = await request.query(`SELECT * FROM contact_info WHERE contact_id = @contactId`);
      return result.recordset.length > 0 ? mapContactFromDb(result.recordset[0]) : undefined;
    }

    updates.push('updated_at = GETDATE()');

    const result = await request.query(`
      UPDATE contact_info
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE contact_id = @contactId
    `);

    if (result.recordset.length === 0) {
      return undefined;
    }

    return mapContactFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Update contact error');
    throw error;
  }
}

/**
 * Deactivate customer contact
 */
export async function deactivateCustomerContactSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  contactId: number
): Promise<boolean> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);
    request.input('contactId', sql.BigInt, contactId);

    const result = await request.query(`
      UPDATE entity_contact
      SET is_current = 0, end_date = CAST(GETDATE() AS DATE)
      WHERE entity_id = @customerId
        AND entity_type = 'customer'
        AND contact_id = @contactId
    `);

    return (result.rowsAffected[0] || 0) > 0;
  } catch (error) {
    fileLogger.error({ err: error }, 'Deactivate customer contact error');
    throw error;
  }
}

/**
 * Get customer addresses
 */
export async function getCustomerAddressesSqlServer(
  pool: sql.ConnectionPool,
  customerId: number
): Promise<Address[]> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);

    const result = await request.query(`
      SELECT a.*
      FROM address a
      INNER JOIN entity_address ea ON ea.address_id = a.address_id
      WHERE ea.entity_id = @customerId
        AND ea.entity_type = 'customer'
        AND ea.is_current = 1
      ORDER BY a.is_primary DESC, a.address_type, a.address_id
    `);

    return result.recordset.map(mapAddressFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get customer addresses error');
    throw error;
  }
}

/**
 * Add customer address
 */
export async function addCustomerAddressSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  addressData: InsertAddress
): Promise<Address> {
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // Create address
    const addressRequest = new sql.Request(transaction);
    addressRequest.input('addressLine1', sql.NVarChar, addressData.addressLine1);
    addressRequest.input('addressLine2', sql.NVarChar, addressData.addressLine2 || null);
    addressRequest.input('city', sql.NVarChar, addressData.city);
    addressRequest.input('state', sql.NVarChar, addressData.state || null);
    addressRequest.input('postalCode', sql.NVarChar, addressData.postalCode || null);
    addressRequest.input('country', sql.NVarChar, addressData.country);
    addressRequest.input('addressType', sql.NVarChar, addressData.addressType || 'mailing');
    addressRequest.input('isPrimary', sql.Bit, addressData.isPrimary ? 1 : 0);
    addressRequest.input('validated', sql.Bit, addressData.validated ? 1 : 0);

    const addressResult = await addressRequest.query(`
      INSERT INTO address (
        address_line1, address_line2, city, state, postal_code, country,
        address_type, is_primary, validated
      )
      OUTPUT INSERTED.*
      VALUES (
        @addressLine1, @addressLine2, @city, @state, @postalCode, @country,
        @addressType, @isPrimary, @validated
      )
    `);

    const newAddress = addressResult.recordset[0];

    // If this is a primary address, deactivate existing primary addresses
    if (addressData.isPrimary || addressData.addressType === 'primary' || addressData.addressType === 'mailing') {
      const deactivateRequest = new sql.Request(transaction);
      deactivateRequest.input('customerId', sql.BigInt, customerId);
      deactivateRequest.input('addressId', sql.BigInt, newAddress.address_id);

      await deactivateRequest.query(`
        UPDATE entity_address
        SET is_current = 0, end_date = CAST(GETDATE() AS DATE)
        WHERE entity_id = @customerId
          AND entity_type = 'customer'
          AND address_purpose = 'primary'
          AND is_current = 1
          AND address_id != @addressId
      `);
    }

    // Link address to customer
    const linkRequest = new sql.Request(transaction);
    linkRequest.input('customerId', sql.BigInt, customerId);
    linkRequest.input('addressId', sql.BigInt, newAddress.address_id);

    await linkRequest.query(`
      INSERT INTO entity_address (
        entity_type, entity_id, address_id, address_purpose, is_current
      )
      VALUES (
        'customer', @customerId, @addressId, 'primary', 1
      )
    `);

    await transaction.commit();
    return mapAddressFromDb(newAddress);
  } catch (error) {
    await transaction.rollback();
    fileLogger.error({ err: error }, 'Add customer address error');
    throw error;
  }
}

/**
 * Update address
 */
export async function updateAddressSqlServer(
  pool: sql.ConnectionPool,
  addressId: number,
  addressData: Partial<InsertAddress>
): Promise<Address | undefined> {
  try {
    const request = pool.request();
    request.input('addressId', sql.BigInt, addressId);

    const updates: string[] = [];

    if (addressData.addressLine1 !== undefined) {
      request.input('addressLine1', sql.NVarChar, addressData.addressLine1);
      updates.push('address_line1 = @addressLine1');
    }
    if (addressData.addressLine2 !== undefined) {
      request.input('addressLine2', sql.NVarChar, addressData.addressLine2);
      updates.push('address_line2 = @addressLine2');
    }
    if (addressData.city !== undefined) {
      request.input('city', sql.NVarChar, addressData.city);
      updates.push('city = @city');
    }
    if (addressData.state !== undefined) {
      request.input('state', sql.NVarChar, addressData.state);
      updates.push('state = @state');
    }
    if (addressData.postalCode !== undefined) {
      request.input('postalCode', sql.NVarChar, addressData.postalCode);
      updates.push('postal_code = @postalCode');
    }
    if (addressData.country !== undefined) {
      request.input('country', sql.NVarChar, addressData.country);
      updates.push('country = @country');
    }
    if (addressData.addressType !== undefined) {
      request.input('addressType', sql.NVarChar, addressData.addressType);
      updates.push('address_type = @addressType');
    }
    if (addressData.isPrimary !== undefined) {
      request.input('isPrimary', sql.Bit, addressData.isPrimary ? 1 : 0);
      updates.push('is_primary = @isPrimary');
    }
    if (addressData.validated !== undefined) {
      request.input('validated', sql.Bit, addressData.validated ? 1 : 0);
      updates.push('validated = @validated');
    }

    if (updates.length === 0) {
      const result = await request.query(`SELECT * FROM address WHERE address_id = @addressId`);
      return result.recordset.length > 0 ? mapAddressFromDb(result.recordset[0]) : undefined;
    }

    updates.push('updated_at = GETDATE()');

    const result = await request.query(`
      UPDATE address
      SET ${updates.join(', ')}
      OUTPUT INSERTED.*
      WHERE address_id = @addressId
    `);

    if (result.recordset.length === 0) {
      return undefined;
    }

    return mapAddressFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Update address error');
    throw error;
  }
}

/**
 * Deactivate customer address
 */
export async function deactivateCustomerAddressSqlServer(
  pool: sql.ConnectionPool,
  customerId: number,
  addressId: number
): Promise<boolean> {
  try {
    const request = pool.request();
    request.input('customerId', sql.BigInt, customerId);
    request.input('addressId', sql.BigInt, addressId);

    const result = await request.query(`
      UPDATE entity_address
      SET is_current = 0, end_date = CAST(GETDATE() AS DATE)
      WHERE entity_id = @customerId
        AND entity_type = 'customer'
        AND address_id = @addressId
    `);

    return (result.rowsAffected[0] || 0) > 0;
  } catch (error) {
    fileLogger.error({ err: error }, 'Deactivate customer address error');
    throw error;
  }
}

/**
 * Map database row to ContactInfo object
 */
function mapContactFromDb(row: any): ContactInfo {
  return {
    contactId: row.contact_id,
    contactType: row.contact_type,
    contactValue: row.contact_value,
    contactSubtype: row.contact_subtype,
    isPrimary: row.is_primary,
    isVerified: row.is_verified,
    verificationDate: row.verification_date,
    canContact: row.can_contact,
    preferredTime: row.preferred_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Map database row to Address object
 */
function mapAddressFromDb(row: any): Address {
  return {
    addressId: row.address_id,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    addressType: row.address_type,
    isPrimary: row.is_primary,
    validated: row.validated,
    validationDate: row.validation_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
