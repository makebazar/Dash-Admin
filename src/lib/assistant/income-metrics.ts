import { query } from "@/db"

type ReportField = {
    metric_key?: string
    key?: string
    custom_label?: string
    label?: string
    field_type?: string
}

function sanitizeNumber(value: any) {
    const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0
    return Number.isFinite(n) ? n : 0
}

function parseReportData(reportData: any) {
    if (!reportData) return {}
    if (typeof reportData === "string") {
        try {
            const parsed = JSON.parse(reportData)
            return parsed && typeof parsed === "object" ? parsed : {}
        } catch {
            return {}
        }
    }
    if (typeof reportData === "object") return reportData
    return {}
}

function normalizeFields(schema: any): ReportField[] {
    if (Array.isArray(schema)) return schema
    if (schema && typeof schema === "object") {
        const fields = (schema as any).fields
        if (Array.isArray(fields)) return fields
    }
    return []
}

export async function getClubIncomeMetricKeys(clubId: string) {
    const { metrics, hasTemplate } = await getClubIncomeMetrics(clubId)
    return { keys: metrics.map((m) => m.key), hasTemplate }
}

export async function getClubIncomeMetrics(clubId: string) {
    const templateRes = await query(
        `SELECT schema FROM club_report_templates
         WHERE club_id = $1 AND is_active = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [clubId]
    )

    const schema = templateRes.rows[0]?.schema
    const fields = normalizeFields(schema)

    const fromTemplate = fields
        .filter((f) => String(f.field_type || "").toUpperCase() === "INCOME")
        .map((f) => {
            const key = String(f.metric_key || f.key || "").trim()
            const label = String(f.custom_label || f.label || f.metric_key || f.key || "").trim()
            return { key, label }
        })
        .filter((m) => Boolean(m.key))

    const defaults = [
        { key: "cash_income", label: "Наличные" },
        { key: "card_income", label: "Карта" },
    ]

    const unique = new Map<string, { key: string; label: string }>()
    for (const m of [...defaults, ...fromTemplate]) {
        if (!unique.has(m.key)) unique.set(m.key, m)
    }

    return { metrics: Array.from(unique.values()), hasTemplate: Boolean(templateRes.rowCount) }
}

export function getShiftIncomeBreakdown(
    shift: any,
    incomeMetrics: Array<{ key: string; label: string }>
) {
    const reportData = parseReportData(shift?.report_data)

    const metrics = Array.isArray(incomeMetrics) ? incomeMetrics : []
    const items = metrics.map((m) => {
        if (m.key === "cash_income") return { key: m.key, label: m.label, amount: sanitizeNumber(shift?.cash_income) }
        if (m.key === "card_income") return { key: m.key, label: m.label, amount: sanitizeNumber(shift?.card_income) }
        return { key: m.key, label: m.label, amount: sanitizeNumber(reportData?.[m.key]) }
    })

    const total = items.reduce((acc, i) => acc + i.amount, 0)
    return { total, items }
}

export function getShiftExpenses(shift: any) {
    return sanitizeNumber(shift?.expenses)
}
