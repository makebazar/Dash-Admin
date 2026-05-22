import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { ensureOwnerSubscriptionActive } from "@/lib/club-subscription-guard";

const DEFAULT_SETTINGS = {
  require_photo_before: false,
  min_photos_before: 0,
  require_photo_after: true,
  min_photos_after: 1,
  require_notes_on_completion: false,
  block_desktop_access: false,
  instruction_step_order: "BEFORE_PHOTOS",
  desktop_completion_mode: "QR",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessCheck = await query(
      `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
      [clubId, userId],
    );

    if ((accessCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await query(
      `SELECT
                require_photo_before, min_photos_before,
                require_photo_after, min_photos_after,
                require_notes_on_completion,
                block_desktop_access,
                instruction_step_order,
                require_photos_on_completion, min_photos,
                desktop_completion_mode
             FROM club_maintenance_settings
             WHERE club_id = $1`,
      [clubId],
    );

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    const row = result.rows[0];
    // Handle case where new columns might be NULL if migration didn't run yet or we want to be safe
    return NextResponse.json({
      require_photo_before: row.require_photo_before === true,
      min_photos_before: Math.max(0, Number(row.min_photos_before) || 0),
      require_photo_after:
        row.require_photo_after ?? row.require_photos_on_completion !== false,
      min_photos_after: Math.max(
        0,
        Number(row.min_photos_after ?? row.min_photos) || 0,
      ),
      require_notes_on_completion: row.require_notes_on_completion === true,
      block_desktop_access: row.block_desktop_access === true,
      instruction_step_order: row.instruction_step_order || "BEFORE_PHOTOS",
      desktop_completion_mode: row.desktop_completion_mode || "QR",
    });
  } catch (error) {
    console.error("Get Maintenance Settings Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;
    const body = await request.json().catch(() => ({}));

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guard = await ensureOwnerSubscriptionActive(clubId, userId);
    if (!guard.ok) return guard.response;

    const requirePhotoBefore = body.require_photo_before === true;
    const minPhotosBefore = Math.max(0, Number(body.min_photos_before) || 0);

    const requirePhotoAfter =
      body.require_photo_after ?? body.require_photos_on_completion !== false;
    const minPhotosAfter = Math.max(
      0,
      Number(body.min_photos_after ?? body.min_photos) || 0,
    );

    const requireNotes = body.require_notes_on_completion === true;
    const blockDesktopAccess = body.block_desktop_access === true;
    const instructionStepOrder = body.instruction_step_order || "BEFORE_PHOTOS";
    const desktopCompletionMode = body.desktop_completion_mode || "QR";

    const result = await query(
      `INSERT INTO club_maintenance_settings (
                club_id,
                require_photo_before, min_photos_before,
                require_photo_after, min_photos_after,
                require_notes_on_completion,
                block_desktop_access,
                instruction_step_order,
                desktop_completion_mode,
                -- Keep legacy fields in sync
                require_photos_on_completion, min_photos
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $4, $5)
            ON CONFLICT (club_id) DO UPDATE SET
                require_photo_before = EXCLUDED.require_photo_before,
                min_photos_before = EXCLUDED.min_photos_before,
                require_photo_after = EXCLUDED.require_photo_after,
                min_photos_after = EXCLUDED.min_photos_after,
                require_notes_on_completion = EXCLUDED.require_notes_on_completion,
                block_desktop_access = EXCLUDED.block_desktop_access,
                instruction_step_order = EXCLUDED.instruction_step_order,
                desktop_completion_mode = EXCLUDED.desktop_completion_mode,
                require_photos_on_completion = EXCLUDED.require_photo_after,
                min_photos = EXCLUDED.min_photos_after,
                updated_at = NOW()
            RETURNING *`,
      [
        clubId,
        requirePhotoBefore,
        minPhotosBefore,
        requirePhotoAfter,
        minPhotosAfter,
        requireNotes,
        blockDesktopAccess,
        instructionStepOrder,
        desktopCompletionMode,
      ],
    );

    const row = result.rows[0];
    return NextResponse.json({
      require_photo_before: row.require_photo_before,
      min_photos_before: row.min_photos_before,
      require_photo_after: row.require_photo_after,
      min_photos_after: row.min_photos_after,
      require_notes_on_completion: row.require_notes_on_completion,
      block_desktop_access: row.block_desktop_access,
      instruction_step_order: row.instruction_step_order,
      desktop_completion_mode: row.desktop_completion_mode,
    });
  } catch (error) {
    console.error("Update Maintenance Settings Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
