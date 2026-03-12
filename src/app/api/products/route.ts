// ============================================================================
// Products API Route - Lakhan Bhandar POS
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Product } from '@/types/pos';
import { ProductInputSchema } from '@/schemas';

// GET /api/products - Fetch all products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barcode = searchParams.get('barcode');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';

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

    const products = await db.product.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      data: products,
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

    // Validate with Zod
    const result = ProductInputSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }
    
    const validatedData = result.data;

    const product = await db.product.create({
      data: {
        barcode: validatedData.barcode ? String(validatedData.barcode).trim() : null,
        name: String(validatedData.name).trim(),
        nameBn: validatedData.nameBn ? String(validatedData.nameBn).trim() : null,
        category: String(validatedData.category).trim(),
        buyingPrice: validatedData.buyingPrice,
        sellingPrice: validatedData.sellingPrice,
        unit: validatedData.unit,
        currentStock: validatedData.currentStock,
        minStockLevel: validatedData.minStockLevel,
        isActive: validatedData.isActive,
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

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const result = ProductInputSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.errors.map(e => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { id, ...validatedData } = result.data;

    const product = await db.product.update({
      where: { id: body.id },
      data: {
        barcode: validatedData.barcode !== undefined ? (validatedData.barcode ? String(validatedData.barcode).trim() : null) : undefined,
        name: validatedData.name !== undefined ? String(validatedData.name).trim() : undefined,
        nameBn: validatedData.nameBn !== undefined ? (validatedData.nameBn ? String(validatedData.nameBn).trim() : null) : undefined,
        category: validatedData.category !== undefined ? String(validatedData.category).trim() : undefined,
        buyingPrice: validatedData.buyingPrice,
        sellingPrice: validatedData.sellingPrice,
        unit: validatedData.unit,
        currentStock: validatedData.currentStock,
        minStockLevel: validatedData.minStockLevel,
        isActive: validatedData.isActive,
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
