import { OfficerDTO } from '@shared/contracts';

/**
 * Enterprise Adapter: Employee + CustomerOfficerAssignment (DB) → OfficerDTO (API)
 * This adapter ensures database field names never leak to the frontend.
 * All transformations and business logic for officers happen here.
 */

/**
 * Type for joined officer data from database query
 */
export interface OfficerWithAssignment {
  officerCode: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
  relationshipType: 'primary' | 'secondary';
  assignedAt: Date | null;
}

/**
 * Maps a database officer entity (joined employee + assignment) to a clean OfficerDTO
 * Implements defensive coding and null safety as per enterprise standards
 * 
 * @param dbOfficer - Raw joined database entity from storage layer
 * @returns Clean DTO for API response
 */
export function mapOfficerToDTO(dbOfficer: OfficerWithAssignment): OfficerDTO {
  // Defensive: Ensure officer code exists (should never be null due to JOIN filter)
  const officerCode = dbOfficer.officerCode || 'UNKNOWN';
  
  // Defensive: Build display name with null safety
  const firstName = dbOfficer.firstName?.trim() || '';
  const lastName = dbOfficer.lastName?.trim() || '';
  const displayName = `${firstName} ${lastName}`.trim() || 'Unknown Officer';
  
  // Defensive: Provide fallback title
  const title = dbOfficer.title?.trim() || 'Officer';
  
  // Defensive: Department can be null
  const department = dbOfficer.department?.trim() || null;
  
  // Derive isPrimary boolean from relationshipType
  const isPrimary = dbOfficer.relationshipType === 'primary';
  
  // Format assignment timestamp (ISO string for API contract)
  const assignedAt = dbOfficer.assignedAt 
    ? dbOfficer.assignedAt.toISOString()
    : new Date().toISOString(); // Defensive fallback
  
  return {
    id: officerCode,
    displayName,
    title,
    department,
    relationshipType: dbOfficer.relationshipType,
    isPrimary,
    assignedAt
    // Note: contactChannels omitted for now - can be added later if needed
  };
}

/**
 * Maps an array of database officer entities to DTOs
 * @param dbOfficers - Array of raw joined database entities
 * @returns Array of clean DTOs for API response, sorted with primary first
 */
export function mapOfficersToDTO(dbOfficers: OfficerWithAssignment[]): OfficerDTO[] {
  // Defensive: Handle null/undefined input
  if (!dbOfficers || !Array.isArray(dbOfficers)) {
    return [];
  }
  
  // Map all officers to DTOs
  const dtos = dbOfficers.map(officer => mapOfficerToDTO(officer));
  
  // Sort: primary officer first, then by last name, then first name
  return dtos.sort((a, b) => {
    // Primary officers always come first
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    
    // If both same priority level, sort alphabetically by display name
    return a.displayName.localeCompare(b.displayName);
  });
}
