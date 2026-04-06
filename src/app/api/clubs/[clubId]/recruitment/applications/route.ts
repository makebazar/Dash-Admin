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

        const url = new URL(request.url)
        const templateId = url.searchParams.get("template_id")
        const status = url.searchParams.get("status")

        const where: string[] = ["a.club_id = $1"]
        const values: any[] = [clubId]

        if (templateId) {
            values.push(templateId)
            where.push(`a.template_id = $${values.length}`)
        }
        if (status) {
            values.push(status)
            where.push(`a.status = $${values.length}`)
        }

        const res = await query(
            `
            SELECT
                a.id,
                a.club_id,
                a.template_id,
                t.name as template_name,
                t.position as template_position,
                a.candidate_name,
                a.candidate_phone,
                a.candidate_email,
                COALESCE(ts.tests_auto_score, 0)::int as auto_score,
                a.manual_score,
                (COALESCE(ts.tests_auto_score, 0) + COALESCE(a.manual_score, 0))::int as total_score,
                COALESCE(tsum.test_summaries, '[]'::json) as test_summaries,
                a.status,
                a.reviewed_at,
                a.created_at
            FROM recruitment_applications a
            JOIN recruitment_form_templates t ON t.id = a.template_id
            LEFT JOIN (
                SELECT
                    application_id,
                    COALESCE(SUM(COALESCE(auto_score, 0)), 0)::int as tests_auto_score
                FROM recruitment_application_tests
                WHERE score_percent IS NOT NULL
                GROUP BY application_id
            ) ts ON ts.application_id = a.id
            LEFT JOIN (
                SELECT
                    rat.application_id,
                    json_agg(
                        json_build_object(
                            'test_id', rat.test_id,
                            'name', rt.name,
                            'label', COALESCE(rat.result->>'label', ''),
                            'decision', COALESCE(rat.result->>'decision', ''),
                            'score', COALESCE(rat.auto_score, 0),
                            'percent', COALESCE(rat.score_percent, 0)
                        )
                        ORDER BY rt.name ASC
                    ) as test_summaries
                FROM recruitment_application_tests rat
                JOIN recruitment_test_templates rt ON rt.id = rat.test_id
                WHERE rat.score_percent IS NOT NULL
                GROUP BY rat.application_id
            ) tsum ON tsum.application_id = a.id
            WHERE ${where.join(" AND ")}
            ORDER BY a.created_at DESC
            `,
            values
        )

        return NextResponse.json(res.rows)
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Applications GET Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}
