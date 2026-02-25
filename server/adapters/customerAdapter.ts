import type { customer } from '@shared/schema';
import { CustomerDTO } from '@shared/contracts';

// Type for the Customer from database
type Customer = typeof customer.$inferSelect;

/**
 * Enterprise Adapter: Customer (DB) → CustomerDTO (API)
 * Handles PII masking and data transformation for customer entities.
 */

/**
 * Masks sensitive SSN data for security
 * @param ssn - Full SSN
 * @returns Masked SSN (XXX-XX-1234)
 */
function maskSSN(ssn: string | null): string {
  if (!ssn || ssn.length < 4) return 'XXX-XX-XXXX';
  return `XXX-XX-${ssn.slice(-4)}`;
}

/**
 * Maps a database Customer entity to a clean CustomerDTO with masked PII
 * @param dbCustomer - Raw database entity
 * @param contactInfo - Optional contact information to include
 * @param addressInfo - Optional address information to include
 * @returns Clean DTO with masked sensitive data
 */
export function mapCustomerToDTO(
  dbCustomer: Customer, 
  contactInfo?: { email?: string; phone?: string },
  addressInfo?: { address?: string; city?: string; state?: string; zipCode?: string }
): CustomerDTO {
  // Defensive null checks for boolean flags
  const isEmployee = dbCustomer.isEmployee !== null && dbCustomer.isEmployee !== undefined 
    ? dbCustomer.isEmployee 
    : null;
  const vipCustomer = dbCustomer.vipCustomer !== null && dbCustomer.vipCustomer !== undefined 
    ? dbCustomer.vipCustomer 
    : null;

  // Convert dateOfBirth to string if it's a Date object
  let dateOfBirthStr = '';
  if (dbCustomer.dateOfBirth) {
    if (dbCustomer.dateOfBirth instanceof Date) {
      dateOfBirthStr = dbCustomer.dateOfBirth.toISOString().split('T')[0]; // YYYY-MM-DD format
    } else if (typeof dbCustomer.dateOfBirth === 'string') {
      dateOfBirthStr = dbCustomer.dateOfBirth;
    }
  }

  return {
    id: dbCustomer.customerId.toString(),
    firstName: dbCustomer.firstName || '',
    lastName: dbCustomer.lastName || '',
    middleName: dbCustomer.middleName || undefined,
    dateOfBirth: dateOfBirthStr,
    ssn: maskSSN(dbCustomer.taxIdentifier),
    email: contactInfo?.email || '',
    phoneNumber: contactInfo?.phone || '',
    address: addressInfo?.address || '',
    city: addressInfo?.city || '',
    state: addressInfo?.state || '',
    zipCode: addressInfo?.zipCode || '',
    createdAt: dbCustomer.createdAt ? new Date(dbCustomer.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: dbCustomer.updatedAt ? new Date(dbCustomer.updatedAt).toISOString() : null,
    isEmployee,
    vipCustomer,
    cifNumber: dbCustomer.jackHenryCifNumber || null
  };
}

/**
 * Maps an array of database Customer entities to DTOs
 * @param dbCustomers - Array of raw database entities
 * @returns Array of clean DTOs with masked sensitive data
 */
export function mapCustomersToDTO(dbCustomers: Customer[]): CustomerDTO[] {
  return dbCustomers.map(c => mapCustomerToDTO(c));
}

/**
 * Maps a CustomerDTO to database insert format
 * @param dto - Clean DTO from API request (SSN should be unmasked at this point)
 * @returns Database insert object
 */
export function mapCustomerDTOToInsert(dto: Omit<CustomerDTO, 'id' | 'createdAt' | 'updatedAt'>): Partial<Customer> {
  return {
    firstName: dto.firstName,
    lastName: dto.lastName,
    middleName: dto.middleName || null,
    dateOfBirth: dto.dateOfBirth || null,
    taxIdentifier: dto.ssn, // Store unmasked in DB
    customerStatus: 'active',
    customerType: 'regular'
  };
}