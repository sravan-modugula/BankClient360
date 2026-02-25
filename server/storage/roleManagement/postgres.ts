/**
 * PostgreSQL Role Management Storage Implementation
 * Wraps existing Drizzle ORM queries from permission and user management services
 */

import { eq, and, or, desc, sql, isNull, inArray, like, ilike } from "drizzle-orm";
import { db } from "../../db";
import {
  privilegeLevel,
  role,
  permission,
  rolePermission,
  employeeRole,
  permissionDenialLog,
  employee,
  employeeStatusHistory,
  employeeRoleHistory,
  type Permission,
  type Role,
  type UserPermissions,
  type PermissionContext,
  type PermissionCheckResult,
  type UserListItem,
  type UserDetail,
  type AssignRoleRequest,
  type UpdateUserStatusRequest
} from '../../../shared/schema';
import type { IRoleManagementStore } from './index';

export class PostgresRoleManagementStore implements IRoleManagementStore {
  
  // ==================================================================================
  // PERMISSION OPERATIONS
  // ==================================================================================
  
  async getUserPermissions(employeeId: number): Promise<UserPermissions> {
    const now = new Date();
    
    // Fetch employee info
    const employeeInfo = await db
      .select({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email
      })
      .from(employee)
      .where(eq(employee.employeeId, employeeId))
      .limit(1);
    
    const empData = employeeInfo[0] || { firstName: null, lastName: null, email: null };
    
    const roles = await db
      .select({
        roleId: role.roleId,
        roleName: role.roleName,
        privilegeLevel: role.privilegeLevel,
        description: role.description,
        isSystemRole: role.isSystemRole,
        isActive: role.isActive,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        createdBy: role.createdBy
      })
      .from(role)
      .innerJoin(employeeRole, eq(role.roleId, employeeRole.roleId))
      .where(
        and(
          eq(employeeRole.employeeId, employeeId),
          eq(employeeRole.isActive, true),
          eq(role.isActive, true),
          sql`${employeeRole.effectiveDate} <= ${now}`,
          sql`(${employeeRole.expirationDate} IS NULL OR ${employeeRole.expirationDate} >= ${now})`
        )
      );

    if (roles.length === 0) {
      return {
        employeeId,
        firstName: empData.firstName,
        lastName: empData.lastName,
        email: empData.email,
        primaryRoleName: null,
        privilegeLevel: null,
        permissions: [],
        maxPrivilegeLevel: 0,
        roles: []
      };
    }

    const maxPrivilegeLevel = Math.max(...roles.map(r => Number(r.privilegeLevel)));
    const roleIds = roles.map(r => r.roleId);
    
    // Get primary role (highest privilege)
    const primaryRole = roles.reduce((highest, current) => 
      Number(current.privilegeLevel) > Number(highest.privilegeLevel) ? current : highest
    );

    // Get permissions explicitly assigned to roles
    const rolePermissionsResult = await this.getRolePermissions(roleIds);
    
    // Get permissions granted by privilege level
    const privilegeLevelPermissionsResult = await this.getPrivilegeLevelPermissions(maxPrivilegeLevel);

    // Combine and deduplicate permissions
    const allPermissionCodes = new Set([
      ...rolePermissionsResult.map(p => p.permissionCode),
      ...privilegeLevelPermissionsResult.map(p => p.permissionCode)
    ]);

    return {
      employeeId,
      firstName: empData.firstName,
      lastName: empData.lastName,
      email: empData.email,
      primaryRoleName: primaryRole.roleName,
      privilegeLevel: Number(primaryRole.privilegeLevel),
      permissions: Array.from(allPermissionCodes),
      maxPrivilegeLevel,
      roles
    };
  }
  
