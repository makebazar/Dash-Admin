import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"

export const dynamic = "force-dynamic"

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
            FROM recruitment_test_templates
            WHERE club_id = $1
            ORDER BY created_at DESC
            `,
            [clubId]
        )
        return NextResponse.json(res.rows)
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Tests GET Error:", error)
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
        const name = String(body?.name || "").trim()
        const description = body?.description ?? null
        const schema = body?.schema ?? { version: 1, questions: [] }

        if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

        const insert = await query(
            `
            INSERT INTO recruitment_test_templates (club_id, name, description, schema)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            `,
            [clubId, name, description, schema]
        )
        return NextResponse.json(insert.rows[0])
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Tests POST Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}
