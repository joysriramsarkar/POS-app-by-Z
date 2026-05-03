import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requirePermission, getAuthenticatedUser } from "@/lib/api-middleware";
import { logAudit } from "@/lib/audit";

const getIp = (req: NextRequest) => req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
import { toMoneyNumber } from "@/lib/money";

export async function GET(request: NextRequest) {
  const authError = await requirePermission(request, "expenses.view");
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      const toDate = dateTo ? new Date(dateTo) : undefined;
      if (toDate && !dateTo?.includes('T')) toDate.setHours(23, 59, 59, 999);
      where.date = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      include: { supplier: { select: { id: true, name: true } } },
    });
    const data = expenses.map(e => ({
      ...e,
      supplierName: e.supplier?.name ?? e.supplierName ?? null,
    }));
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch expenses" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requirePermission(request, "expenses.create");
  if (authError) return authError;

  try {
    const body = await request.json();
    const { amount, category, notes, date, supplierId, supplierName } = body;

    if (!amount || !category) {
      return NextResponse.json(
        { success: false, error: "Amount and category are required" },
        { status: 400 },
      );
    }

    const convertBengaliToEnglishNumerals = (input: string) => {
      const map: Record<string, string> = { "০":"0","১":"1","২":"2","৩":"3","৪":"4","৫":"5","৬":"6","৭":"7","৮":"8","৯":"9" };
      return input.replace(/[০-৯]/g, (m) => map[m] || m);
    };

    let parsedDate = new Date();
    if (date) {
      const normalized = convertBengaliToEnglishNumerals(date);
      const ddmm = normalized.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
      if (ddmm) {
        parsedDate = new Date(`${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`);
      } else {
        const d = new Date(normalized);
        if (!isNaN(d.getTime())) parsedDate = d;
      }
    }

    const expense = await prisma.expense.create({
      data: {
        amount: toMoneyNumber(amount),
        category,
        notes,
        date: parsedDate,
        supplierId: supplierId || null,
        supplierName: supplierName || null,
      },
    });

    const user = await getAuthenticatedUser(request);
    await logAudit({ userId: (user as any)?.id, action: 'CREATE_EXPENSE', entityType: 'Expense', entityId: expense.id, details: { amount: expense.amount, category: expense.category, notes: expense.notes }, ipAddress: getIp(request) });
    return NextResponse.json({ success: true, data: expense });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Failed to create expense" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requirePermission(request, "expenses.delete");
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID is required" },
        { status: 400 },
      );
    }

    await prisma.expense.delete({ where: { id } });
    const user2 = await getAuthenticatedUser(request);
    await logAudit({ userId: (user2 as any)?.id, action: 'DELETE_EXPENSE', entityType: 'Expense', entityId: id, ipAddress: getIp(request) });
    return NextResponse.json({ success: true, message: "Expense deleted" });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Failed to delete expense" },
      { status: 500 },
    );
  }
}



