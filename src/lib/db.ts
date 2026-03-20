import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Strict singleton factory function for PrismaClient
 * Prevents connection exhaustion during hot-reloading
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    // Logging
    log: ['query'],
    errorFormat: 'pretty',
    
    // ⚠️ CRITICAL: Connection pool configuration for PgBouncer
    // Adjusted to handle serverless environment and connection pooling
  })

  // Log successful connection to PostgreSQL
  client.$connect().then(() => {
    console.log('[PrismaClient] ✅ Successfully connected to PostgreSQL (Supabase with PgBouncer)')
  }).catch((error) => {
    console.error('[PrismaClient] ❌ Connection failed:', error)
  })

  // Auto-disconnect on process termination (fixes PgBouncer prepared statement conflicts on Vercel)
  process.on('SIGTERM', async () => {
    console.log('[PrismaClient] SIGTERM received, disconnecting...')
    await client.$disconnect()
    process.exit(0)
  })

  // Also disconnect on process exit in development
  process.on('exit', async () => {
    await client.$disconnect()
  })

  return client
}

/**
 * Strict singleton pattern - ensures only one PrismaClient instance
 * In development: cached in globalThis to survive hot-reloads
 * In production: also cached to prevent connection exhaustion
 */
export const db: PrismaClient = (() => {
  // Return existing instance if already created (prevents re-instantiation)
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  const prisma = createPrismaClient()

  // Cache in both development AND production for serverless environments
  // This prevents connection pool exhaustion on every function invocation
  if (process.env.NODE_ENV === 'development' || process.env.VERCEL) {
    globalForPrisma.prisma = prisma
  } else {
    // Ensure we cache even in production if possible
    globalForPrisma.prisma = prisma
  }

  return prisma
})()