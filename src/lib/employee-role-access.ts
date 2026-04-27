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

    await query(`
        CREATE TABLE IF NOT EXISTS club_employee_roles (
            club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
            priority INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(club_id, user_id, role_id)
        );
        CREATE INDEX IF NOT EXISTS idx_club_employee_roles_club_user ON club_employee_roles(club_id, user_id);
    `)
    await query(`
        CREATE TABLE IF NOT EXISTS club_employee_role_preferences (
            club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            active_role_id INTEGER NULL REFERENCES roles(id) ON DELETE SET NULL,
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(club_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_club_employee_role_preferences_club_user ON club_employee_role_preferences(club_id, user_id);
    `)

    await query(`INSERT INTO roles (name, default_kpi_settings) VALUES ('Владелец', '{}'::jsonb) ON CONFLICT (name) DO NOTHING`)

    const accessRes = await query(
        `
        WITH membership AS (
            SELECT 1 as ok
            WHERE (
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
        ),
        preferred_role AS (
            SELECT active_role_id as role_id
            FROM club_employee_role_preferences
            WHERE club_id = $2 AND user_id = $1
            LIMIT 1
        ),
        assigned_role AS (
            SELECT role_id
            FROM club_employee_roles
            WHERE club_id = $2 AND user_id = $1
            ORDER BY priority ASC
            LIMIT 1
        ),
        owner_role AS (
            SELECT r.id as role_id
            FROM roles r
            WHERE r.name = 'Владелец'
            LIMIT 1
        ),
        base_user AS (
            SELECT u.role_id as user_role_id
            FROM users u
            WHERE u.id = $1
            LIMIT 1
        ),
        effective_role AS (
            SELECT COALESCE(
                (SELECT role_id FROM preferred_role),
                (SELECT role_id FROM assigned_role),
                (SELECT user_role_id FROM base_user),
                (
                    CASE
                        WHEN EXISTS (SELECT 1 FROM clubs c WHERE c.id = $2 AND c.owner_id = $1)
                        THEN (SELECT role_id FROM owner_role)
                        ELSE NULL
                    END
                )
            ) as role_id
        )
        SELECT
            (SELECT role_id FROM effective_role) as role_id,
            r.name as role_name,
            r.employee_access_settings
        FROM membership m
        LEFT JOIN roles r ON r.id = (SELECT role_id FROM effective_role)
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
