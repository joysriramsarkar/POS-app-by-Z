import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';
import { requirePermission } from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(request, 'reports.view');
  if (authResponse) return authResponse;

  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = startOfDay(subDays(new Date(), days - 1));
    const endDate = endOfDay(new Date());

    // Fetch all sales within the date range
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: 'Completed',
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Process data for charts
    const salesByDay = new Map<string, { date: string; revenue: number; profit: number; count: number }>();

    // Initialize all days in range
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd');
      salesByDay.set(date, { date, revenue: 0, profit: 0, count: 0 });
    }

    let totalRevenue = 0;
    let totalProfit = 0;
    let previousPeriodRevenue = 0; // For simple trend calculation (could be more complex)

    // Calculate previous period stats for basic comparison (last 30 days vs previous 30 days)
    const prevStartDate = startOfDay(subDays(new Date(), (days * 2) - 1));
    const prevEndDate = endOfDay(subDays(new Date(), days));

    const previousSales = await prisma.sale.aggregate({
      where: {
        createdAt: {
          gte: prevStartDate,
          lte: prevEndDate,
        },
        status: 'Completed',
      },
      _sum: {
        totalAmount: true,
      }
    });

    previousPeriodRevenue = previousSales._sum.totalAmount || 0;

    // Aggregate current period data
    sales.forEach(sale => {
      const dateKey = format(sale.createdAt, 'yyyy-MM-dd');
      const dayData = salesByDay.get(dateKey);

      if (dayData) {
        dayData.revenue += sale.totalAmount;
        dayData.count += 1;
        totalRevenue += sale.totalAmount;
      }
    });

    // To get accurate profit, we need product buying prices
    const productIds = Array.from(new Set(sales.flatMap(s => s.items.map(i => i.productId))));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, buyingPrice: true }
    });
    const productCostMap = new Map(products.map(p => [p.id, p.buyingPrice]));

    sales.forEach(sale => {
      const dateKey = format(sale.createdAt, 'yyyy-MM-dd');
      const dayData = salesByDay.get(dateKey);

      if (dayData) {
        let saleCost = 0;
        sale.items.forEach(item => {
          const unitCost = productCostMap.get(item.productId) || 0;
          saleCost += unitCost * item.quantity;
        });

        const profit = sale.totalAmount - saleCost;
        dayData.profit += profit;
        totalProfit += profit;
      }
    });

    const chartData = Array.from(salesByDay.values());

    // Calculate growth percentage
    let revenueGrowth = 0;
    if (previousPeriodRevenue > 0) {
      revenueGrowth = ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100;
    } else if (totalRevenue > 0) {
      revenueGrowth = 100;
    }

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalProfit,
        totalSalesCount: sales.length,
        revenueGrowth: revenueGrowth.toFixed(2),
        profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : '0'
      },
      chartData
    });

  } catch (error: any) {
    console.error('Failed to fetch sales report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales report', details: error.message },
      { status: 500 }
    );
  }
}
