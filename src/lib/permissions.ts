import { db } from "./db";
import { Session } from "next-auth";

export type UserRole = "ADMIN" | "MANAGER" | "CASHIER" | "VIEWER";

/**
 * Check if a user has a specific permission
 * @param userId - User ID
 * @param permissionCode - Permission code (e.g., "sales.create")
 * @returns true if user has permission, false otherwise
 */
export async function hasPermission(
  userId: string,
  permissionCode: string
): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return false;
    }

    // Check if permission exists for this role
    const permission = await db.rolePermission.findFirst({
      where: {
        role: user.role,
        permission: {
          code: permissionCode,
        },
      },
    });

    return !!permission;
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

/**
 * Check if a user has multiple permissions (all must be true)
 * @param userId - User ID
 * @param permissionCodes - Array of permission codes
 * @returns true if user has all permissions, false otherwise
 */
export async function hasAllPermissions(
  userId: string,
  permissionCodes: string[]
): Promise<boolean> {
  const results = await Promise.all(
    permissionCodes.map((code) => hasPermission(userId, code))
  );
  return results.every((result) => result);
}

/**
 * Check if a user has any of the given permissions
 * @param userId - User ID
 * @param permissionCodes - Array of permission codes
 * @returns true if user has any of the permissions, false otherwise
 */
export async function hasAnyPermission(
  userId: string,
  permissionCodes: string[]
): Promise<boolean> {
  const results = await Promise.all(
    permissionCodes.map((code) => hasPermission(userId, code))
  );
  return results.some((result) => result);
}

/**
 * Get all permissions for a user based on role
 * @param userId - User ID
 * @returns Array of permission codes
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return [];
    }

    const permissions = await db.rolePermission.findMany({
      where: {
        role: user.role,
      },
      select: {
        permission: {
          select: {
            code: true,
          },
        },
      },
    });

    return permissions.map((rp: any) => rp.permission.code);
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return [];
  }
}

/**
 * Helper to get user role (for session-based checks)
 * @param session - NextAuth session
 * @returns User role
 */
export function getUserRole(session: Session | null): UserRole | null {
  return (session?.user as { id?: string; role?: UserRole; username?: string })?.role || null;
}

/**
 * Check if session user has permission
 * @param session - NextAuth session
 * @param permissionCode - Permission code
 * @returns true if user has permission, false otherwise
 */
export async function sessionHasPermission(
  session: Session | null,
  permissionCode: string
): Promise<boolean> {
  if (!session?.user || !(session.user as { id?: string; role?: string; username?: string })?.id) {
    return false;
  }
  return hasPermission((session.user as { id?: string; role?: string; username?: string }).id as string, permissionCode);
}

/**
 * Role-based permission map (for frontend convenience)
 * Shows what each role can access
 */
export const rolePermissions: Record<UserRole, string[]> = {
  ADMIN: [
    "users.view", "users.create", "users.edit", "users.delete",
    "products.view", "products.create", "products.edit", "products.delete",
    "sales.view", "sales.create", "sales.edit", "sales.delete",
    "stock.view", "stock.edit", "stock.import",
    "reports.view", "reports.export",
    "settings.view", "settings.edit",
    "customers.view", "customers.create", "customers.edit",
  ],
  MANAGER: [
    "products.view", "products.create", "products.edit",
    "sales.view", "sales.create", "sales.edit",
    "stock.view", "stock.edit", "stock.import",
    "reports.view", "reports.export",
    "customers.view", "customers.create", "customers.edit",
  ],
  CASHIER: [
    "products.view",
    "sales.view", "sales.create",
    "customers.view", "customers.create",
  ],
  VIEWER: [
    "reports.view",
    "products.view",
    "sales.view",
  ],
};

/**
 * Check if role has specific permission (for frontend)
 * @param role - User role
 * @param permissionCode - Permission code
 * @returns true if role has permission
 */
export function roleHasPermission(role: UserRole, permissionCode: string): boolean {
  return rolePermissions[role]?.includes(permissionCode) ?? false;
}
