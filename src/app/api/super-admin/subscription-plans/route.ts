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
    // Основная таблица планов
    await query(`
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id SERIAL PRIMARY KEY,
            code VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            tagline VARCHAR(255),
            description TEXT,
            price_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
            price_per_extra_club DECIMAL(12, 2) NOT NULL DEFAULT 0,
            period_unit VARCHAR(20) NOT NULL DEFAULT 'month',
            period_value INTEGER NOT NULL DEFAULT 1,
            grace_period_days INTEGER NOT NULL DEFAULT 7,
            display_order INTEGER NOT NULL DEFAULT 100,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active, display_order ASC)`);

    // Добавляем поля если их нет (для существующих инсталляций)
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS tagline VARCHAR(255)`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS description TEXT`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_per_extra_club DECIMAL(12, 2) NOT NULL DEFAULT 0`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS grace_period_days INTEGER NOT NULL DEFAULT 7`);
    await query(`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 100`);

    // Дефолтные тарифы
    await query(
        `INSERT INTO subscription_plans (code, name, tagline, description, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, display_order, is_active)
         VALUES
            ('starter', 'Стандарт', 'Для первого клуба', 'Всё включено: сотрудники, смены, зарплаты, аналитика', 2900, 1500, 'month', 1, 7, 10, TRUE),
            ('annual', 'Годовой', 'Выгоднее на 20%', 'Оплата за год вперёд', 27840, 14400, 'year', 1, 14, 20, TRUE)
         ON CONFLICT (code) DO NOTHING`
    );
}

export async function GET() {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;
        await ensurePlansTable();

        const result = await query(
            `SELECT id, code, name, tagline, description, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, display_order, is_active, created_at, updated_at
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
        const tagline = body.tagline ? String(body.tagline).trim() : null;
        const description = body.description ? String(body.description).trim() : null;
        const priceAmount = Number(body.price_amount || 0);
        const pricePerExtraClub = Number(body.price_per_extra_club || 0);
        const periodUnit = body.period_unit === 'year' ? 'year' : 'month';
        const periodValue = Number(body.period_value || 1);
        const gracePeriodDays = Number(body.grace_period_days || 7);
        const displayOrder = Number(body.display_order || 100);
        const isActive = body.is_active !== false;

        if (!code || !name) {
            return NextResponse.json({ error: 'Code and name are required' }, { status: 400 });
        }
        if (Number.isNaN(priceAmount) || priceAmount < 0) {
            return NextResponse.json({ error: 'Invalid price amount' }, { status: 400 });
        }

        const result = await query(
            `INSERT INTO subscription_plans (code, name, tagline, description, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, display_order, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
             RETURNING id, code, name, tagline, description, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, display_order, is_active, created_at, updated_at`,
            [code, name, tagline, description, priceAmount, pricePerExtraClub, periodUnit, periodValue, gracePeriodDays, displayOrder, isActive]
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
        const tagline = body.tagline ? String(body.tagline).trim() : null;
        const description = body.description ? String(body.description).trim() : null;
        const priceAmount = Number(body.price_amount || 0);
        const pricePerExtraClub = Number(body.price_per_extra_club || 0);
        const periodUnit = body.period_unit === 'year' ? 'year' : 'month';
        const periodValue = Number(body.period_value || 1);
        const gracePeriodDays = Number(body.grace_period_days || 7);
        const displayOrder = Number(body.display_order || 100);
        const isActive = body.is_active !== false;

        if (!code || !name) {
            return NextResponse.json({ error: 'Code and name are required' }, { status: 400 });
        }

        const result = await query(
            `UPDATE subscription_plans
             SET code = $1,
                 name = $2,
                 tagline = $3,
                 description = $4,
                 price_amount = $5,
                 price_per_extra_club = $6,
                 period_unit = $7,
                 period_value = $8,
                 grace_period_days = $9,
                 display_order = $10,
                 is_active = $11,
                 updated_at = NOW()
             WHERE id = $12
             RETURNING id, code, name, tagline, description, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, display_order, is_active, created_at, updated_at`,
            [code, name, tagline, description, priceAmount, pricePerExtraClub, periodUnit, periodValue, gracePeriodDays, displayOrder, isActive, id]
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
