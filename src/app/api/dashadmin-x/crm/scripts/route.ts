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

export async function GET() {
    try {
        if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const result = await query(`SELECT * FROM crm_scripts ORDER BY created_at DESC`);
        return NextResponse.json(result.rows);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { title, content } = await request.json();
        const result = await query(
            `INSERT INTO crm_scripts (title, content) VALUES ($1, $2) RETURNING *`,
            [title, content]
        );
        return NextResponse.json(result.rows[0]);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