  async checkPermission(
    employeeId: number,
    permissionCode: string,
    context: PermissionContext = {}
  ): Promise<PermissionCheckResult> {
    const userPermissions = await this.getUserPermissions(employeeId);
    const perm = await this.getPermissionByCode(permissionCode);

    if (!perm) {
      return {
        allowed: false,
        reason: `Permission '${permissionCode}' does not exist`
      };
    }

    if (!userPermissions.permissions.includes(permissionCode)) {
      await this.logPermissionDenial(
        employeeId,
        permissionCode,
        'Permission not granted to any of user\'s roles',
        context.customer ? 'customer' : context.account ? 'account' : context.note ? 'note' : undefined,
        context.customer?.customerId || context.account?.accountId || context.note?.noteId || null,
        'Permission not granted to any of user\'s roles',
        context
      );
      
      return {
        allowed: false,
        reason: 'Permission not granted to any of your roles'
      };
    }

    // ABAC: Check attribute-based conditions if present
    if (perm.conditions && typeof perm.conditions === 'object' && !Array.isArray(perm.conditions)) {
      const conditions = perm.conditions as any;
      
      // Branch-level restriction
      if (conditions.branchLevel !== undefined && context.customer?.branchId) {
        if (context.employee?.branchId !== context.customer.branchId) {
          await this.logPermissionDenial(
            employeeId,
            permissionCode,
            'Branch-level restriction: employee not in same branch as customer',
            'customer',
            context.customer.customerId,
            'Branch-level access restriction',
            context
          );
          
          return {
            allowed: false,
            reason: 'You do not have access to customers from other branches'
          };
        }
      }
      
      // Region-level restriction
      if (conditions.regionLevel !== undefined && context.customer?.regionId) {
        if (context.employee?.regionId !== context.customer.regionId) {
          await this.logPermissionDenial(
            employeeId,
            permissionCode,
            'Region-level restriction: employee not in same region as customer',
            'customer',
            context.customer.customerId,
            'Region-level access restriction',
            context
          );
          
          return {
            allowed: false,
            reason: 'You do not have access to customers from other regions'
          };
        }
      }
    }

    return {
      allowed: true
    };
  }
  
  async hasPermission(employeeId: number, permissionCode: string): Promise<boolean> {
    const result = await this.checkPermission(employeeId, permissionCode, {});
    return result.allowed;
  }
  
  async hasAnyPermission(employeeId: number, permissionCodes: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(employeeId);
    return permissionCodes.some(code => userPermissions.permissions.includes(code));
  }
  
  async hasAllPermissions(employeeId: number, permissionCodes: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(employeeId);
    return permissionCodes.every(code => userPermissions.permissions.includes(code));
  }
  
  async getMaxPrivilegeLevel(employeeId: number): Promise<number> {
    const userPermissions = await this.getUserPermissions(employeeId);
    return userPermissions.maxPrivilegeLevel;
  }
  
  async logPermissionDenial(
    employeeId: number,
    permissionCode: string,
    reason: string,
    resourceType?: string,
    resourceId?: number | string | null,
    denialReason?: string,
    contextData?: any
  ): Promise<void> {
    try {
      await db.insert(permissionDenialLog).values({
        employeeId,
        permissionCode,
        reason: denialReason || reason,
        resourceType: resourceType || null,
        resourceId: resourceId ? String(resourceId) : null,
        contextData: contextData || null,
        deniedAt: new Date()
      });
    } catch (error) {
      console.error('Failed to log permission denial:', error);
    }
  }
  
  // ==================================================================================
  // ROLE OPERATIONS
  // ==================================================================================
  
  async getAllRoles(): Promise<Role[]> {
    return await db
      .select()
      .from(role)
      .where(eq(role.isActive, true))
      .orderBy(desc(role.privilegeLevel), role.roleName);
  }
  
  async getEmployeeRoles(employeeId: number): Promise<Role[]> {
    const now = new Date();
    const roles = await db
      .select({
        roleId: role.roleId,
        roleName: role.roleName,
        privilegeLevel: role.privilegeLevel,
        description: role.description,
        isSystemRole: role.isSystemRole,
        isActive: role.isActive,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        createdBy: role.createdBy
      })
      .from(role)
      .innerJoin(employeeRole, eq(role.roleId, employeeRole.roleId))
      .where(
        and(
          eq(employeeRole.employeeId, employeeId),
          eq(employeeRole.isActive, true),
          eq(role.isActive, true),
          sql`${employeeRole.effectiveDate} <= ${now}`,
          sql`(${employeeRole.expirationDate} IS NULL OR ${employeeRole.expirationDate} >= ${now})`
        )
      );
    
    return roles;
  }
  
  async getRolePermissions(roleIds: number[]): Promise<Array<{ permissionCode: string }>> {
    if (roleIds.length === 0) {
      return [];
    }
    
    return await db
      .select({
        permissionCode: permission.permissionCode
      })
      .from(permission)
      .innerJoin(rolePermission, eq(permission.permissionId, rolePermission.permissionId))
      .where(
        and(
          inArray(rolePermission.roleId, roleIds),
          eq(permission.isActive, true)
        )
      );
  }
  
