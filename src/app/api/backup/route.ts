import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { requireAdmin } from "../users/route";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await requireAdmin(session))) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Fetch all table data
    const [
      products,
      categories,
      stockHistory,
      customers,
      ledgerEntries,
      sales,
      saleItems,
      suppliers,
      purchases,
      purchaseItems,
      settings,
      users
    ] = await Promise.all([
      db.product.findMany(),
      db.category.findMany(),
      db.stockHistory.findMany(),
      db.customer.findMany(),
      db.ledgerEntry.findMany(),
      db.sale.findMany(),
      db.saleItem.findMany(),
      db.supplier.findMany(),
      db.purchase.findMany(),
      db.purchaseItem.findMany(),
      db.setting.findMany(),
      db.user.findMany()
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      data: {
        products,
        categories,
        stockHistory,
        customers,
        ledgerEntries,
        sales,
        saleItems,
        suppliers,
        purchases,
        purchaseItems,
        settings,
        users
      }
    };

    return NextResponse.json(backupData);
  } catch (error: any) {
    console.error("Error creating backup:", error);
    return NextResponse.json(
      { error: "Failed to create backup", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await requireAdmin(session))) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    let backupData;
    try {
      backupData = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON backup file" }, { status: 400 });
    }

    if (!backupData || !backupData.data) {
      return NextResponse.json({ error: "Invalid backup format" }, { status: 400 });
    }

    const {
      products = [],
      categories = [],
      stockHistory = [],
      customers = [],
      ledgerEntries = [],
      sales = [],
      saleItems = [],
      suppliers = [],
      purchases = [],
      purchaseItems = [],
      settings = [],
      users = []
    } = backupData.data;

    // Use interactive transaction to sequentially clear and restore data to avoid foreign key issues
    await db.$transaction(async (tx) => {
      // CLEAR EVERYTHING first (order matters for foreign keys)
      await tx.saleItem.deleteMany();
      await tx.purchaseItem.deleteMany();
      await tx.stockHistory.deleteMany();
      await tx.ledgerEntry.deleteMany();
      await tx.sale.deleteMany();
      await tx.purchase.deleteMany();
      await tx.product.deleteMany();
      await tx.category.deleteMany();
      await tx.customer.deleteMany();
      await tx.supplier.deleteMany();
      await tx.setting.deleteMany();
      // Keep users to prevent locking out the admin, unless we specifically want to replace them
      // In a real scenario we might skip deleting users or ensure the current user isn't deleted.
      // Let's delete all users EXCEPT the currently logged in user just in case?
      // Actually, since they are uploading a full backup, let's just clear and restore users as well.
      // But we risk locking them out if they import a DB with a different password.
      await tx.user.deleteMany();

      // RESTORE EVERYTHING (order matters for foreign keys)
      if (users.length > 0) await tx.user.createMany({ data: users });
      if (settings.length > 0) await tx.setting.createMany({ data: settings });
      if (categories.length > 0) await tx.category.createMany({ data: categories });
      if (products.length > 0) await tx.product.createMany({ data: products });
      if (customers.length > 0) await tx.customer.createMany({ data: customers });
      if (suppliers.length > 0) await tx.supplier.createMany({ data: suppliers });
      if (sales.length > 0) await tx.sale.createMany({ data: sales });
      if (saleItems.length > 0) await tx.saleItem.createMany({ data: saleItems });
      if (purchases.length > 0) await tx.purchase.createMany({ data: purchases });
      if (purchaseItems.length > 0) await tx.purchaseItem.createMany({ data: purchaseItems });
      if (ledgerEntries.length > 0) await tx.ledgerEntry.createMany({ data: ledgerEntries });
      if (stockHistory.length > 0) await tx.stockHistory.createMany({ data: stockHistory });
    });

    return NextResponse.json({ success: true, message: "Database restored successfully" });
  } catch (error: any) {
    console.error("Error restoring backup:", error);
    return NextResponse.json(
      { error: "Failed to restore database", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
