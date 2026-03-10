import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { isSuperAdmin } from '@/lib/super-admin';
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

async function syncOwnersSubscriptionForClub(clubId: string | number) {
    const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
    const hasSubscriptionCanceledAt = await hasColumn('users', 'subscription_canceled_at');

    const sourceResult = await query(
        `SELECT 
            u.subscription_plan,
            ${hasSubscriptionStatus ? 'u.subscription_status' : "NULL::varchar as subscription_status"},
            u.subscription_started_at,
            u.subscription_ends_at,
            ${hasSubscriptionCanceledAt ? 'u.subscription_canceled_at' : "NULL::timestamp as subscription_canceled_at"}
         FROM clubs c
         JOIN users u ON u.id = c.owner_id
         WHERE c.id = $1`,
        [clubId]
    );

    if ((sourceResult.rowCount || 0) === 0) return;
    const source = sourceResult.rows[0];

    await query(
        `UPDATE users
         SET subscription_plan = $1,
             ${hasSubscriptionStatus ? 'subscription_status = $2,' : ''}
             subscription_started_at = $3::timestamp,
             subscription_ends_at = $4::timestamp
             ${hasSubscriptionCanceledAt ? ', subscription_canceled_at = $5::timestamp' : ''}
         WHERE id IN (
            SELECT c.owner_id
            FROM clubs c
            WHERE c.id = $6
            UNION
            SELECT ce.user_id
            FROM club_employees ce
            WHERE ce.club_id = $6
              AND ce.role = 'Владелец'
              AND ce.is_active = TRUE
              AND ce.dismissed_at IS NULL
         )`,
        [
            source.subscription_plan,
            source.subscription_status,
            source.subscription_started_at,
            source.subscription_ends_at,
            source.subscription_canceled_at,
            clubId
        ]
    );
}

