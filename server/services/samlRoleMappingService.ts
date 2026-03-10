import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  samlRoleMapping,
  employeeRole,
  employeeRoleHistory,
  employee,
  role,
  type SamlRoleMapping,
  type EmployeeRole
} from "../../shared/schema";
import logger from "./logger";

const samlLogger = logger.child({ module: 'saml' });

export interface SamlRoleAssignmentResult {
  success: boolean;
  assigned: boolean;
  roleId?: number;
  roleName?: string;
  source: 'saml' | 'manual';
  message: string;
}

export class SamlRoleMappingService {
  /**
   * Find role mapping for a SAML role key
   */
  async findMapping(samlRoleKey: string): Promise<SamlRoleMapping | null> {
    const mappings = await db
      .select()
      .from(samlRoleMapping)
      .where(
        and(
          eq(samlRoleMapping.samlRoleKey, samlRoleKey),
          eq(samlRoleMapping.isActive, true)
        )
      )
      .limit(1);

    return mappings[0] || null;
  }

  /**
   * Process SAML role attribute and assign/remove roles based on SAML mapping
   * SECURITY: Enforced mappings will remove roles when SAML attribute is removed
   */
  async processSamlRole(
    employeeId: number,
    samlRole: string,
    isFirstLogin: boolean = false
  ): Promise<SamlRoleAssignmentResult> {
    // Skip processing in development mode with SQL Server (db is null)
    if (!db) {
      samlLogger.info('Skipping role processing (SQL Server mode without Drizzle ORM)');
      return {
        assigned: false,
        message: 'Role processing skipped in SQL Server mode',
        source: 'none' as const
      };
    }

    // Get current role mapping configuration
    const mapping = await db.select()
      .from(samlRoleMapping)
      .where(
        and(
          eq(samlRoleMapping.samlRoleKey, samlRole),
          eq(samlRoleMapping.isActive, true)
        )
      )
      .limit(1);

    const currentMapping = mapping[0] || null;

    // Get the employee's last seen SAML role for comparison
    const employeeData = await db
      .select({ lastSeenSamlRole: employee.lastSeenSamlRole })
      .from(employee)
      .where(eq(employee.employeeId, employeeId))
      .limit(1);

    const previousSamlRole = employeeData[0]?.lastSeenSamlRole;

    // Update last seen SAML role on employee record
    await db
      .update(employee)
      .set({ lastSeenSamlRole: samlRole || null })
      .where(eq(employee.employeeId, employeeId));

    // SECURITY FIX: Check for enforced SAML roles that need to be revoked
    // This happens when SAML role is removed or changed
    const allEnforcedMappings = await db
      .select()
      .from(samlRoleMapping)
      .where(
        and(
          eq(samlRoleMapping.syncMode, 'enforced'),
          eq(samlRoleMapping.isActive, true)
        )
      );

    // For each enforced mapping, check if it should be revoked
    for (const enforcedMapping of allEnforcedMappings) {
      const shouldHaveRole = samlRole === enforcedMapping.samlRoleKey;

      // Get current assignment status
      const currentAssignments = await db
        .select()
        .from(employeeRole)
        .where(
          and(
            eq(employeeRole.employeeId, employeeId),
            eq(employeeRole.roleId, enforcedMapping.roleId),
            eq(employeeRole.isActive, true)
          )
        );

      const hasRole = currentAssignments.length > 0;

      // REVOKE enforced role if user no longer has the SAML attribute
      if (hasRole && !shouldHaveRole) {
        await db
          .update(employeeRole)
          .set({ isActive: false })
          .where(
            and(
              eq(employeeRole.employeeId, employeeId),
              eq(employeeRole.roleId, enforcedMapping.roleId)
            )
          );

        // Log the revocation
        await this.logRoleAssignment(
          employeeId,
          enforcedMapping.roleId,
          'removed',
          'saml',
          previousSamlRole,
          undefined,
          `Enforced SAML role revoked: SAML attribute changed from "${previousSamlRole}" to "${samlRole || 'null'}"`
        );
      }
    }

    // If no SAML role provided, role revocations are done above
    if (!samlRole) {
      return {
        success: true,
        assigned: false,
        source: 'manual',
        message: 'No SAML role attribute - enforced roles revoked if applicable'
      };
    }

    // If no mapping found for the current SAML role, we're done
    if (!currentMapping) {
      return {
        success: true,
        assigned: false,
        source: 'manual',
        message: `SAML role "${samlRole}" not mapped - manual assignment required`
      };
    }

    // Check if employee already has this role
    const existingRoles = await db
      .select()
      .from(employeeRole)
      .where(
        and(
          eq(employeeRole.employeeId, employeeId),
          eq(employeeRole.roleId, currentMapping.roleId),
          eq(employeeRole.isActive, true)
        )
      );

    const hasRole = existingRoles.length > 0;

    // Determine if we should assign based on sync mode
    const shouldAssign = isFirstLogin || (currentMapping.syncMode === 'enforced' && !hasRole);

    if (!shouldAssign && hasRole) {
      return {
        success: true,
        assigned: false,
        roleId: currentMapping.roleId,
        source: 'saml',
        message: 'Role already assigned - no action needed'
      };
    }

    // Assign the role
    if (!hasRole) {
      await db.insert(employeeRole).values({
        employeeId,
        roleId: currentMapping.roleId,
        isPrimary: true,
        isActive: true,
        effectiveDate: new Date().toISOString().split('T')[0],
        notes: `Auto-assigned from SAML role: ${samlRole}`
      });

      // Log to history
      await this.logRoleAssignment(
        employeeId,
        currentMapping.roleId,
        'assigned',
        'saml',
        samlRole
      );
    }

    // Get role name for response
    const roleData = await db
      .select({ roleName: role.roleName })
      .from(role)
      .where(eq(role.roleId, currentMapping.roleId))
      .limit(1);

    return {
      success: true,
      assigned: true,
      roleId: currentMapping.roleId,
      roleName: roleData[0]?.roleName,
      source: 'saml',
      message: `Successfully assigned role: ${roleData[0]?.roleName}`
    };
  }

