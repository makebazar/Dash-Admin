import { query } from "@/db"
import { resolveAssistantRangePreset, type AssistantRangePreset } from "@/lib/assistant/range"
import type { AssistantIntent } from "@/lib/assistant/parse"
import { getClubIncomeMetrics, getShiftExpenses, getShiftIncomeBreakdown, getShiftIncomeValue } from "@/lib/assistant/income-metrics"

export type AssistantToolCall =
    | { name: "income_metrics"; arguments: {} }
    | { name: "revenue_summary"; arguments: { range_preset: AssistantRangePreset } }
    | { name: "revenue_by_day"; arguments: { range_preset: AssistantRangePreset } }
    | { name: "revenue_metric"; arguments: { metric_key: string; range_preset?: AssistantRangePreset; month?: number; year?: number } }
    | { name: "payroll_accrued"; arguments: { range_preset: AssistantRangePreset; adminsOnly?: boolean } }
    | { name: "compare_revenue"; arguments: { range_preset: AssistantRangePreset } }

export function getAssistantToolsSchema() {
    const rangeEnum = ["today", "yesterday", "last_7_days", "this_week", "this_month", "last_month"]
    return [
        {
            type: "function",
            function: {
                name: "income_metrics",
                description: "Список каналов дохода (ключи и подписи): например, Наличные, Карта, СБП, Бар и т.д.",
                parameters: { type: "object", properties: {}, additionalProperties: false },
            },
        },
        {
            type: "function",
            function: {
                name: "revenue_summary",
                description: "Свод выручки по сменам: нал/безнал, расходы, прибыль, количество смен.",
                parameters: {
                    type: "object",
                    properties: { range_preset: { type: "string", enum: rangeEnum } },
                    required: ["range_preset"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: "revenue_by_day",
                description: "Выручка по дням за период.",
                parameters: {
                    type: "object",
                    properties: { range_preset: { type: "string", enum: rangeEnum } },
                    required: ["range_preset"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: "revenue_metric",
                description:
                    "Сумма выручки по одному каналу дохода (metric_key) за период. Период можно задать range_preset или конкретным month/year.",
                parameters: {
                    type: "object",
                    properties: {
                        metric_key: { type: "string" },
                        range_preset: { type: "string", enum: rangeEnum },
                        month: { type: "integer", minimum: 1, maximum: 12 },
                        year: { type: "integer", minimum: 2000, maximum: 2100 },
                    },
                    required: ["metric_key"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: "payroll_accrued",
                description: "Начисления по зарплате по сменам за период, с топом сотрудников. adminsOnly=true только если пользователь явно просил про админов.",
                parameters: {
                    type: "object",
                    properties: {
                        range_preset: { type: "string", enum: rangeEnum },
                        adminsOnly: { type: "boolean" },
                    },
                    required: ["range_preset"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function",
            function: {
                name: "compare_revenue",
                description: "Сравнение выручки периода с предыдущим периодом такой же длины (предыдущая неделя/предыдущие 7 дней и т.д.).",
                parameters: {
                    type: "object",
                    properties: { range_preset: { type: "string", enum: rangeEnum } },
                    required: ["range_preset"],
                    additionalProperties: false,
                },
            },
        },
    ]
}

function formatMonthLabel(month: number, year: number) {
    const names = [
        "январь",
        "февраль",
        "март",
        "апрель",
        "май",
        "июнь",
        "июль",
        "август",
        "сентябрь",
        "октябрь",
        "ноябрь",
        "декабрь",
    ]
    const idx = Math.max(1, Math.min(12, month)) - 1
    return `${names[idx]} ${year}`
}

export async function executeAssistantTool(clubId: string, tool: AssistantToolCall, now: Date) {
    if (tool.name === "income_metrics") {
        const { metrics } = await getClubIncomeMetrics(clubId)
        return { metrics }
    }

    if (tool.name === "revenue_summary") {
        const range = resolveAssistantRangePreset(tool.arguments.range_preset, now, "revenue")
        const startIso = range.start.toISOString()
        const endIso = range.end.toISOString()

        const { metrics: incomeMetrics } = await getClubIncomeMetrics(clubId)
        const shiftsRes = await query(
            `
            SELECT cash_income, card_income, expenses, report_data
            FROM shifts
            WHERE club_id = $1
              AND check_in >= $2
              AND check_in < $3
              AND status NOT IN ('ACTIVE', 'CANCELLED')
            `,
            [clubId, startIso, endIso]
        )

        let expensesTotal = 0
        const totalsByKey = new Map<string, { key: string; label: string; amount: number }>()
        shiftsRes.rows.forEach((s: any) => {
            const income = getShiftIncomeBreakdown(s, incomeMetrics)
            expensesTotal += getShiftExpenses(s)
            income.items.forEach((it) => {
                const prev = totalsByKey.get(it.key)
                if (prev) prev.amount += it.amount
                else totalsByKey.set(it.key, { key: it.key, label: it.label, amount: it.amount })
            })
        })

        const revenueItems = Array.from(totalsByKey.values())
        const revenueTotal = revenueItems.reduce((acc, it) => acc + it.amount, 0)

        return {
            range: { label: range.label, start: startIso, end: endIso },
            revenue_total: revenueTotal,
            revenue_items: revenueItems,
            expenses_total: expensesTotal,
            profit_total: revenueTotal - expensesTotal,
            shifts_count: Number(shiftsRes.rowCount || 0),
        }
    }

    if (tool.name === "revenue_by_day") {
        const range = resolveAssistantRangePreset(tool.arguments.range_preset, now, "revenue")
        const startIso = range.start.toISOString()
        const endIso = range.end.toISOString()

        const { metrics: incomeMetrics } = await getClubIncomeMetrics(clubId)
        const shiftsRes = await query(
            `
            SELECT DATE(check_in) as day, cash_income, card_income, report_data
            FROM shifts
            WHERE club_id = $1
              AND check_in >= $2
              AND check_in < $3
              AND status NOT IN ('ACTIVE', 'CANCELLED')
            ORDER BY check_in ASC
            `,
            [clubId, startIso, endIso]
        )

        const byDayMap = new Map<string, { day: string; revenue_total: number }>()
        shiftsRes.rows.forEach((s: any) => {
            const income = getShiftIncomeBreakdown(s, incomeMetrics)
            const day = String(s.day)
            const prev = byDayMap.get(day)
            if (prev) prev.revenue_total += income.total
            else byDayMap.set(day, { day, revenue_total: income.total })
        })

        return {
            range: { label: range.label, start: startIso, end: endIso },
            days: Array.from(byDayMap.values()),
        }
    }

    if (tool.name === "revenue_metric") {
        const { metrics } = await getClubIncomeMetrics(clubId)
        const metricKey = String(tool.arguments.metric_key || "").trim()
        const metric = metrics.find((m) => m.key === metricKey) || null
        if (!metric) return { error: "Unknown metric_key" }

        const month = typeof tool.arguments.month === "number" ? tool.arguments.month : null
        const year = typeof tool.arguments.year === "number" ? tool.arguments.year : null
        const preset = tool.arguments.range_preset || "this_month"

        let start: Date
        let end: Date
        let label: string

        if (month && year) {
            start = new Date(year, month - 1, 1, 0, 0, 0, 0)
            end = new Date(year, month, 1, 0, 0, 0, 0)
            label = formatMonthLabel(month, year)
        } else {
            const range = resolveAssistantRangePreset(preset, now, "revenue")
            start = range.start
            end = range.end
            label = range.label
        }

        const shiftsRes = await query(
            `
            SELECT cash_income, card_income, report_data
            FROM shifts
            WHERE club_id = $1
              AND check_in >= $2
              AND check_in < $3
              AND status NOT IN ('ACTIVE', 'CANCELLED')
            `,
            [clubId, start.toISOString(), end.toISOString()]
        )

        const total = shiftsRes.rows.reduce((acc: number, s: any) => acc + getShiftIncomeValue(s, metricKey), 0)

        return {
            range: { label, start: start.toISOString(), end: end.toISOString() },
            metric: { key: metric.key, label: metric.label },
            amount: total,
            shifts_count: Number(shiftsRes.rowCount || 0),
        }
    }

    if (tool.name === "payroll_accrued") {
        const intent: AssistantIntent = "payroll"
        const range = resolveAssistantRangePreset(tool.arguments.range_preset, now, intent)
        const startIso = range.start.toISOString()
        const endIso = range.end.toISOString()

        const adminsOnly = Boolean(tool.arguments.adminsOnly)

        const perEmployeeRes = await query(
            `
            SELECT
                s.user_id,
                u.full_name,
                COALESCE(SUM(COALESCE(s.calculated_salary, 0)), 0) as accrued_total,
                COUNT(*)::int as shifts_count
            FROM shifts s
            JOIN users u ON u.id = s.user_id
            WHERE s.club_id = $1
              AND s.check_in >= $2
              AND s.check_in < $3
              AND s.status IN ('CLOSED', 'PAID', 'VERIFIED', 'ACTIVE')
            GROUP BY s.user_id, u.full_name
            ORDER BY accrued_total DESC
            `,
            [clubId, startIso, endIso]
        )

        const employees = perEmployeeRes.rows
            .map((r: any) => ({
                user_id: r.user_id,
                full_name: r.full_name,
                accrued_total: Number(r.accrued_total || 0),
                shifts_count: Number(r.shifts_count || 0),
            }))
            .filter((e: any) => (adminsOnly ? e.accrued_total > 0 : true))

        const accruedTotal = employees.reduce((acc: number, e: any) => acc + e.accrued_total, 0)
        const shiftsCount = employees.reduce((acc: number, e: any) => acc + e.shifts_count, 0)

        return {
            range: { label: range.label, start: startIso, end: endIso },
            adminsOnly,
            accrued_total: accruedTotal,
            shifts_count: shiftsCount,
            employees_count: employees.length,
            top_employees: employees.slice(0, 10),
        }
    }

    if (tool.name === "compare_revenue") {
        const range = resolveAssistantRangePreset(tool.arguments.range_preset, now, "revenue")
        const durationMs = range.end.getTime() - range.start.getTime()
        const prevEnd = new Date(range.start.getTime())
        const prevStart = new Date(prevEnd.getTime() - durationMs)

        const current = await executeAssistantTool(
            clubId,
            { name: "revenue_summary", arguments: { range_preset: tool.arguments.range_preset } },
            now
        )
        const { metrics: incomeMetrics } = await getClubIncomeMetrics(clubId)
        const prevShiftsRes = await query(
            `
            SELECT cash_income, card_income, report_data
            FROM shifts
            WHERE club_id = $1
              AND check_in >= $2
              AND check_in < $3
              AND status NOT IN ('ACTIVE', 'CANCELLED')
            `,
            [clubId, prevStart.toISOString(), prevEnd.toISOString()]
        )
        const prevTotal = prevShiftsRes.rows.reduce((acc: number, s: any) => acc + getShiftIncomeBreakdown(s, incomeMetrics).total, 0)
        const currentTotal = Number((current as any).revenue_total || 0)
        const diff = currentTotal - prevTotal
        const pct = prevTotal > 0 ? (diff / prevTotal) * 100 : null

        return {
            current: { ...current, label: range.label },
            previous: { start: prevStart.toISOString(), end: prevEnd.toISOString(), revenue_total: prevTotal },
            diff,
            pct,
        }
    }

    return null
}
