import { PrismaClient } from '@prisma/client'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Always use absolute path for SQLite database to ensure consistent resolution
const getDbPath = () => {
  const dbPath = path.resolve(process.cwd(), 'data', 'pos.db')
  // Ensure proper file: protocol with absolute path
  // On Windows, use forward slashes for SQLite
  return `file:${dbPath.replace(/\\/g, '/')}`
}

const databaseUrl = process.env.DATABASE_URL || getDbPath()

/**
 * Strict singleton factory function for PrismaClient
 * Prevents connection exhaustion during hot-reloading
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: ['query'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

  // Enable WAL (Write-Ahead Logging) mode for concurrent read/write support
  client.$connect().then(async () => {
    try {
      // Enable WAL mode for better concurrent access (use $queryRawUnsafe for PRAGMA statements that return results)
      await client.$queryRawUnsafe('PRAGMA journal_mode = WAL;')
      // Set synchronous mode to NORMAL for better performance with WAL
      await client.$queryRawUnsafe('PRAGMA synchronous = NORMAL;')
      console.log('[PrismaClient] WAL mode enabled and synchronous set to NORMAL')
    } catch (error) {
      console.error('[PrismaClient] Failed to enable WAL mode:', error)
    }
  }).catch((error) => {
    console.error('[PrismaClient] Connection pool initialization error:', error)
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