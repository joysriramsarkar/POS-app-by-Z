// ============================================================================
// Customers API Route - Lakhan Bhandar POS
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CustomerInputSchema } from '@/schemas';

// GET /api/customers - Fetch customers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const phone = searchParams.get('phone');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // If specific ID requested
    if (id) {
      const customer = await db.customer.findUnique({
        where: { id },
        include: {
          sales: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
          ledgerEntries: {
            take: 20,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!customer) {
        return NextResponse.json(
          { success: false, error: 'Customer not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: customer });
    }

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (!includeInactive) {
      where.isActive = true;
    }
    
    if (phone) {
      where.phone = phone;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const customers = await db.customer.findMany({
      where,
      include: {
        _count: {
          select: { sales: true },
        },
      },
      orderBy: [
        { totalDue: 'desc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

// POST /api/customers - Create new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = CustomerInputSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const validatedData = result.data;

    // Check if customer with same phone exists
    if (validatedData.phone) {
      const existing = await db.customer.findUnique({
        where: { phone: validatedData.phone },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Customer with this phone already exists' },
          { status: 400 }
        );
      }
    }

    const customer = await db.customer.create({
      data: {
        name: validatedData.name,
        phone: validatedData.phone || null,
        address: validatedData.address || null,
        notes: validatedData.notes || null,
        totalDue: validatedData.totalDue || 0,
        totalPaid: validatedData.totalPaid || 0,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Customer created successfully',
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}

// PUT /api/customers - Update customer
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const result = CustomerInputSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { id, ...validatedData } = result.data;

    const customer = await db.customer.update({
      where: { id: body.id },
      data: {
        ...validatedData,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: customer,
      message: 'Customer updated successfully',
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

// DELETE /api/customers - Soft delete customer
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const customer = await db.customer.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
