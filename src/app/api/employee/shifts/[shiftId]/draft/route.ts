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

    await query(
      `UPDATE shifts SET close_draft_data = $1 WHERE id = $2 AND user_id = $3 AND status = 'OPEN'`,
      [JSON.stringify(body), shiftId, userId],
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