export async function GET() {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;
        const hasClubPublicId = await hasColumn('clubs', 'public_id');

        const clubsResult = await query(`
            SELECT 
                c.id,
                ${hasClubPublicId ? 'c.public_id' : 'NULL::varchar as public_id'},
                c.name,
                c.address,
                c.created_at,
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', o.id,
                            'full_name', o.full_name,
                            'phone_number', o.phone_number,
                            'is_primary', o.is_primary
                        )
                        ORDER BY o.is_primary DESC, o.full_name ASC
                    )
                    FROM (
                        SELECT u.id, u.full_name, u.phone_number, TRUE as is_primary
                        FROM users u
                        WHERE u.id = c.owner_id
                        UNION
                        SELECT eu.id, eu.full_name, eu.phone_number, FALSE as is_primary
                        FROM club_employees ce
                        JOIN users eu ON eu.id = ce.user_id
                        WHERE ce.club_id = c.id
                          AND ce.role = 'Владелец'
                          AND ce.user_id <> c.owner_id
                          AND ce.is_active = TRUE
                          AND ce.dismissed_at IS NULL
                    ) o
                ), '[]'::json) as owners,
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', eu.id,
                            'full_name', eu.full_name,
                            'phone_number', eu.phone_number,
                            'role', CASE
                                WHEN ce.role IN ('EMPLOYEE', 'EMP', 'Сотрудник') THEN COALESCE(r.name, 'Сотрудник')
                                ELSE ce.role
                            END,
                            'hired_at', ce.hired_at,
                            'is_primary', ce.is_primary
                        )
                        ORDER BY ce.hired_at DESC
                    )
                    FROM (
                        SELECT u.id as user_id, 'Владелец'::varchar as role, c.created_at as hired_at, TRUE as is_primary
                        FROM users u
                        WHERE u.id = c.owner_id
                        UNION ALL
                        SELECT ce.user_id, ce.role, ce.hired_at, FALSE as is_primary
                        FROM club_employees ce
                        WHERE ce.club_id = c.id
                          AND ce.user_id <> c.owner_id
                          AND ce.is_active = TRUE
                          AND ce.dismissed_at IS NULL
                    ) ce
                    JOIN users eu ON eu.id = ce.user_id
                    LEFT JOIN roles r ON r.id = eu.role_id
                ), '[]'::json) as employees
            FROM clubs c
            ORDER BY c.name ASC
        `);

        const usersResult = await query(`
            SELECT id, full_name, phone_number, is_super_admin
            FROM users
            ORDER BY full_name ASC
        `);

        return NextResponse.json({ clubs: clubsResult.rows, users: usersResult.rows });

    } catch (error) {
        console.error('Get All Clubs Admin Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;

        const { targetUserId, clubId, role } = await request.json();
        const userIdToAssign = targetUserId;

        if (!userIdToAssign || !clubId) {
            return NextResponse.json({ error: 'User ID and Club ID are required' }, { status: 400 });
        }

        const clubOwnerResult = await query(`SELECT owner_id FROM clubs WHERE id = $1`, [clubId]);
        if (clubOwnerResult.rowCount === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const currentOwnerId = clubOwnerResult.rows[0].owner_id;

        if (role === 'Владелец') {
            await query(
                `INSERT INTO club_employees (user_id, club_id, role) 
                 VALUES ($1, $2, 'Владелец') 
                 ON CONFLICT (user_id, club_id) DO UPDATE SET role = 'Владелец'`,
                [userIdToAssign, clubId]
            );
            if (currentOwnerId === userIdToAssign) {
                return NextResponse.json({ success: true });
            }
            return NextResponse.json({ success: true });
        }

        if (currentOwnerId === userIdToAssign) {
            return NextResponse.json({ error: 'Primary owner already has this club' }, { status: 400 });
        }

        await query(
            `INSERT INTO club_employees (user_id, club_id, role) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (user_id, club_id) DO UPDATE SET role = EXCLUDED.role`,
            [userIdToAssign, clubId, role || 'Сотрудник']
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Assign User to Club Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;

        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode');
        const targetUserId = searchParams.get('userId');
        const clubId = searchParams.get('clubId');

        if (mode === 'delete-club') {
            if (!clubId) {
                return NextResponse.json({ error: 'Club ID is required' }, { status: 400 });
            }

            const clubCheck = await query(`SELECT id FROM clubs WHERE id = $1`, [clubId]);
            if (clubCheck.rowCount === 0) {
                return NextResponse.json({ error: 'Club not found' }, { status: 404 });
            }

            await query(`DELETE FROM clubs WHERE id = $1`, [clubId]);
            return NextResponse.json({ success: true });
        }

        if (!targetUserId || !clubId) {
            return NextResponse.json({ error: 'User ID and Club ID are required' }, { status: 400 });
        }

        await query(
            `DELETE FROM club_employees WHERE user_id = $1 AND club_id = $2`,
            [targetUserId, clubId]
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Remove User from Club Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await ensureSuperAdmin();
        if (!auth.ok) return auth.response;

        const { mode, clubId, targetUserId } = await request.json();

        if (mode !== 'set-primary-owner') {
            return NextResponse.json({ error: 'Unsupported mode' }, { status: 400 });
        }

        if (!clubId || !targetUserId) {
            return NextResponse.json({ error: 'Club ID and target user ID are required' }, { status: 400 });
        }

        const clubResult = await query(`SELECT owner_id FROM clubs WHERE id = $1`, [clubId]);
        if (clubResult.rowCount === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const currentOwnerId = clubResult.rows[0].owner_id as string;

        const targetAccessResult = await query(
            `SELECT 1
             FROM clubs c
             WHERE c.id = $1 AND c.owner_id = $2
             UNION
             SELECT 1
             FROM club_employees ce
             WHERE ce.club_id = $1 AND ce.user_id = $2 AND ce.role = 'Владелец'`,
            [clubId, targetUserId]
        );

        if (targetAccessResult.rowCount === 0) {
            return NextResponse.json({ error: 'Target user must be one of club owners' }, { status: 400 });
        }

        if (currentOwnerId === targetUserId) {
            return NextResponse.json({ success: true });
        }

        await query(
            `INSERT INTO club_employees (user_id, club_id, role)
             VALUES ($1, $2, 'Владелец')
             ON CONFLICT (user_id, club_id) DO UPDATE SET role = 'Владелец'`,
            [currentOwnerId, clubId]
        );

        await query(
            `INSERT INTO club_employees (user_id, club_id, role)
             VALUES ($1, $2, 'Владелец')
             ON CONFLICT (user_id, club_id) DO UPDATE SET role = 'Владелец'`,
            [targetUserId, clubId]
        );

        await query(`UPDATE clubs SET owner_id = $1 WHERE id = $2`, [targetUserId, clubId]);
        await syncOwnersSubscriptionForClub(clubId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Set Primary Owner Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
