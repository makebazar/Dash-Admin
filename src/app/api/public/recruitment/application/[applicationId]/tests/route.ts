import { NextResponse } from "next/server"
import { query } from "@/db"
import { resolveScoreBand, scorePercent, scoreRecruitmentAnswers } from "@/lib/recruitment"

export const dynamic = "force-dynamic"

export async function POST(
    request: Request,
    { params }: { params: Promise<{ applicationId: string }> }
) {
    try {
        const { applicationId } = await params
        const body = await request.json()

        const testId = Number(body?.test_id)
        const answers = body?.answers ?? {}
        const complete = Boolean(body?.complete)

        if (!Number.isFinite(testId)) return NextResponse.json({ error: "test_id is required" }, { status: 400 })

        const appRes = await query(
            `SELECT id, club_id, template_id, auto_score FROM recruitment_applications WHERE id = $1`,
            [applicationId]
        )
        if (appRes.rowCount === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 })

        const app = appRes.rows[0]

        const testRes = await query(
            `SELECT id, schema FROM recruitment_test_templates WHERE id = $1 AND club_id = $2 AND is_active = TRUE`,
            [testId, app.club_id]
        )
        if (testRes.rowCount === 0) return NextResponse.json({ error: "Test Not Found" }, { status: 404 })

        const test = testRes.rows[0]
        const { score, maxScore } = scoreRecruitmentAnswers(test.schema, answers)
        const percent = scorePercent(score, maxScore)
        const band = resolveScoreBand(test.schema, score)
        const result = band || null

        await query(
            `
            INSERT INTO recruitment_application_tests (application_id, test_id, answers, auto_score, max_score, score_percent, result)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (application_id, test_id)
            DO UPDATE SET answers = EXCLUDED.answers, auto_score = EXCLUDED.auto_score, max_score = EXCLUDED.max_score, score_percent = EXCLUDED.score_percent, result = EXCLUDED.result
            `,
            [applicationId, testId, answers, score, maxScore, percent, result]
        )

        const requiredRes = await query(
            `SELECT COUNT(*)::int as cnt FROM recruitment_form_template_tests WHERE template_id = $1`,
            [app.template_id]
        )
        const requiredCount = requiredRes.rows[0]?.cnt ?? 0

        const doneRes = await query(
            `SELECT COUNT(*)::int as cnt FROM recruitment_application_tests WHERE application_id = $1`,
            [applicationId]
        )
        const doneCount = doneRes.rows[0]?.cnt ?? 0

        const testsScoreRes = await query(
            `SELECT COALESCE(SUM(COALESCE(auto_score, 0)), 0)::int as sum FROM recruitment_application_tests WHERE application_id = $1`,
            [applicationId]
        )
        const testsScore = testsScoreRes.rows[0]?.sum ?? 0

        const allDone = doneCount >= requiredCount && requiredCount > 0
        if (complete || allDone) {
            await query(
                `
                UPDATE recruitment_applications
                SET status = 'new',
                    auto_score = $2
                WHERE id = $1
                `,
                [applicationId, testsScore]
            )
        }

        return NextResponse.json({
            success: true,
            tests_done: doneCount,
            tests_required: requiredCount,
            auto_score_total: testsScore,
            completed: complete || allDone,
            test: {
                test_id: testId,
                score,
                max_score: maxScore,
                score_percent: percent,
                result
            }
        })
    } catch (error) {
        console.error("Public Recruitment Test POST Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
