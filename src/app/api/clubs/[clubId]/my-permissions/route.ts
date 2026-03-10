import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { hasColumn } from '@/lib/db-compat';
import { resolveSubscriptionState } from '@/lib/subscriptions';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
        const ownerSubscriptionRes = await query(
            `SELECT 
                u.subscription_plan,
                ${hasSubscriptionStatus ? 'u.subscription_status' : "NULL::varchar as subscription_status"},
                u.subscription_ends_at
             FROM clubs c
             JOIN users u ON u.id = c.owner_id
             WHERE c.id = $1`,
            [clubId]
        );
        if ((ownerSubscriptionRes.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }
        const ownerSubscription = resolveSubscriptionState(ownerSubscriptionRes.rows[0]);
        const subscriptionMeta = {
            subscription_status: ownerSubscription.status,
            subscription_is_active: ownerSubscription.isActive,
            subscription_ends_at: ownerSubscription.endsAt
        };

        // Check if the user is the owner of the club
        const clubOwnerRes = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if (clubOwnerRes.rowCount && clubOwnerRes.rowCount > 0) {
            return NextResponse.json({ isFullAccess: true, ...subscriptionMeta });
        }

        // Get user's role in this club
        const userRoleRes = await query(
            `SELECT ce.role as club_role, u.role_id, r.name as role_name
             FROM club_employees ce
             LEFT JOIN users u ON u.id = ce.user_id
             LEFT JOIN roles r ON r.id = u.role_id
             WHERE ce.club_id = $1 AND ce.user_id = $2`,
            [clubId, userId]
        );

        if (userRoleRes.rowCount === 0) {
            // Not in club_employees, and not the owner (checked above)
            return NextResponse.json({ error: 'Not a club employee' }, { status: 403 });
        }

        const { role_id, role_name, club_role } = userRoleRes.rows[0];

        // Owner and Admin always have full access
        if (club_role === 'Владелец' || club_role === 'Админ' || role_name === 'Админ') {
            return NextResponse.json({ isFullAccess: true, ...subscriptionMeta });
        }

        if (!role_id) {
            return NextResponse.json({ isFullAccess: false, permissions: {}, ...subscriptionMeta });
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

        return NextResponse.json({ isFullAccess: false, permissions, ...subscriptionMeta });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
