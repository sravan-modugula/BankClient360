import { getRoleManagementStore } from "../storage/roleManagement";
import type {
  Employee,
  UserListItem,
  UserDetail,
  CreateUserRequest,
  UpdateUserRequest,
  AssignRoleRequest,
  UpdateUserStatusRequest,
  Role
} from "../../shared/schema";

export class UserManagementService {
  // Delegated read operations using storage layer
  async listUsers(filters?: {
    search?: string;
    roleId?: number;
    isActive?: boolean;
    department?: string;
  }): Promise<UserListItem[]> {
    const store = await getRoleManagementStore();
    return await store.listUsers(filters);
  }
  
  async getAllRoles(): Promise<Role[]> {
    const store = await getRoleManagementStore();
    return await store.getAllRoles();
  }
  
  async getUserById(employeeId: number, requestingUserId: number): Promise<UserDetail | null> {
    const store = await getRoleManagementStore();
    return await store.getUserById(employeeId, requestingUserId);
  }
  
  // Write operations - still using direct DB access (TODO: migrate to storage layer)
  async createUser(data: CreateUserRequest, createdByUserId: number): Promise<Employee> {
    throw new Error('Write operations not yet implemented in SQL Server mode');
  }

  async updateUser(employeeId: number, data: UpdateUserRequest, modifiedByUserId: number): Promise<Employee> {
    throw new Error('Write operations not yet implemented in SQL Server mode');
  }

  async assignRole(employeeId: number, data: AssignRoleRequest, assignedByUserId: number): Promise<void> {
    const store = await getRoleManagementStore();
    return await store.assignRole(employeeId, data, assignedByUserId);
  }

  async updateUserStatus(employeeId: number, data: UpdateUserStatusRequest, modifiedByUserId: number): Promise<void> {
    const store = await getRoleManagementStore();
    return await store.updateUserStatus(employeeId, data, modifiedByUserId);
  }

  async deleteUser(employeeId: number, deletedByUserId: number): Promise<void> {
    throw new Error('Write operations not yet implemented in SQL Server mode');
  }
  
  async removeRole(employeeId: number, roleId: number, reason: string, removedByUserId: number): Promise<void> {
    const store = await getRoleManagementStore();
    return await store.removeRole(employeeId, roleId, reason, removedByUserId);
  }
}

export const userManagementService = new UserManagementService();
