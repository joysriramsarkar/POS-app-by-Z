// ============================================================================
// Sync API Route - Offline-First Synchronization
// Lakhan Bhandar POS
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

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
      case 'Sale':
        result = await syncSale(parsedPayload, action);
        break;
      case 'Customer':
        result = await syncCustomer(parsedPayload, action);
        break;
      case 'Product':
        result = await syncProduct(parsedPayload, action);
        break;
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
async function syncSale(saleData: Record<string, unknown>, action: string) {
  if (action === 'create') {
    // Check if sale already exists (prevent duplicates)
    const existing = await db.sale.findUnique({
      where: { invoiceNumber: saleData.invoiceNumber as string },
    });

    if (existing) {
      return existing;
    }

    // Create sale with items
    return db.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          id: saleData.id as string,
          invoiceNumber: saleData.invoiceNumber as string,
          customerId: (saleData.customerId as string) || null,
          subtotal: saleData.subtotal as number,
          discount: saleData.discount as number,
          tax: saleData.tax as number,
          totalAmount: saleData.totalAmount as number,
          amountPaid: (saleData.amountPaid as number) || 0,
          paymentMethod: saleData.paymentMethod as string,
          paymentStatus: saleData.paymentStatus as string,
          status: saleData.status as string,
          notes: (saleData.notes as string) || null,
          offlineSynced: true,
          items: {
            create: (saleData.items as Array<Record<string, unknown>>).map((item) => ({
              productId: item.productId as string,
              productName: item.productName as string,
              quantity: item.quantity as number,
              unitPrice: item.unitPrice as number,
              totalPrice: item.totalPrice as number,
            })),
          },
        },
        include: { items: true },
      });

      // Update stock
      for (const item of saleData.items as Array<Record<string, unknown>>) {
        await tx.product.update({
          where: { id: item.productId as string },
          data: {
            currentStock: { decrement: item.quantity as number },
            updatedAt: new Date(),
          },
        });
      }

      // Update customer due if applicable
      const amountPaid = (saleData.amountPaid as number) || 0;
      const totalAmount = saleData.totalAmount as number;

      if (saleData.customerId && amountPaid < totalAmount) {
        const dueAmount = totalAmount - amountPaid;
        await tx.customer.update({
          where: { id: saleData.customerId as string },
          data: {
            totalDue: { increment: dueAmount },
            updatedAt: new Date(),
          },
        });

        // Add ledger entries for double-entry bookkeeping tracking
        const customer = await tx.customer.findUnique({
          where: { id: saleData.customerId as string },
        });

        if (customer) {
          // Add credit for the total amount
          await tx.ledgerEntry.create({
            data: {
              customerId: saleData.customerId as string,
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
                customerId: saleData.customerId as string,
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
async function syncCustomer(customerData: Record<string, unknown>, action: string) {
  if (action === 'create') {
    // Check if customer already exists
    if (customerData.phone) {
      const existing = await db.customer.findUnique({
        where: { phone: customerData.phone as string },
      });

      if (existing) {
        return existing;
      }
    }

    return db.customer.create({
      data: {
        id: customerData.id as string,
        name: customerData.name as string,
        phone: (customerData.phone as string) || null,
        address: (customerData.address as string) || null,
        notes: (customerData.notes as string) || null,
        totalDue: customerData.totalDue as number,
        totalPaid: customerData.totalPaid as number,
        isActive: true,
      },
    });
  }

  if (action === 'update') {
    return db.customer.update({
      where: { id: customerData.id as string },
      data: {
        name: customerData.name as string,
        phone: (customerData.phone as string) || null,
        address: (customerData.address as string) || null,
        notes: (customerData.notes as string) || null,
        totalDue: customerData.totalDue as number,
        totalPaid: customerData.totalPaid as number,
        updatedAt: new Date(),
      },
    });
  }

  throw new Error(`Unknown action: ${action}`);
}

// Sync product updates (primarily stock changes) from offline
async function syncProduct(productData: Record<string, unknown>, action: string) {
  if (action === 'update') {
    const { productId, quantityChange } = productData as any;

    if (typeof productId !== 'string') {
      throw new Error('Invalid productId');
    }

    if (typeof quantityChange === 'number') {
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
    const { id, ...fields } = productData as any;
    return db.product.upsert({
      where: { id },
      create: productData as any,
      update: fields,
    });
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
