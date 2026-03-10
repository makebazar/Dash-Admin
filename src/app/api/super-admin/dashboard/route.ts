import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { isSuperAdmin } from '@/lib/super-admin';
import { hasColumn } from '@/lib/db-compat';

export async function GET() {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminCheck = await query(
            `SELECT is_super_admin, phone_number FROM users WHERE id = $1`,
            [userId]
        );

        const canAccess = isSuperAdmin(adminCheck.rows[0]?.is_super_admin, userId, adminCheck.rows[0]?.phone_number);

        if (!canAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const hasSubscriptionStatus = await hasColumn('users', 'subscription_status');
        const statsResult = await query(`
            SELECT 
                (SELECT COUNT(*) FROM clubs) as total_clubs,
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE ${hasSubscriptionStatus ? "subscription_status IN ('active', 'trialing')" : "subscription_plan != 'new_user'"}) as paid_subscriptions,
                (SELECT COUNT(*) FROM users WHERE ${hasSubscriptionStatus ? "subscription_status = 'trialing' OR (subscription_status IS NULL AND subscription_plan = 'new_user')" : "subscription_plan = 'new_user'"}) as trial_subscriptions,
                (SELECT COALESCE(SUM(
                    CASE 
                        WHEN subscription_plan = 'starter' THEN 2900
                        WHEN subscription_plan = 'pro' THEN 7900
                        WHEN subscription_plan = 'enterprise' THEN 19900
                        ELSE 0
                    END
                ), 0) FROM users) as estimated_mrr
            FROM (SELECT 1) dummy
        `);

        return NextResponse.json(statsResult.rows[0]);

    } catch (error) {
        console.error('Get Admin Stats Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
