import type { address } from '@shared/schema';
import { ContactDTO } from '@shared/contracts';

// Type for the Address from database
type Address = typeof address.$inferSelect;

/**
 * Enterprise Adapter: Address (DB) → ContactDTO (API)
 * Transforms address records into contact DTOs with type='address'
 */

function cleanWhitespace(s: string | null) {
  if (s && s.trim() !== '') return s;
  return null;
}

/**
 * Maps a database Address entity to a ContactDTO
 * @param dbAddress - Raw database address entity
 * @param purpose - Address purpose from entity_address relationship
 * @returns ContactDTO with type='address'
 */
export function mapAddressToContactDTO(dbAddress: Address, purpose?: string | null): ContactDTO {
 
  // Combine address fields into a single value string
  const addressParts = [
    cleanWhitespace(dbAddress.addressLine1),
    cleanWhitespace(dbAddress.addressLine2),
    [
      cleanWhitespace(dbAddress.city), 
      cleanWhitespace(dbAddress.state), 
      cleanWhitespace(dbAddress.postalCode)
    ].filter(Boolean).join(', ')
  ].filter(Boolean);

  const addressValue = addressParts.join(', ') || '';

  return {
    id: dbAddress.addressId.toString(),
    type: 'address',
    value: addressValue,
    subtype: dbAddress.addressType || purpose || 'primary',
    isPrimary: !!dbAddress.isPrimary,
    purpose: purpose || dbAddress.addressType || undefined
  };
}

/**
 * Maps an array of database Address entities to ContactDTOs
 * @param dbAddresses - Array of raw database addresses with optional purpose
 * @returns Array of ContactDTOs with type='address'
 */
export function mapAddressesToContactDTO(dbAddresses: Array<{address: Address, purpose?: string | null}>): ContactDTO[] {
  return dbAddresses.map(item => mapAddressToContactDTO(item.address, item.purpose));
}

/**
 * Maps a simple array of database Address entities to ContactDTOs
 * @param dbAddresses - Array of raw database addresses
 * @returns Array of ContactDTOs with type='address'
 */
export function mapAddressArrayToContactDTO(dbAddresses: Address[]): ContactDTO[] {
  return dbAddresses.map(address => mapAddressToContactDTO(address));
}