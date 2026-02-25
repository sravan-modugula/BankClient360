import { useQuery } from "@tanstack/react-query";
import type { UserPermissions, PermissionContext } from "@shared/schema";

export function usePermissions(employeeId?: number) {
  return useQuery<UserPermissions>({
    queryKey: employeeId ? ['/api/auth/permissions', employeeId] : ['/api/auth/permissions'],
    staleTime: 5 * 60 * 1000
  });
}

export function useHasPermission(permissionCode: string, employeeId?: number): boolean {
  const { data } = usePermissions(employeeId);
  return data?.permissions.includes(permissionCode) ?? false;
}

export function useHasAnyPermission(permissionCodes: string[], employeeId?: number): boolean {
  const { data } = usePermissions(employeeId);
  if (!data) return false;
  return permissionCodes.some(code => data.permissions.includes(code));
}

export function useHasAllPermissions(permissionCodes: string[], employeeId?: number): boolean {
  const { data } = usePermissions(employeeId);
  if (!data) return false;
  return permissionCodes.every(code => data.permissions.includes(code));
}

export function useMinPrivilegeLevel(minLevel: number, employeeId?: number): boolean {
  const { data } = usePermissions(employeeId);
  return (data?.maxPrivilegeLevel ?? 0) >= minLevel;
}

export function useCheckPermission(
  permissionCode: string,
  context: PermissionContext = {},
  employeeId?: number
) {
  return useQuery<{ allowed: boolean; reason?: string }>({
    queryKey: ['/api/auth/check-permission', permissionCode, context, employeeId],
    enabled: !!employeeId && !!permissionCode,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const response = await fetch('/api/auth/check-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ permissionCode, context })
      });

      if (!response.ok) {
        throw new Error('Failed to check permission');
      }

      return response.json();
    }
  });
}
