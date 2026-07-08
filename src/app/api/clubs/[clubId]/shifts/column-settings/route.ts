import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubApiAccess } from "@/lib/club-api-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const userId = await requireClubApiAccess(clubId);

    // Dynamically ensure the column exists
    await query(
      `ALTER TABLE club_employees ADD COLUMN IF NOT EXISTS ui_preferences JSONB DEFAULT '{}'::jsonb`,
    );

    const result = await query(
      `SELECT ui_preferences FROM club_employees WHERE club_id = $1 AND user_id = $2`,
      [clubId, userId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ columnOrder: [], hiddenColumns: [] });
    }

    const preferences = result.rows[0].ui_preferences || {};
    return NextResponse.json({
      columnOrder: preferences.shiftsColumnOrder || [],
      hiddenColumns: preferences.shiftsHiddenColumns || [],
    });
  } catch (error: any) {
    console.error("GET shifts column settings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const userId = await requireClubApiAccess(clubId);
    const { columnOrder, hiddenColumns } = await request.json();

    // Dynamically ensure the column exists
    await query(
      `ALTER TABLE club_employees ADD COLUMN IF NOT EXISTS ui_preferences JSONB DEFAULT '{}'::jsonb`,
    );

    // Fetch existing preferences first to merge
    const selectRes = await query(
      `SELECT ui_preferences FROM club_employees WHERE club_id = $1 AND user_id = $2`,
      [clubId, userId],
    );

    let preferences = {};
    if (selectRes.rows.length > 0) {
      preferences = selectRes.rows[0].ui_preferences || {};
    }

    const updatedPreferences = {
      ...preferences,
      shiftsColumnOrder: columnOrder,
      shiftsHiddenColumns: hiddenColumns,
    };

    // Upsert into club_employees
    await query(
      `INSERT INTO club_employees (club_id, user_id, role, ui_preferences) 
       VALUES ($1, $2, 'Owner', $3)
       ON CONFLICT (club_id, user_id) 
       DO UPDATE SET ui_preferences = EXCLUDED.ui_preferences`,
      [clubId, userId, JSON.stringify(updatedPreferences)],
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST shifts column settings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
