import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// C2 + H5: In-memory rate limiter for auth endpoints
// For production with multiple instances, replace with @upstash/ratelimit + Redis
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_RULES: Record<string, { max: number; windowMs: number }> = {
  "/api/auth/callback/credentials": { max: 10, windowMs: 60_000 },
  "/api/auth/signin":               { max: 10, windowMs: 60_000 },
};

function rateLimit(ip: string, pathname: string): boolean {
  const rule = RATE_LIMIT_RULES[pathname];
  if (!rule) return false;

  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + rule.windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > rule.max;
}

export default withAuth(
  function middleware(request: NextRequest) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (rateLimit(ip, request.nextUrl.pathname)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|logo.svg|manifest.json).*)",
    "/api/auth/callback/credentials",
    "/api/auth/signin",
  ],
};
