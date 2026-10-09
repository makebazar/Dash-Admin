import { NextResponse } from 'next/server'
import { query } from '@/db'
import { cookies } from 'next/headers'
import { verifySessionValue } from '@/lib/session'
import {
    getReportMetricMeta,
    calculateShiftIncomeTotal,
    buildRevenueBreakdown,
    calculateShiftBarSales,
    calculateShiftReceiptsCount,
    getShiftRevenueRows,
} from '@/app/clubs/[clubId]/_queries/shiftStats'
import { normalizeMetricValue } from '@/app/clubs/[clubId]/_formatters'

// ─── Date helpers ──────────────────────────────────────────────────────────────

function getDateRangeForPeriod(params: { period?: string; month?: number; year?: number; startDate?: string; endDate?: string }) {
    const now = new Date()
    const targetYear = params.year || now.getFullYear()
    let startDate = new Date()
    let endDate = new Date()

    if (params.startDate && params.endDate) {
        startDate = new Date(params.startDate)
        endDate = new Date(params.endDate)
        endDate.setHours(23, 59, 59, 999)
    } else if (params.month && params.month >= 1 && params.month <= 12) {
        startDate = new Date(targetYear, params.month - 1, 1, 0, 0, 0, 0)
        endDate = new Date(targetYear, params.month, 0, 23, 59, 59, 999)
    } else {
        const period = params.period || 'this_week'
        if (period === 'today') {
            startDate.setHours(0, 0, 0, 0)
            endDate.setHours(23, 59, 59, 999)
        } else if (period === 'yesterday') {
            startDate.setDate(now.getDate() - 1)
            startDate.setHours(0, 0, 0, 0)
            endDate.setDate(now.getDate() - 1)
            endDate.setHours(23, 59, 59, 999)
        } else if (period === 'this_week') {
            const day = now.getDay() || 7
            startDate.setDate(now.getDate() - day + 1)
            startDate.setHours(0, 0, 0, 0)
            endDate.setHours(23, 59, 59, 999)
        } else if (period === 'last_week') {
            const day = now.getDay() || 7
            startDate.setDate(now.getDate() - day - 6)
            startDate.setHours(0, 0, 0, 0)
            endDate.setDate(now.getDate() - day)
            endDate.setHours(23, 59, 59, 999)
        } else if (period === 'this_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            endDate.setHours(23, 59, 59, 999)
        } else if (period === 'last_month') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
        } else {
            startDate.setDate(now.getDate() - 7)
        }
    }

    return { startDate, endDate }
}

function toDateStr(d: Date): string { return d.toISOString().split('T')[0] }

// ─── Tool implementations ──────────────────────────────────────────────────────

type PeriodParams = { period?: string; month?: number; year?: number; startDate?: string; endDate?: string }

async function fetchShiftRows(clubId: number, params: PeriodParams) {
    const { startDate, endDate } = getDateRangeForPeriod(params)
    const clubIdStr = String(clubId)
    const endPlusOne = new Date(endDate)
    endPlusOne.setDate(endPlusOne.getDate() + 1)

    const [rows, metricMeta] = await Promise.all([
        getShiftRevenueRows(clubIdStr, startDate.toISOString(), endPlusOne.toISOString()),
        getReportMetricMeta(clubIdStr),
    ])
    return { rows, metricMeta, startDate, endDate }
}

function processExpenses(row: any): number {
    let exp = normalizeMetricValue(row.expenses)
    const rd = typeof row.report_data === 'string' ? JSON.parse(row.report_data || '{}') : (row.report_data || {})
    if (rd.expenses_cash) exp += normalizeMetricValue(rd.expenses_cash)
    return exp
}

