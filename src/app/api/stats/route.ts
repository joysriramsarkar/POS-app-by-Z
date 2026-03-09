// ============================================================================
// Stats API Route - Lakhan Bhandar POS
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/stats - Fetch dashboard stats
export async function GET() {
  try {
    // Get the start and end of today in the local timezone
    // Note: This assumes the server runs in the same timezone as the business.
    // For production, you might want to handle timezones more explicitly.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Get Today's Sales and Orders
    const salesToday = await db.sale.aggregate({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        status: 'Completed', // Only count completed sales
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    // 2. Get Total Due Payments
    const totalDue = await db.customer.aggregate({
      _sum: {
        totalDue: true,
      },
    });

    const stats = {
      todaySales: salesToday._sum.totalAmount || 0,
      todayOrders: salesToday._count.id || 0,
      duePayments: totalDue._sum.totalDue || 0,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
