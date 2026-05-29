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
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;

        // Protection for core statuses
        if (id === 'new' || id === 'rejected') {
            return NextResponse.json({ error: 'Cannot delete core status' }, { status: 400 });
        }

        // Check if any leads are using this status
        const leadsCheck = await query(`SELECT count(*) as count FROM crm_leads WHERE status = $1`, [id]);
        if (parseInt(leadsCheck.rows[0].count) > 0) {
            return NextResponse.json({ error: 'Cannot delete status that is in use by leads' }, { status: 400 });
        }

        await query(`DELETE FROM crm_statuses WHERE id = $1`, [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;
        const { title, color, position } = await request.json();

        const result = await query(
            `UPDATE crm_statuses
             SET title = COALESCE($1, title),
                 color = COALESCE($2, color),
                 position = COALESCE($3, position)
             WHERE id = $4
             RETURNING *`,
            [title !== undefined ? title : null, color !== undefined ? color : null, position !== undefined ? position : null, id]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Status not found' }, { status: 404 });
        }

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error("Update CRM Status Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
