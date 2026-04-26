import { NextResponse } from "next/server"
import { getArenaInvite } from "@/lib/arena-access"
import { query } from "@/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function assertMatchAccess(matchId: string, invite: Awaited<ReturnType<typeof getArenaInvite>>) {
    if (!invite) return { ok: false as const, error: "Unauthorized", status: 401 }
    if (invite.kind !== "JUDGE" && invite.kind !== "PARTICIPANT") return { ok: false as const, error: "Forbidden", status: 403 }

    const matchRes = await query(
        `SELECT id, tournament_id, competitor_a_id, competitor_b_id FROM tournament_matches WHERE id = $1 LIMIT 1`,
        [matchId]
    )
    if ((matchRes.rowCount || 0) === 0) return { ok: false as const, error: "Not found", status: 404 }
    const match = matchRes.rows[0]

    if (invite.kind === "JUDGE") {
        if (!invite.tournament_id || Number(invite.tournament_id) !== Number(match.tournament_id)) {
            return { ok: false as const, error: "Forbidden", status: 403 }
        }
    } else {
        if (!invite.tournament_id || !invite.competitor_id) return { ok: false as const, error: "Invalid session", status: 400 }
        if (Number(invite.tournament_id) !== Number(match.tournament_id)) return { ok: false as const, error: "Forbidden", status: 403 }
        if (Number(invite.competitor_id) !== Number(match.competitor_a_id) && Number(invite.competitor_id) !== Number(match.competitor_b_id)) {
            return { ok: false as const, error: "Forbidden", status: 403 }
        }
    }

    return { ok: true as const, match }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    try {
        const { matchId } = await params
        const invite = await getArenaInvite()
        const access = await assertMatchAccess(matchId, invite)
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

        const res = await query(
            `
            SELECT
                m.*,
                c.display_name as sender_competitor_name
            FROM tournament_match_messages m
            LEFT JOIN tournament_competitors c ON c.id = m.sender_competitor_id
            WHERE m.match_id = $1
            ORDER BY m.created_at ASC, m.id ASC
            LIMIT 300
            `,
            [matchId]
        )

        return NextResponse.json({ messages: res.rows })
    } catch (error: any) {
        console.error("Arena messages GET error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    try {
        const { matchId } = await params
        const invite = await getArenaInvite()
        const access = await assertMatchAccess(matchId, invite)
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

        const body = await request.json()
        const text = String(body?.body || "").trim()
        if (!text) return NextResponse.json({ error: "body is required" }, { status: 400 })

        const senderKind = invite?.kind === "JUDGE" ? "JUDGE" : "COMPETITOR"
        const senderCompetitorId = invite?.kind === "PARTICIPANT" ? invite.competitor_id : null

        const inserted = await query(
            `
            INSERT INTO tournament_match_messages (match_id, sender_kind, sender_competitor_id, body)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            `,
            [matchId, senderKind, senderCompetitorId, text]
        )

        await query(`SELECT pg_notify('tournament_match_messages', $1)`, [JSON.stringify({ matchId: String(matchId), ts: Date.now() })])

        return NextResponse.json({ message: inserted.rows[0] })
    } catch (error: any) {
        console.error("Arena messages POST error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}
