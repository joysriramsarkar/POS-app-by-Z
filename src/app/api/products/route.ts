// ============================================================================
// Products API Route - Lakhan Bhandar POS
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Product } from '@/types/pos';

// GET /api/products - Fetch all products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barcode = searchParams.get('barcode');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const cursor = searchParams.get('cursor');
    const limitParam = searchParams.get('limit');

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (!includeInactive) {
      where.isActive = true;
    }
    
    if (barcode) {
      where.barcode = barcode;
    }
    
    if (category) {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameBn: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    const findManyArgs: any = {
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    };

    if (limit) {
      findManyArgs.take = limit + 1; // Fetch one extra to check if there are more
    }

    if (cursor) {
      findManyArgs.cursor = { id: cursor };
      // Note: when using cursor pagination, typically you skip the cursor itself,
      // but if the client sends the last ID they saw, we should skip it.
      findManyArgs.skip = 1;
    }

    const products = await db.product.findMany(findManyArgs);

    let nextCursor: string | undefined = undefined;
    if (limit && products.length > limit) {
      const nextItem = products.pop();
      nextCursor = nextItem?.id;
    }

    return NextResponse.json({
      success: true,
      data: products,
      nextCursor,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST /api/products - Create new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const errors: string[] = [];

    if (!body.name || !String(body.name).trim()) {
      errors.push('Product name is required');
    }

    if (!body.category || !String(body.category).trim()) {
      errors.push('Category is required');
    }

    const buyingPrice = parseFloat(body.buyingPrice);
    if (isNaN(buyingPrice) || buyingPrice < 0) {
      errors.push('Valid buying price is required');
    }

    const sellingPrice = parseFloat(body.sellingPrice);
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      errors.push('Valid selling price is required');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: errors.join(', ') },
        { status: 400 }
      );
    }
    
    const product = await db.product.create({
      data: {
        barcode: body.barcode ? String(body.barcode).trim() : null,
        name: String(body.name).trim(),
        nameBn: body.nameBn ? String(body.nameBn).trim() : null,
        category: String(body.category).trim(),
        buyingPrice: buyingPrice,
        sellingPrice: sellingPrice,
        unit: body.unit || 'piece',
        currentStock: parseFloat(body.currentStock) || 0,
        minStockLevel: parseFloat(body.minStockLevel) || 5,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product created successfully',
    });
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint failed')) {
        return NextResponse.json(
          { success: false, error: 'Barcode already exists for another product' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

// PUT /api/products - Update product
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const product = await db.product.update({
      where: { id },
      data: {
        ...data,
        buyingPrice: data.buyingPrice ? parseFloat(data.buyingPrice) : undefined,
        sellingPrice: data.sellingPrice ? parseFloat(data.sellingPrice) : undefined,
        currentStock: data.currentStock ? parseFloat(data.currentStock) : undefined,
        minStockLevel: data.minStockLevel ? parseFloat(data.minStockLevel) : undefined,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product updated successfully',
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE /api/products - Soft delete product
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    const product = await db.product.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
