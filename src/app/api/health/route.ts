import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    console.log('🔍 [HEALTH CHECK] Starting database connection check...')
    console.log('📝 [HEALTH CHECK] DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...')
    console.log('📝 [HEALTH CHECK] NODE_ENV:', process.env.NODE_ENV)

    // Try to query the database
    const result = await db.$queryRaw`SELECT 1 as connection_test`
    
    console.log('✅ [HEALTH CHECK] Database connection successful!')

    return Response.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date(),
      environment: process.env.NODE_ENV,
    }, { status: 200 })
  } catch (error: any) {
    console.error('❌ [HEALTH CHECK] Database connection failed:', error.message)
    console.error('❌ [HEALTH CHECK] Full error:', error)

    return Response.json({
      status: 'error',
      database: 'failed',
      error: error.message,
      timestamp: new Date(),
    }, { status: 500 })
  }
}
