import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard'
import { calculateSalary } from '@/lib/salary-calculator'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value
        const { clubId } = await params

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        const body = await request.json()
        const scheme = body?.scheme
        const shift = body?.shift
        const reportMetrics = body?.reportMetrics

        if (!scheme || !shift) {
            return NextResponse.json({ error: 'scheme and shift are required' }, { status: 400 })
        }

        const result = await calculateSalary(shift, scheme, reportMetrics || {})
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Salary Preview Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

