import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { isSuperAdmin } from '@/lib/super-admin';
import { normalizeSubscriptionPlan, normalizeSubscriptionStatus, resolveSubscriptionState } from '@/lib/subscriptions';
import { hasColumn } from '@/lib/db-compat';

async function ensureSuperAdmin() {
    const userId = (await cookies()).get('session_user_id')?.value;
    if (!userId) {
        return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const adminCheck = await query(
        `SELECT is_super_admin, phone_number FROM users WHERE id = $1`,
        [userId]
    );

    const canAccess = isSuperAdmin(adminCheck.rows[0]?.is_super_admin, userId, adminCheck.rows[0]?.phone_number);
    if (!canAccess) {
        return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { ok: true as const, userId };
}

export async function GET() {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;

        // Fetch all users with their club counts and actual club details
        const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
        const hasSubscriptionCanceledAt = await hasColumn('users', 'subscription_canceled_at');
        const result = await query(
            `SELECT 
                u.id, u.full_name, u.phone_number, u.subscription_plan, ${hasSubscriptionStatus ? 'u.subscription_status' : "NULL::varchar as subscription_status"},
                u.subscription_started_at, u.subscription_ends_at, ${hasSubscriptionCanceledAt ? 'u.subscription_canceled_at' : "NULL::timestamp as subscription_canceled_at"}, u.is_super_admin, u.created_at,
                (
                    SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'role', 'Owner'))
                    FROM clubs c WHERE c.owner_id = u.id
                ) as owned_clubs,
                (
                    SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'role', ce.role))
                    FROM club_employees ce 
                    JOIN clubs c ON ce.club_id = c.id 
                    WHERE ce.user_id = u.id
                ) as employee_clubs
             FROM users u
             ORDER BY u.created_at DESC`
        );

        const users = result.rows
            .filter(row => !String(row.phone_number || '').startsWith('__system_'))
            .map(row => {
            const resolved = resolveSubscriptionState(row);
            return {
                ...row,
                subscription_plan: resolved.plan,
                subscription_status: resolved.status
            };
        });

        return NextResponse.json({ users });

    } catch (error) {
        console.error('Get Admin Users Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;

        const { targetUserId, subscription_plan, subscription_status, subscription_ends_at, subscription_started_at, subscription_canceled_at } = await request.json();

        if (!targetUserId) {
            return NextResponse.json({ error: 'Target User ID is required' }, { status: 400 });
        }

        const plan = normalizeSubscriptionPlan(subscription_plan);
        let status = normalizeSubscriptionStatus(subscription_status);
        if (plan === 'new_user' && status === 'active') {
            status = 'trialing';
        }

        const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
        const hasSubscriptionCanceledAt = await hasColumn('users', 'subscription_canceled_at');
        const result = await query(
            `UPDATE users 
             SET subscription_plan = $1,
                 ${hasSubscriptionStatus ? "subscription_status = $2," : ''}
                 subscription_started_at = COALESCE($3::timestamp, subscription_started_at, NOW()),
                 subscription_ends_at = $4::timestamp
                 ${hasSubscriptionCanceledAt ? ", subscription_canceled_at = $5::timestamp" : ''}
             WHERE id = $6 
             RETURNING id, full_name, subscription_plan, ${hasSubscriptionStatus ? 'subscription_status' : "NULL::varchar as subscription_status"}, subscription_started_at, subscription_ends_at, ${hasSubscriptionCanceledAt ? 'subscription_canceled_at' : "NULL::timestamp as subscription_canceled_at"}`,
            [plan, status, subscription_started_at || null, subscription_ends_at || null, subscription_canceled_at || null, targetUserId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const resolved = resolveSubscriptionState(result.rows[0]);
        return NextResponse.json({
            user: {
                ...result.rows[0],
                subscription_plan: resolved.plan,
                subscription_status: resolved.status
            }
        });

    } catch (error) {
        console.error('Update User Subscription Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;

        const { targetUserId } = await request.json();
        if (!targetUserId) {
            return NextResponse.json({ error: 'Target User ID is required' }, { status: 400 });
        }
        if (targetUserId === auth.userId) {
            return NextResponse.json({ error: 'Нельзя удалить самого себя' }, { status: 400 });
        }

        const userResult = await query(
            `SELECT id, is_super_admin, phone_number FROM users WHERE id = $1`,
            [targetUserId]
        );
        if ((userResult.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        if (userResult.rows[0].is_super_admin) {
            return NextResponse.json({ error: 'Нельзя удалить супер-админа' }, { status: 400 });
        }
        if (String(userResult.rows[0].phone_number || '').startsWith('__system_')) {
            return NextResponse.json({ error: 'Нельзя удалить системного пользователя' }, { status: 400 });
        }

        const linkedResult = await query(
            `SELECT EXISTS(SELECT 1 FROM clubs WHERE owner_id = $1) as is_owner,
                    EXISTS(SELECT 1 FROM club_employees WHERE user_id = $1) as is_employee`,
            [targetUserId]
        );
        const isOwner = linkedResult.rows[0]?.is_owner === true;
        const isEmployee = linkedResult.rows[0]?.is_employee === true;
        if (isOwner || isEmployee) {
            return NextResponse.json({ error: 'Можно удалять только непривязанных пользователей' }, { status: 400 });
        }

        await query(`DELETE FROM users WHERE id = $1`, [targetUserId]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete User Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
