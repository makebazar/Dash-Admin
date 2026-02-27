import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

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

        const result = await query(
            `SELECT c.*, u.full_name as author_name, u.role as author_role
             FROM equipment_issue_comments c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.issue_id = $1
             ORDER BY c.created_at ASC`,
            [issueId]
        );

        return NextResponse.json({ comments: result.rows });
    } catch (error) {
        console.error('Get Comments Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(
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

        const { content, is_system_message } = body;

        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }

        const result = await query(
            `INSERT INTO equipment_issue_comments (issue_id, user_id, content, is_system_message)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [issueId, userId, content, is_system_message || false]
        );

        // Fetch user details for response
        const userResult = await query(
            `SELECT full_name, role FROM users WHERE id = $1`,
            [userId]
        );

        const newComment = {
            ...result.rows[0],
            author_name: userResult.rows[0]?.full_name,
            author_role: userResult.rows[0]?.role
        };

        return NextResponse.json(newComment, { status: 201 });
    } catch (error) {
        console.error('Create Comment Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
