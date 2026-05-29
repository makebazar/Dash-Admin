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

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string, contactId: string }> }
) {
    try {
        if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { contactId } = await params;
        await query(`DELETE FROM crm_contacts WHERE id = $1`, [contactId]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
