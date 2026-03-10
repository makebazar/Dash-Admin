import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { isSuperAdmin } from '@/lib/super-admin';
import {
    getAllowedStatuses,
    getAllowedPlans,
    normalizeSubscriptionPlan,
    normalizeSubscriptionStatus,
    resolveSubscriptionState
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

async function loadPlanCatalog() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id SERIAL PRIMARY KEY,
                code VARCHAR(100) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                price_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
                period_unit VARCHAR(20) NOT NULL DEFAULT 'month',
                period_value INTEGER NOT NULL DEFAULT 1,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await query(
            `INSERT INTO subscription_plans (code, name, price_amount, period_unit, period_value, is_active)
             VALUES
                ('new_user', 'Новый пользователь', 0, 'day', 7, TRUE),
                ('starter', 'Стартовый', 2900, 'month', 1, TRUE),
                ('pro', 'Про', 7900, 'month', 1, TRUE),
                ('enterprise', 'Энтерпрайз', 19900, 'month', 1, TRUE)
             ON CONFLICT (code) DO NOTHING`
        );
        await query(`UPDATE subscription_plans SET is_active = FALSE, updated_at = NOW() WHERE code = 'trial'`);

        const result = await query(
            `SELECT code, name, price_amount, period_unit, period_value, is_active
             FROM subscription_plans
             ORDER BY created_at DESC`
        );

        const catalog = result.rows || [];
        const byCode = new Map<string, { code: string; name: string; price_amount: number; period_unit: string; period_value: number; is_active: boolean }>();
        for (const row of catalog) {
            byCode.set(String(row.code), {
                code: String(row.code),
                name: String(row.name),
                price_amount: Number(row.price_amount || 0),
                period_unit: String(row.period_unit),
                period_value: Number(row.period_value || 1),
                is_active: Boolean(row.is_active)
            });
        }

        return { catalog, byCode };
    } catch {
        const fallback = getAllowedPlans().map(code => ({
            code,
            name: code,
            price_amount: 0,
            period_unit: 'month',
            period_value: 1,
            is_active: true
        }));
        return { catalog: fallback, byCode: new Map(fallback.map(item => [item.code, item])) };
    }
}

export async function GET() {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;
        const { catalog, byCode } = await loadPlanCatalog();

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
            const planFromCatalog = byCode.get(resolved.plan);
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
                subscription_limits: {
                    max_clubs: resolved.planDefinition.maxClubs,
                    max_employees_per_club: resolved.planDefinition.maxEmployeesPerClub,
                    price_monthly: planFromCatalog?.price_amount ?? resolved.planDefinition.priceMonthly
                },
                subscription_is_active: resolved.isActive
            };
        });

        const summary = subscriptions.reduce(
            (acc, item) => {
                acc.total += 1;
                if (item.subscription_is_active) acc.active += 1;
                if (item.subscription_status === 'trialing') acc.trialing += 1;
                if (item.subscription_status === 'expired') acc.expired += 1;
                if (item.subscription_status === 'canceled') acc.canceled += 1;
                const plan = byCode.get(item.subscription_plan);
                acc.mrr += plan?.price_amount ?? 0;
                return acc;
            },
            { total: 0, active: 0, trialing: 0, expired: 0, canceled: 0, mrr: 0 }
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
        const { byCode } = await loadPlanCatalog();

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
            return NextResponse.json({ error: 'Подписку можно менять только владельцу клуба' }, { status: 403 });
        }

        const nextPlan = normalizeSubscriptionPlan(body.subscription_plan);
        let nextStatus = normalizeSubscriptionStatus(body.subscription_status);
        const nextStartedAt = body.subscription_started_at || null;
        const nextEndsAt = body.subscription_ends_at || null;
        const nextCanceledAt = body.subscription_canceled_at || null;

        if (!byCode.has(nextPlan)) {
            return NextResponse.json({ error: 'Plan not found in catalog' }, { status: 400 });
        }

        if (nextPlan === 'new_user' && nextStatus === 'active') {
            nextStatus = 'trialing';
        }

        const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
        const hasSubscriptionCanceledAt = await hasColumn('users', 'subscription_canceled_at');
        const result = await query(
            `WITH owner_clubs AS (
                SELECT c.id as club_id
                FROM clubs c
                WHERE c.owner_id = $6
                UNION
                SELECT ce.club_id
                FROM club_employees ce
                WHERE ce.user_id = $6
                  AND ce.role = 'Владелец'
                  AND ce.is_active = TRUE
                  AND ce.dismissed_at IS NULL
             ),
             owner_users AS (
                SELECT c.owner_id as owner_user_id
                FROM clubs c
                WHERE c.id IN (SELECT club_id FROM owner_clubs)
                UNION
                SELECT ce.user_id as owner_user_id
                FROM club_employees ce
                WHERE ce.club_id IN (SELECT club_id FROM owner_clubs)
                  AND ce.role = 'Владелец'
                  AND ce.is_active = TRUE
                  AND ce.dismissed_at IS NULL
             )
             UPDATE users
             SET subscription_plan = $1,
                 ${hasSubscriptionStatus ? 'subscription_status = $2,' : ''}
                 subscription_started_at = COALESCE($3::timestamp, subscription_started_at, NOW()),
                 subscription_ends_at = $4::timestamp
                 ${hasSubscriptionCanceledAt ? ', subscription_canceled_at = $5::timestamp' : ''}
             WHERE id IN (SELECT owner_user_id FROM owner_users)
             RETURNING id, full_name, subscription_plan, ${hasSubscriptionStatus ? 'subscription_status' : "NULL::varchar as subscription_status"}, subscription_started_at, subscription_ends_at, ${hasSubscriptionCanceledAt ? 'subscription_canceled_at' : "NULL::timestamp as subscription_canceled_at"}`,
            [nextPlan, nextStatus, nextStartedAt, nextEndsAt, nextCanceledAt, targetUserId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const users = result.rows.map(row => {
            const resolved = resolveSubscriptionState(row);
            return {
                ...row,
                subscription_plan: resolved.plan,
                subscription_status: resolved.status
            };
        });

        return NextResponse.json({
            user: users[0],
            synced_users_count: users.length,
            synced_users: users
        });
    } catch (error) {
        console.error('Update Subscription Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
