import { NextResponse } from "next/server"
import { getArenaInvite } from "@/lib/arena-access"
import { query } from "@/db"
import crypto from "crypto"

export const dynamic = "force-dynamic"

function digits(length: number) {
    let out = ""
    for (let i = 0; i < length; i++) out += String(crypto.randomInt(0, 10))
    return out
}

async function createJudgeInvite(clubId: number, tournamentId: number) {
    for (let attempt = 0; attempt < 60; attempt++) {
        const code = digits(4)
        const res = await query(
            `
            INSERT INTO tournament_access_invites (club_id, tournament_id, kind, code, label)
            SELECT $1, $2, 'JUDGE', $3, 'Судья'
            WHERE NOT EXISTS (
                SELECT 1
                FROM tournament_access_invites
                WHERE club_id = $1
                  AND kind = 'JUDGE'
                  AND code = $3
                  AND revoked_at IS NULL
                  AND (expires_at IS NULL OR expires_at > NOW())
            )
            RETURNING *
            `,
            [clubId, tournamentId, code]
        )
        if ((res.rowCount || 0) > 0) return res.rows[0]
    }
    throw new Error("Failed to allocate invite code")
}

export async function GET() {
    try {
        const invite = await getArenaInvite()
        if (!invite) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        if (invite.kind !== "ORGANIZER" || !invite.club_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const res = await query(
            `
            SELECT
                t.*,
                COALESCE(e.cnt, 0)::int as entries_count
            FROM club_tournaments t
            LEFT JOIN (
                SELECT tournament_id, COUNT(*)::int as cnt
                FROM tournament_entries
                GROUP BY tournament_id
            ) e ON e.tournament_id = t.id
            WHERE t.club_id = $1
              AND t.created_by_invite_id = $2
            ORDER BY t.created_at DESC
            `,
            [invite.club_id, invite.id]
        )

        return NextResponse.json({ tournaments: res.rows })
    } catch (error: any) {
        console.error("Arena organizer tournaments GET error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const invite = await getArenaInvite()
        if (!invite) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        if (invite.kind !== "ORGANIZER" || !invite.club_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const body = await request.json()
        const name = String(body?.name || "").trim()
        const venue = body?.venue ? String(body.venue).trim() : null
        const startsAt = body?.starts_at ? new Date(body.starts_at) : null
        const config = body?.config && typeof body.config === "object" ? body.config : {}

        if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

        const inserted = await query(
            `
            INSERT INTO club_tournaments (club_id, name, venue, local_mode, starts_at, config, created_by_invite_id)
            VALUES ($1, $2, $3, TRUE, $4, $5, $6)
            RETURNING *
            `,
            [invite.club_id, name, venue, startsAt, config, invite.id]
        )

        const tournament = inserted.rows[0]
        const judgeInvite = await createJudgeInvite(Number(invite.club_id), Number(tournament.id))

        return NextResponse.json({ tournament, judgeInvite })
    } catch (error: any) {
        console.error("Arena organizer tournaments POST error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}
