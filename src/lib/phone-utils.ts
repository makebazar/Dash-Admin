/**
 * Phone number validation and formatting utilities
 */

/**
 * Normalizes phone number to raw 11 digits starting with 7
 * Handles: +7..., 8..., 7... and various separators
 */
export function normalizePhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '')

    // If starts with 8, replace with 7
    if (cleaned.length === 11 && cleaned.startsWith('8')) {
        cleaned = '7' + cleaned.slice(1)
    }

    // If starts with 7 and 11 digits, it's likely already correct
    // If 10 digits, prepend 7
    if (cleaned.length === 10) {
        cleaned = '7' + cleaned
    }

    return cleaned
}

/**
 * Validates if a phone number is in correct format
 */
export function validatePhone(phone: string): boolean {
    const normalized = normalizePhone(phone)
    return normalized.length === 11 && normalized.startsWith('7')
}

/**
 * Formats phone number to +7 (XXX) XXX-XX-XX
 */
export function formatPhone(phone: string): string {
    const normalized = normalizePhone(phone)

    if (normalized.length !== 11 || !normalized.startsWith('7')) {
        return phone
    }

    return `+7 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`
}

/**
 * Cleans phone number to raw digits (deprecated in favor of normalizePhone)
 */
export function cleanPhone(phone: string): string {
    return normalizePhone(phone)
}

/**
 * Gets display format for phone number
 * If valid - returns formatted, otherwise returns as is
 */
export function getPhoneDisplay(phone: string): string {
    if (validatePhone(phone)) {
        return formatPhone(phone)
    }
    return phone
}
