import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"
import { validateRecruitmentTestSchema } from "@/lib/recruitment"

export const dynamic = "force-dynamic"

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string; testId: string }> }
) {
    try {
        const { clubId, testId } = await params
        await requireClubFullAccess(clubId)

        const res = await query(
            `SELECT * FROM recruitment_test_templates WHERE club_id = $1 AND id = $2`,
            [clubId, testId]
        )
        if (res.rowCount === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 })
        return NextResponse.json(res.rows[0])
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Test GET Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ clubId: string; testId: string }> }
) {
    try {
        const { clubId, testId } = await params
        await requireClubFullAccess(clubId)

        const body = await request.json()
        if (body?.schema !== undefined) {
            const error = validateRecruitmentTestSchema(body.schema)
            if (error) return NextResponse.json({ error }, { status: 400 })
        }
        const fields: { sql: string; value: any }[] = []
        if (body?.name !== undefined) fields.push({ sql: "name", value: String(body.name || "").trim() })
        if (body?.description !== undefined) fields.push({ sql: "description", value: body.description ?? null })
        if (body?.schema !== undefined) fields.push({ sql: "schema", value: body.schema })
        if (body?.is_active !== undefined) fields.push({ sql: "is_active", value: Boolean(body.is_active) })
        if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })

        const setSql = fields.map((f, i) => `${f.sql} = $${i + 3}`).join(", ")
        const values = fields.map(f => f.value)

        const res = await query(
            `
            UPDATE recruitment_test_templates
            SET ${setSql},
                updated_at = NOW()
            WHERE club_id = $1 AND id = $2
            RETURNING *
            `,
            [clubId, testId, ...values]
        )
        if (res.rowCount === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 })
        return NextResponse.json(res.rows[0])
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Test PUT Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ clubId: string; testId: string }> }
) {
    try {
        const { clubId, testId } = await params
        await requireClubFullAccess(clubId)

        const res = await query(
            `DELETE FROM recruitment_test_templates WHERE club_id = $1 AND id = $2 RETURNING id`,
            [clubId, testId]
        )
        if (res.rowCount === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Test DELETE Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}
