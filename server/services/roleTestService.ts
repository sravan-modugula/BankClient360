import { getRoleManagementStore } from "../storage/roleManagement";
import type { Role, UserPermissions } from "../../shared/schema";

interface RoleTestOverride {
  overrideRoleId: number;
  originalRoleId: number | null;
}

export class RoleTestService {
  private testRoleOverrides: Map<number, RoleTestOverride> = new Map();
  
  // Feature flag: Check if role testing is enabled
  isEnabled(): boolean {
    return process.env.ROLE_TESTING_ENABLED !== 'false';
  }
  
  // Override management API (maintains backward compatibility)
  async setOverride(employeeId: number, testRoleId: number): Promise<void> {
    // Production guard: Prevent role testing in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Role testing is not allowed in production');
    }
    
    // Capture the employee's current role before setting override
    const store = await getRoleManagementStore();
    const currentPermissions = await store.getUserPermissions(employeeId);
    const originalRoleId = currentPermissions.roles[0]?.roleId || null;
    
    this.testRoleOverrides.set(employeeId, {
      overrideRoleId: testRoleId,
      originalRoleId
    });
  }
  
  getOverride(employeeId: number): RoleTestOverride | null {
    return this.testRoleOverrides.get(employeeId) || null;
  }
  
  clearOverride(employeeId: number): void {
    this.testRoleOverrides.delete(employeeId);
  }
  
  hasOverride(employeeId: number): boolean {
    return this.testRoleOverrides.has(employeeId);
  }
  
  // Get permissions with override applied (called by routes)
  async getPermissions(employeeId: number, basePermissions: UserPermissions): Promise<any> {
    const override = this.testRoleOverrides.get(employeeId);
    
    if (!override) {
      // No override active - return base permissions with metadata indicating no testing
      return {
        ...basePermissions,
        isRoleTesting: false,
        originalRoleId: null,
        testingRoleId: null
      };
    }
    
    return await this.getPermissionsWithOverride(employeeId, override);
  }

  async getPermissionsWithOverride(employeeId: number, override: RoleTestOverride) {
    const store = await getRoleManagementStore();
    
    // Get base permissions
    const basePermissions = await store.getUserPermissions(employeeId);
    const roleData = await this.getRoleById(override.overrideRoleId);
    
    if (!roleData) {
      throw new Error(`Role ${override.overrideRoleId} not found`);
    }

    // Get permissions for the override role ONLY (replace, not merge)
    const rolePermissions = await store.getRolePermissions([override.overrideRoleId]);
    const privilegeLevelPermissions = await store.getPrivilegeLevelPermissions(Number(roleData.privilegeLevel));
    
    // Use ONLY test role permissions (isolation testing)
    const testRolePermissions = new Set([
      ...rolePermissions.map(p => p.permissionCode),
      ...privilegeLevelPermissions.map(p => p.permissionCode)
    ]);

    // Build test role entry
    const testRoleEntry = {
      roleId: roleData.roleId,
      roleName: roleData.roleName,
      privilegeLevel: Number(roleData.privilegeLevel),
      isPrimary: true
    };
    
    // Get base granted roles
    const baseGrantedRoles = basePermissions.roles.map((r: any) => ({
      roleId: r.roleId,
      roleName: r.roleName,
      privilegeLevel: Number(r.privilegeLevel),
      isPrimary: false
    }));
    
    // Check if the test role already exists in grantedRoles
    const testRoleIndex = baseGrantedRoles.findIndex((r: any) => r.roleId === override.overrideRoleId);
    
    let overriddenRoles;
    if (testRoleIndex >= 0) {
      // Test role exists - move it to index 0 and mark it as primary, mark others as non-primary
      const testRole = { ...baseGrantedRoles[testRoleIndex], isPrimary: true };
      const otherRoles = baseGrantedRoles
        .filter((r: any) => r.roleId !== override.overrideRoleId)
        .map((r: any) => ({ ...r, isPrimary: false }));
      
      overriddenRoles = [testRole, ...otherRoles];
    } else {
      // Test role doesn't exist - add it at index 0, mark all others as non-primary
      overriddenRoles = [
        testRoleEntry,
        ...baseGrantedRoles.map((r: any) => ({ ...r, isPrimary: false }))
      ];
    }

    return {
      ...basePermissions,
      permissions: Array.from(testRolePermissions),
      privilegeLevel: roleData.privilegeLevel,
      maxPrivilegeLevel: roleData.privilegeLevel,
      primaryRoleName: roleData.roleName,
      grantedRoles: overriddenRoles,
      isRoleTesting: true,
      originalRoleId: override.originalRoleId,
      testingRoleId: override.overrideRoleId
    };
  }

  async getAllRoles(): Promise<Role[]> {
    const store = await getRoleManagementStore();
    return await store.getAllRoles();
  }
  
  private async getRoleById(roleId: number): Promise<Role | null> {
    const roles = await this.getAllRoles();
    return roles.find(r => r.roleId === roleId) || null;
  }
}

export const roleTestService = new RoleTestService();
