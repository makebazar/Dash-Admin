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

async function createParticipantInviteCode(params: {
    clubId: number
    tournamentId: number
    competitorId: number
    length: number
}) {
    for (let attempt = 0; attempt < 60; attempt++) {
        const code = digits(params.length)
        const res = await query(
            `
            INSERT INTO tournament_access_invites (club_id, tournament_id, competitor_id, kind, code)
            SELECT $1, $2, $3, 'PARTICIPANT', $4
            WHERE NOT EXISTS (
                SELECT 1
                FROM tournament_access_invites
                WHERE club_id = $1
                  AND kind = 'PARTICIPANT'
                  AND code = $4
                  AND revoked_at IS NULL
                  AND (expires_at IS NULL OR expires_at > NOW())
            )
            RETURNING *
            `,
            [params.clubId, params.tournamentId, params.competitorId, code]
        )
        if ((res.rowCount || 0) > 0) return res.rows[0]
    }
    throw new Error("Failed to allocate invite code")
}

async function assertOrganizerTournamentAccess(tournamentId: string) {
    const invite = await getArenaInvite()
    if (!invite) return { ok: false as const, error: "Unauthorized", status: 401 }
    if (invite.kind !== "ORGANIZER" || !invite.club_id) return { ok: false as const, error: "Forbidden", status: 403 }

    const res = await query(
        `
        SELECT id, club_id
        FROM club_tournaments
        WHERE id = $1
          AND club_id = $2
          AND created_by_invite_id = $3
        LIMIT 1
        `,
        [tournamentId, invite.club_id, invite.id]
    )
    if ((res.rowCount || 0) === 0) return { ok: false as const, error: "Not found", status: 404 }
    return { ok: true as const, invite, tournament: res.rows[0] as { id: number; club_id: number } }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ tournamentId: string }> }
) {
    try {
        const { tournamentId } = await params
        const access = await assertOrganizerTournamentAccess(tournamentId)
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

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
        console.error("Arena organizer competitors GET error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ tournamentId: string }> }
) {
    try {
        const { tournamentId } = await params
        const access = await assertOrganizerTournamentAccess(tournamentId)
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

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

        const inviteRow = await createParticipantInviteCode({
            clubId: Number(access.tournament.club_id),
            tournamentId: Number(access.tournament.id),
            competitorId: Number(competitor.id),
            length: 4,
        })

        return NextResponse.json({ competitor, entry: entryRes.rows[0], invite: inviteRow })
    } catch (error: any) {
        console.error("Arena organizer competitors POST error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}

