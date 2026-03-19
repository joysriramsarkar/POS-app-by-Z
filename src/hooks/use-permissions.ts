import { useSession } from "next-auth/react";
import { UserRole, roleHasPermission } from "@/lib/permissions";

/**
 * Hook to check if current user has a specific permission
 * @param permissionCode - Permission code (e.g., "users.create")
 * @returns boolean - true if user has the permission
 */
export function usePermission(permissionCode: string): boolean {
  const { data: session } = useSession();
  const role = (session?.user as { id?: string; role?: string; username?: string })?.role as UserRole;

  if (!role) {
    return false;
  }

  return roleHasPermission(role, permissionCode);
}

/**
 * Hook to check if current user has all of the given permissions
 * @param permissionCodes - Array of permission codes
 * @returns boolean - true if user has all permissions
 */
export function useAllPermissions(permissionCodes: string[]): boolean {
  const { data: session } = useSession();
  const role = (session?.user as { id?: string; role?: string; username?: string })?.role as UserRole;

  if (!role) {
    return false;
  }

  return permissionCodes.every((code) => roleHasPermission(role, code));
}

/**
 * Hook to check if current user has any of the given permissions
 * @param permissionCodes - Array of permission codes
 * @returns boolean - true if user has any of the permissions
 */
export function useAnyPermission(permissionCodes: string[]): boolean {
  const { data: session } = useSession();
  const role = (session?.user as { id?: string; role?: string; username?: string })?.role as UserRole;

  if (!role) {
    return false;
  }

  return permissionCodes.some((code) => roleHasPermission(role, code));
}

/**
 * Hook to get current user's role
 * @returns UserRole | null
 */
export function useUserRole(): UserRole | null {
  const { data: session } = useSession();
  return (session?.user as { id?: string; role?: UserRole; username?: string })?.role || null;
}

/**
 * Hook to check if user is admin
 * @returns boolean
 */
export function useIsAdmin(): boolean {
  const role = useUserRole();
  return role === "ADMIN";
}

/**
 * Hook to check if user is manager or higher
 * @returns boolean
 */
export function useIsManagerOrHigher(): boolean {
  const role = useUserRole();
  return role === "ADMIN" || role === "MANAGER";
}

/**
 * Guard Component - Only render children if user has permission
 */
export function PermissionGuard({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const hasPermission = usePermission(permission);
  return hasPermission ? children : fallback;
}

/**
 * Guard Component - Only render children if user has all permissions
 */
export function AllPermissionsGuard({
  permissions,
  children,
  fallback = null,
}: {
  permissions: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const hasPermissions = useAllPermissions(permissions);
  return hasPermissions ? children : fallback;
}

/**
 * Guard Component - Only render children if user has any of the permissions
 */
export function AnyPermissionGuard({
  permissions,
  children,
  fallback = null,
}: {
  permissions: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const hasPermission = useAnyPermission(permissions);
  return hasPermission ? children : fallback;
}

/**
 * Guard Component - Only render children if user has a specific role
 */
export function RoleGuard({
  roles,
  children,
  fallback = null,
}: {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const role = useUserRole();
  return role && roles.includes(role) ? children : fallback;
}
