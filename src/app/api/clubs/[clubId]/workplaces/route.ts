import { NextResponse } from 'next/server'
import { query } from '@/db'
import { cookies } from 'next/headers'
import { hasColumn } from '@/lib/db-compat'
import { normalizeEquipmentRecord } from '@/lib/equipment-status'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value
        const { clubId } = await params

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        )

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='club_zones' AND column_name='display_order') THEN
                    ALTER TABLE club_zones ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
                END IF;
            END $$;
        `);

        const hasIssuesClubIdColumn = await hasColumn('equipment_issues', 'club_id')
        const hasClubEquipmentTypes = await hasColumn('equipment_types', 'club_id')
        const hasEquipmentStatusColumn = await hasColumn('equipment', 'status')
        const hasCleaningIntervalOverrideColumn = await hasColumn('equipment', 'cleaning_interval_override_days')
        const equipmentStatusSql = hasEquipmentStatusColumn
            ? `COALESCE(e.status, CASE WHEN e.is_active = FALSE THEN 'WRITTEN_OFF' WHEN e.workstation_id IS NULL THEN 'STORAGE' ELSE 'ACTIVE' END)`
            : `CASE WHEN e.is_active = FALSE THEN 'WRITTEN_OFF' WHEN e.workstation_id IS NULL THEN 'STORAGE' ELSE 'ACTIVE' END`
        const equipmentActiveSql = `CASE WHEN ${equipmentStatusSql} = 'WRITTEN_OFF' THEN FALSE ELSE TRUE END`
        const effectiveCleaningIntervalSql = hasCleaningIntervalOverrideColumn
            ? `COALESCE(e.cleaning_interval_override_days, e.cleaning_interval_days)`
            : `e.cleaning_interval_days`

        const [workstationsResult, equipmentResult, equipmentTypesResult, employeesResult, zonesResult] = await Promise.all([
            query(
                `WITH equipment_counts AS (
                    SELECT workstation_id, COUNT(*)::int as equipment_count
                    FROM equipment
                    WHERE club_id = $1 AND workstation_id IS NOT NULL AND ${hasEquipmentStatusColumn
                        ? `COALESCE(status, CASE WHEN is_active = FALSE THEN 'WRITTEN_OFF' WHEN workstation_id IS NULL THEN 'STORAGE' ELSE 'ACTIVE' END) != 'WRITTEN_OFF'`
                        : `is_active = TRUE`}
                    GROUP BY workstation_id
                )
                SELECT
                    w.id,
                    w.name,
                    w.zone,
                    w.assigned_user_id,
                    u.full_name as assigned_user_name,
                    COALESCE(ec.equipment_count, 0)::int as equipment_count
                FROM club_workstations w
                LEFT JOIN users u ON w.assigned_user_id = u.id
                LEFT JOIN equipment_counts ec ON ec.workstation_id = w.id
                WHERE w.club_id = $1
                ORDER BY w.zone, w.name`,
                [clubId]
            ),
            query(
                hasIssuesClubIdColumn
                    ? `WITH issue_counts AS (
                        SELECT equipment_id, COUNT(*)::int as open_issues_count
                        FROM equipment_issues
                        WHERE club_id = $1
                          AND status IN ('OPEN', 'IN_PROGRESS')
                        GROUP BY equipment_id
                    )
                    SELECT
                        e.id,
                        e.name,
                        e.type,
                        et.name_ru as type_name,
                        et.icon as type_icon,
                        e.identifier,
                        e.brand,
                        e.model,
                        e.workstation_id,
                        ${equipmentActiveSql} as is_active,
                        ${equipmentStatusSql} as status,
                        e.maintenance_enabled,
                        ${effectiveCleaningIntervalSql} as cleaning_interval_days,
                        ${hasCleaningIntervalOverrideColumn ? 'e.cleaning_interval_override_days' : 'NULL::integer as cleaning_interval_override_days'},
                        e.last_cleaned_at,
                        e.cpu_thermal_paste_last_changed_at,
                        e.cpu_thermal_paste_interval_days,
                        e.cpu_thermal_paste_type,
                        e.cpu_thermal_paste_note,
                        e.gpu_thermal_paste_last_changed_at,
                        e.gpu_thermal_paste_interval_days,
                        e.gpu_thermal_paste_type,
                        e.gpu_thermal_paste_note,
                        e.assigned_user_id,
                        e.assignment_mode,
                        COALESCE(ic.open_issues_count, 0)::int as open_issues_count
                    FROM equipment e
                    LEFT JOIN equipment_types et ON et.code = e.type
                    LEFT JOIN issue_counts ic ON ic.equipment_id = e.id
                    WHERE e.club_id = $1
                    ORDER BY e.workstation_id NULLS LAST, e.type, e.name`
                    : `WITH issue_counts AS (
                        SELECT i.equipment_id, COUNT(*)::int as open_issues_count
                        FROM equipment_issues i
                        JOIN equipment source_equipment ON source_equipment.id = i.equipment_id
                        WHERE source_equipment.club_id = $1
                          AND i.status IN ('OPEN', 'IN_PROGRESS')
                        GROUP BY i.equipment_id
                    )
                    SELECT
                        e.id,
                        e.name,
                        e.type,
                        et.name_ru as type_name,
                        et.icon as type_icon,
                        e.identifier,
                        e.brand,
                        e.model,
                        e.workstation_id,
                        ${equipmentActiveSql} as is_active,
                        ${equipmentStatusSql} as status,
                        e.maintenance_enabled,
                        ${effectiveCleaningIntervalSql} as cleaning_interval_days,
                        ${hasCleaningIntervalOverrideColumn ? 'e.cleaning_interval_override_days' : 'NULL::integer as cleaning_interval_override_days'},
                        e.last_cleaned_at,
                        e.cpu_thermal_paste_last_changed_at,
                        e.cpu_thermal_paste_interval_days,
                        e.cpu_thermal_paste_type,
                        e.cpu_thermal_paste_note,
                        e.gpu_thermal_paste_last_changed_at,
                        e.gpu_thermal_paste_interval_days,
                        e.gpu_thermal_paste_type,
                        e.gpu_thermal_paste_note,
                        e.assigned_user_id,
                        e.assignment_mode,
                        COALESCE(ic.open_issues_count, 0)::int as open_issues_count
                    FROM equipment e
                    LEFT JOIN equipment_types et ON et.code = e.type
                    LEFT JOIN issue_counts ic ON ic.equipment_id = e.id
                    WHERE e.club_id = $1
                    ORDER BY e.workstation_id NULLS LAST, e.type, e.name`,
                [clubId]
            ),
            query(
                hasClubEquipmentTypes
                    ? `SELECT code, name_ru, icon
                       FROM equipment_types
                       WHERE is_active = TRUE
                         AND (club_id IS NULL OR club_id = $1)
                       ORDER BY
                         CASE WHEN club_id = $1 THEN 0 ELSE 1 END,
                         sort_order,
                         name_ru`
                    : `SELECT code, name_ru, icon
                       FROM equipment_types
                       ORDER BY name_ru`,
                hasClubEquipmentTypes ? [clubId] : []
            ),
            query(
                `SELECT id, full_name
                 FROM users
                 WHERE id IN (
                    SELECT owner_id FROM clubs WHERE id = $1
                    UNION
                    SELECT user_id
                    FROM club_employees
                    WHERE club_id = $1 AND is_active = TRUE AND dismissed_at IS NULL
                 )
                 ORDER BY full_name`,
                [clubId]
            ),
            query(
                `WITH workstation_counts AS (
                    SELECT zone, COUNT(*)::int as workstation_count
                    FROM club_workstations
                    WHERE club_id = $1
                    GROUP BY zone
                )
                SELECT 
                    z.id,
                    z.name,
                    z.display_order,
                    z.assigned_user_id,
                    u.full_name as assigned_user_name,
                    COALESCE(wc.workstation_count, 0)::int as workstation_count
                 FROM club_zones z
                 LEFT JOIN users u ON z.assigned_user_id = u.id
                 LEFT JOIN workstation_counts wc ON wc.zone = z.name
                 WHERE z.club_id = $1
                 ORDER BY z.display_order ASC, z.name ASC`,
                [clubId]
            )
        ])

        return NextResponse.json({
            workstations: workstationsResult.rows,
            equipment: equipmentResult.rows.map((item: any) => ({
                ...normalizeEquipmentRecord(item),
                maintenance_enabled: item.maintenance_enabled !== false,
            })),
            equipmentTypes: equipmentTypesResult.rows,
            employees: employeesResult.rows,
            zones: zonesResult.rows,
        })
    } catch (error) {
        console.error('Get Workplaces Overview Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
