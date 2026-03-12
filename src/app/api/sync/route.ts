// ============================================================================
// Sync API Route - Offline-First Synchronization
// Lakhan Bhandar POS
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { ProductInputSchema, SaleInputSchema, CustomerInputSchema } from '@/schemas';

const ProductSyncPayloadSchema = z.union([
  ProductInputSchema,
  z.object({
    productId: z.string(),
    quantityChange: z.number(),
  }),
]);

// GET /api/sync - Get pending sync items or sync status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'status') {
      // Return sync status
      const [pendingCount, lastSync] = await Promise.all([
        db.syncQueue.count({ where: { synced: false } }),
        db.syncQueue.findFirst({
          where: { synced: true },
          orderBy: { syncedAt: 'desc' },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          pendingCount,
          lastSyncTime: lastSync?.syncedAt || null,
        },
      });
    }

    // Return all pending sync items
    const pendingItems = await db.syncQueue.findMany({
      where: { synced: false },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: pendingItems,
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}

// POST /api/sync - Sync offline data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entityType, entityId, action, payload } = body;

    // Validate required fields
    if (!entityType || !entityId || !action || !payload) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const parsedPayload = JSON.parse(payload);
    let result;

    switch (entityType) {
      case 'Sale': {
        const saleResult = SaleInputSchema.safeParse(parsedPayload);
        if (!saleResult.success) {
          return NextResponse.json({ success: false, error: 'Invalid Sale payload' }, { status: 400 });
        }
        result = await syncSale(saleResult.data, action);
        break;
      }
      case 'Customer': {
        const customerResult = CustomerInputSchema.safeParse(parsedPayload);
        if (!customerResult.success) {
          return NextResponse.json({ success: false, error: 'Invalid Customer payload' }, { status: 400 });
        }
        result = await syncCustomer(customerResult.data, action);
        break;
      }
      case 'Product': {
        const productResult = ProductSyncPayloadSchema.safeParse(parsedPayload);
        if (!productResult.success) {
          return NextResponse.json({ success: false, error: 'Invalid Product payload' }, { status: 400 });
        }
        result = await syncProduct(productResult.data, action);
        break;
      }
      default:
        return NextResponse.json(
          { success: false, error: 'Unknown entity type' },
          { status: 400 }
        );
    }

    // Log sync success
    await db.syncQueue.create({
      data: {
        id: uuidv4(),
        entityType,
        entityId,
        action,
        payload,
        synced: true,
        syncedAt: new Date(),
        retryCount: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `${entityType} synced successfully`,
    });
  } catch (error) {
    console.error('Error syncing data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync data' },
      { status: 500 }
    );
  }
}

// Sync sale from offline
async function syncSale(saleData: z.infer<typeof SaleInputSchema>, action: string) {
  if (action === 'create') {
    if (!saleData.invoiceNumber) {
      throw new Error('Invoice number is required for sync');
    }
    // Check if sale already exists (prevent duplicates)
    const existing = await db.sale.findUnique({
      where: { invoiceNumber: saleData.invoiceNumber },
    });

    if (existing) {
      return existing;
    }

    // Create sale with items
    return db.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          id: saleData.id,
          invoiceNumber: saleData.invoiceNumber as string,
          customerId: saleData.customerId || null,
          subtotal: saleData.subtotal || 0,
          discount: saleData.discount || 0,
          tax: saleData.tax || 0,
          totalAmount: saleData.totalAmount || 0,
          amountPaid: saleData.amountPaid || 0,
          paymentMethod: saleData.paymentMethod || 'Cash',
          paymentStatus: saleData.paymentStatus || 'Paid',
          status: saleData.status || 'Completed',
          notes: saleData.notes || null,
          offlineSynced: true,
          items: {
            create: saleData.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: { items: true },
      });

      // Update stock
      for (const item of saleData.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { decrement: item.quantity },
            updatedAt: new Date(),
          },
        });
      }

      // Update customer due if applicable
      const amountPaid = saleData.amountPaid || 0;
      const totalAmount = saleData.totalAmount || 0;

      if (saleData.customerId && amountPaid < totalAmount) {
        const dueAmount = totalAmount - amountPaid;
        await tx.customer.update({
          where: { id: saleData.customerId },
          data: {
            totalDue: { increment: dueAmount },
            updatedAt: new Date(),
          },
        });

        // Add ledger entries for double-entry bookkeeping tracking
        const customer = await tx.customer.findUnique({
          where: { id: saleData.customerId },
        });

        if (customer) {
          // Add credit for the total amount
          await tx.ledgerEntry.create({
            data: {
              customerId: saleData.customerId,
              entryType: 'credit',
              amount: totalAmount,
              balanceAfter: customer.totalDue + totalAmount,
              description: `Credit purchase: ${saleData.invoiceNumber}`,
              referenceId: sale.id,
            },
          });

          // Add debit for the amount paid if partial payment
          if (amountPaid > 0) {
            await tx.ledgerEntry.create({
              data: {
                customerId: saleData.customerId,
                entryType: 'debit',
                amount: amountPaid,
                balanceAfter: customer.totalDue + totalAmount - amountPaid,
                description: `Payment for purchase: ${saleData.invoiceNumber}`,
                referenceId: sale.id,
              },
            });
          }
        }
      }

      return sale;
    });
  }

  throw new Error(`Unknown action: ${action}`);
}

