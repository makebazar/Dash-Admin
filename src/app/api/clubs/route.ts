import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { canCreateMoreClubs, normalizeSubscriptionPlan, normalizeSubscriptionStatus, resolveSubscriptionState } from '@/lib/subscriptions';
import { hasColumn } from '@/lib/db-compat';

export async function GET() {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        console.log('[Clubs API] Fetching clubs for userId:', userId);

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Получить все клубы владельца и клубы, где пользователь является управляющим
        const hasPublicId = await hasColumn('clubs', 'public_id');
        const publicIdColumn = hasPublicId ? 'c.public_id' : 'c.id::text as public_id';
        
        console.log('[Clubs API] Executing query for userId:', userId);
        
        const result = await query(
            `SELECT DISTINCT ON (c.id)
                    c.id,
                    ${publicIdColumn},
                    c.name,
                    c.address,
                    c.created_at,
                    CASE
                        WHEN c.owner_id = $1 THEN TRUE
                        WHEN ce_owner.user_id = $1 THEN TRUE
                        ELSE FALSE
                    END as is_owner
             FROM clubs c
             LEFT JOIN club_employees ce ON ce.club_id = c.id
                AND ce.is_active = TRUE
                AND ce.dismissed_at IS NULL
             LEFT JOIN users u ON u.id = ce.user_id
             LEFT JOIN roles r ON r.id = u.role_id
             LEFT JOIN (
                SELECT ce2.club_id, ce2.user_id
                FROM club_employees ce2
                WHERE ce2.role = 'Владелец'
                  AND ce2.is_active = TRUE
                  AND ce2.dismissed_at IS NULL
             ) ce_owner ON ce_owner.club_id = c.id
             WHERE c.owner_id = $1
                OR (
                    ce.user_id = $1
                    AND ce.role = 'Владелец'
                    AND ce.is_active = TRUE
                    AND ce.dismissed_at IS NULL
                )
                OR (
                    ce.user_id = $1
                    AND (ce.role = 'Управляющий' OR r.name = 'Управляющий')
                    AND ce.is_active = TRUE
                    AND ce.dismissed_at IS NULL
                )
             ORDER BY c.id, c.created_at DESC`,
            [userId]
        );

        console.log('[Clubs API] Result rows:', result.rowCount);
        console.log('[Clubs API] Result data:', result.rows);

        return NextResponse.json({ clubs: result.rows });

    } catch (error) {
        console.error('Get Clubs Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, address } = await request.json();

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Club name is required' }, { status: 400 });
        }

        const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
        const hasSubscriptionCanceledAt = await hasColumn('users', 'subscription_canceled_at');
        const hasPublicId = await hasColumn('clubs', 'public_id');

        const ownerResult = await query(
            `SELECT 
                u.id,
                u.subscription_plan,
                ${hasSubscriptionStatus ? 'u.subscription_status' : "NULL::varchar as subscription_status"},
                u.subscription_ends_at,
                (
                    SELECT COUNT(*)
                    FROM clubs c
                    WHERE c.owner_id = u.id
                )::integer as owned_clubs
             FROM users u
             WHERE u.id = $1`,
            [userId]
        );

        if (ownerResult.rowCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const owner = ownerResult.rows[0];
        const ownedClubs = Number(owner.owned_clubs || 0);
        let planToApply = normalizeSubscriptionPlan(owner.subscription_plan);
        let statusToApply = normalizeSubscriptionStatus(owner.subscription_status);
        let endsAtToApply = owner.subscription_ends_at;

        if (ownedClubs === 0) {
            planToApply = 'new_user';
            statusToApply = 'trialing';
            endsAtToApply = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        }

        const subscriptionState = resolveSubscriptionState({
            subscription_plan: planToApply,
            subscription_status: statusToApply,
            subscription_ends_at: endsAtToApply
        });

        if (!subscriptionState.isActive) {
            return NextResponse.json(
                { error: 'Подписка неактивна. Создание клуба недоступно.' },
                { status: 403 }
            );
        }

        const clubsLimitCheck = canCreateMoreClubs(ownedClubs, planToApply);
        if (!clubsLimitCheck.allowed) {
            return NextResponse.json(
                { error: `Лимит тарифа: максимум ${clubsLimitCheck.limit} клуб(а/ов).` },
                { status: 403 }
            );
        }

        if (owner.subscription_plan !== planToApply || owner.subscription_status !== statusToApply || owner.subscription_ends_at !== endsAtToApply) {
            if (hasSubscriptionStatus && hasSubscriptionCanceledAt) {
                await query(
                    `UPDATE users
                     SET subscription_plan = $1,
                         subscription_status = $2,
                         subscription_started_at = COALESCE(subscription_started_at, NOW()),
                         subscription_ends_at = $3::timestamp,
                         subscription_canceled_at = CASE WHEN $2 = 'canceled' THEN NOW() ELSE NULL END
                     WHERE id = $4`,
                    [planToApply, statusToApply, endsAtToApply, userId]
                );
            } else {
                await query(
                    `UPDATE users
                     SET subscription_plan = $1,
                         subscription_started_at = COALESCE(subscription_started_at, NOW()),
                         subscription_ends_at = $2::timestamp
                     WHERE id = $3`,
                    [planToApply, endsAtToApply, userId]
                );
            }
        }

        const result = await query(
            `INSERT INTO clubs (name, address, owner_id) VALUES ($1, $2, $3) RETURNING id, ${hasPublicId ? 'public_id' : 'id::text as public_id'}, name, address, created_at`,
            [name.trim(), address?.trim() || null, userId]
        );

        return NextResponse.json({ success: true, club: result.rows[0], clubId: result.rows[0].id });

    } catch (error) {
        console.error('Create Club Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { searchParams } = new URL(request.url);
        const clubId = searchParams.get('id');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!clubId) {
            return NextResponse.json({ error: 'Club ID is required' }, { status: 400 });
        }

        // Проверить, что пользователь владеет этим клубом
        const checkOwnership = await query(
            `SELECT c.id
             FROM clubs c
             LEFT JOIN club_employees ce ON ce.club_id = c.id
             WHERE c.id = $1
               AND (
                    c.owner_id = $2
                    OR (
                        ce.user_id = $2
                        AND ce.role = 'Владелец'
                        AND ce.is_active = TRUE
                        AND ce.dismissed_at IS NULL
                    )
               )
             LIMIT 1`,
            [clubId, userId]
        );

        if (checkOwnership.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Удалить клуб (каскадное удаление должно быть настроено в БД, но если нет - удаляем зависимости)
        // В текущей схеме многие таблицы имеют ON DELETE CASCADE для club_id, так что должно сработать
        await query(`DELETE FROM clubs WHERE id = $1`, [clubId]);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete Club Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
