import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL:    z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  NEXTAUTH_URL:    z.string().url("NEXTAUTH_URL must be a valid URL"),
  NODE_ENV:        z.enum(["development", "test", "production"]).default("development"),
  // Optional
  DIRECT_URL:           z.string().optional(),
  ALLOWED_ORIGINS:      z.string().optional(),
  SEED_ADMIN_PASSWORD:  z.string().optional(),
  UPSTASH_REDIS_REST_URL:   z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`[env] Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
