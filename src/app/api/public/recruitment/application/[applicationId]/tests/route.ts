import { NextResponse } from "next/server"
import { query } from "@/db"
import { resolveScoreBand, scorePercent, scoreRecruitmentAnswers } from "@/lib/recruitment"

export const dynamic = "force-dynamic"

const TIMER_STARTED_AT_KEY = "__timer_started_at"
const TIMER_DEADLINE_AT_KEY = "__timer_deadline_at"

function getTimeLimitMinutes(schema: any) {
    const value = schema?.time_limit_minutes
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value)
    if (typeof value === "string") {
        const parsed = Number(value)
        if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed)
    }
    return null
}

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
        const startOnly = Boolean(body?.start_only)

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
        const timeLimitMinutes = getTimeLimitMinutes(test.schema)

        const existingAttemptRes = await query(
            `
            SELECT answers, auto_score, score_percent
            FROM recruitment_application_tests
            WHERE application_id = $1 AND test_id = $2
            LIMIT 1
            `,
            [applicationId, testId]
        )
        const existingAttempt = existingAttemptRes.rows[0] || null
        const existingAnswers = existingAttempt?.answers && typeof existingAttempt.answers === "object" ? existingAttempt.answers : {}

        const currentStartedAt = typeof existingAnswers?.[TIMER_STARTED_AT_KEY] === "string" ? existingAnswers[TIMER_STARTED_AT_KEY] : null
        const currentDeadlineAt = typeof existingAnswers?.[TIMER_DEADLINE_AT_KEY] === "string" ? existingAnswers[TIMER_DEADLINE_AT_KEY] : null

        if (startOnly) {
            if (!timeLimitMinutes) {
                return NextResponse.json({
                    success: true,
                    started_at: null,
                    deadline_at: null,
                    time_limit_minutes: null
                })
            }

            const startedAt = currentStartedAt || new Date().toISOString()
            const deadlineAt = currentDeadlineAt || new Date(Date.now() + timeLimitMinutes * 60 * 1000).toISOString()
            const timerMetaAnswers = {
                ...existingAnswers,
                [TIMER_STARTED_AT_KEY]: startedAt,
                [TIMER_DEADLINE_AT_KEY]: deadlineAt
            }

            await query(
                `
                INSERT INTO recruitment_application_tests (application_id, test_id, answers, auto_score, max_score, score_percent, result)
                VALUES ($1, $2, $3, NULL, NULL, NULL, NULL)
                ON CONFLICT (application_id, test_id)
                DO UPDATE SET answers = EXCLUDED.answers
                `,
                [applicationId, testId, timerMetaAnswers]
            )

            return NextResponse.json({
                success: true,
                started_at: startedAt,
                deadline_at: deadlineAt,
                time_limit_minutes: timeLimitMinutes
            })
        }

        const startedAt = timeLimitMinutes ? (currentStartedAt || new Date().toISOString()) : null
        const deadlineAt = timeLimitMinutes
            ? (currentDeadlineAt || new Date(Date.now() + timeLimitMinutes * 60 * 1000).toISOString())
            : null
        const timedOut = deadlineAt ? Date.now() >= new Date(deadlineAt).getTime() : false
        const finalAnswers = {
            ...answers,
            ...(startedAt ? { [TIMER_STARTED_AT_KEY]: startedAt } : {}),
            ...(deadlineAt ? { [TIMER_DEADLINE_AT_KEY]: deadlineAt } : {})
        }

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
            [applicationId, testId, finalAnswers, score, maxScore, percent, result]
        )

        const requiredRes = await query(
            `SELECT COUNT(*)::int as cnt FROM recruitment_form_template_tests WHERE template_id = $1`,
            [app.template_id]
        )
        const requiredCount = requiredRes.rows[0]?.cnt ?? 0

        const doneRes = await query(
            `SELECT COUNT(*)::int as cnt FROM recruitment_application_tests WHERE application_id = $1 AND score_percent IS NOT NULL`,
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
            timed_out: timedOut,
            deadline_at: deadlineAt,
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
