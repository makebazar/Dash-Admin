import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"

export const dynamic = "force-dynamic"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; applicationId: string }> }
) {
    try {
        const { clubId, applicationId } = await params
        await requireClubFullAccess(clubId)

        const res = await query(
            `
            SELECT
                a.*,
                t.name as template_name,
                t.position as template_position,
                t.schema as template_schema,
                COALESCE(tt.tests, '[]'::json) as template_tests,
                COALESCE(at.tests, '[]'::json) as application_tests
            FROM recruitment_applications a
            JOIN recruitment_form_templates t ON t.id = a.template_id
            LEFT JOIN (
                SELECT
                    rft.template_id,
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', rt.id,
                            'name', rt.name,
                            'description', rt.description,
                            'schema', rt.schema,
                            'sort_order', rft.sort_order
                        )
                        ORDER BY rft.sort_order
                    ) FILTER (WHERE rt.id IS NOT NULL) AS tests
                FROM recruitment_form_template_tests rft
                JOIN recruitment_test_templates rt ON rt.id = rft.test_id
                GROUP BY rft.template_id
            ) tt ON tt.template_id = t.id
            LEFT JOIN (
                SELECT
                    rat.application_id,
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'test_id', rat.test_id,
                            'answers', rat.answers,
                            'auto_score', rat.auto_score,
                            'max_score', rat.max_score,
                            'score_percent', rat.score_percent,
                            'result', rat.result
                        )
                    ) FILTER (WHERE rat.id IS NOT NULL) AS tests
                FROM recruitment_application_tests rat
                GROUP BY rat.application_id
            ) at ON at.application_id = a.id
            WHERE a.club_id = $1 AND a.id = $2
            `,
            [clubId, applicationId]
        )
        if (res.rowCount === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 })
        return NextResponse.json(res.rows[0])
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Application GET Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ clubId: string; applicationId: string }> }
) {
    try {
        const { clubId, applicationId } = await params
        await requireClubFullAccess(clubId)

        const body = await request.json()
        const fields: { sql: string; value: any }[] = []
        if (body?.status !== undefined) fields.push({ sql: "status", value: String(body.status) })
        if (body?.manual_score !== undefined) {
            const n = body.manual_score === null ? null : Number(body.manual_score)
            fields.push({ sql: "manual_score", value: Number.isFinite(n) ? n : null })
        }

        if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })

        const setSql = fields.map((f, i) => `${f.sql} = $${i + 3}`).join(", ")
        const values = fields.map(f => f.value)

        const res = await query(
            `
            UPDATE recruitment_applications
            SET ${setSql},
                reviewed_at = NOW()
            WHERE club_id = $1 AND id = $2
            RETURNING *
            `,
            [clubId, applicationId, ...values]
        )
        if (res.rowCount === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 })
        return NextResponse.json(res.rows[0])
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Application PUT Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}
