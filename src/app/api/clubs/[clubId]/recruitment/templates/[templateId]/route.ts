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
    { params }: { params: Promise<{ clubId: string; templateId: string }> }
) {
    try {
        const { clubId, templateId } = await params
        await requireClubFullAccess(clubId)

        const res = await query(
            `SELECT * FROM recruitment_form_templates WHERE club_id = $1 AND id = $2`,
            [clubId, templateId]
        )
        if (res.rowCount === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 })

        const testsRes = await query(
            `
            SELECT
                rt.*,
                rft.sort_order
            FROM recruitment_form_template_tests rft
            JOIN recruitment_test_templates rt ON rt.id = rft.test_id
            WHERE rft.template_id = $1
            ORDER BY rft.sort_order ASC
            `,
            [templateId]
        )

        return NextResponse.json({ ...res.rows[0], tests: testsRes.rows })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Template GET Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ clubId: string; templateId: string }> }
) {
    try {
        const { clubId, templateId } = await params
        await requireClubFullAccess(clubId)

        const body = await request.json()

        const rotateToken = Boolean(body?.rotate_token)
        const newToken = rotateToken ? makeToken() : null
        const tests = body?.tests

        const fields: { sql: string; value: any }[] = []
        if (body?.name !== undefined) fields.push({ sql: "name", value: String(body.name || "").trim() })
        if (body?.description !== undefined) fields.push({ sql: "description", value: body.description ?? null })
        if (body?.position !== undefined) fields.push({ sql: "position", value: body.position ?? null })
        if (body?.schema !== undefined) fields.push({ sql: "schema", value: body.schema })
        if (body?.is_active !== undefined) fields.push({ sql: "is_active", value: Boolean(body.is_active) })
        if (rotateToken) fields.push({ sql: "public_token", value: newToken })

        if (fields.length === 0 && tests === undefined) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 })
        }

        await query("BEGIN")

        let updatedTemplate = null as any
        if (fields.length > 0) {
            const setSql = fields.map((f, i) => `${f.sql} = $${i + 3}`).join(", ")
            const values = fields.map(f => f.value)

            const res = await query(
                `
                UPDATE recruitment_form_templates
                SET ${setSql},
                    updated_at = NOW()
                WHERE club_id = $1 AND id = $2
                RETURNING *
                `,
                [clubId, templateId, ...values]
            )

            if (res.rowCount === 0) {
                await query("ROLLBACK")
                return NextResponse.json({ error: "Not Found" }, { status: 404 })
            }
            updatedTemplate = res.rows[0]
        } else {
            const res = await query(
                `SELECT * FROM recruitment_form_templates WHERE club_id = $1 AND id = $2`,
                [clubId, templateId]
            )
            if (res.rowCount === 0) {
                await query("ROLLBACK")
                return NextResponse.json({ error: "Not Found" }, { status: 404 })
            }
            updatedTemplate = res.rows[0]
        }

        if (tests !== undefined) {
            const list = Array.isArray(tests) ? tests : []
            await query(`DELETE FROM recruitment_form_template_tests WHERE template_id = $1`, [templateId])
            for (let i = 0; i < list.length; i++) {
                const testId = Number(list[i]?.id ?? list[i])
                if (!Number.isFinite(testId)) continue
                await query(
                    `
                    INSERT INTO recruitment_form_template_tests (template_id, test_id, sort_order)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (template_id, test_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
                    `,
                    [templateId, testId, i]
                )
            }
        }

        const testsRes = await query(
            `
            SELECT
                rt.*,
                rft.sort_order
            FROM recruitment_form_template_tests rft
            JOIN recruitment_test_templates rt ON rt.id = rft.test_id
            WHERE rft.template_id = $1
            ORDER BY rft.sort_order ASC
            `,
            [templateId]
        )

        await query("COMMIT")
        return NextResponse.json({ ...updatedTemplate, tests: testsRes.rows })
    } catch (error: any) {
        try { await query("ROLLBACK") } catch {}
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Template PUT Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string; templateId: string }> }
) {
    try {
        const { clubId, templateId } = await params
        await requireClubFullAccess(clubId)

        const res = await query(
            `DELETE FROM recruitment_form_templates WHERE club_id = $1 AND id = $2 RETURNING id`,
            [clubId, templateId]
        )
        if (res.rowCount === 0) return NextResponse.json({ error: "Not Found" }, { status: 404 })
        return NextResponse.json({ success: true })
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500
        if (status === 500) console.error("Recruitment Template DELETE Error:", error)
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
    }
}
