import { query } from "@/db"
import { cookies } from "next/headers"

export type EmployeeShiftEndMode = "FULL_REPORT" | "NO_REPORT"
export type EmployeeHandoverChecklistMode = "DISABLED" | "OPTIONAL" | "REQUIRED"

export type EmployeeAccessSettings = {
    employee_only: boolean
    shift_start_enabled: boolean
    shift_end_mode: EmployeeShiftEndMode
    handover_checklist_on_start?: EmployeeHandoverChecklistMode
    closing_checklist_enabled?: boolean
    shift_zone_handover_enabled: boolean
    inventory_actions_enabled: boolean
    maintenance_enabled: boolean
    schedule_enabled: boolean
    requests_enabled: boolean
    workstations_view_enabled: boolean
}

type AccessError = Error & { status?: number }

export type EmployeeRoleAccess = {
    userId: string
    roleId: number | null
    roleName: string | null
    settings: EmployeeAccessSettings
}

function normalizeShiftEndMode(value: unknown): EmployeeShiftEndMode {
    if (value === "NO_REPORT") return "NO_REPORT"
    return "FULL_REPORT"
}

function normalizeHandoverMode(value: unknown): EmployeeHandoverChecklistMode | undefined {
    if (value === "DISABLED" || value === "OPTIONAL" || value === "REQUIRED") return value
    return undefined
}

export function normalizeEmployeeAccessSettings(raw: any): EmployeeAccessSettings {
    const source = raw && typeof raw === "object" ? raw : {}

    return {
        employee_only: Boolean(source.employee_only),
        shift_start_enabled: source.shift_start_enabled !== false,
        shift_end_mode: normalizeShiftEndMode(source.shift_end_mode),
        handover_checklist_on_start: normalizeHandoverMode(source.handover_checklist_on_start),
        closing_checklist_enabled: typeof source.closing_checklist_enabled === "boolean" ? source.closing_checklist_enabled : undefined,
        shift_zone_handover_enabled: source.shift_zone_handover_enabled !== false,
        inventory_actions_enabled: source.inventory_actions_enabled !== false,
        maintenance_enabled: source.maintenance_enabled !== false,
        schedule_enabled: source.schedule_enabled !== false,
        requests_enabled: source.requests_enabled !== false,
        workstations_view_enabled: source.workstations_view_enabled !== false,
    }
}

export async function getEmployeeRoleAccess(clubId: string): Promise<EmployeeRoleAccess> {
    const userId = (await cookies()).get("session_user_id")?.value
    if (!userId) {
        const error = new Error("Unauthorized") as AccessError
        error.status = 401
        throw error
    }

    const accessRes = await query(
        `
        SELECT
            u.role_id,
            r.name as role_name,
            r.employee_access_settings
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1
          AND (
              EXISTS (
                  SELECT 1
                  FROM club_employees ce
                  WHERE ce.club_id = $2
                    AND ce.user_id = $1
                    AND ce.dismissed_at IS NULL
              )
              OR EXISTS (
                  SELECT 1
                  FROM clubs c
                  WHERE c.id = $2
                    AND c.owner_id = $1
              )
          )
        LIMIT 1
        `,
        [userId, clubId]
    )

    if ((accessRes.rowCount || 0) === 0) {
        const error = new Error("Forbidden") as AccessError
        error.status = 403
        throw error
    }

    const row = accessRes.rows[0] || {}
    const settings = normalizeEmployeeAccessSettings(row.employee_access_settings)

    return {
        userId,
        roleId: row.role_id ? Number(row.role_id) : null,
        roleName: row.role_name || null,
        settings,
    }
}
