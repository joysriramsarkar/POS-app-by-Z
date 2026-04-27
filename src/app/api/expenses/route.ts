import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { date: "desc" },
      take: 100,
    });
    return NextResponse.json({ success: true, data: expenses });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch expenses" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { amount, category, notes, date } = body;

    if (!amount || !category) {
      return NextResponse.json(
        { success: false, error: "Amount and category are required" },
        { status: 400 },
      );
    }

    // Handle invalid dates (like those submitted in Bengali localized formats like DD/MM/YYYY)
    let parsedDate = new Date();
    if (date) {
      // First normalize the date string if it contains Bengali numerals
      const convertBengaliToEnglishNumerals = (input: string) => {
        const bengaliToEnglish: { [key: string]: string } = {
          "০": "0",
          "১": "1",
          "২": "2",
          "৩": "3",
          "৪": "4",
          "৫": "5",
          "৬": "6",
          "৭": "7",
          "৮": "8",
          "৯": "9",
        };
        return input.replace(
          /[০-৯]/g,
          (match) => bengaliToEnglish[match] || match,
        );
      };

      const normalizedDateStr = convertBengaliToEnglishNumerals(date);

      // If the date looks like DD/MM/YYYY, convert to YYYY-MM-DD
      const ddmmyyyyMatch = normalizedDateStr.match(
        /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/,
      );
      if (ddmmyyyyMatch) {
        parsedDate = new Date(
          `${ddmmyyyyMatch[3]}-${ddmmyyyyMatch[2]}-${ddmmyyyyMatch[1]}`,
        );
      } else {
        const attemptedDate = new Date(normalizedDateStr);
        if (!isNaN(attemptedDate.getTime())) {
          parsedDate = attemptedDate;
        }
      }
    }

    const expense = await prisma.expense.create({
      data: {
        amount: parseFloat(amount),
        category,
        notes,
        date: parsedDate,
      },
    });

    return NextResponse.json({ success: true, data: expense });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Failed to create expense" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID is required" },
        { status: 400 },
      );
    }

    await prisma.expense.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Expense deleted" });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Failed to delete expense" },
      { status: 500 },
    );
  }
}