// Tool 1: Aggregate financial summary for a period
async function toolGetFinancialReport(clubId: number, params: PeriodParams) {
    const { rows, metricMeta, startDate, endDate } = await fetchShiftRows(clubId, params)

    let totalRevenue = 0, totalExpenses = 0, totalBarSales = 0, totalReceipts = 0
    rows.forEach(row => {
        totalRevenue += calculateShiftIncomeTotal(row, metricMeta)
        totalBarSales += calculateShiftBarSales(row, metricMeta)
        totalReceipts += calculateShiftReceiptsCount(row)
        totalExpenses += processExpenses(row)
    })

    const revenueBreakdown = buildRevenueBreakdown(rows, metricMeta)
    const shiftsCount = rows.length
    const avgShiftRev = shiftsCount > 0 ? Math.round(totalRevenue / shiftsCount) : 0

    return {
        startDate: toDateStr(startDate),
        endDate: toDateStr(endDate),
        totalRevenue: Math.round(totalRevenue),
        netRevenue: Math.round(totalRevenue - totalExpenses),
        revenueBreakdown: revenueBreakdown.map(b => ({ source: b.label, amount: Math.round(b.amount) })),
        barSales: Math.round(totalBarSales),
        totalExpenses: Math.round(totalExpenses),
        shiftsCount,
        avgShiftRevenue: avgShiftRev,
        totalReceipts,
    }
}

// Tool 2: Day-by-day breakdown
async function toolGetDailyBreakdown(clubId: number, params: PeriodParams) {
    const { rows, metricMeta, startDate, endDate } = await fetchShiftRows(clubId, params)

    const byDate = new Map<string, { revenue: number; expenses: number; shifts: number; bar: number }>()
    rows.forEach(row => {
        const dateKey = row.period_at ? toDateStr(new Date(row.period_at)) : 'unknown'
        const entry = byDate.get(dateKey) || { revenue: 0, expenses: 0, shifts: 0, bar: 0 }
        entry.revenue += calculateShiftIncomeTotal(row, metricMeta)
        entry.expenses += processExpenses(row)
        entry.bar += calculateShiftBarSales(row, metricMeta)
        entry.shifts += 1
        byDate.set(dateKey, entry)
    })

    const days = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({
            date,
            weekday: new Date(date).toLocaleDateString('ru-RU', { weekday: 'short' }),
            revenue: Math.round(d.revenue),
            expenses: Math.round(d.expenses),
            bar: Math.round(d.bar),
            shiftsCount: d.shifts,
        }))

    const revenues = days.map(d => d.revenue)
    return {
        startDate: toDateStr(startDate),
        endDate: toDateStr(endDate),
        totalDays: days.length,
        days,
        best: days.length > 0 ? { date: days[revenues.indexOf(Math.max(...revenues))].date, revenue: Math.max(...revenues) } : null,
        worst: days.length > 0 ? { date: days[revenues.indexOf(Math.min(...revenues))].date, revenue: Math.min(...revenues) } : null,
    }
}

// Tool 3: Per-shift details with employee names
async function toolGetShiftDetails(clubId: number, params: PeriodParams) {
    const { startDate, endDate } = getDateRangeForPeriod(params)
    const endPlusOne = new Date(endDate)
    endPlusOne.setDate(endPlusOne.getDate() + 1)
    const clubIdStr = String(clubId)

    const [metricMeta, shiftsRes] = await Promise.all([
        getReportMetricMeta(clubIdStr),
        query(
            `SELECT s.id, s.check_in, s.check_out, s.total_hours, s.shift_type, s.status,
                    s.cash_income, s.card_income, s.expenses, s.report_data,
                    s.calculated_salary, s.actor_role_name_snapshot,
                    u.full_name as employee_name
             FROM shifts s
             JOIN users u ON s.user_id = u.id
             WHERE s.club_id = $1 AND s.status NOT IN ('ACTIVE', 'CANCELLED')
               AND s.check_in >= $2 AND s.check_in < $3
             ORDER BY s.check_in DESC
             LIMIT 50`,
            [clubId, startDate.toISOString(), endPlusOne.toISOString()]
        ),
    ])

    const shifts = shiftsRes.rows.map((s: any) => {
        const revenue = calculateShiftIncomeTotal(s, metricMeta)
        const bar = calculateShiftBarSales(s, metricMeta)
        const expenses = processExpenses(s)
        return {
            date: s.check_in ? toDateStr(new Date(s.check_in)) : null,
            checkIn: s.check_in ? new Date(s.check_in).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null,
            checkOut: s.check_out ? new Date(s.check_out).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null,
            hours: s.total_hours ? parseFloat(s.total_hours) : null,
            employee: s.employee_name,
            role: s.actor_role_name_snapshot || null,
            shiftType: s.shift_type === 'NIGHT' ? 'Ночная' : 'Дневная',
            revenue: Math.round(revenue),
            bar: Math.round(bar),
            expenses: Math.round(expenses),
            salary: s.calculated_salary ? Math.round(parseFloat(s.calculated_salary)) : null,
        }
    })

    return {
        startDate: toDateStr(startDate),
        endDate: toDateStr(endDate),
        totalShifts: shifts.length,
        shifts,
    }
}

