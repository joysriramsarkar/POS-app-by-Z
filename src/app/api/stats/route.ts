export const dynamic = 'force-dynamic';
// ============================================================================
// Stats API Route - Lakhan Bhandar POS
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/stats - Fetch dashboard stats
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the start and end of today in the local timezone
    // Note: This assumes the server runs in the same timezone as the business.
    // For production, you might want to handle timezones more explicitly.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

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

    // 1b. Get Yesterday's Sales and Orders
    const salesYesterday = await db.sale.aggregate({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
        status: 'Completed',
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

    const todaySales = salesToday._sum.totalAmount || 0;
    const todayOrders = salesToday._count.id || 0;
    const yesterdaySales = salesYesterday._sum.totalAmount || 0;
    const yesterdayOrders = salesYesterday._count.id || 0;

    let salesComparison = 'N/A';
    if (yesterdaySales > 0) {
      const diff = ((todaySales - yesterdaySales) / yesterdaySales) * 100;
      salesComparison = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% from yesterday`;
    }

    let ordersComparison = 'N/A';
    if (yesterdayOrders > 0) {
      const diff = todayOrders - yesterdayOrders;
      ordersComparison = `${diff >= 0 ? '+' : ''}${diff} from yesterday`;
    }

    const stats = {
      todaySales,
      todayOrders,
      duePayments: totalDue._sum.totalDue || 0,
      salesComparison,
      ordersComparison,
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
