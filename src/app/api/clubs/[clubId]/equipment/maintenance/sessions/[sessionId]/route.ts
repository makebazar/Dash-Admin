import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string; sessionId: string }> },
) {
  try {
    const { clubId, sessionId } = await params;

    const sessionResult = await query(
      `SELECT * FROM equipment_maintenance_sessions WHERE id = $1 AND club_id = $2`,
      [sessionId, clubId],
    );

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const tasksResult = await query(
      `SELECT
                mt.*,
                e.name as equipment_name,
                e.type as equipment_type,
                et.name_ru as equipment_type_name,
                et.icon as equipment_icon,
                w.name as workstation_name,
                w.zone as workstation_zone,
                u_v.full_name as verified_by_name,
                -- Per-type settings or general club defaults
                COALESCE(s.require_photo_before, gs.require_photo_before, FALSE) as require_photo_before,
                COALESCE(s.min_photos_before, gs.min_photos_before, 0) as min_photos_before,
                COALESCE(s.require_photo_after, gs.require_photo_after, TRUE) as require_photo_after,
                COALESCE(s.min_photos_after, gs.min_photos_after, 1) as min_photos_after,
                COALESCE(
                    s.require_comment_mode,
                    CASE WHEN gs.require_notes_on_completion THEN 'ALWAYS' ELSE 'ON_ISSUE' END,
                    'ON_ISSUE'
                ) as require_comment_mode,
                COALESCE(gs.instruction_step_order, 'BEFORE_PHOTOS') as instruction_step_order,
                ei.instructions,
                ei.performance_instructions,
                mt.task_type,
                -- Performance metrics for this type
                (
                  SELECT json_agg(m.* ORDER BY m.sort_order ASC, m.name ASC)
                  FROM club_equipment_performance_metrics m
                  WHERE m.club_id = mt.club_id AND m.equipment_type_code = e.type AND m.is_active = TRUE
                ) as performance_metrics,
                -- Latest rejection data
                (
                  SELECT json_build_object(
                    'note', ev.note,
                    'photos', ev.photos,
                    'rejected_by_name', u_rej.full_name
                  )
                  FROM equipment_maintenance_task_events ev
                  LEFT JOIN users u_rej ON ev.actor_user_id = u_rej.id
                  WHERE ev.task_id = mt.id AND ev.event_type = 'REJECTED'
                  ORDER BY ev.created_at DESC
                  LIMIT 1
                ) as latest_rejection
             FROM equipment_maintenance_tasks mt
             JOIN equipment e ON mt.equipment_id = e.id
             JOIN equipment_types et ON e.type = et.code
             LEFT JOIN club_workstations w ON e.workstation_id = w.id
             LEFT JOIN users u_v ON mt.verified_by = u_v.id
             LEFT JOIN club_maintenance_settings gs ON gs.club_id = mt.club_id
             LEFT JOIN club_equipment_type_maintenance_settings s ON s.club_id = mt.club_id AND s.equipment_type_code = e.type
             LEFT JOIN club_equipment_instructions ei ON ei.club_id = mt.club_id AND ei.equipment_type_code = e.type
             WHERE mt.session_id = $1
             ORDER BY
                (CASE WHEN mt.status = 'REWORK' OR mt.verification_status = 'REJECTED' THEN 0 ELSE 1 END) ASC,
                w.zone ASC NULLS LAST,
                w.name ASC NULLS LAST,
                e.name ASC`,
      [sessionId],
    );

    return NextResponse.json({
      session: sessionResult.rows[0],
      tasks: tasksResult.rows,
    });
  } catch (error) {
    console.error("Get Maintenance Session Details Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clubId: string; sessionId: string }> },
) {
  try {
    const { clubId, sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const { taskIds } = body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: "Task IDs are required" },
        { status: 400 },
      );
    }

    // Verify session existence
    const sessionResult = await query(
      `SELECT id FROM equipment_maintenance_sessions WHERE id = $1 AND club_id = $2`,
      [sessionId, clubId],
    );

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Assign tasks to session and update their status to IN_PROGRESS
    await query(
      `UPDATE equipment_maintenance_tasks
             SET session_id = $1, status = 'IN_PROGRESS'
             WHERE id = ANY($2) AND club_id = $3`,
      [sessionId, taskIds, clubId],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update Maintenance Session Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
