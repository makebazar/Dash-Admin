import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { completeMaintenanceTask } from "@/lib/maintenance-task-logic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string; sessionId: string }> },
) {
  try {
    const userIdFromCookie = (await cookies()).get("session_user_id")?.value;
    const { clubId, sessionId } = await params;
    const body = await request.json().catch(() => ({}));

    const { reports } = body; // Array of { taskId, photos_before, photos_after, notes, status_mode }
    if (!Array.isArray(reports)) {
      return NextResponse.json(
        { error: "Reports array is required" },
        { status: 400 },
      );
    }

    // 1. Verify session ownership/access and get creator
    const sessionCheck = await query(
      `SELECT created_by FROM equipment_maintenance_sessions WHERE id = $1 AND club_id = $2`,
      [sessionId, clubId],
    );
    if (sessionCheck.rows.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const userId = userIdFromCookie || sessionCheck.rows[0].created_by;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Complete each task
    const results = [];
    for (const report of reports) {
      try {
        const res = await completeMaintenanceTask({
          clubId,
          userId,
          taskId: report.taskId,
          photos_before: report.photos_before,
          photos_after: report.photos_after,
          notes: report.notes,
          status_mode: report.status_mode,
          issue_title: report.issue_title,
          issue_description: report.issue_description,
        });
        results.push({ taskId: report.taskId, success: true });
      } catch (e) {
        console.error(`Failed to complete task ${report.taskId}:`, e);
        results.push({
          taskId: report.taskId,
          success: false,
          error: (e as Error).message,
        });
      }
    }

    // 3. Close session
    await query(
      `UPDATE equipment_maintenance_sessions
             SET status = 'COMPLETED', completed_at = NOW()
             WHERE id = $1`,
      [sessionId],
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Complete Maintenance Session Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
