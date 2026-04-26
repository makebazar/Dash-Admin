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
    tournamentId: string
    kind: "PARTICIPANT"
    competitorId: number
    length: number
}) {
    for (let attempt = 0; attempt < 60; attempt++) {
        const code = digits(params.length)
        const res = await query(
            `
            INSERT INTO tournament_access_invites (club_id, tournament_id, competitor_id, kind, code)
            SELECT $1, $2, $3, $4, $5
            WHERE NOT EXISTS (
                SELECT 1
                FROM tournament_access_invites
                WHERE club_id = $1
                  AND kind = $4
                  AND code = $5
                  AND revoked_at IS NULL
                  AND (expires_at IS NULL OR expires_at > NOW())
            )
            RETURNING *
            `,
            [params.clubId, params.tournamentId, params.competitorId, params.kind, code]
        )
        if ((res.rowCount || 0) > 0) return res.rows[0]
    }
    throw new Error("Failed to allocate invite code")
}

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
                c.*,
                e.id as entry_id,
                e.status as entry_status,
                e.seed,
                i.code as access_code,
                i.token as access_token
            FROM tournament_competitors c
            JOIN tournament_entries e ON e.competitor_id = c.id
            LEFT JOIN LATERAL (
                SELECT code, token
                FROM tournament_access_invites
                WHERE competitor_id = c.id
                  AND kind = 'PARTICIPANT'
                  AND revoked_at IS NULL
                  AND (expires_at IS NULL OR expires_at > NOW())
                ORDER BY created_at DESC
                LIMIT 1
            ) i ON TRUE
            WHERE c.tournament_id = $1
            ORDER BY c.created_at DESC
            `,
            [tournamentId]
        )

        return NextResponse.json({ competitors: res.rows })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Tournament Competitors GET Error:", error)
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
        const type = String(body?.type || "").toUpperCase()
        const displayName = String(body?.display_name || "").trim()
        const meta = body?.meta && typeof body.meta === "object" ? body.meta : {}

        if (!displayName) return NextResponse.json({ error: "display_name is required" }, { status: 400 })
        if (type !== "SOLO" && type !== "TEAM") return NextResponse.json({ error: "type must be SOLO or TEAM" }, { status: 400 })

        const competitorRes = await query(
            `
            INSERT INTO tournament_competitors (tournament_id, type, display_name, meta)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            `,
            [tournamentId, type, displayName, meta]
        )
        const competitor = competitorRes.rows[0]

        const entryRes = await query(
            `
            INSERT INTO tournament_entries (tournament_id, competitor_id, status)
            VALUES ($1, $2, $3)
            RETURNING *
            `,
            [tournamentId, competitor.id, "PENDING_PAYMENT"]
        )

        const invite = await createInviteCode({
            clubId,
            tournamentId,
            kind: "PARTICIPANT",
            competitorId: Number(competitor.id),
            length: 4,
        })

        return NextResponse.json({ competitor, entry: entryRes.rows[0], invite })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Tournament Competitors POST Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}
