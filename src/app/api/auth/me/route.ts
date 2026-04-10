import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { isSuperAdmin } from '@/lib/super-admin';
import { resolveSubscriptionState } from '@/lib/subscriptions';
import { hasColumn } from '@/lib/db-compat';

const LEGAL_ACCEPTANCE_VERSION = '2026-04-01'

export async function GET() {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        console.log('[Auth/Me] Fetching user data for userId:', userId);

        if (!userId) {
            console.log('[Auth/Me] No session_user_id found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user info
        const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
        const hasSubscriptionCanceledAt = await hasColumn('users', 'subscription_canceled_at');
        const hasLegalAcceptedAt = await hasColumn('users', 'legal_accepted_at');
        const hasLegalAcceptanceVersion = await hasColumn('users', 'legal_acceptance_version');
        const userResult = await query(
            `SELECT 
                id,
                full_name,
                phone_number,
                is_super_admin,
                subscription_plan,
                ${hasSubscriptionStatus ? 'subscription_status' : "NULL::varchar as subscription_status"},
                subscription_started_at,
                subscription_ends_at,
                ${hasSubscriptionCanceledAt ? 'subscription_canceled_at' : "NULL::timestamp as subscription_canceled_at"},
                ${hasLegalAcceptedAt ? 'legal_accepted_at' : "NULL::timestamp as legal_accepted_at"},
                ${hasLegalAcceptanceVersion ? 'legal_acceptance_version' : "NULL::varchar as legal_acceptance_version"}
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (userResult.rowCount === 0) {
            console.log('[Auth/Me] User not found in DB:', userId);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = userResult.rows[0];
        const resolvedSuperAdmin = isSuperAdmin(user.is_super_admin, user.id, user.phone_number);
        const subscription = resolveSubscriptionState(user);
        const legalAcceptanceRequired = !user.legal_accepted_at || user.legal_acceptance_version !== LEGAL_ACCEPTANCE_VERSION
        console.log('[Auth/Me] User found:', user.full_name);

        // Get owned clubs
        const ownedClubsResult = await query(
            `SELECT DISTINCT c.id, c.name, c.address, c.created_at, c.inventory_required, c.inventory_settings, c.timezone
             FROM clubs c
             LEFT JOIN club_employees ce ON ce.club_id = c.id
             WHERE c.owner_id = $1
                OR (
                    ce.user_id = $1
                    AND ce.role = 'Владелец'
                    AND ce.is_active = TRUE
                    AND ce.dismissed_at IS NULL
                )
             ORDER BY c.created_at DESC`,
            [userId]
        );
        console.log('[Auth/Me] Owned clubs count:', ownedClubsResult.rowCount);

        const ownedClubs = ownedClubsResult.rows.map(row => ({
            id: row.id,
            name: row.name,
            address: row.address,
            inventory_required: row.inventory_required,
            inventory_settings: row.inventory_settings,
            timezone: row.timezone || 'Europe/Moscow'
        }));

        // Get employee clubs with role
        const employeeClubsQuery = `
            SELECT c.id, c.name, c.address, c.inventory_required, c.inventory_settings, c.timezone, ce.role as employee_role, r.name as global_role_name, r.id as global_role_id
            FROM clubs c
            JOIN club_employees ce ON c.id = ce.club_id
            LEFT JOIN users u ON ce.user_id = u.id
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE ce.user_id = $1
              AND ce.is_active = TRUE
              AND ce.dismissed_at IS NULL
            ORDER BY ce.hired_at DESC
        `;
        
        console.log('[Auth/Me] Executing employee clubs query for user:', userId);
        
        const employeeClubsResult = await query(employeeClubsQuery, [userId]);
        
        // Combine employee clubs and owned clubs for the employee dashboard view
        // Owners should be able to "go on shift" in their own clubs
        const employeeClubsMap = new Map();
        
        // Add actual employee roles first
        employeeClubsResult.rows.forEach(row => {
            const normalizedRole = (row.employee_role === 'EMPLOYEE' || row.employee_role === 'Сотрудник' || row.employee_role === 'EMP')
                ? (row.global_role_name || 'Сотрудник')
                : (row.employee_role || row.global_role_name || 'Сотрудник');
            employeeClubsMap.set(row.id, {
                id: row.id,
                name: row.name,
                address: row.address,
                inventory_required: row.inventory_required,
                inventory_settings: row.inventory_settings,
                timezone: row.timezone || 'Europe/Moscow',
                role: normalizedRole,
                role_id: row.global_role_id
            });
        });

        // Add owned clubs if not already there (as Владелец)
        ownedClubsResult.rows.forEach(row => {
            if (!employeeClubsMap.has(row.id)) {
                employeeClubsMap.set(row.id, {
                    id: row.id,
                    name: row.name,
                    address: row.address,
                    inventory_required: row.inventory_required,
                    inventory_settings: row.inventory_settings,
                    timezone: row.timezone || 'Europe/Moscow',
                    role: 'Владелец',
                    is_owner: true
                });
            }
        });

        const clubIds = Array.from(employeeClubsMap.keys()).map(id => Number(id)).filter(id => Number.isInteger(id));
        if (clubIds.length > 0) {
            const ownerSubscriptionResult = await query(
                `SELECT c.id as club_id,
                        u.subscription_plan,
                        ${hasSubscriptionStatus ? 'u.subscription_status' : "NULL::varchar as subscription_status"},
                        u.subscription_ends_at
                 FROM clubs c
                 JOIN users u ON u.id = c.owner_id
                 WHERE c.id = ANY($1::int[])`,
                [clubIds]
            );

            const subscriptionByClub = new Map<number, { status: string; isActive: boolean; endsAt: Date | null }>();
            for (const row of ownerSubscriptionResult.rows) {
                const resolved = resolveSubscriptionState(row);
                subscriptionByClub.set(Number(row.club_id), {
                    status: resolved.status,
                    isActive: resolved.isActive,
                    endsAt: resolved.endsAt
                });
            }

            employeeClubsMap.forEach((club, clubId) => {
                const state = subscriptionByClub.get(Number(clubId));
                if (state) {
                    club.subscription_status = state.status;
                    club.subscription_is_active = state.isActive;
                    club.subscription_ends_at = state.endsAt;
                }
            });
        }

        const employeeClubs = Array.from(employeeClubsMap.values());
        const hasExpiredClubSubscription = employeeClubs.some((club: any) => club.subscription_is_active === false);

        return NextResponse.json({
            user: {
                id: user.id,
                full_name: user.full_name,
                phone_number: user.phone_number,
                is_super_admin: resolvedSuperAdmin,
                subscription_plan: subscription.plan,
                subscription_status: subscription.status,
                subscription_started_at: user.subscription_started_at,
                subscription_ends_at: user.subscription_ends_at,
                subscription_canceled_at: user.subscription_canceled_at,
                legal_accepted_at: user.legal_accepted_at,
                legal_acceptance_version: user.legal_acceptance_version,
                legal_acceptance_required: legalAcceptanceRequired,
                subscription_limits: {
                    max_clubs: subscription.planDefinition.maxClubs,
                    max_employees_per_club: subscription.planDefinition.maxEmployeesPerClub,
                    price_monthly: subscription.planDefinition.priceMonthly,
                    advanced_analytics: subscription.planDefinition.advancedAnalytics,
                    inventory_lite: subscription.planDefinition.inventoryLite,
                    priority_support: subscription.planDefinition.prioritySupport
                }
            },
            ownedClubs,
            employeeClubs,
            has_expired_club_subscription: hasExpiredClubSubscription,
            legal_acceptance_version_required: LEGAL_ACCEPTANCE_VERSION
        });

    } catch (error) {
        console.error('Get Me Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
