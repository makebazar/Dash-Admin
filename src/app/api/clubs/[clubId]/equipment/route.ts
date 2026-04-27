import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';
import { hasColumn } from '@/lib/db-compat';
import {
    DEFAULT_EQUIPMENT_STATUS,
    normalizeEquipmentRecord,
    isEquipmentStatus,
    resolveEquipmentStateForPersistence,
} from '@/lib/equipment-status';

// GET /api/clubs/[clubId]/equipment - List all equipment
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url);

        const workstationId = searchParams.get('workstation_id');
        const type = searchParams.get('type');
        const search = searchParams.get('search');
        const status = searchParams.get('status');
        const includeInactive = searchParams.get('include_inactive') === 'true';
        
        // Pagination parameters
        const rawLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
        const rawOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 5000) : 50;
        const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Performance monitoring: Start timer
        const startTime = Date.now();

        // Verify access (cached check or simple query)
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const hasEquipmentStatusColumn = await hasColumn('equipment', 'status');
        const equipmentStatusSql = hasEquipmentStatusColumn
            ? `COALESCE(e.status, CASE WHEN e.is_active = FALSE THEN 'WRITTEN_OFF' WHEN e.workstation_id IS NULL THEN 'STORAGE' ELSE 'ACTIVE' END)`
            : `CASE WHEN e.is_active = FALSE THEN 'WRITTEN_OFF' WHEN e.workstation_id IS NULL THEN 'STORAGE' ELSE 'ACTIVE' END`;
        const equipmentActiveSql = `CASE WHEN ${equipmentStatusSql} = 'WRITTEN_OFF' THEN FALSE ELSE TRUE END`;

        let whereConditions = [`e.club_id = $1`];
        const queryParams: any[] = [clubId];
        let paramIndex = 2;

        const normalizedStatus = status === 'inactive' ? 'written_off' : status;
        const normalizedStatusKey = normalizedStatus?.toUpperCase();
        const hasLifecycleStatusFilter = isEquipmentStatus(normalizedStatusKey);
        const hasLegacyStatusFilter = normalizedStatus === 'active' || normalizedStatus === 'written_off';

        if (!hasLifecycleStatusFilter && !hasLegacyStatusFilter && !includeInactive) {
            whereConditions.push(`${equipmentActiveSql} = TRUE`);
        }

        if (workstationId) {
            if (workstationId === 'unassigned') {
                whereConditions.push(`e.workstation_id IS NULL`);
            } else {
                whereConditions.push(`e.workstation_id = $${paramIndex}`);
                queryParams.push(workstationId);
                paramIndex++;
            }
        }

        if (type) {
            whereConditions.push(`e.type = $${paramIndex}`);
            queryParams.push(type);
            paramIndex++;
        }

        if (search) {
            whereConditions.push(`(e.name ILIKE $${paramIndex} OR e.identifier ILIKE $${paramIndex} OR e.brand ILIKE $${paramIndex} OR e.model ILIKE $${paramIndex})`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        if (hasLifecycleStatusFilter) {
            whereConditions.push(`${equipmentStatusSql} = $${paramIndex}`);
            queryParams.push(normalizedStatusKey);
            paramIndex++;
        } else if (hasLegacyStatusFilter) {
            if (normalizedStatus === 'active') {
                whereConditions.push(`${equipmentActiveSql} = TRUE`);
            } else if (normalizedStatus === 'written_off') {
                whereConditions.push(`${equipmentActiveSql} = FALSE`);
            }
        }

        const whereClause = whereConditions.join(' AND ');
        const hasCleaningIntervalOverrideColumn = await hasColumn('equipment', 'cleaning_interval_override_days');
        const effectiveCleaningIntervalSql = hasCleaningIntervalOverrideColumn
            ? `COALESCE(e.cleaning_interval_override_days, e.cleaning_interval_days)`
            : `e.cleaning_interval_days`;

        // Optimized query: Use a JOIN instead of a subquery per row for counts
        // Also limit fields to what's needed for the list view to reduce payload size
        const sql = `
            WITH issue_counts AS (
                SELECT equipment_id, COUNT(*) as open_issues_count
                FROM equipment_issues
                WHERE status IN ('OPEN', 'IN_PROGRESS')
                GROUP BY equipment_id
            )
            SELECT 
                e.id, e.club_id, e.workstation_id, e.type, e.name, e.identifier, e.brand, e.model,
                e.purchase_date, e.warranty_expires, e.last_cleaned_at,
                ${equipmentActiveSql} as is_active,
                ${equipmentStatusSql} as status,
                ${effectiveCleaningIntervalSql} as cleaning_interval_days,
                ${hasCleaningIntervalOverrideColumn ? 'e.cleaning_interval_override_days' : 'NULL::integer as cleaning_interval_override_days'},
                e.thermal_paste_last_changed_at, e.thermal_paste_interval_days, e.thermal_paste_type, e.thermal_paste_note,
                e.cpu_thermal_paste_last_changed_at, e.cpu_thermal_paste_interval_days, e.cpu_thermal_paste_type, e.cpu_thermal_paste_note,
                e.gpu_thermal_paste_last_changed_at, e.gpu_thermal_paste_interval_days, e.gpu_thermal_paste_type, e.gpu_thermal_paste_note,
                e.maintenance_enabled, e.assigned_user_id, e.assignment_mode,
                w.name as workstation_name,
                w.zone as workstation_zone,
                w.assigned_user_id as workstation_assigned_user_id,
                et.name_ru as type_name,
                et.icon as type_icon,
                eu.full_name as assigned_to_name,
                wu.full_name as workstation_assigned_to_name,
                COALESCE(ic.open_issues_count, 0)::integer as open_issues_count,
                CASE 
                    WHEN e.warranty_expires IS NULL THEN NULL
                    WHEN e.warranty_expires < CURRENT_DATE THEN 'EXPIRED'
                    WHEN e.warranty_expires < CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
                    ELSE 'ACTIVE'
                END as warranty_status
            FROM equipment e
            LEFT JOIN club_workstations w ON e.workstation_id = w.id
            LEFT JOIN equipment_types et ON e.type = et.code
            LEFT JOIN issue_counts ic ON e.id = ic.equipment_id
            LEFT JOIN users eu ON eu.id = e.assigned_user_id
            LEFT JOIN users wu ON wu.id = w.assigned_user_id
            WHERE ${whereClause}
            ORDER BY w.name NULLS LAST, e.type, e.name
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        
        const countSql = `SELECT COUNT(*) FROM equipment e WHERE ${whereClause}`;

        const [result, countResult] = await Promise.all([
            query(sql, [...queryParams, limit, offset]),
            query(countSql, queryParams)
        ]);

        const total = parseInt(countResult.rows[0].count);
        const duration = Date.now() - startTime;
        
        console.log(`[PERF] GET /api/clubs/${clubId}/equipment: ${duration}ms, total: ${total}, count: ${result.rowCount}`);

        return NextResponse.json({
            equipment: result.rows.map((row: any) => normalizeEquipmentRecord(row)),
            total,
            limit,
            offset,
            duration_ms: duration
        });
    } catch (error) {
        console.error('Get Equipment Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST /api/clubs/[clubId]/equipment - Create new equipment
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        const {
            workstation_id,
            type,
            name,
            identifier,
            brand,
            model,
            purchase_date,
            warranty_expires,
            receipt_url,
            notes
        } = body;

        if (!name || !type) {
            return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
        }

        const clubInstructionResult = await query(
            `SELECT default_interval_days
             FROM club_equipment_instructions
             WHERE club_id = $1 AND equipment_type_code = $2
             LIMIT 1`,
            [clubId, type]
        );

        const typeResult = await query(
            `SELECT default_cleaning_interval FROM equipment_types WHERE code = $1`,
            [type]
        );

        const intervalDays =
            clubInstructionResult.rows[0]?.default_interval_days ||
            typeResult.rows[0]?.default_cleaning_interval ||
            30;

        const hasEquipmentStatusColumn = await hasColumn('equipment', 'status');
        const resolvedState = resolveEquipmentStateForPersistence({
            currentStatus: DEFAULT_EQUIPMENT_STATUS,
            currentIsActive: true,
            currentWorkstationId: null,
            requestedStatus: body.status,
            requestedIsActive: body.is_active,
            requestedWorkstationId: workstation_id || null,
            hasRequestedStatus: body.status !== undefined,
            hasRequestedIsActive: body.is_active !== undefined,
            hasRequestedWorkstation: workstation_id !== undefined,
        });

        const insertColumns = [
            'club_id',
            'workstation_id',
            'type',
            'name',
            'identifier',
            'brand',
            'model',
            'purchase_date',
            'warranty_expires',
            'receipt_url',
            'cleaning_interval_days',
            'notes',
            'is_active',
        ];
        const insertValues = [
            clubId,
            resolvedState.workstation_id,
            type,
            name,
            identifier || null,
            brand || null,
            model || null,
            purchase_date || null,
            warranty_expires || null,
            receipt_url || null,
            intervalDays,
            notes || null,
            resolvedState.is_active,
        ];

        if (hasEquipmentStatusColumn) {
            insertColumns.push('status');
            insertValues.push(resolvedState.status || DEFAULT_EQUIPMENT_STATUS);
        }

        const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');

        const result = await query(
            `INSERT INTO equipment (${insertColumns.join(', ')})
             VALUES (${placeholders})
             RETURNING *`,
            insertValues
        );

        // If workstation changed, record the move
        if (resolvedState.workstation_id) {
            await query(
                `INSERT INTO equipment_moves (equipment_id, from_workstation_id, to_workstation_id, moved_by, reason)
                 VALUES ($1, NULL, $2, $3, 'Initial assignment')`,
                [result.rows[0].id, resolvedState.workstation_id, userId]
            );
        }

        return NextResponse.json(normalizeEquipmentRecord(result.rows[0]), { status: 201 });
    } catch (error) {
        console.error('Create Equipment Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let body: any = null
        try {
            body = await request.json()
        } catch {
            body = null
        }

        const idsRaw = Array.isArray(body?.ids) ? body.ids : []
        const ids = Array.from(new Set(idsRaw.filter((id: any) => typeof id === 'string').map((id: string) => id.trim()).filter(Boolean)))

        if (ids.length === 0) {
            return NextResponse.json({ error: 'ids is required' }, { status: 400 });
        }

        if (ids.length > 50) {
            return NextResponse.json({ error: 'Too many ids (max 50)' }, { status: 400 });
        }

        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (ids.some((id) => !uuidRe.test(id))) {
            return NextResponse.json({ error: 'Invalid id format' }, { status: 400 });
        }

        const result = await query(
            `DELETE FROM equipment WHERE club_id = $1 AND id = ANY($2::uuid[]) RETURNING id`,
            [clubId, ids]
        );

        return NextResponse.json({
            success: true,
            requested_count: ids.length,
            deleted_count: result.rowCount || 0,
            deleted_ids: result.rows.map((row: any) => row.id),
        });
    } catch (error) {
        console.error('Bulk Delete Equipment Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
