import { NextResponse } from 'next/server'
import { getClient, query } from '@/db'
import { cookies } from 'next/headers'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    const userId = (await cookies()).get('session_user_id')?.value
    const { clubId } = await params

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessCheck = await query(
        `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
         UNION
         SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
        [clubId, userId]
    )
    if ((accessCheck.rowCount || 0) === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sourceClubRes = await query(`SELECT id, owner_id FROM clubs WHERE id = $1`, [clubId])
    const sourceClub = sourceClubRes.rows[0]
    if (!sourceClub) {
        return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    const clubsRes = await query(
        `SELECT id, name
         FROM clubs
         WHERE owner_id = $1
         ORDER BY name`,
        [sourceClub.owner_id]
    )

    const client = await getClient()
    try {
        const clubs = []
        for (const club of clubsRes.rows) {
            const wsRes = await client.query(
                `SELECT w.id, w.name, w.zone, w.assigned_user_id, u.full_name as assigned_user_name
                 FROM club_workstations w
                 LEFT JOIN users u ON u.id = w.assigned_user_id
                 WHERE w.club_id = $1
                 ORDER BY w.zone, w.name`,
                [club.id]
            )
            clubs.push({
                id: club.id,
                name: club.name,
                workstations: wsRes.rows,
            })
        }
        return NextResponse.json({ clubs })
    } catch (e) {
        console.error('Get Interclub Targets Error:', e)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    } finally {
        client.release()
    }
}
