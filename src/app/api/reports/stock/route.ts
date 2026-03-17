import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const lowStockItems = await prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: {
          lte: prisma.product.fields.minStockLevel, // Prisma native compare
        },
      },
      select: {
        id: true,
        name: true,
        nameBn: true,
        category: true,
        currentStock: true,
        minStockLevel: true,
        unit: true,
        barcode: true,
      },
      orderBy: {
        currentStock: 'asc',
      },
      take: 50,
    });

    return NextResponse.json({
      lowStockItems,
      totalCount: lowStockItems.length,
    });
  } catch (error: any) {
    console.error('Failed to fetch stock report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock report', details: error.message },
      { status: 500 }
    );
  }
}
