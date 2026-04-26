import { cookies } from "next/headers"
import { query } from "@/db"

export type ArenaInviteKind = "PARTICIPANT" | "JUDGE" | "ORGANIZER"

export type ArenaInvite = {
    id: string
    kind: ArenaInviteKind
    club_id: number | null
    tournament_id: number | null
    competitor_id: number | null
    code: string
    token: string
    label: string | null
    expires_at: string | null
    revoked_at: string | null
}

export async function getArenaInvite(): Promise<ArenaInvite | null> {
    const token = (await cookies()).get("arena_invite_token")?.value
    if (!token) return null

    const res = await query(
        `
        SELECT
            id::text,
            kind,
            club_id,
            tournament_id,
            competitor_id,
            code,
            token::text,
            label,
            expires_at,
            revoked_at
        FROM tournament_access_invites
        WHERE token = $1
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
        `,
        [token]
    )

    if ((res.rowCount || 0) === 0) return null
    return res.rows[0] as ArenaInvite
}
