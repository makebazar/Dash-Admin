import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { query } from '@/db'
import { hasColumn } from '@/lib/db-compat'

const LEGAL_ACCEPTANCE_VERSION = '2026-04-01'

export async function POST(request: Request) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const hasLegalAcceptedAt = await hasColumn('users', 'legal_accepted_at')
        const hasTermsAcceptedAt = await hasColumn('users', 'terms_accepted_at')
        const hasPrivacyAcceptedAt = await hasColumn('users', 'privacy_accepted_at')
        const hasLegalAcceptanceVersion = await hasColumn('users', 'legal_acceptance_version')
        const hasLegalAcceptanceSource = await hasColumn('users', 'legal_acceptance_source')

        if (!hasLegalAcceptedAt || !hasTermsAcceptedAt || !hasPrivacyAcceptedAt || !hasLegalAcceptanceVersion || !hasLegalAcceptanceSource) {
            return NextResponse.json({ error: 'Legal consent columns are missing' }, { status: 500 })
        }

        const body = await request.json()
        const accepted = body?.accepted === true
        const source = String(body?.source || 'login').trim().toLowerCase()

        if (!accepted) {
            return NextResponse.json({ error: 'Согласие обязательно' }, { status: 400 })
        }

        await query(
            `UPDATE users
             SET legal_accepted_at = NOW(),
                 terms_accepted_at = NOW(),
                 privacy_accepted_at = NOW(),
                 legal_acceptance_version = $1,
                 legal_acceptance_source = $2
             WHERE id = $3`,
            [LEGAL_ACCEPTANCE_VERSION, source, userId]
        )

        return NextResponse.json({ success: true, version: LEGAL_ACCEPTANCE_VERSION })
    } catch (error) {
        console.error('Legal Consent Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