  /**
   * Manually assign a role to an employee (used by admins)
   */
  async assignRoleManually(
    employeeId: number,
    roleId: number,
    assignedBy: number,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if role already assigned
      const existing = await db
        .select()
        .from(employeeRole)
        .where(
          and(
            eq(employeeRole.employeeId, employeeId),
            eq(employeeRole.roleId, roleId),
            eq(employeeRole.isActive, true)
          )
        );

      if (existing.length > 0) {
        return {
          success: false,
          message: 'Role already assigned to this employee'
        };
      }

      // Assign the role
      await db.insert(employeeRole).values({
        employeeId,
        roleId,
        isPrimary: false,
        assignedBy,
        isActive: true,
        effectiveDate: new Date().toISOString().split('T')[0],
        notes: reason || 'Manually assigned by admin'
      });

      // Log to history
      await this.logRoleAssignment(
        employeeId,
        roleId,
        'assigned',
        'manual',
        null,
        assignedBy,
        reason
      );

      return {
        success: true,
        message: 'Role assigned successfully'
      };
    } catch (error) {
      samlLogger.error({ err: error }, 'Error assigning role manually');
      return {
        success: false,
        message: 'Failed to assign role'
      };
    }
  }

  /**
   * Remove a role from an employee
   */
  async removeRole(
    employeeId: number,
    roleId: number,
    removedBy: number,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Soft delete the role assignment
      await db
        .update(employeeRole)
        .set({ isActive: false })
        .where(
          and(
            eq(employeeRole.employeeId, employeeId),
            eq(employeeRole.roleId, roleId)
          )
        );

      // Log to history
      await this.logRoleAssignment(
        employeeId,
        roleId,
        'removed',
        'manual',
        null,
        removedBy,
        reason
      );

      return {
        success: true,
        message: 'Role removed successfully'
      };
    } catch (error) {
      samlLogger.error({ err: error }, 'Error removing role');
      return {
        success: false,
        message: 'Failed to remove role'
      };
    }
  }

  /**
   * Log role assignment/removal to history table
   */
  private async logRoleAssignment(
    employeeId: number,
    roleId: number,
    action: 'assigned' | 'removed',
    source: 'saml' | 'manual',
    samlRoleAttribute: string | null,
    assignedBy?: number,
    reason?: string
  ): Promise<void> {
    await db.insert(employeeRoleHistory).values({
      employeeId,
      roleId,
      action,
      source,
      samlRoleAttribute: samlRoleAttribute || null,
      assignedBy: assignedBy || null,
      reason: reason || null
    });
  }

  /**
   * Get all SAML role mappings
   */
  async getAllMappings(): Promise<SamlRoleMapping[]> {
    return db
      .select()
      .from(samlRoleMapping)
      .where(eq(samlRoleMapping.isActive, true))
      .orderBy(samlRoleMapping.samlRoleKey);
  }

  /**
   * Create a new SAML role mapping
   */
  async createMapping(
    samlRoleKey: string,
    roleId: number,
    syncMode: 'initial' | 'enforced',
    description?: string,
    createdBy?: number
  ): Promise<{ success: boolean; message: string; mapping?: SamlRoleMapping }> {
    try {
      const result = await db.insert(samlRoleMapping).values({
        samlRoleKey,
        roleId,
        syncMode,
        description: description || null,
        createdBy: createdBy || null,
        isActive: true
      }).returning();

      return {
        success: true,
        message: 'SAML role mapping created successfully',
        mapping: result[0]
      };
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return {
          success: false,
          message: 'SAML role key already exists'
        };
      }
      samlLogger.error({ err: error }, 'Error creating SAML mapping');
      return {
        success: false,
        message: 'Failed to create SAML role mapping'
      };
    }
  }

  /**
   * Update an existing SAML role mapping
   */
  async updateMapping(
    mappingId: number,
    updates: {
      roleId?: number;
      syncMode?: 'initial' | 'enforced';
      description?: string;
      isActive?: boolean;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      await db
        .update(samlRoleMapping)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(samlRoleMapping.mappingId, mappingId));

      return {
        success: true,
        message: 'SAML role mapping updated successfully'
      };
    } catch (error) {
      samlLogger.error({ err: error }, 'Error updating SAML mapping');
      return {
        success: false,
        message: 'Failed to update SAML role mapping'
      };
    }
  }

  /**
   * Delete (deactivate) a SAML role mapping
   */
  async deleteMapping(mappingId: number): Promise<{ success: boolean; message: string }> {
    try {
      await db
        .update(samlRoleMapping)
        .set({ isActive: false })
        .where(eq(samlRoleMapping.mappingId, mappingId));

      return {
        success: true,
        message: 'SAML role mapping deleted successfully'
      };
    } catch (error) {
      samlLogger.error({ err: error }, 'Error deleting SAML mapping');
      return {
        success: false,
        message: 'Failed to delete SAML role mapping'
      };
    }
  }
}

export const samlRoleMappingService = new SamlRoleMappingService();