import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"
import crypto from "crypto"

export const dynamic = "force-dynamic"

function makeToken() {
    return crypto.randomBytes(24).toString("hex")
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params
        await requireClubFullAccess(clubId)

        const res = await query(
            `
            SELECT
                t.*,
                COALESCE(a.cnt, 0)::int as applications_count,
                COALESCE(tt.tests, '[]'::json) as tests
            FROM recruitment_form_templates t
            LEFT JOIN (
                SELECT template_id, COUNT(*)::int as cnt
                FROM recruitment_applications
                WHERE club_id = $1
                GROUP BY template_id
            ) a ON a.template_id = t.id
            LEFT JOIN (
                SELECT
                    rft.template_id,
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'id', rt.id,
                            'name', rt.name,
                            'description', rt.description,
                            'is_active', rt.is_active,
                            'sort_order', rft.sort_order
                        )
                        ORDER BY rft.sort_order
                    ) FILTER (WHERE rt.id IS NOT NULL) AS tests
                FROM recruitment_form_template_tests rft
                JOIN recruitment_test_templates rt ON rt.id = rft.test_id
                WHERE rt.club_id = $1
                GROUP BY rft.template_id
            ) tt ON tt.template_id = t.id
            WHERE t.club_id = $1
            ORDER BY t.created_at DESC
            `,
            [clubId]
        )

        return NextResponse.json(res.rows)
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Templates GET Error:", error)
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
        const position = body?.position ?? null
        const schema = body?.schema ?? { version: 1, questions: [] }
        const tests = Array.isArray(body?.tests) ? body.tests : []

        if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

        const publicToken = makeToken()
        await query("BEGIN")
        const insert = await query(
            `
            INSERT INTO recruitment_form_templates (club_id, name, description, position, schema, public_token)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            `,
            [clubId, name, description, position, schema, publicToken]
        )

        const template = insert.rows[0]

        if (tests.length > 0) {
            for (let i = 0; i < tests.length; i++) {
                const testId = Number(tests[i]?.id ?? tests[i])
                if (!Number.isFinite(testId)) continue
                await query(
                    `
                    INSERT INTO recruitment_form_template_tests (template_id, test_id, sort_order)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (template_id, test_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
                    `,
                    [template.id, testId, i]
                )
            }
        }

        await query("COMMIT")

        return NextResponse.json(template)
    } catch (error: any) {
        try { await query("ROLLBACK") } catch {}
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Templates POST Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}
