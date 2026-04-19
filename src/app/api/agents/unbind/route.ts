import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(request: Request) {
    try {
        const { workstation_id } = await request.json();

        if (!workstation_id) {
            return NextResponse.json({ error: 'workstation_id is required' }, { status: 400 });
        }

        // Clear binding
        await query(
            `UPDATE club_workstations 
             SET binding_code = NULL, 
                 agent_last_seen = NULL, 
                 agent_status = 'OFFLINE'
             WHERE id = $1`,
            [workstation_id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Agent Unbind Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}