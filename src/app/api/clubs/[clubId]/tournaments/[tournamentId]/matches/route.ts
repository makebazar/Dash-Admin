import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"

export const dynamic = "force-dynamic"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; tournamentId: string }> }
) {
    try {
        const { clubId, tournamentId } = await params
        await requireClubFullAccess(clubId)

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
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Tournament Matches GET Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string; tournamentId: string }> }
) {
    try {
        const { clubId, tournamentId } = await params
        await requireClubFullAccess(clubId)

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
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Tournament Matches POST Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}
