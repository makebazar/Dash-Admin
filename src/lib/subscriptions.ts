export type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'canceled'

const ALLOWED_STATUSES = new Set<SubscriptionStatus>(['trialing', 'active', 'expired', 'canceled'])

export const normalizeSubscriptionPlan = (plan: string | null | undefined): string => {
    const normalized = (plan || '').trim().toLowerCase()
    return normalized || 'starter'
}

export const normalizeSubscriptionStatus = (status: string | null | undefined): SubscriptionStatus => {
    if (!status) return 'trialing'
    return ALLOWED_STATUSES.has(status as SubscriptionStatus) ? (status as SubscriptionStatus) : 'trialing'
}

const toDate = (value: string | Date | null | undefined) => {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

export const resolveSubscriptionState = (subscription: {
    subscription_plan?: string | null
    subscription_status?: string | null
    subscription_ends_at?: string | Date | null
    grace_period_days?: number | null
}, gracePeriodDaysDefault: number = 7) => {
    const plan = normalizeSubscriptionPlan(subscription.subscription_plan)
    const endsAt = toDate(subscription.subscription_ends_at)
    let status = normalizeSubscriptionStatus(subscription.subscription_status)
    const gracePeriodDays = subscription.grace_period_days ?? gracePeriodDaysDefault

    if (status !== 'canceled' && endsAt && endsAt.getTime() < Date.now()) {
        // Проверяем grace period
        const graceEndsAt = new Date(endsAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000)
        if (graceEndsAt.getTime() >= Date.now()) {
            status = 'active' // В grace period считаем активным
        } else {
            status = 'expired'
        }
    }

    const isActive = status === 'active' || status === 'trialing'
    const isInGracePeriod = status === 'active' && endsAt && endsAt.getTime() < Date.now()

    return {
        plan,
        status,
        endsAt,
        isActive,
        isInGracePeriod,
        gracePeriodDays,
        graceEndsAt: isInGracePeriod && endsAt
            ? new Date(endsAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000)
            : null
    }
}

export const getGracePeriodInfo = (endsAt: Date | null, gracePeriodDays: number) => {
    if (!endsAt) return null
    
    const now = Date.now()
    const graceEndsAt = new Date(endsAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000)
    
    if (endsAt.getTime() >= now) {
        return null // Подписка ещё не истекла
    }
    
    if (graceEndsAt.getTime() < now) {
        return null // Grace period тоже истёк
    }
    
    const daysLeft = Math.ceil((graceEndsAt.getTime() - now) / (24 * 60 * 60 * 1000))
    return {
        daysLeft,
        graceEndsAt
    }
}

export const getAllowedStatuses = () => Array.from(ALLOWED_STATUSES)
