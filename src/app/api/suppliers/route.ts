export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, getAuthenticatedUser } from '@/lib/api-middleware';
import { logAudit } from '@/lib/audit';

const getIp = (req: NextRequest) => req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;

export async function GET(request: NextRequest) {
  const authError = await requirePermission(request, 'suppliers.view');
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (id) {
      const supplier = await db.supplier.findUnique({
        where: { id },
        include: { purchases: { take: 10, orderBy: { createdAt: 'desc' } } },
      });
      if (!supplier) return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: supplier });
    }

    const where: Record<string, unknown> = {};
    if (!includeInactive) where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const suppliers = await db.supplier.findMany({
      where,
      include: { _count: { select: { purchases: true } } },
      orderBy: [{ name: 'asc' }],
    });

    return NextResponse.json({ success: true, data: suppliers });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requirePermission(request, 'suppliers.create');
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, phone, address, email, gstNumber, notes } = body;

    if (!name) return NextResponse.json({ success: false, error: 'Supplier name is required' }, { status: 400 });

    const supplier = await db.supplier.create({
      data: { name, phone: phone || null, address: address || null, email: email || null, gstNumber: gstNumber || null, notes: notes || null, isActive: true },
    });

    const user = await getAuthenticatedUser(request);
    await logAudit({ userId: (user as any)?.id, action: 'CREATE_SUPPLIER', entityType: 'Supplier', entityId: supplier.id, details: { name: supplier.name }, ipAddress: getIp(request) });

    return NextResponse.json({ success: true, data: supplier, message: 'Supplier created successfully' });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json({ success: false, error: 'Failed to create supplier' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authError = await requirePermission(request, 'suppliers.edit');
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) return NextResponse.json({ success: false, error: 'Supplier ID is required' }, { status: 400 });

    const supplier = await db.supplier.update({ where: { id }, data: { ...data, updatedAt: new Date() } });

    const user = await getAuthenticatedUser(request);
    await logAudit({ userId: (user as any)?.id, action: 'UPDATE_SUPPLIER', entityType: 'Supplier', entityId: supplier.id, details: { name: supplier.name }, ipAddress: getIp(request) });

    return NextResponse.json({ success: true, data: supplier, message: 'Supplier updated successfully' });
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json({ success: false, error: 'Failed to update supplier' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requirePermission(request, 'suppliers.delete');
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, error: 'Supplier ID is required' }, { status: 400 });

    await db.supplier.update({ where: { id }, data: { isActive: false, updatedAt: new Date() } });

    const user = await getAuthenticatedUser(request);
    await logAudit({ userId: (user as any)?.id, action: 'DELETE_SUPPLIER', entityType: 'Supplier', entityId: id, ipAddress: getIp(request) });

    return NextResponse.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete supplier' }, { status: 500 });
  }
}
