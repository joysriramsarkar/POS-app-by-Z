import { PrismaClient } from '@prisma/client'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db