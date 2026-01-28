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
        const includeInactive = searchParams.get('include_inactive') === 'true';

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

        let sql = `
            SELECT 
                e.*,
                w.name as workstation_name,
                w.zone as workstation_zone,
                et.name_ru as type_name,
                et.icon as type_icon,
                (SELECT COUNT(*) FROM equipment_issues WHERE equipment_id = e.id AND status IN ('OPEN', 'IN_PROGRESS')) as open_issues_count,
                CASE 
                    WHEN e.warranty_expires IS NULL THEN NULL
                    WHEN e.warranty_expires < CURRENT_DATE THEN 'EXPIRED'
                    WHEN e.warranty_expires < CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
                    ELSE 'ACTIVE'
                END as warranty_status
            FROM equipment e
            LEFT JOIN club_workstations w ON e.workstation_id = w.id
            LEFT JOIN equipment_types et ON e.type = et.code
            WHERE e.club_id = $1
        `;
        const queryParams: any[] = [clubId];
        let paramIndex = 2;

        if (!includeInactive) {
            sql += ` AND e.is_active = TRUE`;
        }

        if (workstationId) {
            if (workstationId === 'unassigned') {
                sql += ` AND e.workstation_id IS NULL`;
            } else {
                sql += ` AND e.workstation_id = $${paramIndex}`;
                queryParams.push(workstationId);
                paramIndex++;
            }
        }

        if (type) {
            sql += ` AND e.type = $${paramIndex}`;
            queryParams.push(type);
            paramIndex++;
        }

        sql += ` ORDER BY w.name NULLS LAST, e.type, e.name`;

        const result = await query(sql, queryParams);

        return NextResponse.json({
            equipment: result.rows,
            total: result.rowCount
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