// Sync customer from offline
async function syncCustomer(customerData: z.infer<typeof CustomerInputSchema>, action: string) {
  if (action === 'create') {
    // Check if customer already exists
    if (customerData.phone) {
      const existing = await db.customer.findUnique({
        where: { phone: customerData.phone },
      });

      if (existing) {
        return existing;
      }
    }

    return db.customer.create({
      data: {
        id: customerData.id,
        name: customerData.name,
        phone: customerData.phone || null,
        address: customerData.address || null,
        notes: customerData.notes || null,
        totalDue: customerData.totalDue || 0,
        totalPaid: customerData.totalPaid || 0,
        isActive: true,
      },
    });
  }

  if (action === 'update') {
    if (!customerData.id) {
      throw new Error('Customer ID is required for update');
    }
    return db.customer.update({
      where: { id: customerData.id },
      data: {
        name: customerData.name,
        phone: customerData.phone || null,
        address: customerData.address || null,
        notes: customerData.notes || null,
        totalDue: customerData.totalDue || 0,
        totalPaid: customerData.totalPaid || 0,
        updatedAt: new Date(),
      },
    });
  }

  throw new Error(`Unknown action: ${action}`);
}

// Sync product updates (primarily stock changes) from offline
async function syncProduct(productData: z.infer<typeof ProductSyncPayloadSchema>, action: string) {
  if (action === 'update') {
    if ('productId' in productData && 'quantityChange' in productData) {
      const { productId, quantityChange } = productData;

      return db.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id: productId },
          data: {
            currentStock: { increment: quantityChange },
            updatedAt: new Date(),
          },
        });

        await tx.stockHistory.create({
          data: {
            productId,
            changeType: quantityChange > 0 ? 'purchase' : 'sale',
            quantity: quantityChange,
            reason: 'Offline sync',
          },
        });

        return updated;
      });
    }

    // fallback to upsert entire object if no quantityChange provided
    if ('name' in productData && 'category' in productData && 'buyingPrice' in productData && 'sellingPrice' in productData) {
      if (!productData.id) {
        throw new Error('Product ID is required for upsert sync');
      }

      const { id, barcode, name, nameBn, category, buyingPrice, sellingPrice, unit, currentStock, minStockLevel, isActive } = productData;

      return db.product.upsert({
        where: { id },
        create: {
          id,
          barcode,
          name,
          nameBn,
          category,
          buyingPrice,
          sellingPrice,
          unit,
          currentStock,
          minStockLevel,
          isActive,
        },
        update: {
          barcode,
          name,
          nameBn,
          category,
          buyingPrice,
          sellingPrice,
          unit,
          currentStock,
          minStockLevel,
          isActive,
        },
      });
    }

    throw new Error('Invalid product data payload');
  }

  throw new Error(`Unknown action: ${action}`);
}

// PUT /api/sync - Mark sync item as complete
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, error } = body;

    if (error) {
      // Log sync error
      await db.syncQueue.update({
        where: { id },
        data: {
          retryCount: { increment: 1 },
          error,
        },
      });
    } else {
      // Mark as synced
      await db.syncQueue.update({
        where: { id },
        data: {
          synced: true,
          syncedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error updating sync status:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update sync status' },
      { status: 500 }
    );
  }
}
