import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/db';
import { hasColumn } from '@/lib/db-compat';

const normalizePeriodUnit = (value: string | null | undefined) => {
    if (value === 'day' || value === 'month' || value === 'year') return value;
    return 'month';
};

const addPeriod = (base: Date, unit: string, value: number) => {
    const next = new Date(base);
    if (unit === 'day') {
        next.setDate(next.getDate() + value);
        return next;
    }
    if (unit === 'year') {
        next.setFullYear(next.getFullYear() + value);
        return next;
    }
    next.setMonth(next.getMonth() + value);
    return next;
};

async function ensurePlansTable() {
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

    await query(`CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active, created_at DESC)`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS tagline VARCHAR(255)`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS description TEXT`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS badge_text VARCHAR(100)`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS badge_tone VARCHAR(30) NOT NULL DEFAULT 'default'`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS cta_text VARCHAR(100)`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS card_theme VARCHAR(30) NOT NULL DEFAULT 'light'`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 100`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN NOT NULL DEFAULT FALSE`);
    await query(
        `INSERT INTO subscription_plans (code, name, tagline, description, features, badge_text, badge_tone, cta_text, card_theme, display_order, is_highlighted, price_amount, period_unit, period_value, is_active)
         VALUES
            ('new_user', 'Новый пользователь', '7 дней доступа', 'Подходит для быстрого старта нового клуба', '["До 1 клуба","До 3 сотрудников в клубе","Базовый доступ"]'::jsonb, 'Старт', 'info', 'Начать бесплатно', 'light', 10, FALSE, 0, 'day', 7, TRUE),
            ('starter', 'Стартовый', 'Для небольшого клуба', 'Оптимальный тариф для стабильной работы', '["До 1 клуба","До 15 сотрудников в клубе","Базовая аналитика"]'::jsonb, NULL, 'default', 'Выбрать Стартовый', 'light', 20, FALSE, 2900, 'month', 1, TRUE),
            ('pro', 'Про', 'Для роста сети', 'Расширенные лимиты и аналитика', '["До 3 клубов","До 50 сотрудников в клубе","Продвинутая аналитика"]'::jsonb, 'Популярный', 'success', 'Перейти на Про', 'dark', 30, TRUE, 7900, 'month', 1, TRUE),
            ('enterprise', 'Энтерпрайз', 'Без ограничений', 'Максимальные возможности для сети клубов', '["Безлимит клубов","Безлимит сотрудников","Приоритетная поддержка"]'::jsonb, 'Максимум', 'warning', 'Связаться с нами', 'accent', 40, FALSE, 19900, 'month', 1, TRUE)
         ON CONFLICT (code) DO NOTHING`
    );
    await query(`UPDATE subscription_plans SET is_active = FALSE, updated_at = NOW() WHERE code = 'trial'`);
}

async function getOwnerClubIds(userId: string) {
    const result = await query(
        `SELECT DISTINCT club_id
         FROM (
            SELECT c.id as club_id
            FROM clubs c
            WHERE c.owner_id = $1
            UNION
            SELECT ce.club_id
            FROM club_employees ce
            WHERE ce.user_id = $1
              AND ce.role = 'Владелец'
              AND ce.is_active = TRUE
              AND ce.dismissed_at IS NULL
         ) owner_clubs`,
        [userId]
    );
    return result.rows.map(row => Number(row.club_id)).filter(value => Number.isInteger(value) && value > 0);
}

