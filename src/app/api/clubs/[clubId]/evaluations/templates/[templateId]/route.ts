import { NextResponse } from 'next/server'
import { query } from '@/db'
import { cookies } from 'next/headers'

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string, templateId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value
        const { clubId, templateId } = await params

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check ownership/manager access (only owners can delete templates for now)
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        )

        if (ownerCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Delete template (cascade will handle items)
        await query(
            `DELETE FROM evaluation_templates WHERE id = $1 AND club_id = $2`,
            [templateId, clubId]
        )

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Delete Template Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
