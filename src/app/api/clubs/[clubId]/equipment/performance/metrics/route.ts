import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// GET - List all performance metrics for a club
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

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        let sql = `SELECT * FROM club_equipment_performance_metrics WHERE club_id = $1 AND is_active = TRUE`;
        const queryParams: any[] = [clubId];

        if (type) {
            sql += ` AND equipment_type_code = $2`;
            queryParams.push(type);
        }

        sql += ` ORDER BY sort_order ASC, name ASC`;

        const result = await query(sql, queryParams);
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Performance Metrics Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Add or update performance metrics
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

        // Only owners or admins can manage metrics
        const accessCheck = await query(
            `SELECT role FROM club_employees WHERE club_id = $1 AND user_id = $2
             UNION
             SELECT 'OWNER' as role FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { metrics } = body; // Array of metrics: { id?, name, unit, equipment_type_code, is_active, sort_order }

        if (!Array.isArray(metrics)) {
            return NextResponse.json({ error: 'Metrics array is required' }, { status: 400 });
        }

        // Process each metric
        const results = [];
        for (const metric of metrics) {
            if (metric.id) {
                const res = await query(
                    `UPDATE club_equipment_performance_metrics
                     SET name = $1, unit = $2, equipment_type_code = $3, is_active = $4, sort_order = $5, updated_at = NOW()
                     WHERE id = $6 AND club_id = $7
                     RETURNING *`,
                    [metric.name, metric.unit, metric.equipment_type_code, metric.is_active ?? true, metric.sort_order ?? 0, metric.id, clubId]
                );
                results.push(res.rows[0]);
            } else {
                const res = await query(
                    `INSERT INTO club_equipment_performance_metrics (club_id, equipment_type_code, name, unit, is_active, sort_order)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING *`,
                    [clubId, metric.equipment_type_code, metric.name, metric.unit, metric.is_active ?? true, metric.sort_order ?? 0]
                );
                results.push(res.rows[0]);
            }
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error('Save Performance Metrics Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
