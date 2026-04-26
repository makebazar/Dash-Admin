import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"
import crypto from "crypto"

export const dynamic = "force-dynamic"

function digits(length: number) {
    let out = ""
    for (let i = 0; i < length; i++) out += String(crypto.randomInt(0, 10))
    return out
}

async function createInviteCode(params: {
    clubId: string
    tournamentId: number
    kind: "JUDGE"
    length: number
    label?: string | null
}) {
    for (let attempt = 0; attempt < 40; attempt++) {
        const code = digits(params.length)
        const res = await query(
            `
            INSERT INTO tournament_access_invites (club_id, tournament_id, kind, code, label)
            SELECT $1, $2, $3, $4, $5
            WHERE NOT EXISTS (
                SELECT 1
                FROM tournament_access_invites
                WHERE club_id = $1
                  AND kind = $3
                  AND code = $4
                  AND revoked_at IS NULL
                  AND (expires_at IS NULL OR expires_at > NOW())
            )
            RETURNING *
            `,
            [params.clubId, params.tournamentId, params.kind, code, params.label ?? null]
        )
        if ((res.rowCount || 0) > 0) return res.rows[0]
    }
    throw new Error("Failed to allocate invite code")
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params
        await requireClubFullAccess(clubId)

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
            ORDER BY t.created_at DESC
            `,
            [clubId]
        )

        return NextResponse.json({ tournaments: res.rows })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Tournaments GET Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params
        const access = await requireClubFullAccess(clubId)

        const body = await request.json()
        const name = String(body?.name || "").trim()
        const venue = body?.venue ? String(body.venue).trim() : null
        const localMode = body?.local_mode !== false
        const startsAt = body?.starts_at ? new Date(body.starts_at) : null
        const config = body?.config && typeof body.config === "object" ? body.config : {}

        if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

        const inserted = await query(
            `
            INSERT INTO club_tournaments (club_id, name, venue, local_mode, starts_at, config, created_by_user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [clubId, name, venue, localMode, startsAt, config, access.userId]
        )

        const tournament = inserted.rows[0]
        const judgeInvite = await createInviteCode({
            clubId,
            tournamentId: Number(tournament.id),
            kind: "JUDGE",
            length: 4,
            label: "Судья",
        })

        return NextResponse.json({ tournament, judgeInvite })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Tournaments POST Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}
