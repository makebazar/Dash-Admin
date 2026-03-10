export type SubscriptionPlan = string
export type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'canceled'

export type PlanDefinition = {
    id: SubscriptionPlan
    label: string
    priceMonthly: number
    maxClubs: number | null
    maxEmployeesPerClub: number | null
    prioritySupport: boolean
    advancedAnalytics: boolean
    inventoryLite: boolean
}

const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
    new_user: {
        id: 'new_user',
        label: 'Новый пользователь',
        priceMonthly: 0,
        maxClubs: 1,
        maxEmployeesPerClub: 3,
        prioritySupport: false,
        advancedAnalytics: false,
        inventoryLite: false
    },
    starter: {
        id: 'starter',
        label: 'Стартовый',
        priceMonthly: 2900,
        maxClubs: 1,
        maxEmployeesPerClub: 15,
        prioritySupport: false,
        advancedAnalytics: false,
        inventoryLite: true
    },
    pro: {
        id: 'pro',
        label: 'Про',
        priceMonthly: 7900,
        maxClubs: 3,
        maxEmployeesPerClub: 50,
        prioritySupport: true,
        advancedAnalytics: true,
        inventoryLite: true
    },
    enterprise: {
        id: 'enterprise',
        label: 'Энтерпрайз',
        priceMonthly: 19900,
        maxClubs: null,
        maxEmployeesPerClub: null,
        prioritySupport: true,
        advancedAnalytics: true,
        inventoryLite: true
    }
}

const ALLOWED_STATUSES = new Set<SubscriptionStatus>(['trialing', 'active', 'expired', 'canceled'])

export const normalizeSubscriptionPlan = (plan: string | null | undefined): SubscriptionPlan => {
    const normalized = (plan || '').trim().toLowerCase()
    return normalized || 'new_user'
}

export const normalizeSubscriptionStatus = (status: string | null | undefined): SubscriptionStatus => {
    if (!status) return 'trialing'
    return ALLOWED_STATUSES.has(status as SubscriptionStatus) ? (status as SubscriptionStatus) : 'trialing'
}

export const getPlanDefinition = (plan: string | null | undefined) => {
    const normalizedPlan = normalizeSubscriptionPlan(plan)
    return PLAN_DEFINITIONS[normalizedPlan] || {
        id: normalizedPlan,
        label: normalizedPlan,
        priceMonthly: 0,
        maxClubs: null,
        maxEmployeesPerClub: null,
        prioritySupport: false,
        advancedAnalytics: false,
        inventoryLite: false
    }
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
}) => {
    const plan = normalizeSubscriptionPlan(subscription.subscription_plan)
    const endsAt = toDate(subscription.subscription_ends_at)
    let status = normalizeSubscriptionStatus(subscription.subscription_status)

    if (status !== 'canceled' && endsAt && endsAt.getTime() < Date.now()) {
        status = 'expired'
    }

    if (plan === 'new_user' && status === 'active') {
        status = 'trialing'
    }

    const planDefinition = getPlanDefinition(plan)
    const isActive = status === 'active' || status === 'trialing'

    return {
        plan,
        status,
        endsAt,
        isActive,
        planDefinition
    }
}

export const canCreateMoreClubs = (clubCount: number, plan: string | null | undefined) => {
    const definition = getPlanDefinition(plan)
    if (definition.maxClubs === null) return { allowed: true, limit: null }
    return {
        allowed: clubCount < definition.maxClubs,
        limit: definition.maxClubs
    }
}

export const canAddMoreEmployeesToClub = (employeeCount: number, plan: string | null | undefined) => {
    const definition = getPlanDefinition(plan)
    if (definition.maxEmployeesPerClub === null) return { allowed: true, limit: null }
    return {
        allowed: employeeCount < definition.maxEmployeesPerClub,
        limit: definition.maxEmployeesPerClub
    }
}

export const getAllowedPlans = () => Object.keys(PLAN_DEFINITIONS)
export const getAllowedStatuses = () => Array.from(ALLOWED_STATUSES)
