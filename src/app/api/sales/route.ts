// ============================================================================
// Sales API Route - Lakhan Bhandar POS
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateInvoiceNumber } from '@/lib/invoice';
import { v4 as uuidv4 } from 'uuid';

// GET /api/sales - Fetch sales
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const invoiceNumber = searchParams.get('invoiceNumber');
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // If specific ID requested
    if (id) {
      const sale = await db.sale.findUnique({
        where: { id },
        include: {
          items: true,
          customer: true,
        },
      });

      if (!sale) {
        return NextResponse.json(
          { success: false, error: 'Sale not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: sale });
    }

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (invoiceNumber) {
      where.invoiceNumber = invoiceNumber;
    }
    
    if (customerId) {
      where.customerId = customerId;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt = { ...where.createdAt as object, gte: new Date(dateFrom) };
      }
      if (dateTo) {
        where.createdAt = { ...where.createdAt as object, lte: new Date(dateTo) };
      }
    }

    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        include: {
          items: true,
          customer: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.sale.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: sales,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sales' },
      { status: 500 }
    );
  }
}

// POST /api/sales - Create new sale
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, customerId, paymentMethod, discount, tax, notes } = body;

    // Validate items
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No items in sale' },
        { status: 400 }
      );
    }

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: { totalPrice: number }) => sum + item.totalPrice, 0);
    const totalAmount = subtotal - (discount || 0) + (tax || 0);

    // Determine payment status
    let paymentStatus = 'Paid';
    if (paymentMethod === 'Due') {
      paymentStatus = 'Due';
    }

    // Create sale with items in transaction
    const sale = await db.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber: generateInvoiceNumber(),
          customerId: customerId || null,
          subtotal,
          discount: discount || 0,
          tax: tax || 0,
          totalAmount,
          paymentMethod: paymentMethod || 'Cash',
          paymentStatus,
          status: 'Completed',
          notes: notes || null,
          offlineSynced: true,
          items: {
            create: items.map((item: { productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      // Update stock for each item
      for (const item of items as Array<{ productId: string; quantity: number }>) {
        // Find product with locking or latest state in tx
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        if (product.currentStock < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.currentStock}, Requested: ${item.quantity}`);
        }

        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { decrement: item.quantity },
            updatedAt: new Date(),
          },
        });

        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            changeType: 'sale',
            quantity: -item.quantity,
            reason: `Sale: ${newSale.invoiceNumber}`,
            referenceId: newSale.id,
          },
        });
      }

      // If payment is Due, update customer's totalDue
      if (customerId && paymentMethod === 'Due') {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalDue: { increment: totalAmount },
            updatedAt: new Date(),
          },
        });

        // Create ledger entry
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (customer) {
          await tx.ledgerEntry.create({
            data: {
              customerId,
              entryType: 'credit',
              amount: totalAmount,
              balanceAfter: customer.totalDue + totalAmount,
              description: `Credit purchase: ${newSale.invoiceNumber}`,
              referenceId: newSale.id,
            },
          });
        }
      }

      return newSale;
    });

    return NextResponse.json({
      success: true,
      data: sale,
      message: 'Sale completed successfully',
    });
  } catch (error) {
    console.error('Error creating sale:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create sale' },
      { status: 500 }
    );
  }
}

// PUT /api/sales - Update sale (cancel/refund)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, reason } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Sale ID is required' },
        { status: 400 }
      );
    }

    // Get existing sale
    const existingSale = await db.sale.findUnique({
      where: { id },
      include: { items: true, customer: true },
    });

    if (!existingSale) {
      return NextResponse.json(
        { success: false, error: 'Sale not found' },
        { status: 404 }
      );
    }

    if (existingSale.status !== 'Completed') {
      return NextResponse.json(
        { success: false, error: 'Only completed sales can be cancelled or refunded' },
        { status: 400 }
      );
    }

    // Update sale and restore stock
    const sale = await db.$transaction(async (tx) => {
      // Update sale status
      const updatedSale = await tx.sale.update({
        where: { id },
        data: {
          status,
          notes: reason ? `${existingSale.notes || ''}\n${status}: ${reason}` : existingSale.notes,
          updatedAt: new Date(),
        },
        include: { items: true },
      });

      // Restore stock for cancelled/refunded items
      await Promise.all(
        existingSale.items.flatMap((item) => [
          tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: { increment: item.quantity },
              updatedAt: new Date(),
            },
          }),
          tx.stockHistory.create({
            data: {
              productId: item.productId,
              changeType: 'return',
              quantity: item.quantity,
              reason: `${status}: ${existingSale.invoiceNumber}`,
              referenceId: existingSale.id,
            },
          }),
        ])
      );

      // If sale was on Due, update customer's totalDue
      if (existingSale.customerId && existingSale.paymentMethod === 'Due') {
        await tx.customer.update({
          where: { id: existingSale.customerId },
          data: {
            totalDue: { decrement: existingSale.totalAmount },
            updatedAt: new Date(),
          },
        });

        // Create ledger entry
        const customer = await tx.customer.findUnique({
          where: { id: existingSale.customerId },
        });

        if (customer) {
          await tx.ledgerEntry.create({
            data: {
              customerId: existingSale.customerId,
              entryType: 'debit',
              amount: existingSale.totalAmount,
              balanceAfter: customer.totalDue - existingSale.totalAmount,
              description: `${status}: ${existingSale.invoiceNumber}`,
              referenceId: existingSale.id,
            },
          });
        }
      }

      return updatedSale;
    });

    return NextResponse.json({
      success: true,
      data: sale,
      message: `Sale ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error('Error updating sale:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update sale' },
      { status: 500 }
    );
  }
}
