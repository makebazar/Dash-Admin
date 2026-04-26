import { NextResponse } from "next/server"
import { getArenaInvite } from "@/lib/arena-access"
import { query } from "@/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    try {
        const { matchId } = await params
        const invite = await getArenaInvite()
        if (!invite) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        if (invite.kind !== "JUDGE") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const matchRes = await query(`SELECT id, tournament_id FROM tournament_matches WHERE id = $1 LIMIT 1`, [matchId])
        if ((matchRes.rowCount || 0) === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
        const match = matchRes.rows[0]
        if (!invite.tournament_id || Number(invite.tournament_id) !== Number(match.tournament_id)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const winnerId = body?.winner_competitor_id ? Number(body.winner_competitor_id) : null
        const score = body?.score && typeof body.score === "object" ? body.score : null
        const note = body?.note ? String(body.note).trim() : null

        if (!winnerId) return NextResponse.json({ error: "winner_competitor_id is required" }, { status: 400 })

        const resultPayload: any = { ...(score ? { score } : {}), ...(note ? { note } : {}) }

        const updated = await query(
            `
            UPDATE tournament_matches
            SET
                status = 'FINISHED',
                winner_competitor_id = $2,
                result = COALESCE(result, '{}'::jsonb) || $3::jsonb,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            `,
            [matchId, winnerId, JSON.stringify(resultPayload)]
        )

        await query(`SELECT pg_notify('tournament_match_updates', $1)`, [JSON.stringify({ matchId: String(matchId), ts: Date.now() })])

        return NextResponse.json({ match: updated.rows[0] })
    } catch (error: any) {
        console.error("Arena result PATCH error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}
