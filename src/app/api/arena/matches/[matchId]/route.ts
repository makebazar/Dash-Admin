import { NextResponse } from "next/server"
import { getArenaInvite } from "@/lib/arena-access"
import { query } from "@/db"

export const dynamic = "force-dynamic"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    try {
        const { matchId } = await params
        const invite = await getArenaInvite()
        if (!invite) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const matchRes = await query(
            `
            SELECT
                m.*,
                t.name as tournament_name,
                t.status as tournament_status,
                t.venue as tournament_venue,
                t.starts_at as tournament_starts_at,
                a.display_name as competitor_a_name,
                b.display_name as competitor_b_name,
                w.display_name as winner_name
            FROM tournament_matches m
            JOIN club_tournaments t ON t.id = m.tournament_id
            LEFT JOIN tournament_competitors a ON a.id = m.competitor_a_id
            LEFT JOIN tournament_competitors b ON b.id = m.competitor_b_id
            LEFT JOIN tournament_competitors w ON w.id = m.winner_competitor_id
            WHERE m.id = $1
            LIMIT 1
            `,
            [matchId]
        )

        if ((matchRes.rowCount || 0) === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
        const match = matchRes.rows[0]

        if (invite.kind === "JUDGE") {
            if (!invite.tournament_id || Number(invite.tournament_id) !== Number(match.tournament_id)) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 })
            }
        } else if (invite.kind === "PARTICIPANT") {
            if (!invite.tournament_id || !invite.competitor_id) return NextResponse.json({ error: "Invalid session" }, { status: 400 })
            if (Number(invite.tournament_id) !== Number(match.tournament_id)) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 })
            }
            if (Number(match.competitor_a_id) !== Number(invite.competitor_id) && Number(match.competitor_b_id) !== Number(invite.competitor_id)) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 })
            }
        } else {
            return NextResponse.json({ error: "Not supported" }, { status: 400 })
        }

        return NextResponse.json({ match })
    } catch (error: any) {
        console.error("Arena match error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}
