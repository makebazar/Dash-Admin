import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

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
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

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

        let whereConditions = [`e.club_id = $1`];
        const queryParams: any[] = [clubId];
        let paramIndex = 2;

        if (!includeInactive) {
            whereConditions.push(`e.is_active = TRUE`);
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

        if (status) {
            if (status === 'active') {
                whereConditions.push(`e.is_active = TRUE`);
            } else if (status === 'written_off') {
                whereConditions.push(`e.is_active = FALSE`);
            }
        }

        const whereClause = whereConditions.join(' AND ');

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
                e.purchase_date, e.warranty_expires, e.last_cleaned_at, e.is_active, e.cleaning_interval_days,
                e.maintenance_enabled, e.assigned_user_id,
                w.name as workstation_name,
                w.zone as workstation_zone,
                w.assigned_user_id as workstation_assigned_user_id,
                et.name_ru as type_name,
                et.icon as type_icon,
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
            equipment: result.rows,
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

        // Verify ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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
            cleaning_interval_days,
            notes
        } = body;

        if (!name || !type) {
            return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
        }

        // Get default cleaning interval from equipment_types if not provided
        let intervalDays = cleaning_interval_days;
        if (!intervalDays) {
            const typeResult = await query(
                `SELECT default_cleaning_interval FROM equipment_types WHERE code = $1`,
                [type]
            );
            intervalDays = typeResult.rows[0]?.default_cleaning_interval || 30;
        }

        const result = await query(
            `INSERT INTO equipment (
                club_id, workstation_id, type, name, identifier, brand, model,
                purchase_date, warranty_expires, receipt_url, cleaning_interval_days, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
                clubId,
                workstation_id || null,
                type,
                name,
                identifier || null,
                brand || null,
                model || null,
                purchase_date || null,
                warranty_expires || null,
                receipt_url || null,
                intervalDays,
                notes || null
            ]
        );

        // If workstation changed, record the move
        if (workstation_id) {
            await query(
                `INSERT INTO equipment_moves (equipment_id, from_workstation_id, to_workstation_id, moved_by, reason)
                 VALUES ($1, NULL, $2, $3, 'Initial assignment')`,
                [result.rows[0].id, workstation_id, userId]
            );
        }

        return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error) {
        console.error('Create Equipment Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
