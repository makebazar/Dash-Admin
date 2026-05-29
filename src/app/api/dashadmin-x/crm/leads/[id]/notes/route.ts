import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin';

async function checkAuth() {
    const userId = (await cookies()).get('session_user_id')?.value;
    if (!userId) return null;
    const adminCheck = await query(`SELECT is_super_admin, is_staff, phone_number FROM users WHERE id = $1`, [userId]);
    const user = adminCheck.rows[0];
    if (!user) return null;
    const canAccess = isSuperAdmin(user.is_super_admin, userId, user.phone_number) || Boolean(user.is_staff);
    if (!canAccess) return null;
    return userId;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;
        const result = await query(
            `SELECT n.*, u.full_name as author_name
             FROM crm_notes n
             LEFT JOIN users u ON u.id = n.created_by_id
             WHERE n.lead_id = $1
             ORDER BY n.created_at DESC`,
            [id]
        );
        return NextResponse.json(result.rows);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await checkAuth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;
        const { content } = await request.json();
        const result = await query(
            `INSERT INTO crm_notes (lead_id, content, created_by_id) VALUES ($1, $2, $3) RETURNING *`,
            [id, content, userId]
        );
        
        const insertedNote = result.rows[0];
        const userQuery = await query(`SELECT full_name FROM users WHERE id = $1`, [userId]);
        insertedNote.author_name = userQuery.rows[0]?.full_name || null;
        
        return NextResponse.json(insertedNote);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
