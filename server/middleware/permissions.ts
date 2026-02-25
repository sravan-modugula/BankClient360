import { Request, Response, NextFunction } from "express";
import { permissionService } from "../services/permissionService";
import { PermissionContext } from "../../shared/schema";

declare global {
  namespace Express {
    interface Request {
      employeeId?: number;
      permissions?: string[];
      privilegeLevel?: number;
    }
  }
}

export interface PermissionOptions {
  permissionCode?: string;
  requireAll?: string[];
  requireAny?: string[];
  minPrivilegeLevel?: number;
  contextBuilder?: (req: Request) => Promise<PermissionContext> | PermissionContext;
}

export function requirePermission(options: PermissionOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const employeeId = req.employeeId;

    if (!employeeId) {
      return res.status(401).json({ 
        error: "Authentication required",
        code: "AUTH_REQUIRED"
      });
    }

    try {
      const userPermissions = await permissionService.getUserPermissions(employeeId);
      req.permissions = userPermissions.permissions;
      req.privilegeLevel = userPermissions.maxPrivilegeLevel;

      if (options.minPrivilegeLevel !== undefined && userPermissions.maxPrivilegeLevel < options.minPrivilegeLevel) {
        return res.status(403).json({
          error: "Insufficient privilege level",
          code: "INSUFFICIENT_PRIVILEGE",
          required: options.minPrivilegeLevel,
          current: userPermissions.maxPrivilegeLevel
        });
      }

      if (options.requireAll && options.requireAll.length > 0) {
        const hasAll = await permissionService.hasAllPermissions(employeeId, options.requireAll);
        if (!hasAll) {
          return res.status(403).json({
            error: "Missing required permissions",
            code: "MISSING_PERMISSIONS",
            required: options.requireAll
          });
        }
      }

      if (options.requireAny && options.requireAny.length > 0) {
        const hasAny = await permissionService.hasAnyPermission(employeeId, options.requireAny);
        if (!hasAny) {
          return res.status(403).json({
            error: "Missing required permissions",
            code: "MISSING_PERMISSIONS",
            requiredAny: options.requireAny
          });
        }
      }

      if (options.permissionCode) {
        let context: PermissionContext = {};
        if (options.contextBuilder) {
          context = await options.contextBuilder(req);
        }

        const result = await permissionService.checkPermission(
          employeeId,
          options.permissionCode,
          context
        );

        if (!result.allowed) {
          return res.status(403).json({
            error: "Permission denied",
            code: "PERMISSION_DENIED",
            reason: result.reason
          });
        }
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        error: "Internal server error during permission check",
        code: "PERMISSION_CHECK_ERROR"
      });
    }
  };
}

export function requireMinPrivilegeLevel(level: number) {
  return requirePermission({ minPrivilegeLevel: level });
}

export function requireAnyPermission(...permissionCodes: string[]) {
  return requirePermission({ requireAny: permissionCodes });
}

export function requireAllPermissions(...permissionCodes: string[]) {
  return requirePermission({ requireAll: permissionCodes });
}

export async function attachPermissions(req: Request, res: Response, next: NextFunction) {
  const employeeId = req.employeeId;

  if (!employeeId) {
    return next();
  }

  try {
    const userPermissions = await permissionService.getUserPermissions(employeeId);
    req.permissions = userPermissions.permissions;
    req.privilegeLevel = userPermissions.maxPrivilegeLevel;
    next();
  } catch (error) {
    console.error('Failed to attach permissions:', error);
    next();
  }
}
