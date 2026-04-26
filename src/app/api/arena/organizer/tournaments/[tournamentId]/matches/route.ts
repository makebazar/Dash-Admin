import { NextResponse } from "next/server"
import { getArenaInvite } from "@/lib/arena-access"
import { query } from "@/db"

export const dynamic = "force-dynamic"

async function assertOrganizerTournamentAccess(tournamentId: string) {
    const invite = await getArenaInvite()
    if (!invite) return { ok: false as const, error: "Unauthorized", status: 401 }
    if (invite.kind !== "ORGANIZER" || !invite.club_id) return { ok: false as const, error: "Forbidden", status: 403 }

    const res = await query(
        `
        SELECT id, club_id
        FROM club_tournaments
        WHERE id = $1
          AND club_id = $2
          AND created_by_invite_id = $3
        LIMIT 1
        `,
        [tournamentId, invite.club_id, invite.id]
    )
    if ((res.rowCount || 0) === 0) return { ok: false as const, error: "Not found", status: 404 }
    return { ok: true as const, invite, tournament: res.rows[0] as { id: number; club_id: number } }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ tournamentId: string }> }
) {
    try {
        const { tournamentId } = await params
        const access = await assertOrganizerTournamentAccess(tournamentId)
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

        const res = await query(
            `
            SELECT
                m.*,
                a.display_name as competitor_a_name,
                b.display_name as competitor_b_name,
                w.display_name as winner_name
            FROM tournament_matches m
            LEFT JOIN tournament_competitors a ON a.id = m.competitor_a_id
            LEFT JOIN tournament_competitors b ON b.id = m.competitor_b_id
            LEFT JOIN tournament_competitors w ON w.id = m.winner_competitor_id
            WHERE m.tournament_id = $1
            ORDER BY m.round ASC, m.order_in_round ASC, m.id ASC
            `,
            [tournamentId]
        )

        return NextResponse.json({ matches: res.rows })
    } catch (error: any) {
        console.error("Arena organizer matches GET error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ tournamentId: string }> }
) {
    try {
        const { tournamentId } = await params
        const access = await assertOrganizerTournamentAccess(tournamentId)
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

        const body = await request.json()
        const competitorAId = body?.competitor_a_id ? Number(body.competitor_a_id) : null
        const competitorBId = body?.competitor_b_id ? Number(body.competitor_b_id) : null
        const round = body?.round ? Number(body.round) : 1
        const orderInRound = body?.order_in_round ? Number(body.order_in_round) : 1
        const scheduledAt = body?.scheduled_at ? new Date(body.scheduled_at) : null

        const res = await query(
            `
            INSERT INTO tournament_matches (
                tournament_id,
                round,
                order_in_round,
                competitor_a_id,
                competitor_b_id,
                scheduled_at
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            `,
            [tournamentId, round, orderInRound, competitorAId, competitorBId, scheduledAt]
        )

        return NextResponse.json({ match: res.rows[0] })
    } catch (error: any) {
        console.error("Arena organizer matches POST error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}

