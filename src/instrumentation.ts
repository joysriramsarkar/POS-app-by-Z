// Next.js instrumentation hook — runs once on server startup (not during build or tests)
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");

    // C6: ALLOWED_ORIGINS must be set in production
    if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
      throw new Error(
        "[STARTUP] ALLOWED_ORIGINS environment variable is not set. " +
        "Set it to a comma-separated list of allowed origins (e.g. https://yourdomain.com)."
      );
    }
  }
}
