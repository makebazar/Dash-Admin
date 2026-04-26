import { NextResponse } from "next/server"
import { getArenaInvite } from "@/lib/arena-access"
import { query } from "@/db"

export const dynamic = "force-dynamic"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ tournamentId: string }> }
) {
    try {
        const { tournamentId } = await params
        const invite = await getArenaInvite()
        if (!invite) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        if (invite.kind !== "ORGANIZER" || !invite.club_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const tournamentRes = await query(
            `
            SELECT
                t.*,
                COALESCE(e.cnt, 0)::int as entries_count,
                COALESCE(m.cnt, 0)::int as matches_count
            FROM club_tournaments t
            LEFT JOIN (
                SELECT tournament_id, COUNT(*)::int as cnt
                FROM tournament_entries
                GROUP BY tournament_id
            ) e ON e.tournament_id = t.id
            LEFT JOIN (
                SELECT tournament_id, COUNT(*)::int as cnt
                FROM tournament_matches
                GROUP BY tournament_id
            ) m ON m.tournament_id = t.id
            WHERE t.id = $1
              AND t.club_id = $2
              AND t.created_by_invite_id = $3
            LIMIT 1
            `,
            [tournamentId, invite.club_id, invite.id]
        )

        if ((tournamentRes.rowCount || 0) === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

        const invitesRes = await query(
            `
            SELECT *
            FROM tournament_access_invites
            WHERE tournament_id = $1
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
            `,
            [tournamentId]
        )

        return NextResponse.json({ tournament: tournamentRes.rows[0], invites: invitesRes.rows })
    } catch (error: any) {
        console.error("Arena organizer tournament GET error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}
