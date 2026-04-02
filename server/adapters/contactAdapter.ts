import type { contactInfo } from '@shared/schema';
import { ContactDTO } from '@shared/contracts';

// Type for the ContactInfo from database
type ContactInfo = typeof contactInfo.$inferSelect;

/**
 * Enterprise Adapter: ContactInfo (DB) → ContactDTO (API)
 * This adapter ensures database field names never leak to the frontend.
 * All transformations and business logic for contacts happen here.
 */

/**
 * Maps a database ContactInfo entity to a clean ContactDTO
 * @param dbContact - Raw database entity
 * @param purpose - Contact purpose from entity_contact relationship
 * @returns Clean DTO for API response
 */
export function mapContactToDTO(dbContact: ContactInfo, purpose?: string | null): ContactDTO {
  return {
    id: dbContact.contactId.toString(),
    type: normalizeContactType(dbContact.contactType),
    value: dbContact.contactValue || '',
    subtype: dbContact.contactSubtype || 'unknown',
    isPrimary: !!dbContact.isPrimary,
    purpose: purpose || dbContact.preferredTime || undefined
  };
}

/**
 * Normalizes contact type values from downstream systems to valid enum values.
 * Handles case differences and common naming variants.
 */
function normalizeContactType(type: string): 'phone' | 'email' | 'address' {
  const normalized = (type || '').toLowerCase().trim();
  switch (normalized) {
    case 'phone':
    case 'telephone':
    case 'mobile':
    case 'cell':
    case 'fax':
    case 'ph':
      return 'phone';
    case 'email':
    case 'e-mail':
    case 'em':
      return 'email';
    case 'address':
    case 'addr':
    case 'mailing':
      return 'address';
    default:
      return 'phone';
  }
}

/**
 * Maps an array of database ContactInfo entities to DTOs
 * @param dbContacts - Array of raw database entities with optional purpose
 * @returns Array of clean DTOs for API response
 */
export function mapContactsToDTO(dbContacts: Array<{contact: ContactInfo, purpose?: string | null}>): ContactDTO[] {
  return dbContacts.map(item => mapContactToDTO(item.contact, item.purpose));
}

/**
 * Maps a simple array of database ContactInfo entities to DTOs
 * @param dbContacts - Array of raw database entities
 * @returns Array of clean DTOs for API response
 */
export function mapContactArrayToDTO(dbContacts: ContactInfo[]): ContactDTO[] {
  return dbContacts.map(contact => mapContactToDTO(contact));
}

/**
 * Maps a ContactDTO to database insert format
 * @param dto - Clean DTO from API request
 * @returns Database insert object
 */
export function mapContactDTOToInsert(dto: Omit<ContactDTO, 'id'>): Partial<ContactInfo> {
  return {
    contactType: dto.type,
    contactValue: dto.value,
    contactSubtype: dto.subtype,
    isPrimary: dto.isPrimary,
    preferredTime: dto.purpose || null,
    isVerified: false,
    canContact: true
  };
}