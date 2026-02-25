/**
 * Role Management Storage Interface
 * Provides database-agnostic interface for RBAC operations
 */

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
} from '@shared/schema';

/**
 * Core interface for role management storage operations
 * Implementations exist for both PostgreSQL (Drizzle ORM) and SQL Server (mssql)
 */
export interface IRoleManagementStore {
  // ==================================================================================
  // PERMISSION OPERATIONS
  // ==================================================================================
  
  /**
   * Get all permissions for an employee based on their active roles
   * Combines role-based and privilege-level permissions
   */
  getUserPermissions(employeeId: number): Promise<UserPermissions>;
  
  /**
   * Check if employee has a specific permission with optional ABAC context
   * Returns detailed result including denial reason if not allowed
   */
  checkPermission(
    employeeId: number,
    permissionCode: string,
    context?: PermissionContext
  ): Promise<PermissionCheckResult>;
  
  /**
   * Check if employee has a specific permission (simplified check)
   */
  hasPermission(employeeId: number, permissionCode: string): Promise<boolean>;
  
  /**
   * Check if employee has ANY of the specified permissions
   */
  hasAnyPermission(employeeId: number, permissionCodes: string[]): Promise<boolean>;
  
  /**
   * Check if employee has ALL of the specified permissions
   */
  hasAllPermissions(employeeId: number, permissionCodes: string[]): Promise<boolean>;
  
  /**
   * Get the maximum privilege level for an employee
   */
  getMaxPrivilegeLevel(employeeId: number): Promise<number>;
  
  /**
   * Log a permission denial for audit purposes
   */
  logPermissionDenial(
    employeeId: number,
    permissionCode: string,
    reason: string,
    resourceType?: string,
    resourceId?: number | string | null,
    denialReason?: string,
    contextData?: any
  ): Promise<void>;
  
  // ==================================================================================
  // ROLE OPERATIONS
  // ==================================================================================
  
  /**
   * Get all active roles in the system
   * Ordered by privilege level descending, then by name
   */
  getAllRoles(): Promise<Role[]>;
  
  /**
   * Get all active roles for a specific employee
   * Includes only roles with effective dates and no expiration
   */
  getEmployeeRoles(employeeId: number): Promise<Role[]>;
  
  /**
   * Get all permissions associated with specific roles
   */
  getRolePermissions(roleIds: number[]): Promise<Array<{ permissionCode: string }>>;
  
  /**
   * Get permissions granted by privilege level
   * Returns permissions where user's level >= permission's min level
   */
  getPrivilegeLevelPermissions(maxPrivilegeLevel: number): Promise<Array<{ permissionCode: string }>>;
  
  /**
   * Get detailed permission data for a specific permission code
   */
  getPermissionByCode(permissionCode: string): Promise<Permission | null>;
  
  // ==================================================================================
  // USER MANAGEMENT OPERATIONS
  // ==================================================================================
  
  /**
   * List all users with optional filtering
   * Includes basic user info and assigned roles
   */
  listUsers(filters?: {
    search?: string;
    roleId?: number;
    isActive?: boolean;
    department?: string;
  }): Promise<UserListItem[]>;
  
  /**
   * Get detailed information for a specific user
   * Includes all roles, permissions, and history
   */
  getUserById(employeeId: number, requestingUserId: number): Promise<UserDetail | null>;
  
  /**
   * Get all employees with privilege level 4 (System Admin)
   */
  getLevel4Users(): Promise<Array<{ employeeId: number; email: string }>>;
  
  // ==================================================================================
  // ROLE ASSIGNMENT OPERATIONS (WRITE)
  // ==================================================================================
  
  /**
   * Assign a role to an employee
   * Creates employee_role record and logs to audit trail
   */
  assignRole(
    employeeId: number,
    data: AssignRoleRequest,
    assignedByUserId: number
  ): Promise<void>;
  
  /**
   * Remove a role from an employee
   * Deactivates employee_role record and logs to audit trail
   */
  removeRole(
    employeeId: number,
    roleId: number,
    reason: string,
    removedByUserId: number
  ): Promise<void>;
  
  /**
   * Update employee status (active/inactive)
   * Logs status change to history table
   */
  updateUserStatus(
    employeeId: number,
    data: UpdateUserStatusRequest,
    updatedByUserId: number
  ): Promise<void>;
  
  // ==================================================================================
  // HELPER OPERATIONS
  // ==================================================================================
  
  /**
   * Get role assignment source (SAML vs manual) for users
   * Returns map of employeeId -> source info
   */
  getRoleAssignmentSources(
    employeeIds: number[]
  ): Promise<Map<number, { source: 'saml' | 'manual'; samlRoleAttribute: string | null }>>;
  
  /**
   * Check if an employee has an active role assignment
   */
  hasActiveRole(employeeId: number, roleId: number): Promise<boolean>;
}

/**
 * Factory function to get the appropriate role management store
 * based on the database dialect (PostgreSQL or SQL Server)
 */
export async function getRoleManagementStore(): Promise<IRoleManagementStore> {
  const { isSQLServer } = await import('../../dbConfig');
  
  if (isSQLServer()) {
    const { SqlServerRoleManagementStore } = await import('./sqlServer');
    const { getMssqlPool } = await import('../../dbConnection');
    const pool = await getMssqlPool();
    return new SqlServerRoleManagementStore(pool);
  } else {
    const { PostgresRoleManagementStore } = await import('./postgres');
    return new PostgresRoleManagementStore();
  }
}
