/**
 * SQL Server Role Management Storage Implementation
 * Implements RBAC operations using mssql with parameterized queries
 */

import sql from 'mssql';
import logger from '../../services/logger';
import { logRoleHistorySqlServer } from '../sqlServerEmployee';

const fileLogger = logger.child({ module: 'sqlserver-role-management' });
import type {
  Role,
  Permission,
  UserPermissions,
  PermissionContext,
  PermissionCheckResult,
  UserListItem,
  UserDetail,
  AssignRoleRequest,
  UpdateUserStatusRequest
} from '../../../shared/schema';
import type { IRoleManagementStore } from './index';

export class SqlServerRoleManagementStore implements IRoleManagementStore {
  constructor(private pool: sql.ConnectionPool) {}
  
  // ==================================================================================
  // PERMISSION OPERATIONS
  // ==================================================================================
  
  async getUserPermissions(employeeId: number): Promise<UserPermissions> {
    try {
      const request = this.pool.request();
      request.input('employeeId', sql.BigInt, employeeId);
      
      const now = new Date();
      request.input('now', sql.DateTime2, now);
      
      // Fetch employee info
      const employeeResult = await request.query(`
        SELECT first_name as firstName, last_name as lastName, email
        FROM employee
        WHERE employee_id = @employeeId
      `);
      
      const empData = employeeResult.recordset[0] || { firstName: null, lastName: null, email: null };
      
      // Get active roles for employee (need a new request as parameters are consumed)
      const rolesRequest = this.pool.request();
      rolesRequest.input('employeeId', sql.BigInt, employeeId);
      rolesRequest.input('now', sql.DateTime2, now);
      
      const rolesResult = await rolesRequest.query(`
        SELECT 
          r.role_id as roleId,
          r.role_name as roleName,
          r.privilege_level as privilegeLevel,
          r.description,
          r.is_system_role as isSystemRole,
          r.is_active as isActive,
          r.created_at as createdAt,
          r.updated_at as updatedAt,
          r.created_by as createdBy
        FROM role r
        INNER JOIN employee_role er ON r.role_id = er.role_id
        WHERE er.employee_id = @employeeId
          AND er.is_active = 1
          AND r.is_active = 1
          AND er.effective_date <= @now
          AND (er.expiration_date IS NULL OR er.expiration_date >= @now)
      `);
      
      const roles = rolesResult.recordset.map(r => ({
        roleId: r.roleId,
        roleName: r.roleName,
        privilegeLevel: r.privilegeLevel,
        description: r.description,
        isSystemRole: r.isSystemRole,
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdBy: r.createdBy
      }));
      
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
    } catch (error) {
      fileLogger.error({ err: error }, 'Get user permissions error');
      throw error;
    }
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
      const request = this.pool.request();
      request.input('employeeId', sql.BigInt, employeeId);
      request.input('permissionCode', sql.VarChar(100), permissionCode);
      request.input('reason', sql.Text, denialReason || reason);
      request.input('resourceType', sql.VarChar(50), resourceType || null);
      request.input('resourceId', sql.VarChar(50), resourceId ? String(resourceId) : null);
      request.input('contextData', sql.NVarChar(sql.MAX), contextData ? JSON.stringify(contextData) : null);
      request.input('deniedAt', sql.DateTime2, new Date());
      
      await request.query(`
        INSERT INTO permission_denial_log (
          employee_id, permission_code, reason, resource_type, 
          resource_id, context_data, denied_at
        ) VALUES (
          @employeeId, @permissionCode, @reason, @resourceType,
          @resourceId, @contextData, @deniedAt
        )
      `);
    } catch (error) {
      fileLogger.error({ err: error }, 'Failed to log permission denial');
    }
  }
  
  // ==================================================================================
  // ROLE OPERATIONS
  // ==================================================================================
  
  async getAllRoles(): Promise<Role[]> {
    try {
      const request = this.pool.request();
      
      const result = await request.query(`
        SELECT 
          role_id as roleId,
          role_name as roleName,
          privilege_level as privilegeLevel,
          description,
          is_system_role as isSystemRole,
          is_active as isActive,
          created_at as createdAt,
          updated_at as updatedAt,
          created_by as createdBy
        FROM role
        WHERE is_active = 1
        ORDER BY privilege_level DESC, role_name
      `);
      
      return result.recordset.map(r => ({
        roleId: r.roleId,
        roleName: r.roleName,
        privilegeLevel: r.privilegeLevel,
        description: r.description,
        isSystemRole: r.isSystemRole,
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdBy: r.createdBy
      }));
    } catch (error) {
      fileLogger.error({ err: error }, 'Get all roles error');
      throw error;
    }
  }
  
  async getEmployeeRoles(employeeId: number): Promise<Role[]> {
    try {
      const request = this.pool.request();
      request.input('employeeId', sql.BigInt, employeeId);
      request.input('now', sql.DateTime2, new Date());
      
      const result = await request.query(`
        SELECT 
          r.role_id as roleId,
          r.role_name as roleName,
          r.privilege_level as privilegeLevel,
          r.description,
          r.is_system_role as isSystemRole,
          r.is_active as isActive,
          r.created_at as createdAt,
          r.updated_at as updatedAt,
          r.created_by as createdBy
        FROM role r
        INNER JOIN employee_role er ON r.role_id = er.role_id
        WHERE er.employee_id = @employeeId
          AND er.is_active = 1
          AND r.is_active = 1
          AND er.effective_date <= @now
          AND (er.expiration_date IS NULL OR er.expiration_date >= @now)
      `);
      
      return result.recordset.map(r => ({
        roleId: r.roleId,
        roleName: r.roleName,
        privilegeLevel: r.privilegeLevel,
        description: r.description,
        isSystemRole: r.isSystemRole,
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdBy: r.createdBy
      }));
    } catch (error) {
      fileLogger.error({ err: error }, 'Get employee roles error');
      throw error;
    }
  }
  
  async getRolePermissions(roleIds: number[]): Promise<Array<{ permissionCode: string }>> {
    if (roleIds.length === 0) {
      return [];
    }
    
    try {
      const request = this.pool.request();
      const roleIdsList = roleIds.join(',');
      
      const result = await request.query(`
        SELECT DISTINCT p.permission_code as permissionCode
        FROM permission p
        INNER JOIN role_permission rp ON p.permission_id = rp.permission_id
        WHERE rp.role_id IN (${roleIdsList})
          AND p.is_active = 1
      `);
      
      return result.recordset.map(r => ({ permissionCode: r.permissionCode }));
    } catch (error) {
      fileLogger.error({ err: error }, 'Get role permissions error');
      throw error;
    }
  }
  
  async getPrivilegeLevelPermissions(maxPrivilegeLevel: number): Promise<Array<{ permissionCode: string }>> {
    try {
      const request = this.pool.request();
      request.input('maxPrivilegeLevel', sql.Int, maxPrivilegeLevel);
      
      const result = await request.query(`
        SELECT permission_code as permissionCode
        FROM permission
        WHERE is_active = 1
          AND min_privilege_level IS NOT NULL
          AND min_privilege_level <= @maxPrivilegeLevel
      `);
      
      return result.recordset.map(r => ({ permissionCode: r.permissionCode }));
    } catch (error) {
      fileLogger.error({ err: error }, 'Get privilege level permissions error');
      throw error;
    }
  }
  
  async getPermissionByCode(permissionCode: string): Promise<Permission | null> {
    try {
      const request = this.pool.request();
      request.input('permissionCode', sql.VarChar(100), permissionCode);
      
      const result = await request.query(`
        SELECT 
          permission_id as permissionId,
          permission_code as permissionCode,
          resource_type as resourceType,
          action,
          description,
          min_privilege_level as minPrivilegeLevel,
          conditions,
          is_active as isActive,
          created_at as createdAt
        FROM permission
        WHERE permission_code = @permissionCode
      `);
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      const row = result.recordset[0];
      
      // Parse JSON conditions from NVARCHAR(MAX)
      let conditions = null;
      if (row.conditions) {
        try {
          conditions = JSON.parse(row.conditions);
        } catch (e) {
          fileLogger.error({ err: e }, 'Failed to parse permission conditions JSON');
        }
      }
      
      return {
        permissionId: row.permissionId,
        permissionCode: row.permissionCode,
        resourceType: row.resourceType,
        action: row.action,
        description: row.description,
        minPrivilegeLevel: row.minPrivilegeLevel,
        conditions,
        isActive: row.isActive,
        createdAt: row.createdAt
      };
    } catch (error) {
      fileLogger.error({ err: error }, 'Get permission by code error');
      throw error;
    }
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
    try {
      const request = this.pool.request();
      
      let whereConditions = ['e.deleted_at IS NULL'];
      
      if (filters?.search) {
        request.input('search', sql.NVarChar, `%${filters.search}%`);
        whereConditions.push(`(
          LOWER(e.first_name) LIKE LOWER(@search) OR
          LOWER(e.last_name) LIKE LOWER(@search) OR
          LOWER(e.email) LIKE LOWER(@search) OR
          LOWER(e.employee_number) LIKE LOWER(@search)
        )`);
      }
      
      if (filters?.isActive !== undefined) {
        request.input('isActive', sql.Bit, filters.isActive ? 1 : 0);
        whereConditions.push('e.is_active = @isActive');
      }
      
      if (filters?.department) {
        request.input('department', sql.VarChar(100), filters.department);
        whereConditions.push('e.department = @department');
      }
      
      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
      
      const usersResult = await request.query(`
        SELECT 
          e.employee_id as employeeId,
          e.employee_number as employeeNumber,
          e.first_name as firstName,
          e.last_name as lastName,
          e.email,
          e.phone,
          e.department,
          e.position,
          e.is_active as isActive,
          e.sso_subject as ssoSubject,
          e.last_login_at as lastLoginAt,
          e.created_at as createdAt
        FROM employee e
        ${whereClause}
        ORDER BY e.created_at DESC
      `);
      
      const users = usersResult.recordset;
      
      if (users.length === 0) {
        return [];
      }
      
      const userIds = users.map(u => u.employeeId);
      const userIdsList = userIds.join(',');
      
      const now = new Date();
      const rolesRequest = this.pool.request();
      rolesRequest.input('now', sql.DateTime2, now);
      
      const userRolesResult = await rolesRequest.query(`
        SELECT 
          er.employee_id as employeeId,
          r.role_id as roleId,
          r.role_name as roleName,
          r.privilege_level as privilegeLevel
        FROM employee_role er
        INNER JOIN role r ON er.role_id = r.role_id
        WHERE er.employee_id IN (${userIdsList})
          AND er.is_active = 1
          AND er.effective_date <= @now
          AND (er.expiration_date IS NULL OR er.expiration_date >= @now)
      `);
      
      const rolesByUser = new Map<number, Array<{ roleId: number; roleName: string; privilegeLevel: number }>>();
      for (const ur of userRolesResult.recordset) {
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
        const sourceInfo = roleSourceByUser.get(u.employeeId) || { source: 'manual' as const, samlRoleAttribute: null };
        
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
    } catch (error) {
      fileLogger.error({ err: error }, 'List users error');
      throw error;
    }
  }
  
  async getUserById(employeeId: number, requestingUserId: number): Promise<UserDetail | null> {
    // Complex implementation - placeholder for now
    throw new Error('Not implemented yet');
  }
  
  async getLevel4Users(): Promise<Array<{ employeeId: number; email: string }>> {
    try {
      const request = this.pool.request();
      request.input('now', sql.DateTime2, new Date());
      
      const result = await request.query(`
        SELECT DISTINCT
          e.employee_id as employeeId,
          e.email
        FROM employee e
        INNER JOIN employee_role er ON e.employee_id = er.employee_id
        INNER JOIN role r ON er.role_id = r.role_id
        WHERE r.privilege_level = 4
          AND e.is_active = 1
          AND er.is_active = 1
          AND e.deleted_at IS NULL
          AND er.effective_date <= @now
          AND (er.expiration_date IS NULL OR er.expiration_date >= @now)
      `);
      
      return result.recordset.map(r => ({
        employeeId: r.employeeId,
        email: r.email
      }));
    } catch (error) {
      fileLogger.error({ err: error }, 'Get level 4 users error');
      throw error;
    }
  }
  
  // ==================================================================================
  // ROLE ASSIGNMENT OPERATIONS (WRITE)
  // ==================================================================================
  
  async assignRole(
    employeeId: number,
    data: AssignRoleRequest,
    assignedByUserId: number
  ): Promise<void> {
    // Manual assignment: assigned_by = the admin's id. This marks the row as
    // admin-granted so enforced AD-group sync never auto-revokes it. Upsert by
    // the (employee_id, role_id) composite PK — reactivate an existing row
    // rather than INSERT (which would violate the PK).
    const effectiveDate = data.effectiveDate ? new Date(data.effectiveDate) : new Date();
    const expirationDate = data.expiryDate ? new Date(data.expiryDate) : null;

    const existsReq = this.pool.request();
    existsReq.input('employeeId', sql.BigInt, employeeId);
    existsReq.input('roleId', sql.BigInt, data.roleId);
    const existing = await existsReq.query(
      `SELECT 1 AS x FROM employee_role WHERE employee_id = @employeeId AND role_id = @roleId`
    );

    const r = this.pool.request();
    r.input('employeeId', sql.BigInt, employeeId);
    r.input('roleId', sql.BigInt, data.roleId);
    r.input('isPrimary', sql.Bit, data.isPrimary ? 1 : 0);
    r.input('assignedBy', sql.BigInt, assignedByUserId);
    r.input('effectiveDate', sql.Date, effectiveDate);
    r.input('expirationDate', sql.Date, expirationDate);

    if (existing.recordset.length > 0) {
      await r.query(`
        UPDATE employee_role
        SET is_active = 1, is_primary = @isPrimary, assigned_by = @assignedBy,
            assigned_date = GETDATE(), effective_date = @effectiveDate,
            expiration_date = @expirationDate
        WHERE employee_id = @employeeId AND role_id = @roleId
      `);
    } else {
      await r.query(`
        INSERT INTO employee_role (
          employee_id, role_id, is_primary, assigned_by,
          assigned_date, effective_date, expiration_date, is_active
        ) VALUES (
          @employeeId, @roleId, @isPrimary, @assignedBy,
          GETDATE(), @effectiveDate, @expirationDate, 1
        )
      `);
    }

    await logRoleHistorySqlServer(this.pool, {
      employeeId, roleId: data.roleId, action: 'assigned', source: 'manual',
      assignedBy: assignedByUserId, samlRoleAttribute: null,
      isPrimary: !!data.isPrimary, reason: data.reason ?? null,
    });
  }

  async removeRole(
    employeeId: number,
    roleId: number,
    reason: string,
    removedByUserId: number
  ): Promise<void> {
    const r = this.pool.request();
    r.input('employeeId', sql.BigInt, employeeId);
    r.input('roleId', sql.BigInt, roleId);
    await r.query(`
      UPDATE employee_role
      SET is_active = 0, expiration_date = CAST(GETDATE() AS DATE)
      WHERE employee_id = @employeeId AND role_id = @roleId AND is_active = 1
    `);

    await logRoleHistorySqlServer(this.pool, {
      employeeId, roleId, action: 'revoked', source: 'manual',
      assignedBy: removedByUserId, samlRoleAttribute: null,
      isPrimary: false, reason: reason ?? null,
    });
  }
  
  async updateUserStatus(
    employeeId: number,
    data: UpdateUserStatusRequest,
    updatedByUserId: number
  ): Promise<void> {
    // Complex write operation with transactions - placeholder for now
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
    
    try {
      const userIdsList = employeeIds.join(',');
      const request = this.pool.request();
      
      const result = await request.query(`
        SELECT 
          employee_id as employeeId,
          role_id as roleId,
          source,
          saml_role_attribute as samlRoleAttribute,
          assigned_at as assignedAt
        FROM employee_role_history
        WHERE employee_id IN (${userIdsList})
          AND action = 'assigned'
        ORDER BY assigned_at DESC
      `);
      
      const roleSourceByUser = new Map<number, { source: 'saml' | 'manual'; samlRoleAttribute: string | null }>();
      for (const history of result.recordset) {
        if (!roleSourceByUser.has(history.employeeId)) {
          roleSourceByUser.set(history.employeeId, {
            source: history.source as 'saml' | 'manual',
            samlRoleAttribute: history.samlRoleAttribute
          });
        }
      }
      
      return roleSourceByUser;
    } catch (error) {
      fileLogger.error({ err: error }, 'Get role assignment sources error');
      throw error;
    }
  }
  
  async hasActiveRole(employeeId: number, roleId: number): Promise<boolean> {
    try {
      const request = this.pool.request();
      request.input('employeeId', sql.BigInt, employeeId);
      request.input('roleId', sql.BigInt, roleId);
      request.input('now', sql.DateTime2, new Date());
      
      const result = await request.query(`
        SELECT role_id
        FROM employee_role
        WHERE employee_id = @employeeId
          AND role_id = @roleId
          AND is_active = 1
          AND effective_date <= @now
          AND (expiration_date IS NULL OR expiration_date >= @now)
      `);
      
      return result.recordset.length > 0;
    } catch (error) {
      fileLogger.error({ err: error }, 'Has active role error');
      throw error;
    }
  }
}
