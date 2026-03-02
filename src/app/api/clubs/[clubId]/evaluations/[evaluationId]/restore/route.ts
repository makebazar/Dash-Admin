import { NextResponse } from 'next/server'
import { query } from '@/db'
import { cookies } from 'next/headers'

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

        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2 AND role IN ('admin', 'manager')`,
            [clubId, userId]
        )

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

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
    } catch (error) {
        console.error('Restore Evaluation Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
