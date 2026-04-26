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

async function createOrganizerInvite(clubId: string, label?: string | null) {
    for (let attempt = 0; attempt < 60; attempt++) {
        const code = digits(4)
        const res = await query(
            `
            INSERT INTO tournament_access_invites (club_id, kind, code, label)
            SELECT $1, 'ORGANIZER', $2, $3
            WHERE NOT EXISTS (
                SELECT 1
                FROM tournament_access_invites
                WHERE club_id = $1
                  AND kind = 'ORGANIZER'
                  AND code = $2
                  AND revoked_at IS NULL
                  AND (expires_at IS NULL OR expires_at > NOW())
            )
            RETURNING *
            `,
            [clubId, code, label ?? null]
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
            SELECT *
            FROM tournament_access_invites
            WHERE club_id = $1
              AND kind = 'ORGANIZER'
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
            `,
            [clubId]
        )

        return NextResponse.json({ invites: res.rows })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Organizer Invites GET Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params
        await requireClubFullAccess(clubId)

        const body = await request.json()
        const label = body?.label ? String(body.label).trim() : null

        const invite = await createOrganizerInvite(clubId, label)
        return NextResponse.json({ invite })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Organizer Invites POST Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}
