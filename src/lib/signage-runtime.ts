import { hasColumn } from "@/lib/db-compat"

export type SignageControlAction = "jump" | "pause" | null

export type SignageRuntimeColumns = {
  hasCurrentSlideId: boolean
  hasControlAction: boolean
  hasControlSlideId: boolean
  hasControlUntil: boolean
  hasControlUpdatedAt: boolean
}

export async function getSignageRuntimeColumns(): Promise<SignageRuntimeColumns> {
  const [
    hasCurrentSlideId,
    hasControlAction,
    hasControlSlideId,
    hasControlUntil,
    hasControlUpdatedAt,
  ] = await Promise.all([
    hasColumn("club_signage_devices", "current_slide_id"),
    hasColumn("club_signage_devices", "control_action"),
    hasColumn("club_signage_devices", "control_slide_id"),
    hasColumn("club_signage_devices", "control_until"),
    hasColumn("club_signage_devices", "control_updated_at"),
  ])

  return {
    hasCurrentSlideId,
    hasControlAction,
    hasControlSlideId,
    hasControlUntil,
    hasControlUpdatedAt,
  }
}

export function getSignageRuntimeSelect(columns: SignageRuntimeColumns) {
  return `
    ${columns.hasCurrentSlideId ? "current_slide_id" : "NULL::varchar AS current_slide_id"},
    ${columns.hasControlAction ? "control_action" : "NULL::varchar AS control_action"},
    ${columns.hasControlSlideId ? "control_slide_id" : "NULL::varchar AS control_slide_id"},
    ${columns.hasControlUntil ? "control_until" : "NULL::timestamp AS control_until"},
    ${columns.hasControlUpdatedAt ? "control_updated_at" : "NULL::timestamp AS control_updated_at"}
  `
}

export function normalizeSignageControlAction(value: unknown): SignageControlAction {
  return value === "jump" || value === "pause" ? value : null
}

export function isActivePauseControl(device: {
  control_action?: unknown
  control_slide_id?: unknown
  control_until?: unknown
}) {
  const action = normalizeSignageControlAction(device.control_action)
  if (action !== "pause") return false
  if (typeof device.control_slide_id !== "string" || !device.control_slide_id) return false
  if (!device.control_until) return false

  const until = new Date(String(device.control_until))
  if (Number.isNaN(until.getTime())) return false
  return until.getTime() > Date.now()
}
