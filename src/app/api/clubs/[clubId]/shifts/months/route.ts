import { NextResponse } from "next/server";
import { query } from "@/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const clubIdInt = parseInt(clubId);
    if (isNaN(clubIdInt)) {
      return NextResponse.json({ error: "Invalid Club ID" }, { status: 400 });
    }

    const result = await query(
      `SELECT DISTINCT TO_CHAR(check_in, 'YYYY-MM') as month_key
       FROM shifts
       WHERE club_id = $1 AND check_in IS NOT NULL
       ORDER BY month_key DESC`,
      [clubIdInt],
    );

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const currentMonthKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

    const monthKeys: string[] = result.rows.map((r: any) => r.month_key).filter(Boolean);

    if (!monthKeys.includes(currentMonthKey)) {
      monthKeys.unshift(currentMonthKey);
      monthKeys.sort((a, b) => b.localeCompare(a));
    }

    return NextResponse.json({ months: monthKeys });
  } catch (error: any) {
    console.error("Get Shift Months Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
