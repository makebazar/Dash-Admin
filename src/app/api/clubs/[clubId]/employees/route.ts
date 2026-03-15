import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { normalizePhone } from '@/lib/phone-utils';
import { canAddMoreEmployeesToClub, resolveSubscriptionState } from '@/lib/subscriptions';
import { hasColumn } from '@/lib/db-compat';
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard';

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

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ownerCheck = await query(
            `SELECT 1
             FROM clubs c
             WHERE c.id = $1 AND c.owner_id = $2
             UNION
             SELECT 1
             FROM club_employees ce
             WHERE ce.club_id = $1 AND ce.user_id = $2 AND ce.role = 'Владелец'`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount ?? 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get employees with salary scheme assignments
        const result = await query(
            `WITH member_rows AS (
                SELECT ce.user_id, ce.role, ce.hired_at, ce.is_active, ce.dismissed_at, ce.show_in_schedule, 0 as priority
                FROM club_employees ce
                WHERE ce.club_id = $1
                UNION ALL
                SELECT c.owner_id as user_id, 'Владелец'::varchar as role, c.created_at as hired_at, TRUE as is_active, NULL::timestamp as dismissed_at, TRUE as show_in_schedule, 1 as priority
                FROM clubs c
                WHERE c.id = $1
            ),
            dedup_members AS (
                SELECT DISTINCT ON (user_id) user_id, role, hired_at, is_active, dismissed_at, show_in_schedule
                FROM member_rows
                ORDER BY user_id, priority DESC, hired_at DESC
            )
            SELECT
        u.id,
        dm.user_id,
        u.full_name,
        u.phone_number,
        dm.role as club_role,
        r.name as role_name,
        r.id as role_id,
        dm.hired_at,
        dm.is_active,
        dm.dismissed_at,
        dm.show_in_schedule,
        esa.scheme_id as salary_scheme_id,
        ss.name as salary_scheme_name
       FROM dedup_members dm
       JOIN users u ON dm.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN employee_salary_assignments esa ON esa.user_id = u.id AND esa.club_id = $1
       LEFT JOIN salary_schemes ss ON ss.id = esa.scheme_id
       ORDER BY dm.hired_at DESC`,
            [clubId]
        );

        const employees = (result.rows || [])
            .filter(row => !String(row.phone_number || '').startsWith('__system_'))
            .map(row => ({
            id: row.id,
            full_name: row.full_name,
            phone_number: row.phone_number,
            role: (row.club_role === 'EMPLOYEE' || row.club_role === 'Сотрудник' || row.club_role === 'EMP')
                ? (row.role_name || 'Сотрудник')
                : (row.club_role || row.role_name || 'Сотрудник'),
            role_id: row.role_id,
            hired_at: row.hired_at,
            is_active: row.is_active,
            dismissed_at: row.dismissed_at,
            show_in_schedule: row.show_in_schedule !== false,
            salary_scheme_id: row.salary_scheme_id,
            salary_scheme_name: row.salary_scheme_name
        }));

        return NextResponse.json({ employees });

    } catch (error) {
        console.error('Get Employees Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        console.log('[API] Adding employee to club:', clubId, 'by user:', userId);

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) {
            console.log('[API] Permission denied for user:', userId, 'to add employee to club:', clubId);
            return guard.response;
        }

        const { phone_number, full_name, role_id } = await request.json();
        console.log('[API] Employee data:', { phone_number, full_name, role_id });

        if (!phone_number || !full_name) {
            return NextResponse.json({ error: 'Phone and name are required' }, { status: 400 });
        }

        const normalizedPhone = normalizePhone(phone_number);
        console.log('[API] Normalized phone:', normalizedPhone);

        // Check if user exists
        let employeeId;
        const userCheck = await query(
            `SELECT id FROM users WHERE phone_number = $1`,
            [normalizedPhone]
        );

        if ((userCheck.rowCount ?? 0) > 0) {
            // User exists
            employeeId = userCheck.rows[0].id;
            console.log('[API] User exists, ID:', employeeId);

            // Update role if provided
            if (role_id) {
                console.log('[API] Updating role to:', role_id);
                await query(
                    `UPDATE users SET role_id = $1 WHERE id = $2`,
                    [role_id, employeeId]
                );
            }
        } else {
            // Create new user
            console.log('[API] Creating new user');
            const newUser = await query(
                `INSERT INTO users (full_name, phone_number, role_id, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id`,
                [full_name, normalizedPhone, role_id]
            );
            employeeId = newUser.rows[0].id;
            console.log('[API] New user created, ID:', employeeId);
        }

        // Get role name for club_employees table
        let roleName = 'Сотрудник';
        if (role_id) {
            const roleRes = await query('SELECT name FROM roles WHERE id = $1', [role_id]);
            if (roleRes.rows.length > 0) {
                roleName = roleRes.rows[0].name;
            }
        }

        const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
        const subscriptionResult = await query(
            `SELECT 
                c.owner_id,
                u.subscription_plan,
                ${hasSubscriptionStatus ? 'u.subscription_status' : "NULL::varchar as subscription_status"},
                u.subscription_ends_at
             FROM clubs c
             JOIN users u ON u.id = c.owner_id
             WHERE c.id = $1`,
            [clubId]
        );

        if (subscriptionResult.rowCount === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const ownerSubscription = subscriptionResult.rows[0];
        const subscriptionState = resolveSubscriptionState(ownerSubscription);

        if (!subscriptionState.isActive) {
            return NextResponse.json(
                { error: 'Подписка владельца клуба неактивна. Добавление сотрудников недоступно.' },
                { status: 403 }
            );
        }

        const memberExistsResult = await query(
            `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, employeeId]
        );

        if (memberExistsResult.rowCount === 0) {
            const employeeCountResult = await query(
                `SELECT COUNT(*)::integer as total
                 FROM club_employees
                 WHERE club_id = $1
                   AND is_active = TRUE
                   AND dismissed_at IS NULL`,
                [clubId]
            );
            const currentCount = Number(employeeCountResult.rows[0]?.total || 0);
            const employeesLimitCheck = canAddMoreEmployeesToClub(currentCount, ownerSubscription.subscription_plan);

            if (!employeesLimitCheck.allowed) {
                return NextResponse.json(
                    { error: `Лимит тарифа: максимум ${employeesLimitCheck.limit} сотрудник(а/ов) в клубе.` },
                    { status: 403 }
                );
            }
        }

        // Add to club_employees with role
        console.log('[API] Adding to club_employees. Club:', clubId, 'User:', employeeId, 'Role:', roleName);
        const linkResult = await query(
            `INSERT INTO club_employees (club_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING id`,
            [clubId, employeeId, roleName]
        );
        
        if (linkResult.rowCount === 0) {
            console.log('[API] User was already linked to this club (updated role)');
        } else {
            console.log('[API] Link created successfully');
        }

        if (roleName === 'Владелец') {
            await syncOwnersSubscriptionForClub(clubId);
        }

        return NextResponse.json({ success: true, employeeId });

    } catch (error) {
        console.error('Add Employee Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get('employeeId');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!employeeId) {
            return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        // Remove from club_employees
        await query(
            `DELETE FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, employeeId]
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete Employee Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
