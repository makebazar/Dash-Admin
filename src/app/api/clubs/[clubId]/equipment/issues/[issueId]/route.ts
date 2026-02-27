import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// PATCH - Update issue status
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; issueId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, issueId } = await params;
        const body = await request.json();

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

        // Verify issue belongs to equipment in this club
        const issueCheck = await query(
            `SELECT i.* FROM equipment_issues i
             JOIN equipment e ON i.equipment_id = e.id
             WHERE i.id = $1 AND e.club_id = $2`,
            [issueId, clubId]
        );

        if ((issueCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
        }

        const { status, resolution_notes, assigned_to } = body;

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (status !== undefined) {
            updates.push(`status = $${paramIndex}`);
            values.push(status);
            paramIndex++;

            // If resolving/closing, set resolved_by and resolved_at
            if (status === 'RESOLVED' || status === 'CLOSED') {
                updates.push(`resolved_by = $${paramIndex}`);
                values.push(userId);
                paramIndex++;

                updates.push(`resolved_at = CURRENT_TIMESTAMP`);
            }
        }

        if (assigned_to !== undefined) {
            updates.push(`assigned_to = $${paramIndex}`);
            values.push(assigned_to || null);
            paramIndex++;
        }

        if (resolution_notes !== undefined) {
            updates.push(`resolution_notes = $${paramIndex}`);
            values.push(resolution_notes);
            paramIndex++;
        }

        if (body.resolution_photos !== undefined) {
            updates.push(`resolution_photos = $${paramIndex}`);
            values.push(body.resolution_photos);
            paramIndex++;
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(issueId);

        const result = await query(
            `UPDATE equipment_issues 
             SET ${updates.join(', ')}
             WHERE id = $${paramIndex}
             RETURNING *`,
            values
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Update Issue Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE - Delete issue
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string; issueId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, issueId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await query(
            `DELETE FROM equipment_issues i
             USING equipment e
             WHERE i.equipment_id = e.id AND i.id = $1 AND e.club_id = $2
             RETURNING i.id`,
            [issueId, clubId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Issue Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