// Tool 4: Compare two periods
async function toolComparePeriods(clubId: number, period1: PeriodParams, period2: PeriodParams) {
    const [data1, data2] = await Promise.all([
        toolGetFinancialReport(clubId, period1),
        toolGetFinancialReport(clubId, period2),
    ])

    const revDiff = data1.totalRevenue - data2.totalRevenue
    const revPercent = data2.totalRevenue > 0 ? Math.round((revDiff / data2.totalRevenue) * 100) : null

    return {
        current: { ...data1, periodLabel: `${data1.startDate} — ${data1.endDate}` },
        previous: { ...data2, periodLabel: `${data2.startDate} — ${data2.endDate}` },
        difference: {
            revenue: revDiff,
            revenuePercent: revPercent,
            expenses: data1.totalExpenses - data2.totalExpenses,
            shifts: data1.shiftsCount - data2.shiftsCount,
            avgShiftRevenue: data1.avgShiftRevenue - data2.avgShiftRevenue,
        },
    }
}

// Tool 5: Month-by-month historical trend
async function toolGetMonthlyHistory(clubId: number, monthsBack: number = 6) {
    const now = new Date()
    const months: Array<{ month: number; year: number; monthName: string; revenue: number; expenses: number; shifts: number; avgShiftRevenue: number; bar: number; changePercent: number | null }> = []

    // Fetch each month sequentially from oldest to newest
    for (let i = monthsBack - 1; i >= 0; i--) {
        const target = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const m = target.getMonth() + 1
        const y = target.getFullYear()
        const data = await toolGetFinancialReport(clubId, { period: 'custom_month', month: m, year: y })
        months.push({
            month: m,
            year: y,
            monthName: target.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
            revenue: data.totalRevenue,
            expenses: data.totalExpenses,
            shifts: data.shiftsCount,
            avgShiftRevenue: data.avgShiftRevenue,
            bar: data.barSales,
            changePercent: null, // filled below
        })
    }

    // Calculate month-over-month change %
    for (let i = 1; i < months.length; i++) {
        const prev = months[i - 1].revenue
        if (prev > 0) {
            months[i].changePercent = Math.round(((months[i].revenue - prev) / prev) * 100)
        }
    }

    const revenues = months.map(m => m.revenue)
    const bestIdx = revenues.indexOf(Math.max(...revenues))
    const worstIdx = revenues.indexOf(Math.min(...revenues.filter(r => r > 0)))
    const dips = months.filter(m => m.changePercent !== null && m.changePercent < 0)

    return {
        monthsAnalyzed: months.length,
        months,
        bestMonth: months[bestIdx] ? { name: months[bestIdx].monthName, revenue: months[bestIdx].revenue } : null,
        worstMonth: months[worstIdx] ? { name: months[worstIdx].monthName, revenue: months[worstIdx].revenue } : null,
        dips: dips.map(d => ({ name: d.monthName, changePercent: d.changePercent, revenue: d.revenue })),
        totalRevenue: revenues.reduce((a, b) => a + b, 0),
        avgMonthlyRevenue: months.length > 0 ? Math.round(revenues.reduce((a, b) => a + b, 0) / months.length) : 0,
    }
}

// ─── Gemini tool declarations ──────────────────────────────────────────────────

