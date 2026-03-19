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

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/sync - Get pending sync items or sync status
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

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

// POST /api/sync - Sync offline data with idempotency guarantee
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // CRITICAL: Extract idempotency key from header
    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    if (!idempotencyKey) {
      return NextResponse.json(
        { success: false, error: 'Missing X-Idempotency-Key header' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { actionType, payload } = body;

    // Validate required fields
    if (!actionType || !payload) {
      return NextResponse.json(
        { success: false, error: 'Missing actionType or payload' },
        { status: 400 }
      );
    }

    // ===================================================================
    // IDEMPOTENCY CHECK: If we've already processed this, return cached result
    // ===================================================================
    const existingSync = await db.syncQueue.findUnique({
      where: { idempotencyKey },
    });

    if (existingSync && existingSync.synced) {
      console.log(`✅ Idempotency hit: returning cached result for ${idempotencyKey}`);
      return NextResponse.json({
        success: true,
        data: existingSync.result,
        cached: true,
        message: 'Result from previous successful sync (idempotency)',
      });
    }

    let result;

    // Route based on action type
    switch (actionType) {
      case 'sale:create': {
        const saleResult = SaleInputSchema.safeParse(payload);
        if (!saleResult.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid Sale payload', details: saleResult.error },
            { status: 400 }
          );
        }
        result = await syncSale(saleResult.data, 'create');
        break;
      }

      case 'customer:create': {
        const customerResult = CustomerInputSchema.safeParse(payload);
        if (!customerResult.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid Customer payload', details: customerResult.error },
            { status: 400 }
          );
        }
        result = await syncCustomer(customerResult.data, 'create');
        break;
      }

      case 'customer:update': {
        const customerResult = CustomerInputSchema.safeParse(payload);
        if (!customerResult.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid Customer payload', details: customerResult.error },
            { status: 400 }
          );
        }
        result = await syncCustomer(customerResult.data, 'update');
        break;
      }

      case 'product:stock:update': {
        const productResult = ProductSyncPayloadSchema.safeParse(payload);
        if (!productResult.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid Product payload', details: productResult.error },
            { status: 400 }
          );
        }
        result = await syncProduct(productResult.data, 'update');
        break;
      }

      case 'product:create': {
        const productResult = ProductInputSchema.safeParse(payload);
        if (!productResult.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid Product payload', details: productResult.error },
            { status: 400 }
          );
        }
        result = await syncProduct(productResult.data, 'create');
        break;
      }

      case 'product:update': {
        const productResult = ProductInputSchema.safeParse(payload);
        if (!productResult.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid Product payload', details: productResult.error },
            { status: 400 }
          );
        }
        result = await syncProduct(productResult.data, 'update');
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action type: ${actionType}` },
          { status: 400 }
        );
    }

    // ===================================================================
    // IDEMPOTENCY STORE: Cache this successful result for future retries
    // ===================================================================
    await db.syncQueue.upsert({
      where: { idempotencyKey },
      update: {
        synced: true,
        syncedAt: new Date(),
        result: JSON.stringify(result),
      },
      create: {
        id: uuidv4(),
        idempotencyKey,
        entityType: actionType,
        action: 'sync',
        payload: JSON.stringify(payload),
        synced: true,
        syncedAt: new Date(),
        retryCount: 0,
        result: JSON.stringify(result),
      },
    });

    console.log(`✅ Successfully synced ${actionType} with idempotency key ${idempotencyKey}`);

    return NextResponse.json({
      success: true,
      data: result,
      message: `${actionType} synced successfully`,
    });
  } catch (error) {
    console.error('Error syncing data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync data',
      },
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
      // VALIDATION PHASE: Check all prerequisites before creating anything
      
      // 1. Validate all products exist and check current stock levels
      const productsToValidate = [];
      for (const item of saleData.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        
        if (!product) {
          throw new Error(`Product ${item.productId} not found during sync validation`);
        }
        
        // Note: During offline sync, we may not have exact stock levels, so we log warnings but allow the sync
        // This prevents losing sales data. Stock discrepancies should be reconciled via inventory management
        if (product.currentStock < item.quantity) {
          console.warn(`Warning: Product ${product.name} has insufficient stock (have: ${product.currentStock}, need: ${item.quantity}) during sync. Sale will be recorded but may cause stock issues.`);
        }
        
        productsToValidate.push({ product, item });
      }

      // 2. Validate customer exists if specified
      if (saleData.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: saleData.customerId },
        });
        
        if (!customer) {
          throw new Error(`Customer ${saleData.customerId} not found during sync validation`);
        }
      }

      // 3. Validate basic sale data
      if (!saleData.items || saleData.items.length === 0) {
        throw new Error('Sale must have at least one item');
      }

      if ((saleData.totalAmount || 0) < 0) {
        throw new Error('Total amount cannot be negative');
      }

      // CREATE PHASE: Now that validation passed, create records
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

      // Update stock for all products
      for (const item of saleData.items) {
        const updateResult = await tx.$executeRaw`
          UPDATE products 
          SET "current_stock" = "current_stock" - ${item.quantity},
              "updated_at" = NOW()
          WHERE id = ${item.productId}
        `;

        if (updateResult === 0) {
          console.warn(`Warning during sync: Could not update stock for product ${item.productId}`);
        }

        // Create stock history for audit trail
        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            changeType: 'sale',
            quantity: -item.quantity,
            reason: `Offline sync sale: ${saleData.invoiceNumber}`,
            referenceId: sale.id,
          },
        });
      }

      // Update customer due if applicable
      const amountPaid = saleData.amountPaid || 0;
      const totalAmount = saleData.totalAmount || 0;

      if (saleData.customerId && amountPaid < totalAmount) {
        const dueAmount = totalAmount - amountPaid;
        
        // Fetch customer BEFORE updating for correct balance calculation
        const customer = await tx.customer.findUnique({
          where: { id: saleData.customerId },
        });

        if (customer) {
          const newTotalDue = customer.totalDue + dueAmount;

          await tx.customer.update({
            where: { id: saleData.customerId },
            data: {
              totalDue: { increment: dueAmount },
              updatedAt: new Date(),
            },
          });

          // Add ledger entries for double-entry bookkeeping tracking
          // Add credit for the total amount
          await tx.ledgerEntry.create({
            data: {
              customerId: saleData.customerId,
              entryType: 'credit',
              amount: totalAmount,
              balanceAfter: newTotalDue,
              description: `Offline sync credit purchase: ${saleData.invoiceNumber}`,
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
                balanceAfter: newTotalDue - amountPaid,
                description: `Offline sync payment for: ${saleData.invoiceNumber}`,
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
async function syncProduct(productData: z.infer<typeof ProductSyncPayloadSchema> | z.infer<typeof ProductInputSchema>, action: string) {
  if (action === 'create') {
    // Create a new product from full product data
    if ('name' in productData && 'category' in productData && 'buyingPrice' in productData && 'sellingPrice' in productData) {
      const { id, barcode, name, nameBn, category, buyingPrice, sellingPrice, unit, currentStock, minStockLevel, isActive } = productData as any;

      // Check if product already exists (prevent duplicates)
      if (id) {
        const existing = await db.product.findUnique({ where: { id } });
        if (existing) {
          return existing;
        }
      }

      return db.product.create({
        data: {
          id,
          barcode: barcode || null,
          name,
          nameBn: nameBn || null,
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

    throw new Error('Invalid product data for create action');
  } else if (action === 'update') {
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
      const { id, barcode, name, nameBn, category, buyingPrice, sellingPrice, unit, currentStock, minStockLevel, isActive } = productData as any;

      if (!id) {
        throw new Error('Product ID is required for upsert sync');
      }

      return db.product.upsert({
        where: { id },
        create: {
          id,
          barcode: barcode || null,
          name,
          nameBn: nameBn || null,
          category,
          buyingPrice,
          sellingPrice,
          unit,
          currentStock,
          minStockLevel,
          isActive,
        },
        update: {
          barcode: barcode || null,
          name,
          nameBn: nameBn || null,
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
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

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
