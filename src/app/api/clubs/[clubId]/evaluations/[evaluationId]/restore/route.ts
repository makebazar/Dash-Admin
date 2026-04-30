import { NextResponse } from 'next/server'
import { query } from '@/db'
import { cookies } from 'next/headers'
import { requireClubFullAccess } from '@/lib/club-api-access'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string; evaluationId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value
        const { clubId, evaluationId } = await params

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await requireClubFullAccess(String(clubId))

        const result = await query(
            `UPDATE evaluations
             SET status = 'pending',
                 reviewer_note = NULL,
                 reviewed_at = NULL,
                 reviewed_by = NULL
             WHERE id = $1 AND club_id = $2
             RETURNING id`,
            [evaluationId, clubId]
        )

        if ((result.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Not Found' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Restore Evaluation Error:', error)
        const status = typeof error?.status === 'number' ? error.status : 500
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status })
    }
}
