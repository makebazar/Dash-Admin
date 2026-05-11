import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// GET - List performance logs for a specific equipment
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string, equipmentId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, equipmentId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await query(
            `SELECT l.*, u.full_name as recorder_name
             FROM equipment_performance_logs l
             LEFT JOIN users u ON l.recorded_by = u.id
             WHERE l.equipment_id = $1 AND l.club_id = $2
             ORDER BY l.recorded_at DESC`,
            [equipmentId, clubId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Performance Logs Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Record a new performance log (usually called when completing a task)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string, equipmentId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, equipmentId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { metrics_data, notes, maintenance_task_id } = body;

        if (!metrics_data) {
            return NextResponse.json({ error: 'Metrics data is required' }, { status: 400 });
        }

        const result = await query(
            `INSERT INTO equipment_performance_logs (equipment_id, club_id, recorded_by, metrics_data, notes, maintenance_task_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [equipmentId, clubId, userId, JSON.stringify(metrics_data), notes || null, maintenance_task_id || null]
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Save Performance Log Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
