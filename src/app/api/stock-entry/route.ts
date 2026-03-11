// ============================================================================
// Stock Entry API - Handle purchase/stock additions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface StockEntryRequest {
  productId: string;
  quantity: number;
  purchasePrice: number;
  date?: string;
  supplierId?: string;
  notes?: string;
}

// POST /api/stock-entry - Create stock entry (purchase)
export async function POST(request: NextRequest) {
  try {
    const body: StockEntryRequest = await request.json();
    const { productId, quantity, purchasePrice, date, supplierId, notes } = body;

    // Validate input
    if (!productId || !quantity || quantity <= 0 || purchasePrice == null) {
      return NextResponse.json(
        { success: false, error: 'Invalid stock entry data' },
        { status: 400 }
      );
    }

    // Update stock in transaction
    const result = await db.$transaction(async (tx) => {
      // Verify product exists
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Increment stock
      // build update data dynamically so we only touch buyingPrice when provided
      const updateData: any = {
        currentStock: { increment: quantity },
        updatedAt: new Date(),
      };

      if (purchasePrice !== undefined && purchasePrice !== null) {
        if (purchasePrice !== product.buyingPrice) {
          updateData.buyingPrice = purchasePrice;
        }
      }

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: updateData,
      });

      // Create StockHistory record for audit trail
      await tx.stockHistory.create({
        data: {
          productId,
          changeType: 'purchase',
          quantity, // Positive number for addition
          reason: notes || `Stock purchase: ${quantity} units @ ₹${purchasePrice}`,
          referenceId: undefined, // Could link to Purchase ID if needed
        },
      });

      // Optionally create Purchase record if supplierId provided
      if (supplierId) {
        const purchase = await tx.purchase.create({
          data: {
            supplierId,
            invoiceNumber: `PUR-${Date.now()}`,
            totalAmount: quantity * purchasePrice,
            paymentStatus: 'Paid',
            notes,
            items: {
              create: {
                productId,
                productName: product.name,
                quantity,
                buyingPrice: purchasePrice,
                totalPrice: quantity * purchasePrice,
              },
            },
          },
          include: { items: true },
        });

        // Update StockHistory to link to Purchase
        await tx.stockHistory.updateMany({
          where: {
            productId,
            changeType: 'purchase',
            createdAt: {
              gte: new Date(Date.now() - 1000), // Within last second
            },
          },
          data: {
            referenceId: purchase.id,
          },
        });
      }

      return updatedProduct;
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Stock updated: ${quantity} units added to ${result.name}`,
    });
  } catch (error) {
    console.error('Error creating stock entry:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create stock entry' 
      },
      { status: 500 }
    );
  }
}
