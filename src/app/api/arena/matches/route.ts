import { NextResponse } from "next/server"
import { getArenaInvite } from "@/lib/arena-access"
import { query } from "@/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const invite = await getArenaInvite()
        if (!invite) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        if (invite.kind === "PARTICIPANT") {
            if (!invite.tournament_id || !invite.competitor_id) {
                return NextResponse.json({ error: "Invalid session" }, { status: 400 })
            }

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
                  AND (m.competitor_a_id = $2 OR m.competitor_b_id = $2)
                ORDER BY m.round ASC, m.order_in_round ASC, m.id ASC
                `,
                [invite.tournament_id, invite.competitor_id]
            )

            return NextResponse.json({ matches: res.rows })
        }

        if (invite.kind === "JUDGE") {
            if (!invite.tournament_id) return NextResponse.json({ error: "Invalid session" }, { status: 400 })

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
                [invite.tournament_id]
            )

            return NextResponse.json({ matches: res.rows })
        }

        return NextResponse.json({ error: "Not supported" }, { status: 400 })
    } catch (error: any) {
        console.error("Arena matches error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}
