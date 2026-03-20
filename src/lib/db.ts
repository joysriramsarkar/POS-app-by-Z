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
    log: ['query'],
    errorFormat: 'pretty',
  })

  // Log successful connection to PostgreSQL
  client.$connect().then(() => {
    console.log('[PrismaClient] Successfully connected to PostgreSQL (Supabase)')
  }).catch((error) => {
    console.error('[PrismaClient] Connection failed:', error)
  })

  // Auto-disconnect on process termination (fixes PgBouncer prepared statement conflicts on Vercel)
  process.on('SIGTERM', async () => {
    console.log('[PrismaClient] SIGTERM received, disconnecting...')
    await client.$disconnect()
    process.exit(0)
  })

  return client
}

/**
 * Strict singleton pattern - ensures only one PrismaClient instance
 * In development: cached in globalThis to survive hot-reloads
 * In production: new instance per server restart
 */
export const db: PrismaClient = (() => {
  // Return existing instance if already created (prevents re-instantiation during hot-reload)
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  const prisma = createPrismaClient()

  // Cache only in development to prevent connection exhaustion during hot-reload cycles
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
  }

  return prisma
})()