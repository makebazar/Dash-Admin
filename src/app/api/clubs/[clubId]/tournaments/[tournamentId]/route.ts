import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"

export const dynamic = "force-dynamic"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; tournamentId: string }> }
) {
    try {
        const { clubId, tournamentId } = await params
        await requireClubFullAccess(clubId)

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
            WHERE t.club_id = $1 AND t.id = $2
            LIMIT 1
            `,
            [clubId, tournamentId]
        )

        if ((tournamentRes.rowCount || 0) === 0) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

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
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Tournament GET Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; tournamentId: string }> }
) {
    try {
        const { clubId, tournamentId } = await params
        await requireClubFullAccess(clubId)

        const body = await request.json()
        const allowedStatuses = new Set(["DRAFT", "REGISTRATION", "STARTED", "FINISHED", "CANCELLED"])
        const status = body?.status && allowedStatuses.has(String(body.status)) ? String(body.status) : undefined
        const venue = body?.venue !== undefined ? (body.venue ? String(body.venue).trim() : null) : undefined
        const startsAt = body?.starts_at !== undefined ? (body.starts_at ? new Date(body.starts_at) : null) : undefined
        const localMode = body?.local_mode !== undefined ? Boolean(body.local_mode) : undefined
        const config = body?.config !== undefined ? (body.config && typeof body.config === "object" ? body.config : {}) : undefined

        const fields: string[] = []
        const values: any[] = []
        let idx = 1

        if (status !== undefined) {
            fields.push(`status = $${idx++}`)
            values.push(status)
        }
        if (venue !== undefined) {
            fields.push(`venue = $${idx++}`)
            values.push(venue)
        }
        if (startsAt !== undefined) {
            fields.push(`starts_at = $${idx++}`)
            values.push(startsAt)
        }
        if (localMode !== undefined) {
            fields.push(`local_mode = $${idx++}`)
            values.push(localMode)
        }
        if (config !== undefined) {
            fields.push(`config = $${idx++}`)
            values.push(config)
        }

        if (fields.length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 })
        }

        fields.push(`updated_at = NOW()`)
        values.push(clubId, tournamentId)

        const updated = await query(
            `
            UPDATE club_tournaments
            SET ${fields.join(", ")}
            WHERE club_id = $${idx++} AND id = $${idx++}
            RETURNING *
            `,
            values
        )

        if ((updated.rowCount || 0) === 0) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        return NextResponse.json({ tournament: updated.rows[0] })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Tournament PATCH Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}
