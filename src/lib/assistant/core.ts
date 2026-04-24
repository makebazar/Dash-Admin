import { query } from "@/db"
import { parseAssistantQuery, type AssistantRange } from "@/lib/assistant/parse"
import { parseAssistantQueryWithOpenRouter } from "@/lib/assistant/openrouter"
import { getClubIncomeMetrics, getShiftExpenses, getShiftIncomeBreakdown } from "@/lib/assistant/income-metrics"

export type AssistantResponse =
    | {
          ok: true
          intent: "revenue" | "payroll"
          range: { start: string; end: string; label: string }
          data: any
          message: string
      }
    | { ok: false; error: string; question?: string }

function formatRub(value: number) {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)
}

async function getRevenue(clubId: string, range: AssistantRange) {
    const startIso = range.start.toISOString()
    const endIso = range.end.toISOString()

    const { metrics: incomeMetrics } = await getClubIncomeMetrics(clubId)
    const shiftsRes = await query(
        `
        SELECT
            DATE(check_in) as day,
            cash_income,
            card_income,
            expenses,
            report_data
        FROM shifts
        WHERE club_id = $1
          AND check_in >= $2
          AND check_in < $3
          AND status NOT IN ('ACTIVE', 'CANCELLED')
        ORDER BY check_in ASC
        `,
        [clubId, startIso, endIso]
    )

    let expensesTotal = 0

    const byDayMap = new Map<string, { day: string; revenue: number }>()
    const totalsByKey = new Map<string, { key: string; label: string; amount: number }>()
    shiftsRes.rows.forEach((s: any) => {
        const income = getShiftIncomeBreakdown(s, incomeMetrics)
        expensesTotal += getShiftExpenses(s)

        const day = String(s.day)
        const prev = byDayMap.get(day)
        if (prev) prev.revenue += income.total
        else byDayMap.set(day, { day, revenue: income.total })

        income.items.forEach((it) => {
            const prevIt = totalsByKey.get(it.key)
            if (prevIt) prevIt.amount += it.amount
            else totalsByKey.set(it.key, { key: it.key, label: it.label, amount: it.amount })
        })
    })

    const revenueItems = Array.from(totalsByKey.values())
    const revenueTotal = revenueItems.reduce((acc, it) => acc + it.amount, 0)

    return {
        revenue: {
            total: revenueTotal,
            items: revenueItems,
        },
        expenses: {
            total: expensesTotal,
        },
        profit: {
            total: revenueTotal - expensesTotal,
        },
        shifts_count: Number(shiftsRes.rowCount || 0),
        by_day: Array.from(byDayMap.values()),
    }
}

async function getPayroll(clubId: string, range: AssistantRange, adminsOnly: boolean) {
    const startIso = range.start.toISOString()
    const endIso = range.end.toISOString()

    const totalsRes = await query(
        `
        SELECT
            COALESCE(SUM(COALESCE(calculated_salary, 0)), 0) as accrued_total,
            COUNT(*)::int as shifts_count
        FROM shifts
        WHERE club_id = $1
          AND check_in >= $2
          AND check_in < $3
          AND status IN ('CLOSED', 'PAID', 'VERIFIED', 'ACTIVE')
        `,
        [clubId, startIso, endIso]
    )

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

    const row = totalsRes.rows[0] || {}
    const accruedTotal = Number(row.accrued_total || 0)
    const shiftsCount = Number(row.shifts_count || 0)
    const filteredAccruedTotal = employees.reduce((acc: number, e: any) => acc + e.accrued_total, 0)
    const filteredShiftsCount = employees.reduce((acc: number, e: any) => acc + e.shifts_count, 0)

    return {
        accrued_total: adminsOnly ? filteredAccruedTotal : accruedTotal,
        shifts_count: adminsOnly ? filteredShiftsCount : shiftsCount,
        employees: employees.slice(0, 20),
        employees_count: employees.length,
    }
}

export async function runAssistantQuery(clubId: string, text: string, now: Date = new Date()): Promise<AssistantResponse> {
    const cleaned = String(text || "").trim()
    if (!cleaned) return { ok: false, error: "Пустой запрос" }

    const llmEnabled = Boolean(process.env.OPENROUTER_API_KEY)
    const parsed = llmEnabled ? await parseAssistantQueryWithOpenRouter(cleaned, now) : parseAssistantQuery(cleaned, now)

    if (!parsed.ok) return parsed

    if (parsed.intent === "revenue") {
        const data = await getRevenue(clubId, parsed.range)
        const items = Array.isArray((data as any).revenue?.items) ? (data as any).revenue.items : []
        const parts = items
            .filter((i: any) => Number(i?.amount || 0) > 0)
            .sort((a: any, b: any) => {
                const ak = String(a?.key || "")
                const bk = String(b?.key || "")
                if (ak === "cash_income") return -1
                if (bk === "cash_income") return 1
                if (ak === "card_income") return -1
                if (bk === "card_income") return 1
                return Number(b?.amount || 0) - Number(a?.amount || 0)
            })
            .map((i: any) => `${String(i?.label || i?.key)} ${formatRub(Number(i?.amount || 0))}`)

        const breakdown = parts.length ? ` (${parts.join(" / ")})` : ""
        return {
            ok: true,
            intent: "revenue",
            range: { start: parsed.range.start.toISOString(), end: parsed.range.end.toISOString(), label: parsed.range.label },
            data,
            message: `Выручка за ${parsed.range.label}: ${formatRub(data.revenue.total)} ₽${breakdown}, смен: ${data.shifts_count}`,
        }
    }

    const data = await getPayroll(clubId, parsed.range, parsed.adminsOnly)
    const scopeLabel = parsed.adminsOnly ? " (админы)" : ""
    return {
        ok: true,
        intent: "payroll",
        range: { start: parsed.range.start.toISOString(), end: parsed.range.end.toISOString(), label: parsed.range.label },
        data,
        message: `Начислено по зарплате${scopeLabel} за ${parsed.range.label}: ${formatRub(data.accrued_total)} ₽, сотрудников: ${
            data.employees_count
        }, смен: ${data.shifts_count}`,
    }
}
