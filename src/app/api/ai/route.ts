import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { requireRole } from "@/lib/api-middleware";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // Only allow ADMIN or MANAGER to query AI
  const roleCheck = await requireRole(request, ["ADMIN", "MANAGER"]);
  if (roleCheck) return roleCheck;

  try {
    const { summary } = await request.json();

    if (!summary) {
      return NextResponse.json(
        { success: false, error: "Summary data is required" },
        { status: 400 },
      );
    }

    // Since we don't have a Google Gemini or OpenAI API key integrated natively here,
    // we provide a "mocked" intelligent response for now. If an API key was provided in .env,
    // we could fetch from api.openai.com/v1/chat/completions or generativelanguage.googleapis.com here.

    // Simulate AI delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const promptText = `
      Based on the following data:
      Total Revenue: ₹${summary.totalRevenue}
      Total Profit: ₹${summary.totalProfit}
      Profit Margin: ${summary.profitMargin}%
      Total Sales Count: ${summary.totalSalesCount}
    `;

    let advice = "Hello from your AI Business Advisor! 🤖\n\n";

    if (summary.profitMargin > 20) {
      advice +=
        "Your profit margins are looking great (above 20%). Consider reinvesting some of this profit into marketing or expanding your inventory with new product lines.\n";
    } else {
      advice +=
        "Your profit margins are relatively low. Consider analyzing your top-selling products to see if you can slightly increase prices, or negotiate better buying prices from your suppliers.\n";
    }

    if (summary.totalSalesCount < 10) {
      advice +=
        "Sales volume is a bit low today. You might want to run a local promotion or engage with recurring customers.\n";
    } else {
      advice +=
        "Great sales volume! Keep up the good work and ensure your best-selling items remain well-stocked.\n";
    }

    advice +=
      "\nTip: Always monitor the Auto-Restock list daily to never miss out on sales due to zero inventory.";

    return NextResponse.json({ success: true, advice });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Failed to get AI advice" },
      { status: 500 },
    );
  }
}
