import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { isSuperAdmin } from '@/lib/super-admin';
import {
    normalizeSubscriptionPlan,
    normalizeSubscriptionStatus,
    resolveSubscriptionState,
    getAllowedStatuses
} from '@/lib/subscriptions';
import { hasColumn } from '@/lib/db-compat';

async function ensureSuperAdmin() {
    const userId = (await cookies()).get('session_user_id')?.value;
    if (!userId) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const adminCheck = await query(
        `SELECT is_super_admin, phone_number FROM users WHERE id = $1`,
        [userId]
    );

    const canAccess = isSuperAdmin(adminCheck.rows[0]?.is_super_admin, userId, adminCheck.rows[0]?.phone_number);

    if (!canAccess) {
        return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { ok: true as const };
}

export async function GET() {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;

        // Получаем каталог тарифов
        const catalogResult = await query(
            `SELECT code, name, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, is_active
             FROM subscription_plans
             WHERE is_active = TRUE
             ORDER BY display_order ASC`
        );
        const catalog = catalogResult.rows;

        // Получаем данные о подписках пользователей
        const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
        const hasSubscriptionCanceledAt = await hasColumn('users', 'subscription_canceled_at');
        const result = await query(
            `SELECT 
                u.id,
                u.full_name,
                u.phone_number,
                u.subscription_plan,
                ${hasSubscriptionStatus ? 'u.subscription_status' : "NULL::varchar as subscription_status"},
                u.subscription_started_at,
                u.subscription_ends_at,
                ${hasSubscriptionCanceledAt ? 'u.subscription_canceled_at' : "NULL::timestamp as subscription_canceled_at"},
                u.created_at,
                COALESCE((
                    SELECT COUNT(DISTINCT club_link.club_id)
                    FROM (
                        SELECT c.id as club_id
                        FROM clubs c
                        WHERE c.owner_id = u.id
                        UNION
                        SELECT ce.club_id
                        FROM club_employees ce
                        WHERE ce.user_id = u.id
                          AND ce.role = 'Владелец'
                          AND ce.is_active = TRUE
                          AND ce.dismissed_at IS NULL
                    ) club_link
                ), 0)::integer as clubs_count,
                COALESCE((
                    SELECT json_agg(json_build_object('id', club_link.club_id, 'name', club_link.club_name))
                    FROM (
                        SELECT c.id as club_id, c.name as club_name
                        FROM clubs c
                        WHERE c.owner_id = u.id
                        UNION
                        SELECT c2.id as club_id, c2.name as club_name
                        FROM club_employees ce
                        JOIN clubs c2 ON c2.id = ce.club_id
                        WHERE ce.user_id = u.id
                          AND ce.role = 'Владелец'
                          AND ce.is_active = TRUE
                          AND ce.dismissed_at IS NULL
                    ) club_link
                ), '[]'::json) as owner_clubs,
                COALESCE((
                    SELECT COUNT(*)
                    FROM club_employees ce
                    WHERE ce.club_id IN (
                        SELECT c.id
                        FROM clubs c
                        WHERE c.owner_id = u.id
                        UNION
                        SELECT ce2.club_id
                        FROM club_employees ce2
                        WHERE ce2.user_id = u.id
                          AND ce2.role = 'Владелец'
                          AND ce2.is_active = TRUE
                          AND ce2.dismissed_at IS NULL
                    )
                      AND ce.is_active = TRUE
                      AND ce.dismissed_at IS NULL
                ), 0)::integer as employees_count
             FROM users u
             WHERE EXISTS (
                    SELECT 1
                    FROM clubs c
                    WHERE c.owner_id = u.id
                )
                OR EXISTS (
                    SELECT 1
                    FROM club_employees ce
                    WHERE ce.user_id = u.id
                      AND ce.role = 'Владелец'
                      AND ce.is_active = TRUE
                      AND ce.dismissed_at IS NULL
                )
             ORDER BY u.created_at DESC`
        );

        const subscriptions = result.rows.map(row => {
            const resolved = resolveSubscriptionState(row);
            const planFromCatalog = catalog.find(p => p.code === resolved.plan);
            
            return {
                id: row.id,
                full_name: row.full_name,
                phone_number: row.phone_number,
                created_at: row.created_at,
                clubs_count: Number(row.clubs_count || 0),
                employees_count: Number(row.employees_count || 0),
                owner_clubs: Array.isArray(row.owner_clubs) ? row.owner_clubs : [],
                subscription_plan: resolved.plan,
                subscription_status: resolved.status,
                subscription_started_at: row.subscription_started_at,
                subscription_ends_at: row.subscription_ends_at,
                subscription_canceled_at: row.subscription_canceled_at,
                subscription_is_active: resolved.isActive,
                is_in_grace_period: resolved.isInGracePeriod,
                grace_period_info: resolved.graceEndsAt ? {
                    ends_at: resolved.graceEndsAt,
                    days_left: resolved.gracePeriodDays
                } : null
            };
        });

        const summary = subscriptions.reduce(
            (acc, item) => {
                acc.total += 1;
                if (item.subscription_is_active) acc.active += 1;
                if (item.subscription_status === 'trialing') acc.trialing += 1;
                if (item.subscription_status === 'expired') acc.expired += 1;
                if (item.subscription_status === 'canceled') acc.canceled += 1;
                return acc;
            },
            { total: 0, active: 0, trialing: 0, expired: 0, canceled: 0 }
        );

        return NextResponse.json({
            subscriptions,
            summary,
            meta: {
                plans: catalog,
                statuses: getAllowedStatuses()
            }
        });
    } catch (error) {
        console.error('Get Subscriptions Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;

        const body = await request.json();
        const targetUserId = body.targetUserId as string | undefined;

        if (!targetUserId) {
            return NextResponse.json({ error: 'Target User ID is required' }, { status: 400 });
        }

        const ownershipCheck = await query(
            `SELECT 1
             FROM users u
             WHERE u.id = $1
               AND (
                    EXISTS (SELECT 1 FROM clubs c WHERE c.owner_id = u.id)
                    OR EXISTS (
                        SELECT 1
                        FROM club_employees ce
                        WHERE ce.user_id = u.id
                          AND ce.role = 'Владелец'
                          AND ce.is_active = TRUE
                          AND ce.dismissed_at IS NULL
                    )
               )`,
            [targetUserId]
        );

        if ((ownershipCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'User not found or no access' }, { status: 404 });
        }

        const planToApply = normalizeSubscriptionPlan(body.plan);
        const statusToApply = normalizeSubscriptionStatus(body.status);
        const startsAt = body.startsAt ? new Date(body.startsAt) : null;
        const endsAt = body.endsAt ? new Date(body.endsAt) : null;

        let status = '';
        const setParts: string[] = ['subscription_plan = $1'];
        const params: any[] = [planToApply];
        let paramIndex = 2;

        if (body.status) {
            setParts.push(`subscription_status = $${paramIndex}`);
            params.push(statusToApply);
            paramIndex++;
            status = statusToApply;
        }

        if (startsAt) {
            setParts.push(`subscription_started_at = $${paramIndex}`);
            params.push(startsAt);
            paramIndex++;
        }

        if (endsAt) {
            setParts.push(`subscription_ends_at = $${paramIndex}`);
            params.push(endsAt);
            paramIndex++;
        }

        if (body.cancel !== undefined) {
            setParts.push(`subscription_canceled_at = ${body.cancel ? 'NOW()' : 'NULL'}`);
        }

        params.push(targetUserId);

        await query(
            `UPDATE users SET ${setParts.join(', ')} WHERE id = $${paramIndex}`,
            params
        );

        const updated = await query(
            `SELECT id, subscription_plan, subscription_status, subscription_started_at, subscription_ends_at, subscription_canceled_at
             FROM users WHERE id = $1`,
            [targetUserId]
        );

        return NextResponse.json({ user: updated.rows[0] });
    } catch (error) {
        console.error('Update Subscription Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
