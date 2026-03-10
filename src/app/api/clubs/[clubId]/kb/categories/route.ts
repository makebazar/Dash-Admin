import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check if user is employee or owner of this club
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
            `SELECT * FROM kb_categories WHERE club_id = $1 ORDER BY "order" ASC, name ASC`,
            [clubId]
        );

        return NextResponse.json({ categories: result.rows });
    } catch (error: any) {
        console.error('KB Categories GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check if user is owner or has manage_kb permission
        // For simplicity, we'll check owner/admin for now as per other routes
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

        const { name, description, parent_id, icon, order } = await request.json();

        const result = await query(
            `INSERT INTO kb_categories (club_id, name, description, parent_id, icon, "order")
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [clubId, name, description, parent_id || null, icon || null, order || 0]
        );

        return NextResponse.json({ category: result.rows[0] });
    } catch (error: any) {
        console.error('KB Categories POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
