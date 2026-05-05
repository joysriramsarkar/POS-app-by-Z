export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { startOfDay, endOfDay, parseISO, subDays, format, eachDayOfInterval } from 'date-fns';
import { requirePermission } from '@/lib/api-middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResponse = await requirePermission(request, 'reports.view');
  if (authResponse) return authResponse;

  const { id } = await params;
  const sp = request.nextUrl.searchParams;

  let startDate: Date;
  let endDate: Date;
  if (sp.get('from') && sp.get('to')) {
    startDate = startOfDay(parseISO(sp.get('from')!));
    endDate = endOfDay(parseISO(sp.get('to')!));
  } else {
    startDate = startOfDay(subDays(new Date(), 29));
    endDate = endOfDay(new Date());
  }

  try {
    const [product, saleItems] = await Promise.all([
      prisma.product.findUnique({
        where: { id },
        select: { id: true, name: true, nameBn: true, unit: true, buyingPrice: true, sellingPrice: true, currentStock: true, minStockLevel: true, category: true },
      }),
      prisma.saleItem.findMany({
        where: {
          productId: id,
          createdAt: { gte: startDate, lte: endDate },
          sale: { status: 'Completed' },
        },
        select: {
          quantity: true,
          totalPrice: true,
          createdAt: true,
          sale: {
            select: {
              customerId: true,
              customer: { select: { id: true, name: true, phone: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // --- Daily trend (fill gaps with 0) ---
    const dailyMap = new Map<string, { revenue: number; qty: number; profit: number }>();
    for (const item of saleItems) {
      const key = format(item.createdAt, 'yyyy-MM-dd');
      const prev = dailyMap.get(key) ?? { revenue: 0, qty: 0, profit: 0 };
      const profit = item.totalPrice - product.buyingPrice * item.quantity;
      dailyMap.set(key, { revenue: prev.revenue + item.totalPrice, qty: prev.qty + item.quantity, profit: prev.profit + profit });
    }
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    const dailyTrend = allDays.map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      const v = dailyMap.get(key) ?? { revenue: 0, qty: 0, profit: 0 };
      return { date: key, ...v };
    });

    // --- Hourly pattern (0-23) ---
    const hourlyMap = new Array(24).fill(0).map(() => ({ qty: 0, revenue: 0 }));
    for (const item of saleItems) {
      const h = item.createdAt.getHours();
      hourlyMap[h].qty += item.quantity;
      hourlyMap[h].revenue += item.totalPrice;
    }
    const hourlyPattern = hourlyMap.map((v, h) => ({ hour: `${h}:00`, ...v }));

    // --- Weekly pattern (0=Sun … 6=Sat) ---
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyMap = new Array(7).fill(0).map(() => ({ qty: 0, revenue: 0 }));
    for (const item of saleItems) {
      const d = item.createdAt.getDay();
      weeklyMap[d].qty += item.quantity;
      weeklyMap[d].revenue += item.totalPrice;
    }
    const weeklyPattern = weeklyMap.map((v, i) => ({ day: DAY_NAMES[i], ...v }));

    // --- Top customers ---
    const custMap = new Map<string, { id: string; name: string; phone: string | null; qty: number; revenue: number; orders: Set<string> }>();
    for (const item of saleItems) {
      if (!item.sale.customerId || !item.sale.customer) continue;
      const cid = item.sale.customerId;
      const prev = custMap.get(cid) ?? { id: cid, name: item.sale.customer.name, phone: item.sale.customer.phone, qty: 0, revenue: 0, orders: new Set() };
      prev.qty += item.quantity;
      prev.revenue += item.totalPrice;
      custMap.set(cid, prev);
    }
    const topCustomers = [...custMap.values()]
      .map(c => ({ id: c.id, name: c.name, phone: c.phone, qty: c.qty, revenue: c.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // --- Summary ---
    const totalQty = saleItems.reduce((s, i) => s + i.quantity, 0);
    const totalRevenue = saleItems.reduce((s, i) => s + i.totalPrice, 0);
    const totalProfit = totalRevenue - product.buyingPrice * totalQty;
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';
    const totalOrders = saleItems.length;
    const avgOrderQty = totalOrders > 0 ? (totalQty / totalOrders) : 0;

    // --- Peak hour & day ---
    const peakHour = hourlyPattern.reduce((a, b) => b.qty > a.qty ? b : a, hourlyPattern[0]);
    const peakDay = weeklyPattern.reduce((a, b) => b.qty > a.qty ? b : a, weeklyPattern[0]);

    return NextResponse.json({
      product,
      summary: { totalQty, totalRevenue, totalProfit, profitMargin, totalOrders, avgOrderQty, peakHour: peakHour.hour, peakDay: peakDay.day },
      dailyTrend,
      hourlyPattern,
      weeklyPattern,
      topCustomers,
    });
  } catch (error: unknown) {
    console.error('Product detail report error:', error);
    return NextResponse.json({ error: 'Failed to fetch product detail' }, { status: 500 });
  }
}
