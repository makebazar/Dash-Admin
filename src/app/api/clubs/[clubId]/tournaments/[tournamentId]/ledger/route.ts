import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"

export const dynamic = "force-dynamic"

const allowedKinds = new Set(["FEE", "SPONSOR", "EXPENSE", "PRIZE"])

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; tournamentId: string }> }
) {
    try {
        const { clubId, tournamentId } = await params
        await requireClubFullAccess(clubId)

        const eventsRes = await query(
            `
            SELECT *
            FROM tournament_ledger_events
            WHERE tournament_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT 300
            `,
            [tournamentId]
        )

        const totalsRes = await query(
            `
            SELECT kind, currency, COALESCE(SUM(amount), 0)::numeric(12,2) as total
            FROM tournament_ledger_events
            WHERE tournament_id = $1
            GROUP BY kind, currency
            ORDER BY kind, currency
            `,
            [tournamentId]
        )

        return NextResponse.json({ events: eventsRes.rows, totals: totalsRes.rows })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Tournament ledger GET error:", error)
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
        const kind = String(body?.kind || "").toUpperCase()
        const currency = body?.currency ? String(body.currency).toUpperCase().trim() : "RUB"
        const amount = Number(body?.amount)
        const note = body?.note ? String(body.note).trim() : null

        if (!allowedKinds.has(kind)) return NextResponse.json({ error: "kind is invalid" }, { status: 400 })
        if (!Number.isFinite(amount)) return NextResponse.json({ error: "amount is invalid" }, { status: 400 })

        const meta = note ? { note } : {}

        const inserted = await query(
            `
            INSERT INTO tournament_ledger_events (tournament_id, kind, amount, currency, meta)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [tournamentId, kind, amount, currency, meta]
        )

        return NextResponse.json({ event: inserted.rows[0] })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Tournament ledger POST error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}

