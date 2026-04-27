export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import {
  startOfDay,
  endOfDay,
  format,
  eachDayOfInterval,
  parseISO,
  subDays,
} from "date-fns";
import { requirePermission } from "@/lib/api-middleware";

export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(request, "reports.view");
  if (authResponse) return authResponse;

  try {
    const sp = request.nextUrl.searchParams;
    const isHourly = sp.get("hourly") === "true";

    let startDate: Date;
    let endDate: Date;

    if (sp.get("from") && sp.get("to")) {
      startDate = startOfDay(parseISO(sp.get("from")!));
      endDate = endOfDay(parseISO(sp.get("to")!));
    } else {
      const days = parseInt(sp.get("days") || "30");
      startDate = startOfDay(subDays(new Date(), days - 1));
      endDate = endOfDay(new Date());
    }

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: "Completed",
      },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });

    // Previous period for growth comparison
    const periodMs = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodMs);
    const previousSales = await prisma.sale.aggregate({
      where: {
        createdAt: { gte: prevStart, lte: prevEnd },
        status: "Completed",
      },
      _sum: { totalAmount: true },
    });
    const previousPeriodRevenue = previousSales._sum.totalAmount || 0;

    // Product cost map
    const productIds = Array.from(
      new Set(sales.flatMap((s) => s.items.map((i) => i.productId))),
    );
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, buyingPrice: true },
    });
    const costMap = new Map(products.map((p) => [p.id, p.buyingPrice]));

    let totalRevenue = 0;
    let totalProfit = 0;
    const paymentBreakdown: Record<string, number> = {};

    // Aggregate totals (same for both modes)
    sales.forEach((sale) => {
      let cost = 0;
      sale.items.forEach((item) => {
        cost += (costMap.get(item.productId) || 0) * item.quantity;
      });
      totalRevenue += sale.totalAmount;
      totalProfit += sale.totalAmount - cost;
      paymentBreakdown[sale.paymentMethod] =
        (paymentBreakdown[sale.paymentMethod] || 0) + sale.totalAmount;
    });

    // Build chart data
    let chartData: {
      date: string;
      revenue: number;
      profit: number;
      count: number;
    }[];

    if (isHourly) {
      // 24 slots: 00:00 → 23:00
      chartData = Array.from({ length: 24 }, (_, h) => ({
        date: String(h).padStart(2, "0") + ":00",
        revenue: 0,
        profit: 0,
        count: 0,
      }));
      sales.forEach((sale) => {
        const hour = new Date(sale.createdAt).getHours();
        let cost = 0;
        sale.items.forEach((item) => {
          cost += (costMap.get(item.productId) || 0) * item.quantity;
        });
        chartData[hour].revenue += sale.totalAmount;
        chartData[hour].profit += sale.totalAmount - cost;
        chartData[hour].count += 1;
      });
    } else {
      const dayList = eachDayOfInterval({ start: startDate, end: endDate });
      const salesByDay = new Map<
        string,
        { date: string; revenue: number; profit: number; count: number }
      >();
      dayList.forEach((d) => {
        salesByDay.set(format(d, "yyyy-MM-dd"), {
          date: format(d, "yyyy-MM-dd"),
          revenue: 0,
          profit: 0,
          count: 0,
        });
      });
      sales.forEach((sale) => {
        const key = format(sale.createdAt, "yyyy-MM-dd");
        const day = salesByDay.get(key);
        if (day) {
          let cost = 0;
          sale.items.forEach((item) => {
            cost += (costMap.get(item.productId) || 0) * item.quantity;
          });
          day.revenue += sale.totalAmount;
          day.profit += sale.totalAmount - cost;
          day.count += 1;
        }
      });
      chartData = Array.from(salesByDay.values());
    }

    const revenueGrowth =
      previousPeriodRevenue > 0
        ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
        : totalRevenue > 0
          ? 100
          : 0;

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalProfit,
        totalSalesCount: sales.length,
        revenueGrowth: revenueGrowth.toFixed(2),
        profitMargin:
          totalRevenue > 0
            ? ((totalProfit / totalRevenue) * 100).toFixed(2)
            : "0",
        paymentBreakdown,
      },
      chartData,
    });
  } catch (error) {
    console.error("Failed to fetch sales report:", error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to fetch sales report", details },
      { status: 500 },
    );
  }
}
