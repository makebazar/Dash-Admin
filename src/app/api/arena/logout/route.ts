import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export async function POST() {
    const cookieStore = await cookies()
    cookieStore.set("arena_invite_token", "", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 0,
    })
    return NextResponse.json({ ok: true })
}
