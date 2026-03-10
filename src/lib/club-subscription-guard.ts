import { NextResponse } from 'next/server'
import { query } from '@/db'
import { hasColumn } from '@/lib/db-compat'
import { resolveSubscriptionState } from '@/lib/subscriptions'

export async function ensureOwnerSubscriptionActive(clubId: string | number, userId: string) {
    const ownerCheck = await query(
        `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
        [clubId, userId]
    )

    if ((ownerCheck.rowCount || 0) === 0) {
        return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }

    const hasSubscriptionStatus = await hasColumn('users', 'subscription_status')
    const subscriptionResult = await query(
        `SELECT 
            u.subscription_plan,
            ${hasSubscriptionStatus ? 'u.subscription_status' : "NULL::varchar as subscription_status"},
            u.subscription_ends_at
         FROM clubs c
         JOIN users u ON u.id = c.owner_id
         WHERE c.id = $1`,
        [clubId]
    )

    if ((subscriptionResult.rowCount || 0) === 0) {
        return { ok: false as const, response: NextResponse.json({ error: 'Club not found' }, { status: 404 }) }
    }

    const subscriptionState = resolveSubscriptionState(subscriptionResult.rows[0])
    if (!subscriptionState.isActive) {
        return { ok: false as const, response: NextResponse.json({ error: 'Подписка закончилась. Доступ к управлению клубом ограничен.' }, { status: 402 }) }
    }

    return { ok: true as const }
}
