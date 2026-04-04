import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { hasColumn } from '@/lib/db-compat';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify access
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const startTime = Date.now();
        const hasEquipmentStatusColumn = await hasColumn('equipment', 'status');
        const activeEquipmentCondition = hasEquipmentStatusColumn
            ? `COALESCE(status, CASE WHEN is_active = FALSE THEN 'WRITTEN_OFF' WHEN workstation_id IS NULL THEN 'STORAGE' ELSE 'ACTIVE' END) != 'WRITTEN_OFF'`
            : `is_active = TRUE`;
        const storageEquipmentCondition = hasEquipmentStatusColumn
            ? `COALESCE(status, CASE WHEN is_active = FALSE THEN 'WRITTEN_OFF' WHEN workstation_id IS NULL THEN 'STORAGE' ELSE 'ACTIVE' END) = 'STORAGE'`
            : `is_active = TRUE AND workstation_id IS NULL`;
        const repairEquipmentCondition = hasEquipmentStatusColumn
            ? `COALESCE(status, CASE WHEN is_active = FALSE THEN 'WRITTEN_OFF' WHEN workstation_id IS NULL THEN 'STORAGE' ELSE 'ACTIVE' END) = 'REPAIR'`
            : `FALSE`;

        // Combined stats query for efficiency
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM equipment WHERE club_id = $1) as total_count,
                (SELECT COUNT(*) FROM equipment WHERE club_id = $1 AND ${activeEquipmentCondition}) as active_count,
                (SELECT COUNT(*) FROM equipment WHERE club_id = $1 AND ${storageEquipmentCondition}) as storage_count,
                (SELECT COUNT(*) FROM equipment WHERE club_id = $1 AND ${repairEquipmentCondition}) as repair_count,
                (SELECT COUNT(*) FROM equipment_issues i JOIN equipment e ON i.equipment_id = e.id WHERE e.club_id = $1 AND i.status IN ('OPEN', 'IN_PROGRESS')) as active_issues,
                (SELECT COUNT(*) FROM equipment_maintenance_tasks t JOIN equipment e ON t.equipment_id = e.id WHERE e.club_id = $1 AND t.due_date < CURRENT_DATE AND t.status IN ('PENDING', 'IN_PROGRESS')) as overdue_tasks,
                (SELECT COUNT(*) FROM equipment_maintenance_tasks t JOIN equipment e ON t.equipment_id = e.id WHERE e.club_id = $1 AND t.due_date = CURRENT_DATE AND t.status IN ('PENDING', 'IN_PROGRESS')) as due_today_tasks,
                (SELECT COUNT(*) FROM equipment WHERE club_id = $1 AND warranty_expires >= CURRENT_DATE AND warranty_expires < CURRENT_DATE + INTERVAL '30 days') as expiring_warranty
            FROM (SELECT 1) dummy
        `;

        const result = await query(statsQuery, [clubId]);
        const stats = result.rows[0];

        const duration = Date.now() - startTime;
        console.log(`[PERF] GET /api/clubs/${clubId}/equipment/stats: ${duration}ms`);

        return NextResponse.json({
            total: parseInt(stats.total_count),
            active: parseInt(stats.active_count),
            storage: parseInt(stats.storage_count),
            active_issues: parseInt(stats.active_issues),
            overdue_tasks: parseInt(stats.overdue_tasks),
            due_today_tasks: parseInt(stats.due_today_tasks),
            expiring_warranty: parseInt(stats.expiring_warranty),
            repair: parseInt(stats.repair_count),
            value: parseInt(stats.total_count) * 15000, // Mock estimate
            duration_ms: duration
        });
    } catch (error) {
        console.error('Get Equipment Stats Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
