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
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body: JSON parsing failed' },
        { status: 400 }
      );
    }

    const { items, customerId, paymentMethod, amountPaid, discount, tax, notes } = body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Items must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate and convert item structure - ensure all numeric values are actual numbers
    const validatedItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId || !item.productName) {
        return NextResponse.json(
          { success: false, error: `Invalid item at index ${i}: missing productId or productName` },
          { status: 400 }
        );
      }

      const quantity = parseFloat(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      const totalPrice = parseFloat(item.totalPrice);

      if (isNaN(quantity) || isNaN(unitPrice) || isNaN(totalPrice)) {
        return NextResponse.json(
          { success: false, error: `Invalid numeric values for item at index ${i}` },
          { status: 400 }
        );
      }

      if (quantity <= 0 || unitPrice < 0 || totalPrice < 0) {
        return NextResponse.json(
          { success: false, error: `Invalid item values at index ${i}: quantity must be > 0, prices must be >= 0` },
          { status: 400 }
        );
      }

      validatedItems.push({
        productId: item.productId,
        productName: item.productName,
        quantity,
        unitPrice,
        totalPrice,
      });
    }

    // Calculate totals with validated numeric values
    const subtotal = validatedItems.reduce((sum: number, item: { totalPrice: number }) => sum + item.totalPrice, 0);
    const discountAmount = Math.max(0, parseFloat(discount as any) || 0);
    const taxAmount = Math.max(0, parseFloat(tax as any) || 0);
    const totalAmount = subtotal - discountAmount + taxAmount;
    const amountPaidValue = Math.max(0, parseFloat(amountPaid as any) || 0);

    // Determine payment status
    let paymentStatus = 'Paid';
    if (amountPaidValue === 0) {
      paymentStatus = 'Due';
    } else if (amountPaidValue > 0 && amountPaidValue < totalAmount) {
      paymentStatus = 'Partial';
    }

    // Create sale with items in transaction
    const sale = await db.$transaction(async (tx) => {
      // Create sale with proper Prisma syntax
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber: generateInvoiceNumber(),
          subtotal,
          discount: discountAmount,
          tax: taxAmount,
          totalAmount,
          amountPaid: amountPaidValue,
          paymentMethod: paymentMethod || 'Cash',
          paymentStatus,
          status: 'Completed',
          notes: notes || null,
          offlineSynced: true,
          items: {
            create: validatedItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
          ...(customerId && {
            customer: {
              connect: { id: customerId },
            },
          }),
        },
        include: {
          items: true,
          customer: true,
        },
      });

      // Update stock for each item
      for (const item of validatedItems) {
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

      // If payment is partially or fully due, update customer's totalDue
      if (customerId && amountPaidValue < totalAmount) {
        const dueAmount = totalAmount - amountPaidValue;
        
        // Verify customer exists before updating
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new Error(`Customer ${customerId} not found`);
        }

        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalDue: { increment: dueAmount },
            updatedAt: new Date(),
          },
        });

        // Create ledger entry
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

        // Add debit for the amount paid if partial payment
        if (amountPaidValue > 0) {
          await tx.ledgerEntry.create({
            data: {
              customerId,
              entryType: 'debit',
              amount: amountPaidValue,
              balanceAfter: customer.totalDue + totalAmount - amountPaidValue,
              description: `Payment for purchase: ${newSale.invoiceNumber}`,
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
    
    // Extract meaningful error message
    let errorMessage = 'Failed to create sale';
    let statusCode = 500;
    
    if (error instanceof Error) {
      // Check for specific error patterns
      if (error.message.includes('Insufficient stock')) {
        errorMessage = error.message;
        statusCode = 400;
      } else if (error.message.includes('not found')) {
        errorMessage = error.message;
        statusCode = 404;
      } else if (error.message.includes('No items')) {
        errorMessage = error.message;
        statusCode = 400;
      } else {
        // For Prisma errors and others, try to extract meaningful message
        errorMessage = error.message || 'Failed to create sale';
      }
    }
    
    console.error('Sale creation error details:', {
      message: errorMessage,
      originalError: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
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

      // If sale was partially or fully due, reverse customer's totalDue update
      if (existingSale.customerId && existingSale.amountPaid < existingSale.totalAmount) {
        const dueAmount = existingSale.totalAmount - existingSale.amountPaid;
        await tx.customer.update({
          where: { id: existingSale.customerId },
          data: {
            totalDue: { decrement: dueAmount },
            updatedAt: new Date(),
          },
        });

        // Create ledger entry
        const customer = await tx.customer.findUnique({
          where: { id: existingSale.customerId },
        });

        if (customer) {
          // Add debit for the total amount
          await tx.ledgerEntry.create({
            data: {
              customerId: existingSale.customerId,
              entryType: 'debit',
              amount: existingSale.totalAmount,
              balanceAfter: customer.totalDue - existingSale.totalAmount,
              description: `${status}: reverse credit for ${existingSale.invoiceNumber}`,
              referenceId: existingSale.id,
            },
          });

          // Add credit for the amount paid if partial payment
          if (existingSale.amountPaid > 0) {
            await tx.ledgerEntry.create({
              data: {
                customerId: existingSale.customerId,
                entryType: 'credit',
                amount: existingSale.amountPaid,
                balanceAfter: customer.totalDue - existingSale.totalAmount + existingSale.amountPaid,
                description: `${status}: reverse payment for ${existingSale.invoiceNumber}`,
                referenceId: existingSale.id,
              },
            });
          }
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
