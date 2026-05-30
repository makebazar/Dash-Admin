import { NextResponse } from 'next/server';
import { query } from '@/db';

// GET: Polled by agents to fetch pending commands
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const workstationId = searchParams.get('workstation_id');

        if (!workstationId) {
            return NextResponse.json({ error: 'workstation_id is required' }, { status: 400 });
        }

        // Fetch pending commands
        const result = await query(
            `SELECT id, type, payload FROM agent_commands 
             WHERE workstation_id = $1 AND status = 'PENDING'
             ORDER BY created_at ASC`,
            [workstationId]
        );

        const commands = result.rows;

        if (commands.length > 0) {
            const commandIds = commands.map(c => c.id);
            // Update status to 'SENT' so they are not fetched again
            await query(
                `UPDATE agent_commands 
                 SET status = 'SENT', updated_at = NOW() 
                 WHERE id = ANY($1::uuid[])`,
                [commandIds]
            );
        }

        return NextResponse.json(commands);
    } catch (error) {
        console.error('Get Agent Commands Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Queues a command for a workstation (called by Admin Panel)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { workstation_id, type, payload } = body;

        if (!workstation_id || !type) {
            return NextResponse.json({ error: 'workstation_id and type are required' }, { status: 400 });
        }

        // Insert new command
        const result = await query(
            `INSERT INTO agent_commands (workstation_id, type, payload, status)
             VALUES ($1, $2, $3, 'PENDING')
             RETURNING *`,
            [workstation_id, type, payload ? JSON.stringify(payload) : '{}']
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Queue Agent Command Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
