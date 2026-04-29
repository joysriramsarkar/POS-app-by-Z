import { Session } from "next-auth";
import { UserRole } from "./permissions";

/**
 * Helper to get user role (for session-based checks)
 * @param session - NextAuth session
 * @returns User role
 */
export function getUserRole(session: Session | null): UserRole | null {
  return (session?.user as { id?: string; role?: UserRole; username?: string })?.role || null;
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
    "customers.view", "customers.create", "customers.edit", "customers.delete",
    "suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.delete",
    "expenses.view", "expenses.create", "expenses.delete",
  ],
  MANAGER: [
    "products.view", "products.create", "products.edit", "products.delete",
    "sales.view", "sales.create", "sales.edit",
    "stock.view", "stock.edit", "stock.import",
    "reports.view", "reports.export",
    "customers.view", "customers.create", "customers.edit",
    "suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.delete",
    "expenses.view", "expenses.create", "expenses.delete",
  ],
  CASHIER: [
    "products.view",
    "sales.view", "sales.create",
    "customers.view", "customers.create",
    "suppliers.view",
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
