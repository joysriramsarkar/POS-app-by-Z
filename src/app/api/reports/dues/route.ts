import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const customersWithDues = await prisma.customer.findMany({
      where: {
        totalDue: {
          gt: 0,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        totalDue: true,
        totalPaid: true,
        updatedAt: true,
        _count: {
          select: { sales: true }
        }
      },
      orderBy: {
        totalDue: 'desc',
      },
      take: 50,
    });

    const totalOutstandingDue = customersWithDues.reduce((sum, customer) => sum + customer.totalDue, 0);

    return NextResponse.json({
      customersWithDues,
      totalOutstandingDue,
      count: customersWithDues.length,
    });
  } catch (error: any) {
    console.error('Failed to fetch due report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch due report', details: error.message },
      { status: 500 }
    );
  }
}
