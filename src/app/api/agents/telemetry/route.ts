import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { workstation_id, cpu, gpu, hostname } = body;

        if (!workstation_id) {
            return NextResponse.json({ error: 'workstation_id is required' }, { status: 400 });
        }

        // Insert telemetry
        await query(
            `INSERT INTO agent_telemetry 
             (workstation_id, hostname, cpu_temp, cpu_usage, cpu_model, gpu_data)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                workstation_id,
                hostname,
                cpu?.temp || 0,
                cpu?.usage || 0,
                cpu?.model_name || null,
                gpu ? JSON.stringify(gpu) : null
            ]
        );

        // Update workstation status
        await query(
            `UPDATE club_workstations 
             SET agent_last_seen = NOW(), 
                 agent_status = 'ONLINE'
             WHERE id = $1`,
            [workstation_id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Telemetry Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}