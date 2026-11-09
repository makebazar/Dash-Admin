import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  approveMaintenanceTasks,
  hasActiveClubAccess,
} from "@/lib/maintenance-task-logic";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;

    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }
    const { action, taskIds, comment } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: "No tasks provided" }, { status: 400 });
    }

    if (action !== "APPROVE") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!(await hasActiveClubAccess(clubId, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { approvedIds } = await approveMaintenanceTasks({
      clubId,
      taskIds,
      actorUserId: userId,
      comment: comment || null,
    });

    if (approvedIds.length === 0) {
      return NextResponse.json({ error: "No matching tasks found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify Batch Tasks Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
