import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Try to query the database
    const result = await db.$queryRaw`SELECT 1 as connection_test`;

    return Response.json(
      {
        status: "ok",
        database: "connected",
        timestamp: new Date(),
        environment: process.env.NODE_ENV,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return Response.json(
      {
        status: "error",
        database: "failed",
        error: (error instanceof Error ? error.message : "Unknown error"),
        timestamp: new Date(),
      },
      { status: 500 },
    );
  }
}
