import { NextResponse } from "next/server";
import { executeShiftClose } from "@/lib/shift-logic";
import { query } from "@/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  try {
    const { shiftId } = await params;

    // Verify shift exists and get user_id (check by check_out IS NULL)
    const shiftRes = await query(
      `SELECT user_id, status FROM shifts WHERE id = $1`,
      [shiftId],
    );

    if (shiftRes.rowCount === 0) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const userId = String(shiftRes.rows[0].user_id);
    const status = shiftRes.rows[0].status;

    // If already closed, just return success (to avoid 404 in terminal)
    if (status === "CLOSED") {
      return NextResponse.json({ success: true, already_closed: true });
    }

    // This endpoint is used by the terminal to finalize the shift
    // after the handover (snapshot) is completed.
    return await executeShiftClose(request, shiftId, userId);
  } catch (error: any) {
    console.error("Finalize End Shift Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
