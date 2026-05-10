import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { executeShiftClose as executeShiftCloseLib } from "@/lib/shift-logic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { shiftId } = await params;
    return await executeShiftCloseLib(request, shiftId, userId);
  } catch (error: any) {
    console.error("End Shift Error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal Server Error",
        details: error.toString(),
      },
      { status: 500 },
    );
  }
}

// Re-export for internal use
export const executeShiftClose = executeShiftCloseLib;
