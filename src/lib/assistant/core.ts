import { query } from "@/db"
import { parseAssistantQuery, type AssistantRange } from "@/lib/assistant/parse"
import { parseAssistantQueryWithOpenRouter } from "@/lib/assistant/openrouter"

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

    const totalRes = await query(
        `
        SELECT
            COALESCE(SUM(COALESCE(cash_income, 0) + COALESCE(card_income, 0)), 0) as revenue_total,
            COALESCE(SUM(COALESCE(cash_income, 0)), 0) as revenue_cash,
            COALESCE(SUM(COALESCE(card_income, 0)), 0) as revenue_card,
            COALESCE(SUM(COALESCE(expenses, 0)), 0) as expenses_total,
            COUNT(*)::int as shifts_count
        FROM shifts
        WHERE club_id = $1
          AND check_in >= $2
          AND check_in < $3
          AND status NOT IN ('ACTIVE', 'CANCELLED')
        `,
        [clubId, startIso, endIso]
    )

    const byDayRes = await query(
        `
        SELECT
            DATE(check_in) as day,
            COALESCE(SUM(COALESCE(cash_income, 0) + COALESCE(card_income, 0)), 0) as revenue
        FROM shifts
        WHERE club_id = $1
          AND check_in >= $2
          AND check_in < $3
          AND status NOT IN ('ACTIVE', 'CANCELLED')
        GROUP BY 1
        ORDER BY 1
        `,
        [clubId, startIso, endIso]
    )

    const row = totalRes.rows[0] || {}
    const revenueTotal = Number(row.revenue_total || 0)
    const expensesTotal = Number(row.expenses_total || 0)

    return {
        revenue: {
            total: revenueTotal,
            cash: Number(row.revenue_cash || 0),
            card: Number(row.revenue_card || 0),
        },
        expenses: {
            total: expensesTotal,
        },
        profit: {
            total: revenueTotal - expensesTotal,
        },
        shifts_count: Number(row.shifts_count || 0),
        by_day: byDayRes.rows.map((r: any) => ({
            day: r.day,
            revenue: Number(r.revenue || 0),
        })),
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
        return {
            ok: true,
            intent: "revenue",
            range: { start: parsed.range.start.toISOString(), end: parsed.range.end.toISOString(), label: parsed.range.label },
            data,
            message: `Выручка за ${parsed.range.label}: ${formatRub(data.revenue.total)} ₽ (нал ${formatRub(data.revenue.cash)} / безнал ${formatRub(
                data.revenue.card
            )}), смен: ${data.shifts_count}`,
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

