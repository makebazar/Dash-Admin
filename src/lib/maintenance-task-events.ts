import { query } from "@/db";

type MaintenanceTaskSnapshot = {
  id: string;
  verification_status?: string | null;
  completed_at?: string | Date | null;
  completed_by?: string | null;
  verified_at?: string | Date | null;
  verified_by?: string | null;
  rejection_reason?: string | null;
  verification_note?: string | null;
  notes?: string | null;
  photos?: string[] | null;
  photos_before?: string[] | null;
  photos_after?: string[] | null;
};

function normalizePhotos(photos?: string[] | null) {
  return Array.isArray(photos) ? photos.filter(Boolean) : [];
}

export async function getMaintenanceTaskCurrentCycle(taskId: string) {
  const result = await query(
    `SELECT COALESCE(MAX(cycle_no), 0) AS current_cycle
         FROM equipment_maintenance_task_events
         WHERE task_id = $1`,
    [taskId],
  );

  return Number(result.rows[0]?.current_cycle || 0);
}

export async function appendMaintenanceTaskEvent(params: {
  taskId: string;
  cycleNo: number;
  eventType: "SUBMITTED" | "RESUBMITTED" | "REJECTED" | "APPROVED" | "REVERTED";
  actorUserId?: string | null;
  note?: string | null;
  taskNotes?: string | null;
  photos?: string[] | null;
  photos_before?: string[] | null;
  photos_after?: string[] | null;
  createdAt?: string | Date | null;
}) {
  await query(
    `INSERT INTO equipment_maintenance_task_events
            (task_id, cycle_no, event_type, actor_user_id, note, task_notes, photos, photos_before, photos_after, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, NOW()))`,
    [
      params.taskId,
      params.cycleNo,
      params.eventType,
      params.actorUserId || null,
      params.note || null,
      params.taskNotes || null,
      normalizePhotos(params.photos),
      normalizePhotos(params.photos_before),
      normalizePhotos(params.photos_after),
      params.createdAt || null,
    ],
  );
}

export async function ensureMaintenanceTaskInitialHistory(
  task: MaintenanceTaskSnapshot,
) {
  const existing = await query(
    `SELECT 1
         FROM equipment_maintenance_task_events
         WHERE task_id = $1
         LIMIT 1`,
    [task.id],
  );

  if ((existing.rowCount || 0) > 0) return;

  const photos = normalizePhotos(task.photos);
  const photos_before = normalizePhotos(task.photos_before);
  const photos_after = normalizePhotos(task.photos_after);

  if (
    task.completed_at ||
    task.notes ||
    photos.length > 0 ||
    photos_before.length > 0 ||
    photos_after.length > 0
  ) {
    await appendMaintenanceTaskEvent({
      taskId: task.id,
      cycleNo: 1,
      eventType: "SUBMITTED",
      actorUserId: task.completed_by || null,
      taskNotes: task.notes || null,
      photos,
      photos_before,
      photos_after,
      createdAt: task.completed_at || null,
    });
  }

  if (
    task.verification_status === "REJECTED" &&
    (task.verified_at || task.rejection_reason || task.verification_note)
  ) {
    await appendMaintenanceTaskEvent({
      taskId: task.id,
      cycleNo: 1,
      eventType: "REJECTED",
      actorUserId: task.verified_by || null,
      note: task.rejection_reason || task.verification_note || null,
      taskNotes: task.notes || null,
      photos,
      photos_before,
      photos_after,
      createdAt: task.verified_at || null,
    });
  }

  if (task.verification_status === "APPROVED" && task.verified_at) {
    await appendMaintenanceTaskEvent({
      taskId: task.id,
      cycleNo: 1,
      eventType: "APPROVED",
      actorUserId: task.verified_by || null,
      note: task.verification_note || null,
      taskNotes: task.notes || null,
      photos,
      photos_before,
      photos_after,
      createdAt: task.verified_at,
    });
  }
}
