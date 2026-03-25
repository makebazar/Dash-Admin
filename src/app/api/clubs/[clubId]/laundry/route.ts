import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/db';
import { isLaundryEquipmentType } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ACTIVE_STATUSES = ['NEW', 'SENT_TO_LAUNDRY', 'READY_FOR_RETURN'];

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'active';

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const statusFilter = status === 'history'
            ? `lr.status IN ('RETURNED', 'CANCELLED')`
            : `lr.status IN ('NEW', 'SENT_TO_LAUNDRY', 'READY_FOR_RETURN')`;

        const result = await query(
            `SELECT
                lr.*,
                e.name AS equipment_name,
                e.type AS equipment_type,
                et.name_ru AS equipment_type_name,
                cw.name AS workstation_name,
                cw.zone AS zone_name,
                ru.full_name AS requested_by_name,
                pu.full_name AS processed_by_name,
                mt.completed_at AS maintenance_completed_at
             FROM equipment_laundry_requests lr
             JOIN equipment e ON lr.equipment_id = e.id
             LEFT JOIN equipment_types et ON e.type = et.code
             LEFT JOIN club_workstations cw ON e.workstation_id = cw.id
             LEFT JOIN users ru ON lr.requested_by = ru.id
             LEFT JOIN users pu ON lr.processed_by = pu.id
             LEFT JOIN equipment_maintenance_tasks mt ON lr.maintenance_task_id = mt.id
             WHERE lr.club_id = $1
               AND ${statusFilter}
             ORDER BY
                CASE lr.status
                    WHEN 'NEW' THEN 1
                    WHEN 'SENT_TO_LAUNDRY' THEN 2
                    WHEN 'READY_FOR_RETURN' THEN 3
                    WHEN 'RETURNED' THEN 4
                    WHEN 'CANCELLED' THEN 5
                    ELSE 99
                END,
                lr.created_at DESC`,
            [clubId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Laundry Requests Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const body = await request.json();
        const {
            equipment_id,
            maintenance_task_id,
            title,
            description,
            photos,
            source = 'EMPLOYEE_SERVICE'
        } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!equipment_id || !title) {
            return NextResponse.json({ error: 'equipment_id and title are required' }, { status: 400 });
        }

        if (!['EMPLOYEE_SERVICE', 'INSPECTION_CENTER'].includes(source)) {
            return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
        }

        const equipmentCheck = await query(
            `SELECT id, type FROM equipment WHERE id = $1 AND club_id = $2`,
            [equipment_id, clubId]
        );

        if ((equipmentCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
        }

        const equipment = equipmentCheck.rows[0];

        if (!isLaundryEquipmentType(equipment.type)) {
            return NextResponse.json({ error: 'Laundry flow is available only for коврики' }, { status: 400 });
        }

        const existingRequest = await query(
            `SELECT *
             FROM equipment_laundry_requests
             WHERE club_id = $1
               AND equipment_id = $2
               AND status = ANY($3)
             ORDER BY created_at DESC
             LIMIT 1`,
            [clubId, equipment_id, ACTIVE_STATUSES]
        );

        if ((existingRequest.rowCount || 0) > 0) {
            return NextResponse.json({
                ...existingRequest.rows[0],
                already_exists: true
            });
        }

        const result = await query(
            `INSERT INTO equipment_laundry_requests (
                club_id,
                equipment_id,
                maintenance_task_id,
                requested_by,
                source,
                status,
                title,
                description,
                photos
            )
             VALUES ($1, $2, $3, $4, $5, 'NEW', $6, $7, $8)
             RETURNING *`,
            [
                clubId,
                equipment_id,
                maintenance_task_id || null,
                userId,
                source,
                title,
                description || null,
                Array.isArray(photos) && photos.length > 0 ? photos : null
            ]
        );

        return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error) {
        console.error('Create Laundry Request Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