const agentTools = [
    {
        functionDeclarations: [
            {
                name: 'get_financial_report',
                description: 'Агрегированный финансовый отчет: общая выручка, разбивка по источникам оплаты, расходы, бар, средняя выручка за смену. Используй для ответов типа "сколько заработали", "какая выручка", "расходы за месяц".',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        period: {
                            type: 'STRING',
                            enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom_month', 'custom_range'],
                            description: 'Предустановленный период.'
                        },
                        month: { type: 'INTEGER', description: 'Месяц 1-12 для custom_month.' },
                        year: { type: 'INTEGER', description: 'Год (по умолчанию текущий).' },
                        startDate: { type: 'STRING', description: 'YYYY-MM-DD для custom_range.' },
                        endDate: { type: 'STRING', description: 'YYYY-MM-DD для custom_range.' },
                    }
                }
            },
            {
                name: 'get_daily_breakdown',
                description: 'Разбивка выручки по дням за период. Показывает каждый день отдельно: выручка, расходы, бар, количество смен. Также определяет лучший и худший день. Используй для "покажи по дням", "какой день был лучшим", "динамика выручки".',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        period: {
                            type: 'STRING',
                            enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom_month', 'custom_range'],
                            description: 'Предустановленный период.'
                        },
                        month: { type: 'INTEGER', description: 'Месяц 1-12 для custom_month.' },
                        year: { type: 'INTEGER', description: 'Год.' },
                        startDate: { type: 'STRING', description: 'YYYY-MM-DD.' },
                        endDate: { type: 'STRING', description: 'YYYY-MM-DD.' },
                    }
                }
            },
            {
                name: 'get_shift_details',
                description: 'Детали каждой смены: кто работал, время, выручка за смену, расходы, зарплата, роль. Используй для "кто работал вчера", "покажи смены", "сколько заработал сотрудник", "какая смена была лучшей".',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        period: {
                            type: 'STRING',
                            enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom_month', 'custom_range'],
                            description: 'Предустановленный период.'
                        },
                        month: { type: 'INTEGER', description: 'Месяц 1-12.' },
                        year: { type: 'INTEGER', description: 'Год.' },
                        startDate: { type: 'STRING', description: 'YYYY-MM-DD.' },
                        endDate: { type: 'STRING', description: 'YYYY-MM-DD.' },
                    }
                }
            },
            {
                name: 'compare_periods',
                description: 'Сравнение двух периодов: показывает разницу в выручке, расходах, количестве смен, средней выручке. Считает процент изменения. Используй для "сравни с прошлым месяцем", "лучше или хуже чем на прошлой неделе", "динамика роста".',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        currentPeriod: {
                            type: 'STRING',
                            enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom_month', 'custom_range'],
                            description: 'Текущий (основной) период для сравнения.'
                        },
                        currentMonth: { type: 'INTEGER', description: 'Месяц текущего периода 1-12.' },
                        currentYear: { type: 'INTEGER', description: 'Год текущего периода.' },
                        currentStartDate: { type: 'STRING', description: 'YYYY-MM-DD.' },
                        currentEndDate: { type: 'STRING', description: 'YYYY-MM-DD.' },
                        previousPeriod: {
                            type: 'STRING',
                            enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom_month', 'custom_range'],
                            description: 'Предыдущий (для сравнения) период.'
                        },
                        previousMonth: { type: 'INTEGER', description: 'Месяц предыдущего периода 1-12.' },
                        previousYear: { type: 'INTEGER', description: 'Год предыдущего периода.' },
                        previousStartDate: { type: 'STRING', description: 'YYYY-MM-DD.' },
                        previousEndDate: { type: 'STRING', description: 'YYYY-MM-DD.' },
                    }
                }
            },
            {
                name: 'get_monthly_history',
                description: 'История выручки по месяцам за последние N месяцев. Показывает каждый месяц: выручка, расходы, бар, смены, процент изменения от предыдущего месяца. Определяет лучший/худший месяц и все просадки. Используй для "покажи историю по месяцам", "где у нас просадка", "динамика за полгода", "тренд выручки", "каждый месяц".',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        monthsBack: {
                            type: 'INTEGER',
                            description: 'Сколько месяцев назад смотреть (по умолчанию 6, максимум 12).'
                        },
                    }
                }
            },
            {
                name: 'save_club_memory',
                description: 'Сохраняет факт или правило в вечную память клуба. Используй только когда пользователь просит что-то запомнить.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        memoryText: { type: 'STRING', description: 'Текст для сохранения.' }
                    },
                    required: ['memoryText']
                }
            }
        ]
    }
]

