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
        const result = await query(`SELECT * FROM crm_contacts WHERE lead_id = $1 ORDER BY created_at ASC`, [id]);
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
        if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;
        const { name, phone, tg_username, role } = await request.json();
        const result = await query(
            `INSERT INTO crm_contacts (lead_id, name, phone, tg_username, role) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [id, name, phone || null, tg_username || null, role || null]
        );
        return NextResponse.json(result.rows[0]);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
