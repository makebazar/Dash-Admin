import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { isSuperAdmin } from '@/lib/super-admin';

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

    return { ok: true as const };
}

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
            ('new_user', 'Бесплатно', '14 дней доступа', 'Подходит для быстрого старта нового клуба', '["До 1 клуба","До 3 сотрудников в клубе","Базовый доступ"]'::jsonb, 'Старт', 'info', 'Начать бесплатно', 'light', 10, FALSE, 0, 'day', 14, TRUE),
            ('starter', 'Стартовый', 'Для небольшого клуба', 'Оптимальный тариф для стабильной работы', '["До 1 клуба","До 15 сотрудников в клубе","Базовая аналитика"]'::jsonb, NULL, 'default', 'Выбрать Стартовый', 'light', 20, FALSE, 2900, 'month', 1, TRUE),
            ('pro', 'Про', 'Для роста сети', 'Расширенные лимиты и аналитика', '["До 3 клубов","До 50 сотрудников в клубе","Продвинутая аналитика"]'::jsonb, 'Популярный', 'success', 'Перейти на Про', 'dark', 30, TRUE, 7900, 'month', 1, TRUE),
            ('enterprise', 'Энтерпрайз', 'Без ограничений', 'Максимальные возможности для сети клубов', '["Безлимит клубов","Безлимит сотрудников","Приоритетная поддержка"]'::jsonb, 'Максимум', 'warning', 'Связаться с нами', 'accent', 40, FALSE, 19900, 'month', 1, TRUE)
         ON CONFLICT (code) DO NOTHING`
    );
    await query(
        `UPDATE subscription_plans
         SET name = 'Бесплатно',
             tagline = '14 дней доступа',
             price_amount = 0,
             period_unit = 'day',
             period_value = 14,
             is_active = TRUE,
             updated_at = NOW()
         WHERE code = 'new_user'`
    );
    await query(`UPDATE subscription_plans SET is_active = FALSE, updated_at = NOW() WHERE code = 'trial'`);
}

const normalizePeriodUnit = (value: string | null | undefined) => {
    if (value === 'day' || value === 'month' || value === 'year') return value;
    return 'month';
};

const normalizeTone = (value: string | null | undefined) => {
    if (value === 'default' || value === 'info' || value === 'success' || value === 'warning' || value === 'danger') return value;
    return 'default';
};

const normalizeTheme = (value: string | null | undefined) => {
    if (value === 'light' || value === 'dark' || value === 'accent') return value;
    return 'light';
};

const normalizeFeatures = (value: unknown) => {
    if (Array.isArray(value)) {
        return value.map(item => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map(item => String(item).trim()).filter(Boolean);
            }
        } catch {
            return value.split('\n').map(item => item.trim()).filter(Boolean);
        }
    }
    return [];
};

export async function GET() {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;
        await ensurePlansTable();

        const result = await query(
            `SELECT id, code, name, tagline, description, features, badge_text, badge_tone, cta_text, card_theme, display_order, is_highlighted, price_amount, period_unit, period_value, is_active, created_at, updated_at
             FROM subscription_plans
             ORDER BY display_order ASC, created_at DESC`
        );

        return NextResponse.json({ plans: result.rows });
    } catch (error) {
        console.error('Get Subscription Plans Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;
        await ensurePlansTable();

        const body = await request.json();
        const code = String(body.code || '').trim().toLowerCase();
        const name = String(body.name || '').trim();
        const priceAmount = Number(body.price_amount);
        const periodUnit = normalizePeriodUnit(body.period_unit);
        const periodValue = Number(body.period_value);
        const tagline = body.tagline ? String(body.tagline).trim() : null;
        const description = body.description ? String(body.description).trim() : null;
        const features = normalizeFeatures(body.features);
        const badgeText = body.badge_text ? String(body.badge_text).trim() : null;
        const badgeTone = normalizeTone(body.badge_tone);
        const ctaText = body.cta_text ? String(body.cta_text).trim() : null;
        const cardTheme = normalizeTheme(body.card_theme);
        const displayOrder = Number(body.display_order ?? 100);
        const isHighlighted = Boolean(body.is_highlighted);

        if (!code || !name) {
            return NextResponse.json({ error: 'Code and name are required' }, { status: 400 });
        }
        if (Number.isNaN(priceAmount) || priceAmount < 0) {
            return NextResponse.json({ error: 'Invalid price amount' }, { status: 400 });
        }
        if (!Number.isInteger(periodValue) || periodValue <= 0) {
            return NextResponse.json({ error: 'Invalid period value' }, { status: 400 });
        }
        if (!Number.isInteger(displayOrder) || displayOrder < 0) {
            return NextResponse.json({ error: 'Invalid display order' }, { status: 400 });
        }

        const result = await query(
            `INSERT INTO subscription_plans (code, name, tagline, description, features, badge_text, badge_tone, cta_text, card_theme, display_order, is_highlighted, price_amount, period_unit, period_value, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, COALESCE($15, TRUE), NOW())
             RETURNING id, code, name, tagline, description, features, badge_text, badge_tone, cta_text, card_theme, display_order, is_highlighted, price_amount, period_unit, period_value, is_active, created_at, updated_at`,
            [code, name, tagline, description, JSON.stringify(features), badgeText, badgeTone, ctaText, cardTheme, displayOrder, isHighlighted, priceAmount, periodUnit, periodValue, body.is_active]
        );

        return NextResponse.json({ plan: result.rows[0] });
    } catch (error: any) {
        if (error?.code === '23505') {
            return NextResponse.json({ error: 'Plan code already exists' }, { status: 409 });
        }
        console.error('Create Subscription Plan Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;
        await ensurePlansTable();

        const body = await request.json();
        const id = Number(body.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ error: 'Valid plan id is required' }, { status: 400 });
        }

        const code = String(body.code || '').trim().toLowerCase();
        const name = String(body.name || '').trim();
        const priceAmount = Number(body.price_amount);
        const periodUnit = normalizePeriodUnit(body.period_unit);
        const periodValue = Number(body.period_value);
        const isActive = Boolean(body.is_active);
        const tagline = body.tagline ? String(body.tagline).trim() : null;
        const description = body.description ? String(body.description).trim() : null;
        const features = normalizeFeatures(body.features);
        const badgeText = body.badge_text ? String(body.badge_text).trim() : null;
        const badgeTone = normalizeTone(body.badge_tone);
        const ctaText = body.cta_text ? String(body.cta_text).trim() : null;
        const cardTheme = normalizeTheme(body.card_theme);
        const displayOrder = Number(body.display_order ?? 100);
        const isHighlighted = Boolean(body.is_highlighted);

        if (!code || !name) {
            return NextResponse.json({ error: 'Code and name are required' }, { status: 400 });
        }
        if (Number.isNaN(priceAmount) || priceAmount < 0) {
            return NextResponse.json({ error: 'Invalid price amount' }, { status: 400 });
        }
        if (!Number.isInteger(periodValue) || periodValue <= 0) {
            return NextResponse.json({ error: 'Invalid period value' }, { status: 400 });
        }
        if (!Number.isInteger(displayOrder) || displayOrder < 0) {
            return NextResponse.json({ error: 'Invalid display order' }, { status: 400 });
        }

        const result = await query(
            `UPDATE subscription_plans
             SET code = $1,
                 name = $2,
                 tagline = $3,
                 description = $4,
                 features = $5::jsonb,
                 badge_text = $6,
                 badge_tone = $7,
                 cta_text = $8,
                 card_theme = $9,
                 display_order = $10,
                 is_highlighted = $11,
                 price_amount = $12,
                 period_unit = $13,
                 period_value = $14,
                 is_active = $15,
                 updated_at = NOW()
             WHERE id = $16
             RETURNING id, code, name, tagline, description, features, badge_text, badge_tone, cta_text, card_theme, display_order, is_highlighted, price_amount, period_unit, period_value, is_active, created_at, updated_at`,
            [code, name, tagline, description, JSON.stringify(features), badgeText, badgeTone, ctaText, cardTheme, displayOrder, isHighlighted, priceAmount, periodUnit, periodValue, isActive, id]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }

        return NextResponse.json({ plan: result.rows[0] });
    } catch (error: any) {
        if (error?.code === '23505') {
            return NextResponse.json({ error: 'Plan code already exists' }, { status: 409 });
        }
        console.error('Update Subscription Plan Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;
        await ensurePlansTable();

        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get('id'));
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ error: 'Valid plan id is required' }, { status: 400 });
        }

        const result = await query(
            `UPDATE subscription_plans
             SET is_active = FALSE, updated_at = NOW()
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Subscription Plan Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