// ─── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(toolName: string, args: any, clubId: number): Promise<{ output: any; memoryAdded?: boolean }> {
    const parsePeriodArgs = (a: any): PeriodParams => ({
        period: a.period,
        month: a.month ? parseInt(a.month, 10) : undefined,
        year: a.year ? parseInt(a.year, 10) : undefined,
        startDate: a.startDate,
        endDate: a.endDate,
    })

    switch (toolName) {
        case 'get_financial_report':
            return { output: await toolGetFinancialReport(clubId, parsePeriodArgs(args)) }

        case 'get_daily_breakdown':
            return { output: await toolGetDailyBreakdown(clubId, parsePeriodArgs(args)) }

        case 'get_shift_details':
            return { output: await toolGetShiftDetails(clubId, parsePeriodArgs(args)) }

        case 'compare_periods': {
            const current: PeriodParams = {
                period: args.currentPeriod,
                month: args.currentMonth ? parseInt(args.currentMonth, 10) : undefined,
                year: args.currentYear ? parseInt(args.currentYear, 10) : undefined,
                startDate: args.currentStartDate,
                endDate: args.currentEndDate,
            }
            const previous: PeriodParams = {
                period: args.previousPeriod,
                month: args.previousMonth ? parseInt(args.previousMonth, 10) : undefined,
                year: args.previousYear ? parseInt(args.previousYear, 10) : undefined,
                startDate: args.previousStartDate,
                endDate: args.previousEndDate,
            }
            return { output: await toolComparePeriods(clubId, current, previous) }
        }

        case 'get_monthly_history': {
            const mb = Math.min(Math.max(args.monthsBack ? parseInt(args.monthsBack, 10) : 6, 2), 12)
            return { output: await toolGetMonthlyHistory(clubId, mb) }
        }

        case 'save_club_memory': {
            const memText = args.memoryText
            if (memText) {
                await query(
                    `INSERT INTO ai_club_memories (club_id, category, memory_value) VALUES ($1, 'general', $2)`,
                    [clubId, memText]
                )
                return { output: { success: true, savedText: memText }, memoryAdded: true }
            }
            return { output: { success: false, error: 'Empty text' } }
        }

        default:
            return { output: { error: `Unknown tool: ${toolName}` } }
    }
}

// ─── Route handlers ────────────────────────────────────────────────────────────

