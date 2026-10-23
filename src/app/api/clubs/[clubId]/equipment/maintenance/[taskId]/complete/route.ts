import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import {
  completeMaintenanceTask,
  hasActiveClubAccess,
} from "@/lib/maintenance-task-logic";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string; taskId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId, taskId } = await params;

    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }
    const photosRaw = body.photos;
    const photos = Array.isArray(photosRaw) ? photosRaw : [];
    const photosBeforeRaw = body.photos_before;
    const photos_before = Array.isArray(photosBeforeRaw) ? photosBeforeRaw : [];
    const photosAfterRaw = body.photos_after;
    const photos_after = Array.isArray(photosAfterRaw)
      ? photosAfterRaw
      : photos.length > 0
        ? photos
        : [];
    const notes = body.notes || null;
    const performance_data = body.performance_data || null;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasActiveClubAccess(clubId, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validation (require photos, comments etc. from club + per-type settings)
    const settingsRes = await query(
      `SELECT
          COALESCE(s.require_photo_before, gs.require_photo_before, FALSE) as require_photo_before,
          COALESCE(s.min_photos_before, gs.min_photos_before, 0) as min_photos_before,
          COALESCE(s.require_photo_after, gs.require_photo_after, TRUE) as require_photo_after,
          COALESCE(s.min_photos_after, gs.min_photos_after, 1) as min_photos_after,
          COALESCE(
            s.require_comment_mode,
            CASE WHEN gs.require_notes_on_completion THEN 'ALWAYS' ELSE 'ON_ISSUE' END,
            'ON_ISSUE'
          ) as require_comment_mode
       FROM equipment_maintenance_tasks mt
       JOIN equipment e ON mt.equipment_id = e.id
       LEFT JOIN club_maintenance_settings gs ON gs.club_id = e.club_id
       LEFT JOIN club_equipment_type_maintenance_settings s
         ON s.club_id = e.club_id AND s.equipment_type_code = e.type
       WHERE mt.id = $1 AND e.club_id = $2`,
      [taskId, clubId],
    );

    if ((settingsRes.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const settingsRow = settingsRes.rows[0];
    const minBefore = settingsRow.require_photo_before
      ? Math.max(0, Number(settingsRow.min_photos_before) || 0)
      : 0;
    const minAfter = settingsRow.require_photo_after
      ? Math.max(0, Number(settingsRow.min_photos_after) || 0)
      : 0;

    if (photos_before.length < minBefore) {
      return NextResponse.json(
        { error: `Нужно приложить минимум фото ДО: ${minBefore}` },
        { status: 400 },
      );
    }

    if (photos_after.length < minAfter) {
      return NextResponse.json(
        { error: `Нужно приложить минимум фото ПОСЛЕ: ${minAfter}` },
        { status: 400 },
      );
    }

    if (settingsRow.require_comment_mode === "ALWAYS") {
      const noteStr = String(notes || "").trim();
      if (!noteStr) {
        return NextResponse.json(
          { error: "Нужно заполнить комментарий к выполнению" },
          { status: 400 },
        );
      }
    }

    // Delegate to shared business logic service
    await completeMaintenanceTask({
      clubId,
      taskId,
      userId,
      photos_before,
      photos_after,
      notes,
      performance_data,
      status_mode: "OK",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Complete Task Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