export async function GET() {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await ensurePlansTable();
        const ownerClubIds = await getOwnerClubIds(userId);
        if (ownerClubIds.length === 0) {
            return NextResponse.json({ error: 'Смена тарифа доступна только владельцам клубов' }, { status: 403 });
        }

        const plansResult = await query(
            `SELECT id, code, name, tagline, description, features, badge_text, badge_tone, cta_text, card_theme, display_order, is_highlighted, price_amount, period_unit, period_value, is_active
             FROM subscription_plans
             WHERE is_active = TRUE
             ORDER BY display_order ASC, created_at DESC`
        );

        const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
        const userResult = await query(
            `SELECT subscription_plan, ${hasSubscriptionStatus ? 'subscription_status' : "NULL::varchar as subscription_status"}, subscription_ends_at
             FROM users
             WHERE id = $1`,
            [userId]
        );

        return NextResponse.json({
            plans: plansResult.rows,
            current: userResult.rows[0] || null
        });
    } catch (error) {
        console.error('Get Self Subscription Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await ensurePlansTable();
        const ownerClubIds = await getOwnerClubIds(userId);
        if (ownerClubIds.length === 0) {
            return NextResponse.json({ error: 'Смена тарифа доступна только владельцам клубов' }, { status: 403 });
        }

        const body = await request.json();
        const planCode = String(body?.plan_code || '').trim().toLowerCase();
        if (!planCode) {
            return NextResponse.json({ error: 'Plan code is required' }, { status: 400 });
        }

        const planResult = await query(
            `SELECT code, name, period_unit, period_value, is_active
             FROM subscription_plans
             WHERE code = $1
             LIMIT 1`,
            [planCode]
        );
        if ((planResult.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }

        const plan = planResult.rows[0];
        if (!plan.is_active) {
            return NextResponse.json({ error: 'Plan is inactive' }, { status: 400 });
        }

        const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
        const hasSubscriptionCanceledAt = await hasColumn('users', 'subscription_canceled_at');
        const now = new Date();
        const nextEndsAt = addPeriod(now, normalizePeriodUnit(plan.period_unit), Number(plan.period_value || 1));
        const nextStatus = planCode === 'new_user' ? 'trialing' : 'active';

        let updated;
        if (hasSubscriptionStatus && hasSubscriptionCanceledAt) {
            updated = await query(
                `WITH owner_users AS (
                    SELECT c.owner_id as owner_user_id
                    FROM clubs c
                    WHERE c.id = ANY($6::int[])
                    UNION
                    SELECT ce.user_id as owner_user_id
                    FROM club_employees ce
                    WHERE ce.club_id = ANY($6::int[])
                      AND ce.role = 'Владелец'
                      AND ce.is_active = TRUE
                      AND ce.dismissed_at IS NULL
                 )
                 UPDATE users
                 SET subscription_plan = $1,
                     subscription_status = $2,
                     subscription_started_at = $3::timestamp,
                     subscription_ends_at = $4::timestamp,
                     subscription_canceled_at = $5::timestamp
                 WHERE id IN (SELECT owner_user_id FROM owner_users)
                 RETURNING id`,
                [planCode, nextStatus, now.toISOString(), nextEndsAt.toISOString(), null, ownerClubIds]
            );
        } else if (hasSubscriptionStatus) {
            updated = await query(
                `WITH owner_users AS (
                    SELECT c.owner_id as owner_user_id
                    FROM clubs c
                    WHERE c.id = ANY($5::int[])
                    UNION
                    SELECT ce.user_id as owner_user_id
                    FROM club_employees ce
                    WHERE ce.club_id = ANY($5::int[])
                      AND ce.role = 'Владелец'
                      AND ce.is_active = TRUE
                      AND ce.dismissed_at IS NULL
                 )
                 UPDATE users
                 SET subscription_plan = $1,
                     subscription_status = $2,
                     subscription_started_at = $3::timestamp,
                     subscription_ends_at = $4::timestamp
                 WHERE id IN (SELECT owner_user_id FROM owner_users)
                 RETURNING id`,
                [planCode, nextStatus, now.toISOString(), nextEndsAt.toISOString(), ownerClubIds]
            );
        } else if (hasSubscriptionCanceledAt) {
            updated = await query(
                `WITH owner_users AS (
                    SELECT c.owner_id as owner_user_id
                    FROM clubs c
                    WHERE c.id = ANY($5::int[])
                    UNION
                    SELECT ce.user_id as owner_user_id
                    FROM club_employees ce
                    WHERE ce.club_id = ANY($5::int[])
                      AND ce.role = 'Владелец'
                      AND ce.is_active = TRUE
                      AND ce.dismissed_at IS NULL
                 )
                 UPDATE users
                 SET subscription_plan = $1,
                     subscription_started_at = $2::timestamp,
                     subscription_ends_at = $3::timestamp,
                     subscription_canceled_at = $4::timestamp
                 WHERE id IN (SELECT owner_user_id FROM owner_users)
                 RETURNING id`,
                [planCode, now.toISOString(), nextEndsAt.toISOString(), null, ownerClubIds]
            );
        } else {
            updated = await query(
                `WITH owner_users AS (
                    SELECT c.owner_id as owner_user_id
                    FROM clubs c
                    WHERE c.id = ANY($4::int[])
                    UNION
                    SELECT ce.user_id as owner_user_id
                    FROM club_employees ce
                    WHERE ce.club_id = ANY($4::int[])
                      AND ce.role = 'Владелец'
                      AND ce.is_active = TRUE
                      AND ce.dismissed_at IS NULL
                 )
                 UPDATE users
                 SET subscription_plan = $1,
                     subscription_started_at = $2::timestamp,
                     subscription_ends_at = $3::timestamp
                 WHERE id IN (SELECT owner_user_id FROM owner_users)
                 RETURNING id`,
                [planCode, now.toISOString(), nextEndsAt.toISOString(), ownerClubIds]
            );
        }

        return NextResponse.json({
            success: true,
            plan: {
                code: plan.code,
                name: plan.name
            },
            synced_users_count: updated.rowCount || 0,
            subscription_status: nextStatus,
            subscription_ends_at: nextEndsAt.toISOString()
        });
    } catch (error) {
        console.error('Change Self Subscription Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
