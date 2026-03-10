const toSet = (value: string | undefined) =>
    new Set(
        (value || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
    )

const normalizePhone = (phone: string | null | undefined) => (phone || '').replace(/\D/g, '')

export const isSuperAdminFromEnv = (userId?: string | null, phoneNumber?: string | null) => {
    const ids = toSet(process.env.SUPER_ADMIN_USER_IDS)
    const phones = new Set(
        (process.env.SUPER_ADMIN_PHONES || '')
            .split(',')
            .map(item => normalizePhone(item))
            .filter(Boolean)
    )
    const normalizedPhone = normalizePhone(phoneNumber)
    return (userId ? ids.has(userId) : false) || (normalizedPhone ? phones.has(normalizedPhone) : false)
}

export const isSuperAdmin = (dbFlag: boolean | null | undefined, userId?: string | null, phoneNumber?: string | null) => {
    return Boolean(dbFlag) || isSuperAdminFromEnv(userId, phoneNumber)
}
