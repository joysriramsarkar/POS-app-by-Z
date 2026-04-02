export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { requirePermission } from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(request, 'reports.view');
  if (authResponse) return authResponse;

  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = startOfDay(subDays(new Date(), days - 1));
    const endDate = endOfDay(new Date());

    // Aggregate top selling products
    const topProducts = await prisma.saleItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true,
        totalPrice: true,
      },
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        sale: {
          status: 'Completed',
        },
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 20,
    });

    // Fetch product details for the aggregated data
    const productDetails = await prisma.product.findMany({
      where: {
        id: { in: topProducts.map(p => p.productId) },
      },
      select: {
        id: true,
        name: true,
        nameBn: true,
        buyingPrice: true,
        unit: true,
      },
    });

    const productsMap = new Map(productDetails.map(p => [p.id, p]));

    const result = topProducts.map(p => {
      const details = productsMap.get(p.productId);
      const totalRevenue = p._sum.totalPrice || 0;
      const totalQuantity = p._sum.quantity || 0;
      const estimatedCost = (details?.buyingPrice || 0) * totalQuantity;
      const profit = totalRevenue - estimatedCost;

      return {
        id: p.productId,
        name: details?.name || 'Unknown Product',
        nameBn: details?.nameBn,
        unit: details?.unit || 'unit',
        quantity: totalQuantity,
        revenue: totalRevenue,
        profit: profit,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      topProducts: result,
    });
  } catch (error: any) {
    console.error('Failed to fetch product report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product report', details: error.message },
      { status: 500 }
    );
  }
}
