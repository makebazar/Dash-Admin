import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; articleId: string }> }
) {
    try {
        const { clubId, articleId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Access check
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if (accessCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await query(
            `SELECT a.*, u.full_name as author_name, u2.full_name as updated_by_name
             FROM kb_articles a
             LEFT JOIN users u ON u.id = a.created_by
             LEFT JOIN users u2 ON u2.id = a.updated_by
             WHERE a.id = $1 AND a.club_id = $2`,
            [articleId, clubId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }

        return NextResponse.json({ article: result.rows[0] });
    } catch (error: any) {
        console.error('KB Article GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ clubId: string; articleId: string }> }
) {
    try {
        const { clubId, articleId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Permission check
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );
        const adminCheck = await query(
            `SELECT 1 FROM club_employees ce 
             JOIN users u ON u.id = ce.user_id 
             JOIN roles r ON r.id = u.role_id 
             WHERE ce.club_id = $1 AND ce.user_id = $2 AND r.name IN ('Админ', 'Управляющий')`,
            [clubId, userId]
        );

        if (ownerCheck.rowCount === 0 && adminCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { title, content, category_id, order } = await request.json();

        const result = await query(
            `UPDATE kb_articles 
             SET title = $1, content = $2, category_id = $3, "order" = $4, updated_by = $5, updated_at = NOW()
             WHERE id = $6 AND club_id = $7
             RETURNING *`,
            [title, content, category_id, order || 0, userId, articleId, clubId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }

        return NextResponse.json({ article: result.rows[0] });
    } catch (error: any) {
        console.error('KB Article PUT Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string; articleId: string }> }
) {
    try {
        const { clubId, articleId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Permission check
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );
        const adminCheck = await query(
            `SELECT 1 FROM club_employees ce 
             JOIN users u ON u.id = ce.user_id 
             JOIN roles r ON r.id = u.role_id 
             WHERE ce.club_id = $1 AND ce.user_id = $2 AND r.name IN ('Админ', 'Управляющий')`,
            [clubId, userId]
        );

        if (ownerCheck.rowCount === 0 && adminCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await query(
            `DELETE FROM kb_articles WHERE id = $1 AND club_id = $2`,
            [articleId, clubId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('KB Article DELETE Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
