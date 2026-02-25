import type { ReactNode } from "react";
import {
  usePermissions,
  useHasPermission,
  useHasAnyPermission,
  useHasAllPermissions,
  useMinPrivilegeLevel
} from "@/hooks/usePermissions";

interface PermissionGuardProps {
  permissionCode?: string;
  requireAny?: string[];
  requireAll?: string[];
  minPrivilegeLevel?: number;
  employeeId?: number;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({
  permissionCode,
  requireAny,
  requireAll,
  minPrivilegeLevel,
  employeeId,
  fallback = null,
  children
}: PermissionGuardProps) {
  const hasPermission = useHasPermission(permissionCode || '', employeeId);
  const hasAny = useHasAnyPermission(requireAny || [], employeeId);
  const hasAll = useHasAllPermissions(requireAll || [], employeeId);
  const hasMinLevel = useMinPrivilegeLevel(minPrivilegeLevel || 0, employeeId);

  const { data: permissions } = usePermissions(employeeId);

  if (!permissions) {
    return <>{fallback}</>;
  }

  let shouldShow = true;

  if (permissionCode && !hasPermission) {
    shouldShow = false;
  }

  if (requireAny && requireAny.length > 0 && !hasAny) {
    shouldShow = false;
  }

  if (requireAll && requireAll.length > 0 && !hasAll) {
    shouldShow = false;
  }

  if (minPrivilegeLevel !== undefined && !hasMinLevel) {
    shouldShow = false;
  }

  return shouldShow ? <>{children}</> : <>{fallback}</>;
}

export default PermissionGuard;
