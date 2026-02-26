import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET - List all issues for equipment in a club
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url);

        const status = searchParams.get('status');
        const equipmentId = searchParams.get('equipment_id');
        const severity = searchParams.get('severity');

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
                i.*,
                e.name as equipment_name,
                e.type as equipment_type,
                et.name_ru as equipment_type_name,
                w.name as workstation_name,
                w.zone as workstation_zone,
                ru.full_name as reported_by_name,
                res.full_name as resolved_by_name
            FROM equipment_issues i
            JOIN equipment e ON i.equipment_id = e.id
            LEFT JOIN equipment_types et ON e.type = et.code
            LEFT JOIN club_workstations w ON e.workstation_id = w.id
            LEFT JOIN users ru ON i.reported_by = ru.id
            LEFT JOIN users res ON i.resolved_by = res.id
            WHERE e.club_id = $1
        `;
        const queryParams: any[] = [clubId];
        let paramIndex = 2;

        if (status) {
            sql += ` AND i.status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }

        if (equipmentId) {
            sql += ` AND i.equipment_id = $${paramIndex}`;
            queryParams.push(equipmentId);
            paramIndex++;
        }

        if (severity) {
            sql += ` AND i.severity = $${paramIndex}`;
            queryParams.push(severity);
            paramIndex++;
        }

        sql += ` ORDER BY 
            CASE i.status 
                WHEN 'OPEN' THEN 1 
                WHEN 'IN_PROGRESS' THEN 2 
                WHEN 'RESOLVED' THEN 3 
                ELSE 4 
            END,
            CASE i.severity 
                WHEN 'CRITICAL' THEN 1 
                WHEN 'HIGH' THEN 2 
                WHEN 'MEDIUM' THEN 3 
                ELSE 4 
            END,
            i.created_at DESC`;

        const result = await query(sql, queryParams);

        // Get stats
        const statsResult = await query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'OPEN') as open_count,
                COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_count,
                COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_count,
                COUNT(*) FILTER (WHERE status = 'CLOSED') as closed_count
            FROM equipment_issues i
            JOIN equipment e ON i.equipment_id = e.id
            WHERE e.club_id = $1`,
            [clubId]
        );

        return NextResponse.json({
            issues: result.rows,
            stats: statsResult.rows[0],
            total: result.rowCount
        });
    } catch (error) {
        console.error('Get Issues Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Create new issue (available to employees)
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

        // Verify access (employees can create issues)
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { equipment_id, title, description, severity } = body;

        if (!equipment_id || !title) {
            return NextResponse.json({ error: 'Equipment ID and title are required' }, { status: 400 });
        }

        // Verify equipment belongs to club
        const equipmentCheck = await query(
            `SELECT 1 FROM equipment WHERE id = $1 AND club_id = $2`,
            [equipment_id, clubId]
        );

        if ((equipmentCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
        }

        const result = await query(
            `INSERT INTO equipment_issues (club_id, equipment_id, reported_by, title, description, severity)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [clubId, equipment_id, userId, title, description || null, severity || 'MEDIUM']
        );

        return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error) {
        console.error('Create Issue Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
