import { NextRequest, NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"
import { v4 as uuidv4 } from "uuid"

type AccessError = Error & { status?: number }

export async function POST(_request: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
    try {
        const { clubId } = await params
        const access = await requireClubFullAccess(clubId)
        if (!access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

        const botUsername = process.env.TELEGRAM_BOT_USERNAME
        if (!botUsername) return NextResponse.json({ error: "TELEGRAM_BOT_USERNAME is not set" }, { status: 500 })

        const code = uuidv4().replace(/-/g, "")
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

        await query(
            `INSERT INTO telegram_link_codes (club_id, code, created_by, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [clubId, code, access.userId, expiresAt]
        )

        return NextResponse.json({
            code,
            expires_at: expiresAt,
            url: `https://t.me/${botUsername}?start=${code}`,
        })
    } catch (error) {
        const status = (error as AccessError)?.status
        if (status) {
            return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status })
        }
        console.error("Telegram link error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

