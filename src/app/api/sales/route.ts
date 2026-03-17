// ============================================================================
// Sales API Route - Lakhan Bhandar POS
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateServerInvoiceNumber } from '@/lib/invoice';
import { v4 as uuidv4 } from 'uuid';
import { SaleInputSchema } from '@/schemas';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/sales - Fetch sales
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

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
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

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

    // Validate with Zod
    const result = SaleInputSchema.safeParse(body);
    if (!result.success) {
      const errors = Object.values(result.error.flatten().fieldErrors)
        .flat()
        .join(', ');
      return NextResponse.json(
        { success: false, error: errors || 'Validation failed' },
        { status: 400 }
      );
    }

    const validatedData = result.data;
    const { items: validatedItems, customerId, paymentMethod, notes } = validatedData;

    // Calculate totals with validated numeric values
    const subtotal = validatedItems.reduce((sum: number, item: { totalPrice: number }) => sum + item.totalPrice, 0);
    const discountAmount = Math.max(0, validatedData.discount);
    const taxAmount = Math.max(0, validatedData.tax);
    const totalAmount = subtotal - discountAmount + taxAmount;
    const amountPaidValue = Math.max(0, validatedData.amountPaid);

    // Validate payment status based on customer type
    let paymentStatus = 'Paid';
    if (customerId) {
      // For regular customers, can have partial/due payments
      if (amountPaidValue === 0) {
        paymentStatus = 'Due';
      } else if (amountPaidValue > 0 && amountPaidValue < totalAmount) {
        paymentStatus = 'Partial';
      }
    } else {
      // Walk-in customers must pay full amount
      if (amountPaidValue < totalAmount) {
        return NextResponse.json(
          { success: false, error: 'Walk-in customers must pay the full amount' },
          { status: 400 }
        );
      }
      paymentStatus = 'Paid';
    }

    // Generate invoice number (now async, must be done before transaction)
    const invoiceNumber = await generateServerInvoiceNumber();

    // Create sale with items in transaction
    const sale = await db.$transaction(async (tx) => {
      // Create sale with proper Prisma syntax
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
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

      // Validate and update stock for each item BEFORE using customer data
      // First pass: validate all stock is available using raw SQL to ensure atomicity
      const stockCheckResults = await Promise.all(
        validatedItems.map(item =>
          tx.$queryRaw`
            SELECT id, "current_stock" as currentStock, name 
            FROM products 
            WHERE id = ${item.productId} AND "current_stock" >= ${item.quantity}
          ` as Promise<Array<{ id: string; currentStock: number; name: string }>>
        )
      );

      // Check if all items passed stock validation
      for (let i = 0; i < validatedItems.length; i++) {
        const item = validatedItems[i];
        const result = stockCheckResults[i];
        if (!result || result.length === 0) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) {
            throw new Error(`Product ${item.productId} not found`);
          }
          throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.currentStock}, Requested: ${item.quantity}`);
        }
      }

      // Second pass: atomically update stock for all items
      // We must do updates one-by-one to ensure atomic conditional check for each product
      for (const item of validatedItems) {
        // Use raw SQL for atomic conditional update to prevent race conditions
        const updateResult = await tx.$executeRaw`
          UPDATE products 
          SET "current_stock" = "current_stock" - ${item.quantity},
              "updated_at" = NOW()
          WHERE id = ${item.productId} AND "current_stock" >= ${item.quantity}
        `;

        if (updateResult === 0) {
          // This should not happen as we validated above, but just in case
          throw new Error(`Atomic stock update failed for product ${item.productId}. Another transaction may have depleted stock.`);
        }
      }

      // Third pass: Create all stock history entries in a single batch to minimize round-trips
      await tx.stockHistory.createMany({
        data: validatedItems.map((item) => ({
          productId: item.productId,
          changeType: 'sale',
          quantity: -item.quantity,
          reason: `Sale: ${newSale.invoiceNumber}`,
          referenceId: newSale.id,
        })),
      });

      // Handle due, prepaid, and full payments for customers
      if (customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new Error(`Customer ${customerId} not found`);
        }
        
        const prepaidToUse = validatedData.prepaidAmountUsed || 0;

        // 1. Handle Prepaid Balance Deduction
        if (prepaidToUse > 0) {
          if (customer.prepaidBalance < prepaidToUse) {
            throw new Error(`Insufficient prepaid balance. Available: ${customer.prepaidBalance}, Tried to use: ${prepaidToUse}`);
          }
          
          const newPrepaidBalance = customer.prepaidBalance - prepaidToUse;

          await tx.customer.update({
            where: { id: customerId },
            data: { 
              prepaidBalance: newPrepaidBalance,
              updatedAt: new Date(),
            },
          });

          await tx.ledgerEntry.create({
            data: {
              customerId,
              entryType: 'prepayment-used',
              amount: prepaidToUse,
              balanceAfter: customer.totalDue, // This doesn't affect the due balance directly
              description: `Prepaid used for sale: ${newSale.invoiceNumber}`,
              referenceId: newSale.id,
            },
          });
        }

        // 2. Handle Due Amount Calculation
        const remainingAmountAfterPrepaid = totalAmount - prepaidToUse;
        const dueAmount = remainingAmountAfterPrepaid - amountPaidValue;

        if (dueAmount > 0) {
          const newTotalDue = customer.totalDue + dueAmount;
          await tx.customer.update({
            where: { id: customerId },
            data: {
              totalDue: { increment: dueAmount },
              updatedAt: new Date(),
            },
          });

          // Create ledger entry for the credit (the sale itself)
          await tx.ledgerEntry.create({
            data: {
              customerId,
              entryType: 'credit',
              amount: totalAmount, // The full sale amount is the credit
              balanceAfter: newTotalDue,
              description: `Credit purchase: ${newSale.invoiceNumber}`,
              referenceId: newSale.id,
            },
          });
          
          // Create ledger entry for the part paid by cash/other methods
          if (amountPaidValue > 0) {
            await tx.ledgerEntry.create({
              data: {
                customerId,
                entryType: 'debit',
                amount: amountPaidValue,
                balanceAfter: newTotalDue - amountPaidValue,
                description: `Partial payment for: ${newSale.invoiceNumber}`,
                referenceId: newSale.id,
              },
            });
          }
        } else {
            // Paid in full (or overpaid) with cash/other methods after using prepaid
            // No new due is created, so we only log the payment.
            await tx.ledgerEntry.create({
                data: {
                    customerId,
                    entryType: 'debit',
                    amount: totalAmount, // Log the entire sale value as a debit against the credit of the sale.
                    balanceAfter: customer.totalDue, // No change in due balance
                    description: `Full payment for sale: ${newSale.invoiceNumber}`,
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
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

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
        
        // Fetch customer BEFORE updating to get current balance
        const customer = await tx.customer.findUnique({
          where: { id: existingSale.customerId },
        });

        if (!customer) {
          throw new Error(`Customer ${existingSale.customerId} not found`);
        }

        // Calculate expected balance AFTER the decrement
        const newTotalDue = customer.totalDue - dueAmount;

        // Now update totalDue
        await tx.customer.update({
          where: { id: existingSale.customerId },
          data: {
            totalDue: { decrement: dueAmount },
            updatedAt: new Date(),
          },
        });

        // Create ledger entries using calculated values (not stale data)
        // Add debit for the total amount
        await tx.ledgerEntry.create({
          data: {
            customerId: existingSale.customerId,
            entryType: 'debit',
            amount: existingSale.totalAmount,
            balanceAfter: newTotalDue,
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
              balanceAfter: newTotalDue + existingSale.amountPaid,
              description: `${status}: reverse payment for ${existingSale.invoiceNumber}`,
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
