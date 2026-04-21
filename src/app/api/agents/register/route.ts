import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(request: Request) {
    try {
        const { binding_code, hostname } = await request.json();

        if (!binding_code) {
            return NextResponse.json({ error: 'binding_code is required' }, { status: 400 });
        }

        // Find workstation by binding code
        const workstation = await query(
            `SELECT id, club_id, name FROM club_workstations 
             WHERE binding_code = $1`,
            [binding_code.toUpperCase()]
        );

        if (!workstation.rows || workstation.rows.length === 0) {
            return NextResponse.json({ error: 'Invalid binding code' }, { status: 404 });
        }

        const ws = workstation.rows[0];

        // Update last seen and status
        await query(
            `UPDATE club_workstations 
             SET agent_last_seen = NOW(), 
                 agent_status = 'ONLINE',
                 name = COALESCE($1, name)
             WHERE id = $2`,
            [hostname || null, ws.id]
        );

        // Return MQTT connection details
        // Agent will use these to connect and subscribe
        return NextResponse.json({
            workstation_id: ws.id,
            club_id: ws.club_id,
            name: ws.name,
            mqtt: {
                broker_url: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
                username: process.env.MQTT_USERNAME || 'dashadmin',
                password: process.env.MQTT_PASSWORD || '',
                telemetry_topic: `agent/${ws.id}/telemetry`
            }
        });
    } catch (error) {
        console.error('Agent Register Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
