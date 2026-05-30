import { NextResponse } from 'next/server';
import { query } from '@/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { workstation_id, command_id } = body;

        if (!workstation_id || !command_id) {
            return NextResponse.json({ error: 'workstation_id and command_id are required' }, { status: 400 });
        }

        // Update command status to COMPLETED
        const result = await query(
            `UPDATE agent_commands 
             SET status = 'COMPLETED', updated_at = NOW() 
             WHERE id = $1 AND workstation_id = $2 
             RETURNING id, status`,
            [command_id, workstation_id]
        );

        if ((result.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Command not found or unauthorized' }, { status: 404 });
        }

        return NextResponse.json({ success: true, command: result.rows[0] });
    } catch (error) {
        console.error('Mark Command Done Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
