import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ workstationId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { workstationId } = await params;
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '60');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify access
        const access = await query(
            `SELECT 1 FROM club_workstations w
             JOIN clubs c ON w.club_id = c.id
             WHERE w.id = $1 AND (c.owner_id = $2 OR EXISTS (
                 SELECT 1 FROM club_employees WHERE club_id = w.club_id AND user_id = $2
             ))`,
            [workstationId, userId]
        );

        if ((access.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get latest telemetry with all fields
        const latest = await query(
            `SELECT * FROM agent_telemetry 
             WHERE workstation_id = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [workstationId]
        );

        // Get history for charts
        const history = await query(
            `SELECT cpu_temp, cpu_usage, cpu_model, gpu_data, created_at 
             FROM agent_telemetry
             WHERE workstation_id = $1 
               AND created_at > NOW() - INTERVAL '1 hour'
             ORDER BY created_at ASC
             LIMIT $2`,
            [workstationId, limit]
        );

        // Get workstation info with binding code
        const workstation = await query(
            `SELECT id, name, zone, agent_last_seen, agent_status, binding_code 
             FROM club_workstations WHERE id = $1`,
            [workstationId]
        );

        return NextResponse.json({
            latest: latest.rows[0] || null,
            history: history.rows,
            workstation: workstation.rows[0] || null
        });
    } catch (error) {
        console.error('Get Telemetry Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
