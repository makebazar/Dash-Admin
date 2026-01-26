import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string, taskId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, taskId } = await params;
        const { status, assigned_user_id, notes } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const updates: string[] = [];
        const values: any[] = [];
        let paramIdx = 1;

        if (status !== undefined) {
            updates.push(`status = $${paramIdx++}`);
            values.push(status);
            if (status === 'COMPLETED') {
                updates.push(`completed_at = $${paramIdx++}`);
                values.push(new Date().toISOString());
            } else if (status === 'PENDING') {
                updates.push(`completed_at = NULL`);
            }
        }

        if (assigned_user_id !== undefined) {
            updates.push(`assigned_user_id = $${paramIdx++}`);
            values.push(assigned_user_id === '' || assigned_user_id === null ? null : assigned_user_id);
        }

        if (notes !== undefined) {
            updates.push(`notes = $${paramIdx++}`);
            values.push(notes);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
        }

        values.push(taskId);
        const queryStr = `UPDATE pc_maintenance_tasks SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`;

        const result = await query(queryStr, values);

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Update Maintenance Task Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
