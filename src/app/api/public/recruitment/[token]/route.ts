import { NextResponse } from "next/server"
import { query } from "@/db"

export const dynamic = "force-dynamic"

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params
        const res = await query(
            `
            SELECT
                t.id,
                t.club_id,
                t.name,
                t.description,
                t.position,
                t.schema
            FROM recruitment_form_templates t
            WHERE t.public_token = $1
              AND t.is_active = TRUE
            LIMIT 1
            `,
            [token]
        )

        if (res.rowCount === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 })

        const template = res.rows[0]

        const testsRes = await query(
            `
            SELECT
                rt.id,
                rt.name,
                rt.description,
                rt.schema,
                rft.sort_order
            FROM recruitment_form_template_tests rft
            JOIN recruitment_test_templates rt ON rt.id = rft.test_id
            WHERE rft.template_id = $1
              AND rt.is_active = TRUE
            ORDER BY rft.sort_order ASC
            `,
            [template.id]
        )

        return NextResponse.json({ template, tests: testsRes.rows })
    } catch (error) {
        console.error("Public Recruitment GET Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params
        const body = await request.json()

        const templateRes = await query(
            `
            SELECT id, club_id, schema
            FROM recruitment_form_templates
            WHERE public_token = $1
              AND is_active = TRUE
            LIMIT 1
            `,
            [token]
        )
        if (templateRes.rowCount === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 })

        const template = templateRes.rows[0]
        const candidateName = body?.candidate_name ?? null
        const candidatePhone = body?.candidate_phone ?? body?.phone ?? null
        const candidateEmail = body?.candidate_email ?? body?.email ?? null
        const answers = body?.answers ?? {}

        const insert = await query(
            `
            INSERT INTO recruitment_applications (
                club_id,
                template_id,
                candidate_name,
                candidate_phone,
                candidate_email,
                answers,
                auto_score
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            `,
            [template.club_id, template.id, candidateName, candidatePhone, candidateEmail, answers, 0]
        )

        const testsCountRes = await query(
            `
            SELECT COUNT(*)::int as cnt
            FROM recruitment_form_template_tests
            WHERE template_id = $1
            `,
            [template.id]
        )
        const testsCount = testsCountRes.rows[0]?.cnt ?? 0

        if (testsCount === 0) {
            await query(
                `
                UPDATE recruitment_applications
                SET status = 'new'
                WHERE id = $1
                `,
                [insert.rows[0].id]
            )
        }

        const testsRes = await query(
            `
            SELECT
                rt.id,
                rt.name,
                rt.description,
                rt.schema,
                rft.sort_order
            FROM recruitment_form_template_tests rft
            JOIN recruitment_test_templates rt ON rt.id = rft.test_id
            WHERE rft.template_id = $1
              AND rt.is_active = TRUE
            ORDER BY rft.sort_order ASC
            `,
            [template.id]
        )

        return NextResponse.json({ success: true, id: insert.rows[0].id, tests: testsRes.rows })
    } catch (error) {
        console.error("Public Recruitment POST Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
