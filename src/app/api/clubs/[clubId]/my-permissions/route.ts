import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check if the user is the owner of the club
        const clubOwnerRes = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if (clubOwnerRes.rowCount && clubOwnerRes.rowCount > 0) {
            return NextResponse.json({ isFullAccess: true });
        }

        // Get user's role in this club
        const userRoleRes = await query(
            `SELECT u.role_id, r.name as role_name
             FROM club_employees ce
             JOIN users u ON u.id = ce.user_id
             JOIN roles r ON r.id = u.role_id
             WHERE ce.club_id = $1 AND ce.user_id = $2`,
            [clubId, userId]
        );

        if (userRoleRes.rowCount === 0) {
            // Not in club_employees, and not the owner (checked above)
            return NextResponse.json({ error: 'Not a club employee' }, { status: 403 });
        }

        const { role_id, role_name } = userRoleRes.rows[0];

        // Owner and Admin always have full access
        if (role_name === 'Владелец' || role_name === 'Админ') {
            return NextResponse.json({ isFullAccess: true });
        }

        // Get permissions for this role
        const permissionsRes = await query(
            `SELECT permission_key, is_allowed 
             FROM role_permissions 
             WHERE club_id = $1 AND role_id = $2`,
            [clubId, role_id]
        );

        const permissions: Record<string, boolean> = {};
        permissionsRes.rows.forEach(row => {
            permissions[row.permission_key] = row.is_allowed;
        });

        return NextResponse.json({ isFullAccess: false, permissions });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
