import { NextResponse } from "next/server"
import { query } from "@/db"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params

    const res = await query(
        `
        SELECT token::text
        FROM tournament_access_invites
        WHERE token = $1
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
        `,
        [token]
    )

    if ((res.rowCount || 0) === 0) {
        return NextResponse.redirect(new URL("/arena?error=invalid_token", request.url))
    }

    const cookieStore = await cookies()
    cookieStore.set("arena_invite_token", String(token), {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 3,
    })

    return NextResponse.redirect(new URL("/arena", request.url))
}
