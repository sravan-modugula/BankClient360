import { eq } from "drizzle-orm";
import { db } from "../db";
import { permission, permissionDenialLog } from "../../shared/schema";
import { getRoleManagementStore } from "../storage/roleManagement";
import type {
  Permission,
  Role,
  PermissionContext,
  PermissionCheckResult,
  PermissionCondition,
  AttributeConfig,
  UserPermissions
} from "../../shared/schema";
import logger from "./logger";

const permLogger = logger.child({ module: 'permissions' });

export class PermissionService {
  async getUserPermissions(employeeId: number): Promise<UserPermissions> {
    const store = await getRoleManagementStore();
    return await store.getUserPermissions(employeeId);
  }

  async checkPermission(
    employeeId: number,
    permissionCode: string,
    context: PermissionContext = {}
  ): Promise<PermissionCheckResult> {
    try {
      const userPermissions = await this.getUserPermissions(employeeId);

      // Check if db is null (SQL Server mode)
      if (!db) {
        permLogger.warn('Database not available in SQL Server mode, allowing permission');
        return { allowed: true };
      }

      const permissionData = await db
        .select()
        .from(permission)
        .where(eq(permission.permissionCode, permissionCode))
        .limit(1);

      if (permissionData.length === 0) {
        return {
          allowed: false,
          reason: `Permission '${permissionCode}' does not exist`
        };
      }

      const perm = permissionData[0];

      if (!userPermissions.permissions.includes(permissionCode)) {
        await this.logPermissionDenial(
          employeeId,
          permissionCode,
          context,
          "User does not have this permission"
        );
        return {
          allowed: false,
          reason: "User does not have this permission"
        };
      }

      if (perm.minPrivilegeLevel && userPermissions.maxPrivilegeLevel < Number(perm.minPrivilegeLevel)) {
        await this.logPermissionDenial(
          employeeId,
          permissionCode,
          context,
          `Insufficient privilege level (required: ${perm.minPrivilegeLevel}, user has: ${userPermissions.maxPrivilegeLevel})`
        );
        return {
          allowed: false,
          reason: `Insufficient privilege level`
        };
      }

      if (perm.isAttributeBased && perm.attributeConfig) {
        const attributeCheck = this.evaluateAttributeConditions(
          perm.attributeConfig as AttributeConfig,
          context,
          userPermissions.maxPrivilegeLevel
        );

        if (!attributeCheck.allowed) {
          await this.logPermissionDenial(
            employeeId,
            permissionCode,
            context,
            attributeCheck.reason || "Attribute-based permission denied"
          );
          return attributeCheck;
        }
      }

      return {
        allowed: true
      };
    } catch (error) {
      permLogger.error({ err: error }, 'Error checking permission');
      return {
        allowed: false,
        reason: 'Permission check failed'
      };
    }
  }

  private evaluateAttributeConditions(
    attributeConfig: AttributeConfig,
    context: PermissionContext,
    userPrivilegeLevel: number
  ): PermissionCheckResult {
    const { conditions } = attributeConfig;

    for (const condition of conditions) {
      const conditionMet = this.evaluateCondition(condition, context);

      if (conditionMet && condition.denyIfMatch) {
        if (condition.minPrivilegeOverride && userPrivilegeLevel >= condition.minPrivilegeOverride) {
          continue;
        }

        return {
          allowed: false,
          reason: condition.reason,
          matchedCondition: condition
        };
      }
    }

    return {
      allowed: true
    };
  }

  private evaluateCondition(condition: PermissionCondition, context: PermissionContext): boolean {
    const attributeValue = this.getAttributeValue(condition.attribute, context);

    if (attributeValue === undefined || attributeValue === null) {
      return false;
    }

    switch (condition.operator) {
      case 'equals':
        return attributeValue === condition.value;
      case 'not_equals':
        return attributeValue !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(attributeValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(attributeValue);
      case 'greater_than':
        return attributeValue > condition.value;
      case 'less_than':
        return attributeValue < condition.value;
      default:
        return false;
    }
  }

  private getAttributeValue(attributePath: string, context: PermissionContext): any {
    const parts = attributePath.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private async logPermissionDenial(
    employeeId: number,
    permissionCode: string,
    context: PermissionContext,
    reason: string
  ): Promise<void> {
    try {
      await db.insert(permissionDenialLog).values({
        employeeId,
        permissionCode,
        resourceType: context.customer ? 'customer' : context.account ? 'account' : context.note ? 'note' : 'unknown',
        resourceId: context.customer?.customerId || context.account?.accountId || context.note?.noteId || null,
        denialReason: reason,
        contextData: context
      });
    } catch (error) {
      permLogger.error({ err: error }, 'Failed to log permission denial');
    }
  }

  async hasPermission(employeeId: number, permissionCode: string): Promise<boolean> {
    const result = await this.checkPermission(employeeId, permissionCode);
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
}

export const permissionService = new PermissionService();