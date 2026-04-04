import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { hasColumn } from '@/lib/db-compat';

// GET - Get single issue details
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; issueId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, issueId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const hasClubIdColumn = await hasColumn('equipment_issues', 'club_id');
        const result = await query(
            `SELECT 
                i.*,
                e.name as equipment_name,
                e.type as equipment_type,
                e.identifier as equipment_identifier,
                et.name_ru as equipment_type_name,
                w.name as workstation_name,
                w.zone as workstation_zone,
                ru.full_name as reported_by_name,
                res.full_name as resolved_by_name,
                au.full_name as assigned_to_name,
                mt.photos as source_photos
            FROM equipment_issues i
            JOIN equipment e ON i.equipment_id = e.id
            LEFT JOIN equipment_types et ON e.type = et.code
            LEFT JOIN club_workstations w ON e.workstation_id = w.id
            LEFT JOIN equipment_maintenance_tasks mt ON mt.id = i.maintenance_task_id
            LEFT JOIN users ru ON i.reported_by = ru.id
            LEFT JOIN users res ON i.resolved_by = res.id
            LEFT JOIN users au ON i.assigned_to = au.id
            WHERE i.id = $1 AND ${hasClubIdColumn ? 'i.club_id = $2' : 'e.club_id = $2'}
            LIMIT 1`,
            [issueId, clubId]
        );

        if ((result.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
        }

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Get Issue Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

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

        const { status, resolution_notes, assigned_to, severity } = body;

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

        if (severity !== undefined) {
            updates.push(`severity = $${paramIndex}`);
            values.push(severity);
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