export async function GET(
    req: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params
        const numericClubId = parseInt(clubId, 10)
        const signedCookie = (await cookies()).get('session_user_id')?.value
        const userId = signedCookie ? verifySessionValue(signedCookie) : null

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const [messagesRes, memoriesRes] = await Promise.all([
            query(
                `SELECT role, content, created_at FROM ai_chat_messages WHERE club_id = $1 ORDER BY created_at ASC LIMIT 100`,
                [numericClubId]
            ),
            query(
                `SELECT id, category, memory_key, memory_value, created_at FROM ai_club_memories WHERE club_id = $1 ORDER BY created_at DESC`,
                [numericClubId]
            )
        ])

        return NextResponse.json({
            messages: messagesRes.rows,
            memories: memoriesRes.rows
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params
        const numericClubId = parseInt(clubId, 10)
        const url = new URL(req.url)
        const memoryId = url.searchParams.get('memoryId')

        if (memoryId) {
            await query(`DELETE FROM ai_club_memories WHERE id = $1 AND club_id = $2`, [memoryId, numericClubId])
            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Missing memoryId' }, { status: 400 })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params
        const numericClubId = parseInt(clubId, 10)
        const signedCookie = (await cookies()).get('session_user_id')?.value
        const userId = signedCookie ? verifySessionValue(signedCookie) : null

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const userMessage = (body.message || '').trim()

        if (!userMessage) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }

        // 1. Save user message
        await query(
            `INSERT INTO ai_chat_messages (club_id, user_id, role, content) VALUES ($1, $2, 'user', $3)`,
            [numericClubId, userId, userMessage]
        )

        // 2. Client-side memory extraction (before AI, so "Запомни:" always works)
        const memoryMatch = userMessage.match(/запомни[:\s]+(.+)/i)
        let newlyAddedMemory: string | null = null
        let memoryAdded = false
        if (memoryMatch && memoryMatch[1]) {
            const memoryVal = memoryMatch[1].trim()
            await query(
                `INSERT INTO ai_club_memories (club_id, category, memory_value) VALUES ($1, 'general', $2)`,
                [numericClubId, memoryVal]
            )
            newlyAddedMemory = memoryVal
            memoryAdded = true
        }

        // 3. Load context: memories + conversation history
        const [memoriesRes, historyRes, clubRes] = await Promise.all([
            query(`SELECT memory_value FROM ai_club_memories WHERE club_id = $1 ORDER BY created_at DESC`, [numericClubId]),
            query(`SELECT role, content FROM ai_chat_messages WHERE club_id = $1 ORDER BY created_at DESC LIMIT 20`, [numericClubId]),
            query(`SELECT name, timezone FROM clubs WHERE id = $1`, [numericClubId]),
        ])
        const memoryList = memoriesRes.rows.map(r => `• ${r.memory_value}`).join('\n')
        const recentMessages = historyRes.rows.reverse().slice(0, -1) // exclude just-inserted user msg
        const clubName = clubRes.rows[0]?.name || 'Клуб'
        const clubTimezone = clubRes.rows[0]?.timezone || 'Europe/Moscow'

        const apiKey = process.env.GEMINI_API_KEY
        let assistantReply = ''

        if (apiKey) {
            try {
                const now = new Date()
                const todayStr = now.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: clubTimezone })

                const systemInstruction = {
                    parts: [{
                        text: `Ты — AI-Управляющий компьютерного клуба «${clubName}» в системе DashAdmin.

СЕГОДНЯ: ${todayStr}. Часовой пояс клуба: ${clubTimezone}.

ТВОЯ РОЛЬ:
Ты — опытный управляющий, который идеально знает финансы клуба. Ты можешь:
— Давать точные цифры по выручке, расходам, барным продажам за любой период
— Показывать детали каждой смены: кто работал, сколько выручил, зарплата
— Показывать разбивку по дням: лучший/худший день, динамика
— Сравнивать периоды: этот месяц vs прошлый, эта неделя vs прошлая
— Запоминать правила и факты о клубе

ДОСТУПНЫЕ ИНСТРУМЕНТЫ:
1. get_financial_report — общая сводка: выручка, разбивка по оплатам, расходы, бар, среднее за смену
2. get_daily_breakdown — выручка по каждому дню отдельно, лучший/худший день
3. get_shift_details — кто работал, время, выручка каждой смены, зарплата сотрудника
4. compare_periods — сравнение двух периодов с процентом изменений
5. get_monthly_history — история по месяцам: выручка каждого месяца, просадки, тренд, лучший/худший месяц
6. save_club_memory — сохранить факт в вечную память

ПРАВИЛА:
1. НИКОГДА не выдумывай цифры. Всегда вызывай инструмент.
2. НЕ используй эмодзи.
3. Каждый источник дохода — ОТДЕЛЬНАЯ строка. Данные revenueBreakdown выводи как есть, не группируй.
4. При уточняющих вопросах («а вчера?», «а расходы?», «а по дням?») используй контекст разговора.
5. Всегда указывай период (даты) в ответе.
6. Данные только по ЗАКРЫТЫМ сменам.
7. Если спрашивают «сравни» — используй compare_periods, а не два отдельных вызова.
8. Если спрашивают «кто работал» или «покажи смены» — используй get_shift_details.
9. Если спрашивают «по дням» или «лучший день» — используй get_daily_breakdown.
10. Если спрашивают «что помнишь / какие правила» — ответь из ВЕЧНОЙ ПАМЯТИ, не вызывай инструменты.
11. Форматируй суммы с разделителем тысяч (123 456 руб.), без копеек.
12. Ты можешь вести обычный разговор, давать советы по управлению. Не всё про цифры.
13. Если спрашивают про историю по месяцам, просадки, динамику, тренд, «каждый месяц на сколько» — используй get_monthly_history. В ответе dips показывает все месяцы где была просадка относительно предыдущего.

ВЕЧНАЯ ПАМЯТЬ КЛУБА:
${memoryList || '(Пока пусто. Пользователь может сказать «Запомни: ...»)'}`
                    }]
                }

                // List of models to try in order of preference (helps bypass model-specific rate limits)
                const CANDIDATE_MODELS = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-2.0-flash']
                let activeModelName = CANDIDATE_MODELS[0]
                let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${activeModelName}:generateContent?key=${apiKey}`

                // Build conversation with history
                const contents: any[] = []
                for (const msg of recentMessages) {
                    contents.push({
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: msg.content }]
                    })
                }
                contents.push({ role: 'user', parts: [{ text: userMessage }] })

                // Agentic loop — up to 5 rounds of tool calls
                const MAX_ROUNDS = 5
                for (let round = 0; round < MAX_ROUNDS; round++) {
                    let geminiRes = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ systemInstruction, tools: agentTools, contents }),
                    })

                    // Fallback to alternative candidate models if rate-limited or unavailable
                    if (!geminiRes.ok && (geminiRes.status === 429 || geminiRes.status === 404)) {
                        for (const altModel of CANDIDATE_MODELS) {
                            if (altModel === activeModelName) continue
                            const altEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${altModel}:generateContent?key=${apiKey}`
                            const altRes = await fetch(altEndpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ systemInstruction, tools: agentTools, contents }),
                            })
                            if (altRes.ok) {
                                geminiRes = altRes
                                endpoint = altEndpoint
                                activeModelName = altModel
                                break
                            }
                        }
                    }

                    if (!geminiRes.ok) {
                        const errBody = await geminiRes.text()
                        console.error(`Gemini API Error (round ${round}, model ${activeModelName}):`, geminiRes.status, errBody)
                        if (geminiRes.status === 429) {
                            assistantReply = 'Превышен лимит запросов к AI. Бесплатная квота Gemini API исчерпана. Подождите минуту и попробуйте снова, или подключите платный тариф в Google AI Studio.'
                        }
                        break
                    }

                    const responseData = await geminiRes.json()
                    const candidate = responseData.candidates?.[0]
                    if (!candidate?.content) break

                    contents.push(candidate.content)

                    const functionCalls = candidate.content.parts?.filter((p: any) => p.functionCall) || []

                    if (functionCalls.length === 0) {
                        assistantReply = candidate.content.parts?.find((p: any) => p.text)?.text || ''
                        break
                    }

                    // Execute all tool calls in parallel
                    const toolResults = await Promise.all(
                        functionCalls.map(async (callObj: any) => {
                            const call = callObj.functionCall
                            const result = await executeTool(call.name, call.args || {}, numericClubId)
                            if (result.memoryAdded) memoryAdded = true
                            return {
                                functionResponse: {
                                    name: call.name,
                                    response: { output: result.output },
                                }
                            }
                        })
                    )

                    contents.push({ role: 'user', parts: toolResults })
                }
            } catch (err) {
                console.error('Agent Execution Error:', err)
            }
        }

        if (newlyAddedMemory && !assistantReply) {
            assistantReply = `Запомнил. Добавил в вечную память клуба: «${newlyAddedMemory}».`
        }

        if (!assistantReply) {
            assistantReply = 'Не удалось получить ответ от AI. Попробуйте повторить вопрос.'
        }

        // Save assistant response
        await query(
            `INSERT INTO ai_chat_messages (club_id, user_id, role, content) VALUES ($1, $2, 'assistant', $3)`,
            [numericClubId, userId, assistantReply]
        )

        return NextResponse.json({ reply: assistantReply, memoryAdded })
    } catch (err: any) {
        console.error(err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
