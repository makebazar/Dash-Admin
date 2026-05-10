import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { shiftId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const sumMetric = (val: any) => {
      if (val === null || val === undefined || val === "") return 0;
      if (Array.isArray(val)) {
        return val.reduce(
          (sum: number, item: any) => sum + (Number(item?.amount) || 0),
          0,
        );
      }
      const parsed = parseFloat(String(val).replace(",", "."));
      return isNaN(parsed) ? 0 : parsed;
    };

    const cashIncome = sumMetric(body["cash_income"]);
    const cardIncome = sumMetric(body["card_income"]);
    const expenses = sumMetric(body["expenses_cash"]);
    const templateId = body["templateId"];

    await query(
      `UPDATE shifts
       SET close_draft_data = $1,
           cash_income = CASE WHEN $4 > 0 THEN $4 ELSE cash_income END,
           card_income = CASE WHEN $5 > 0 THEN $5 ELSE card_income END,
           expenses = CASE WHEN $6 > 0 THEN $6 ELSE expenses END,
           template_id = COALESCE($7, template_id)
       WHERE id = $2 AND user_id = $3 AND status = 'OPEN'`,
      [
        JSON.stringify(body),
        shiftId,
        userId,
        cashIncome,
        cardIncome,
        expenses,
        templateId,
      ],
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Save Shift Draft Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
