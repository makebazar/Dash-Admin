import { NextResponse } from "next/server"
import { getArenaInvite } from "@/lib/arena-access"
import { query } from "@/db"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const invite = await getArenaInvite()
        if (!invite) return NextResponse.json({ invite: null })

        const tournament =
            invite.tournament_id != null
                ? await query(
                      `SELECT id, club_id, name, status, venue, starts_at FROM club_tournaments WHERE id = $1 LIMIT 1`,
                      [invite.tournament_id]
                  ).then(r => r.rows[0] || null)
                : null

        const competitor =
            invite.competitor_id != null
                ? await query(
                      `SELECT id, tournament_id, type, display_name FROM tournament_competitors WHERE id = $1 LIMIT 1`,
                      [invite.competitor_id]
                  ).then(r => r.rows[0] || null)
                : null

        return NextResponse.json({ invite, tournament, competitor })
    } catch (error: any) {
        console.error("Arena session error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}
