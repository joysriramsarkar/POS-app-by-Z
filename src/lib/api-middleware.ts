import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPermission } from "@/lib/permissions";

/**
 * Middleware to check if request is authorized (has valid session)
 */
export async function requireAuth(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { authorized: true, response: null, session };
}

/**
 * Middleware to check if user has specific permission
 */
export async function requirePermission(
  request: NextRequest,
  permissionCode: string
) {
  const authResult = await requireAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const session = authResult.session;
  const userId = (session?.user as { id?: string; role?: string; username?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const hasAccess = await hasPermission(userId, permissionCode);
  if (!hasAccess) {
    return NextResponse.json(
      { error: `You don't have permission to perform this action` },
      { status: 403 }
    );
  }

  return null; // null means authorized
}

/**
 * Middleware to check if user has specific role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
) {
  const authResult = await requireAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const session = authResult.session;
  const userRole = (session?.user as { id?: string; role?: string; username?: string })?.role;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  return null; // null means authorized
}

/**
 * Helper to get authenticated user from request
 */
export async function getAuthenticatedUser(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }
  return session.user;
}
