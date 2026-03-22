import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    // We'll update or insert all keys provided in the request body
    const updatePromises = Object.entries(body).map(([key, value]) => {
      const stringValue = typeof value === "string" ? value : String(value);
      return db.setting.upsert({
        where: { key },
        update: { value: stringValue },
        create: { key, value: stringValue },
      });
    });

    await db.$transaction(updatePromises);

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
