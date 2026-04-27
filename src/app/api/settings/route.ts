export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/api-middleware";

export async function GET(request: NextRequest) {
  try {
    const authError = await requirePermission(request, "settings.view");
    if (authError) return authError;

    const settings = await db.setting.findMany();

    // Convert array of key-value pairs into an object
    const settingsObject = settings.reduce((acc: Record<string, string>, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    return NextResponse.json({ success: true, data: settingsObject });
  } catch (error: unknown) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch settings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authError = await requirePermission(request, "settings.edit");
    if (authError) return authError;

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    const entries = Object.entries(body);
    if (entries.length > 0) {
      const keys: string[] = [];
      const values: string[] = [];

      for (const [key, value] of entries) {
        keys.push(key);
        values.push(typeof value === "string" ? value : String(value));
      }

      await db.$transaction(async (tx) => {
        // Find existing keys to determine updates vs inserts
        const existingSettings = await tx.setting.findMany({
          where: { key: { in: keys } },
          select: { key: true }
        });
        const existingKeys = new Set(existingSettings.map((s: any) => s.key));

        const toCreate: { key: string, value: string }[] = [];

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const value = values[i];
          if (existingKeys.has(key)) {
            // Update individual existing settings. Prisma does not have an updateMany for different values.
            // Using individual updates inside an interactive transaction is safe.
            await tx.setting.update({
              where: { key },
              data: { value }
            });
          } else {
            toCreate.push({ key, value });
          }
        }

        // Batch insert new settings
        if (toCreate.length > 0) {
          await tx.setting.createMany({ data: toCreate });
        }
      });
    }

    return NextResponse.json({ success: true, message: "Settings updated successfully" });
  } catch (error: unknown) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      {
        error: "Failed to update settings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
