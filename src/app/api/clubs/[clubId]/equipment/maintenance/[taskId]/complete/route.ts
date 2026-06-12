import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { completeMaintenanceTask } from "@/lib/maintenance-task-logic";

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
      : (photos.length > 0 ? photos : []);
    const notes = body.notes || null;
    const performance_data = body.performance_data || null;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify access (employee or owner)
    const accessCheck = await query(
      `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
             UNION
             SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
      [clubId, userId],
    );

    if ((accessCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validation (require photos, comments etc.)
    try {
      const settingsRes = await query(
        `SELECT require_photos_on_completion, min_photos, require_notes_on_completion
                 FROM club_maintenance_settings
                 WHERE club_id = $1`,
        [clubId],
      );
      const settingsRow = settingsRes.rows[0] || null;
      const requirePhotos = settingsRow?.require_photos_on_completion !== false;
      const minPhotos = requirePhotos
        ? Math.max(1, Number(settingsRow?.min_photos) || 1)
        : 0;
      const requireNotes = settingsRow?.require_notes_on_completion === true;

      const totalPhotosCount = photos_before.length + photos_after.length;

      if (minPhotos > 0 && totalPhotosCount < minPhotos) {
        return NextResponse.json(
          { error: `Нужно приложить минимум фото: ${minPhotos}` },
          { status: 400 },
        );
      }

      if (requireNotes) {
        const noteStr = String(notes || "").trim();
        if (!noteStr) {
          return NextResponse.json(
            { error: "Нужно заполнить комментарий к выполнению" },
            { status: 400 },
          );
        }
      }
    } catch (e) {
      // Fallback if settings query fails
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
