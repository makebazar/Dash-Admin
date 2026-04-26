import { NextResponse } from "next/server"
import { query } from "@/db"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const kind = String(body?.kind || "").toUpperCase()
        const rawCode = String(body?.code || "").trim()
        const code = rawCode.replace(/\s+/g, "")

        if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 })
        if (kind !== "PARTICIPANT" && kind !== "JUDGE" && kind !== "ORGANIZER") {
            return NextResponse.json({ error: "kind is invalid" }, { status: 400 })
        }

        const inviteRes = await query(
            `
            SELECT
                id::text,
                kind,
                club_id,
                tournament_id,
                competitor_id,
                code,
                token::text,
                label
            FROM tournament_access_invites
            WHERE kind = $1
              AND code = $2
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [kind, code]
        )

        if ((inviteRes.rowCount || 0) === 0) {
            return NextResponse.json({ error: "invalid code" }, { status: 404 })
        }

        const invite = inviteRes.rows[0]

        const cookieStore = await cookies()
        cookieStore.set("arena_invite_token", String(invite.token), {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 3,
        })

        return NextResponse.json({
            ok: true,
            invite: {
                kind: invite.kind,
                club_id: invite.club_id,
                tournament_id: invite.tournament_id,
                competitor_id: invite.competitor_id,
                label: invite.label,
            },
        })
    } catch (error: any) {
        console.error("Arena enter error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
    }
}