  async getPrivilegeLevelPermissions(maxPrivilegeLevel: number): Promise<Array<{ permissionCode: string }>> {
    return await db
      .select({
        permissionCode: permission.permissionCode
      })
      .from(permission)
      .where(
        and(
          eq(permission.isActive, true),
          sql`${permission.minPrivilegeLevel} IS NOT NULL`,
          sql`${permission.minPrivilegeLevel} <= ${maxPrivilegeLevel}`
        )
      );
  }
  
  async getPermissionByCode(permissionCode: string): Promise<Permission | null> {
    const result = await db
      .select()
      .from(permission)
      .where(eq(permission.permissionCode, permissionCode))
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  }
  
  // ==================================================================================
  // USER MANAGEMENT OPERATIONS
  // ==================================================================================
  
  async listUsers(filters?: {
    search?: string;
    roleId?: number;
    isActive?: boolean;
    department?: string;
  }): Promise<UserListItem[]> {
    let conditions = [];
    
    conditions.push(isNull(employee.deletedAt));
    
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(employee.firstName, searchTerm),
          ilike(employee.lastName, searchTerm),
          ilike(employee.email, searchTerm),
          ilike(employee.employeeNumber, searchTerm)
        )
      );
    }
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(employee.isActive, filters.isActive));
    }
    
    if (filters?.department) {
      conditions.push(eq(employee.department, filters.department));
    }

    const users = await db
      .select({
        employeeId: employee.employeeId,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        position: employee.position,
        isActive: employee.isActive,
        ssoSubject: employee.ssoSubject,
        lastLoginAt: employee.lastLoginAt,
        createdAt: employee.createdAt
      })
      .from(employee)
      .where(and(...conditions))
      .orderBy(desc(employee.createdAt));

    const userIds = users.map(u => u.employeeId);
    if (userIds.length === 0) {
      return [];
    }

    const now = new Date();
    const userRoles = await db
      .select({
        employeeId: employeeRole.employeeId,
        roleId: role.roleId,
        roleName: role.roleName,
        privilegeLevel: role.privilegeLevel
      })
      .from(employeeRole)
      .innerJoin(role, eq(employeeRole.roleId, role.roleId))
      .where(
        and(
          inArray(employeeRole.employeeId, userIds),
          eq(employeeRole.isActive, true),
          sql`${employeeRole.effectiveDate} <= ${now}`,
          sql`(${employeeRole.expirationDate} IS NULL OR ${employeeRole.expirationDate} >= ${now})`
        )
      );

    const rolesByUser = new Map<number, Array<{ roleId: number; roleName: string; privilegeLevel: number }>>();
    for (const ur of userRoles) {
      if (!rolesByUser.has(ur.employeeId)) {
        rolesByUser.set(ur.employeeId, []);
      }
      rolesByUser.get(ur.employeeId)!.push({
        roleId: ur.roleId,
        roleName: ur.roleName,
        privilegeLevel: Number(ur.privilegeLevel)
      });
    }

    // Get role assignment sources
    const roleSourceByUser = await this.getRoleAssignmentSources(userIds);

    // Apply role filter if specified
    let filteredUsers = users;
    if (filters?.roleId !== undefined) {
      filteredUsers = users.filter(u => {
        const roles = rolesByUser.get(u.employeeId) || [];
        return roles.some(r => r.roleId === filters.roleId);
      });
    }

    return filteredUsers.map(u => {
      const roles = rolesByUser.get(u.employeeId) || [];
      const maxPrivilege = roles.length > 0 ? Math.max(...roles.map(r => r.privilegeLevel)) : 0;
      const sourceInfo = roleSourceByUser.get(u.employeeId) || { source: 'manual', samlRoleAttribute: null };

      return {
        employeeId: u.employeeId,
        employeeNumber: u.employeeNumber,
        firstName: u.firstName,
        lastName: u.lastName,
        fullName: `${u.firstName} ${u.lastName}`,
        email: u.email,
        phone: u.phone ?? null,
        department: u.department ?? null,
        position: u.position ?? null,
        isActive: u.isActive,
        ssoSubject: u.ssoSubject ?? null,
        lastLoginAt: u.lastLoginAt ?? null,
        createdAt: u.createdAt,
        roles,
        maxPrivilegeLevel: maxPrivilege,
        roleSource: sourceInfo.source,
        samlRoleAttribute: sourceInfo.samlRoleAttribute
      };
    });
  }
  
  async getUserById(employeeId: number, requestingUserId: number): Promise<UserDetail | null> {
    // Implementation would go here - extracting from userManagementService
    // This is a complex query that gets full user details with all permissions
    // For now, returning null as placeholder
    throw new Error('Not implemented yet');
  }
  
  async getLevel4Users(): Promise<Array<{ employeeId: number; email: string }>> {
    const now = new Date();
    return await db
      .select({
        employeeId: employee.employeeId,
        email: employee.email
      })
      .from(employee)
      .innerJoin(employeeRole, eq(employee.employeeId, employeeRole.employeeId))
      .innerJoin(role, eq(employeeRole.roleId, role.roleId))
      .where(
        and(
          eq(role.privilegeLevel, 4),
          eq(employee.isActive, true),
          eq(employeeRole.isActive, true),
          isNull(employee.deletedAt),
          sql`${employeeRole.effectiveDate} <= ${now}`,
          sql`(${employeeRole.expirationDate} IS NULL OR ${employeeRole.expirationDate} >= ${now})`
        )
      );
  }
  
  // ==================================================================================
  // ROLE ASSIGNMENT OPERATIONS (WRITE)
  // ==================================================================================
  
  async assignRole(
    employeeId: number,
    data: AssignRoleRequest,
    assignedByUserId: number
  ): Promise<void> {
    // Implementation would extract from userManagementService.assignRole
    throw new Error('Not implemented yet');
  }
  
  async removeRole(
    employeeId: number,
    roleId: number,
    reason: string,
    removedByUserId: number
  ): Promise<void> {
    // Implementation would extract from userManagementService.removeRole
    throw new Error('Not implemented yet');
  }
  
  async updateUserStatus(
    employeeId: number,
    data: UpdateUserStatusRequest,
    updatedByUserId: number
  ): Promise<void> {
    // Implementation would extract from userManagementService.updateUserStatus
    throw new Error('Not implemented yet');
  }
  
  // ==================================================================================
  // HELPER OPERATIONS
  // ==================================================================================
  
  async getRoleAssignmentSources(
    employeeIds: number[]
  ): Promise<Map<number, { source: 'saml' | 'manual'; samlRoleAttribute: string | null }>> {
    if (employeeIds.length === 0) {
      return new Map();
    }
    
    const roleHistory = await db
      .select({
        employeeId: employeeRoleHistory.employeeId,
        roleId: employeeRoleHistory.roleId,
        source: employeeRoleHistory.source,
        samlRoleAttribute: employeeRoleHistory.samlRoleAttribute,
        assignedAt: employeeRoleHistory.assignedAt
      })
      .from(employeeRoleHistory)
      .where(
        and(
          inArray(employeeRoleHistory.employeeId, employeeIds),
          eq(employeeRoleHistory.action, 'assigned')
        )
      )
      .orderBy(desc(employeeRoleHistory.assignedAt));

    const roleSourceByUser = new Map<number, { source: 'saml' | 'manual'; samlRoleAttribute: string | null }>();
    for (const history of roleHistory) {
      if (!roleSourceByUser.has(history.employeeId)) {
        roleSourceByUser.set(history.employeeId, {
          source: history.source as 'saml' | 'manual',
          samlRoleAttribute: history.samlRoleAttribute
        });
      }
    }
    
    return roleSourceByUser;
  }
  
  async hasActiveRole(employeeId: number, roleId: number): Promise<boolean> {
    const now = new Date();
    const result = await db
      .select({ roleId: employeeRole.roleId })
      .from(employeeRole)
      .where(
        and(
          eq(employeeRole.employeeId, employeeId),
          eq(employeeRole.roleId, roleId),
          eq(employeeRole.isActive, true),
          sql`${employeeRole.effectiveDate} <= ${now}`,
          sql`(${employeeRole.expirationDate} IS NULL OR ${employeeRole.expirationDate} >= ${now})`
        )
      )
      .limit(1);
    
    return result.length > 0;
  }
}
