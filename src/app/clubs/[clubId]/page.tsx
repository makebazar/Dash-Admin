import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
    Briefcase,
    ChevronRight,
    HardDrive,
    LayoutDashboard,
    Wrench,
} from "lucide-react"
import { query } from "@/db"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader, PageShell } from "@/components/layout/PageShell"
import { getClubTasks, getSalesAnalytics } from "./inventory/actions"
import { getClubEmployeeLeaderboardState } from "@/lib/employee-leaderboard"

export const dynamic = "force-dynamic"

type PermissionMap = Record<string, boolean>

type DashboardAccess = {
    clubName: string
    isFullAccess: boolean
    permissions: PermissionMap
    roleName: string | null
}

type ShiftStats = {
    revenueTotal: number
    previousRevenueTotal: number
    currentRevenueParts: Array<{ key: string; label: string; amount: number }>
    previousRevenueParts: Array<{ key: string; label: string; amount: number }>
    revenueChange: number
    expensesTotal: number
    expensesChange: number
    operatingResult: number
    operatingChange: number
}

type RevenuePoint = {
    date: string
    revenue: number
}

type MetricMeta = Record<string, { category: string; label: string }>

type RevenueInsightsSnapshot = {
    insights: Array<{
        title: string
        value: string
        description: string
        tone: "default" | "success" | "warning"
    }>
    weekdayAverages: Array<{
        weekday: number
        label: string
        shortLabel: string
        avgRevenue: number
        isWeekend: boolean
    }>
}

type FinanceSnapshot = {
    cashBalance: number
    topExpenses: Array<{
        categoryName: string
        totalAmount: number
        transactionCount: number
    }>
}

type PayrollEmployeeBalance = {
    userId: string
    fullName: string
    accrued: number
    paid: number
    balance: number
}

type PayrollSnapshot = {
    unpaidTotal: number
    topDebts: PayrollEmployeeBalance[]
}

type ActiveShift = {
    id: string
    userName: string
    role: string
    shiftType: "DAY" | "NIGHT" | string
    checkIn: string
    totalHours: number
}

type NextScheduledShift = {
    userName: string
    shiftType: "DAY" | "NIGHT" | string
    date: string
} | null

type RequestItem = {
    id: string
    title: string
    category: string
    priority: string
    status: string
    createdAt: string
    userName: string
}

type RequestsSnapshot = {
    openCount: number
    items: RequestItem[]
}

type EvaluationItem = {
    id: string
    templateName: string
    employeeName: string
    evaluatorName: string | null
    evaluationDate: string
}

type EvaluationsSnapshot = {
    pendingCount: number
    items: EvaluationItem[]
}

type EquipmentIssue = {
    id: string
    title: string
    severity: string
    status: string
    equipmentName: string
    workstationName: string | null
    createdAt: string
}

type EquipmentSnapshot = {
    total: number
    activeIssues: number
    overdueTasks: number
    dueTodayTasks: number
    expiringWarranty: number
    issues: EquipmentIssue[]
}

type InventoryTask = {
    id: string
    title: string | null
    type: string
    priority: string
    productName: string | null
    assigneeName: string | null
    createdAt: string
}

type InventorySnapshot = {
    openTasksCount: number
    returnAmount: number
    returnCount: number
    discrepancyAmount: number
    tasks: InventoryTask[]
}

type TeamSnapshot = {
    top: Array<{
        userId: string
        fullName: string
        rank: number
        score: number
        revenuePerShift: number
    }>
    bottom: Array<{
        userId: string
        fullName: string
        rank: number
        score: number
        revenuePerShift: number
    }>
    averageEvaluation: number
    offPlanCount: number
}

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
})

const compactCurrencyFormatter = new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
})

function formatCurrency(value: number) {
    const safeValue = Number.isFinite(value) ? value : 0
    return `${currencyFormatter.format(Math.round(safeValue))} ₽`
}

function formatCompactCurrency(value: number) {
    const safeValue = Number.isFinite(value) ? value : 0
    return `${compactCurrencyFormatter.format(safeValue)} ₽`
}

function formatSignedPercent(value: number) {
    const safeValue = Number.isFinite(value) ? value : 0
    const sign = safeValue > 0 ? "+" : ""
    return `${sign}${safeValue.toFixed(1)}%`
}

function formatDate(value: string | Date) {
    if (value instanceof Date) {
        return value.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "short",
        })
    }

    if (typeof value === "string" && value.includes("-")) {
        const [year, month, day] = value.split("-").map(Number)
        return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "short",
        })
    }

    return new Date(value).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short",
    })
}

function getDateObject(value: string | Date) {
    if (value instanceof Date) return value

    if (typeof value === "string" && value.includes("-")) {
        const [year, month, day] = value.split("-").map(Number)
        return new Date(year, (month || 1) - 1, day || 1)
    }

    return new Date(value)
}

function formatWeekdayShort(value: string | Date) {
    return getDateObject(value).toLocaleDateString("ru-RU", {
        weekday: "short",
    })
}

function isWeekendDate(value: string | Date) {
    const day = getDateObject(value).getDay()
    return day === 0 || day === 6
}

function formatShiftType(value: string) {
    if (value === "DAY") return "Дневная смена"
    if (value === "NIGHT") return "Ночная смена"
    return value
}

function formatWeekdayFull(weekday: number) {
    return ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"][weekday] || "День"
}

function formatWeekdayShortByIndex(weekday: number) {
    return ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][weekday] || "дн"
}

function normalizeMetricValue(value: unknown): number {
    if (Array.isArray(value)) {
        return value.reduce((sum, item) => sum + normalizeMetricValue(item), 0)
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0
    }

    if (typeof value === "string") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }

    if (value && typeof value === "object") {
        if ("value" in value) {
            return normalizeMetricValue((value as { value?: unknown }).value)
        }
        return 0
    }

    return 0
}

function formatDateKeyInTimezone(value: Date | string, timeZone: string) {
    const date = value instanceof Date ? value : new Date(value)
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date)

    const year = parts.find(part => part.type === "year")?.value || "0000"
    const month = parts.find(part => part.type === "month")?.value || "01"
    const day = parts.find(part => part.type === "day")?.value || "01"

    return `${year}-${month}-${day}`
}

async function getClubTimezone(clubId: string) {
    const result = await query(
        `SELECT COALESCE(timezone, 'Europe/Moscow') as timezone
         FROM clubs
         WHERE id = $1`,
        [clubId]
    )

    return result.rows[0]?.timezone || "Europe/Moscow"
}

async function getReportMetricMeta(clubId: string): Promise<MetricMeta> {
    const templateRes = await query(
        `SELECT schema
         FROM club_report_templates
         WHERE club_id = $1
           AND is_active = TRUE
         ORDER BY created_at DESC
         LIMIT 1`,
        [clubId]
    )

    const templateSchema = templateRes.rows[0]?.schema
    const fields = Array.isArray(templateSchema) ? templateSchema : (templateSchema?.fields || [])
    const metricMeta: MetricMeta = {
        cash_income: { category: "INCOME", label: "Наличные" },
        card_income: { category: "INCOME", label: "Безналичные" },
        expenses: { category: "EXPENSE", label: "Расходы" },
        expenses_cash: { category: "EXPENSE", label: "Расходы наличными" },
    }

    fields.forEach((field: any) => {
        const key = field.metric_key || field.key
        if (!key) return

        const previous = metricMeta[key]
        metricMeta[key] = {
            category: field.field_type || field.calculation_category || previous?.category || "OTHER",
            label: field.custom_label || field.employee_label || field.label || field.name || previous?.label || key,
        }
    })

    return metricMeta
}

function calculateShiftIncomeTotal(
    shift: {
        cash_income?: number | string | null
        card_income?: number | string | null
        report_data?: unknown
    },
    metricMeta: MetricMeta
) {
    let total = 0
    const cash = normalizeMetricValue(shift.cash_income)
    const card = normalizeMetricValue(shift.card_income)

    if (metricMeta["cash_income"]?.category === "INCOME" || !metricMeta["cash_income"]) {
        total += cash
    }
    if (metricMeta["card_income"]?.category === "INCOME" || !metricMeta["card_income"]) {
        total += card
    }

    const reportData = typeof shift.report_data === "string"
        ? JSON.parse(shift.report_data || "{}")
        : shift.report_data

    if (reportData && typeof reportData === "object" && !Array.isArray(reportData)) {
        Object.entries(reportData).forEach(([key, value]) => {
            if (
                metricMeta[key]?.category === "INCOME" &&
                !["cash_income", "card_income", "total_revenue", "revenue_cash", "revenue_card", "cash", "card"].includes(key)
            ) {
                total += normalizeMetricValue(value)
            }
        })
    }

    return total
}

function buildRevenueBreakdown(
    rows: any[],
    metricMeta: MetricMeta
): Array<{ key: string; label: string; amount: number }> {
    const totals = new Map<string, { label: string; amount: number }>()

    const add = (key: string, amount: number) => {
        if (!Number.isFinite(amount) || amount === 0) return
        const label = metricMeta[key]?.label || key
        const current = totals.get(key) || { label, amount: 0 }
        current.amount += amount
        totals.set(key, current)
    }

    rows.forEach((row: any) => {
        if (metricMeta["cash_income"]?.category === "INCOME" || !metricMeta["cash_income"]) {
            add("cash_income", normalizeMetricValue(row.cash_income))
        }
        if (metricMeta["card_income"]?.category === "INCOME" || !metricMeta["card_income"]) {
            add("card_income", normalizeMetricValue(row.card_income))
        }

        const reportData = typeof row.report_data === "string"
            ? JSON.parse(row.report_data || "{}")
            : row.report_data

        if (reportData && typeof reportData === "object" && !Array.isArray(reportData)) {
            Object.entries(reportData).forEach(([key, value]) => {
                if (
                    metricMeta[key]?.category === "INCOME" &&
                    !["cash_income", "card_income", "total_revenue", "revenue_cash", "revenue_card", "cash", "card"].includes(key)
                ) {
                    add(key, normalizeMetricValue(value))
                }
            })
        }
    })

    return Array.from(totals.entries())
        .map(([key, value]) => ({ key, label: value.label, amount: value.amount }))
        .sort((a, b) => b.amount - a.amount)
}

async function getShiftRevenueRows(
    clubId: string,
    startDate: string,
    endDate: string
) {
    const result = await query(
        `SELECT
            s.id,
            s.cash_income,
            s.card_income,
            s.expenses,
            s.report_data,
            COALESCE(s.shift_type, 'DAY') as shift_type,
            s.check_in as period_at
         FROM shifts s
         LEFT JOIN shift_reports sr ON s.shift_report_id = sr.id
         WHERE COALESCE(s.club_id, sr.club_id) = $1
           AND s.status NOT IN ('ACTIVE', 'CANCELLED')
           AND s.check_in >= $2::timestamp
           AND s.check_in < $3::timestamp`,
        [clubId, startDate, endDate]
    )

    return result.rows
}

function hasPermission(access: DashboardAccess, key: string) {
    return access.isFullAccess || access.permissions[key] === true
}

async function getDashboardAccess(clubId: string, userId: string): Promise<DashboardAccess> {
    const clubRes = await query(
        `SELECT id, name, owner_id
         FROM clubs
         WHERE id = $1`,
        [clubId]
    )

    if ((clubRes.rowCount || 0) === 0) {
        redirect("/dashboard")
    }

    const club = clubRes.rows[0]

    if (String(club.owner_id) === String(userId)) {
        return {
            clubName: club.name,
            isFullAccess: true,
            permissions: {},
            roleName: "Владелец",
        }
    }

    const userRoleRes = await query(
        `SELECT ce.role as club_role, u.role_id, r.name as role_name
         FROM club_employees ce
         LEFT JOIN users u ON u.id = ce.user_id
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE ce.club_id = $1
           AND ce.user_id = $2
           AND ce.is_active = TRUE
           AND ce.dismissed_at IS NULL`,
        [clubId, userId]
    )

    if ((userRoleRes.rowCount || 0) === 0) {
        redirect("/dashboard")
    }

    const { role_id, role_name, club_role } = userRoleRes.rows[0]

    if (
        club_role === "Владелец" ||
        club_role === "Админ" ||
        role_name === "Админ" ||
        club_role === "Управляющий" ||
        role_name === "Управляющий"
    ) {
        return {
            clubName: club.name,
            isFullAccess: true,
            permissions: {},
            roleName: club_role || role_name || null,
        }
    }

    if (!role_id) {
        return {
            clubName: club.name,
            isFullAccess: false,
            permissions: {},
            roleName: club_role || role_name || null,
        }
    }

    const permissionsRes = await query(
        `SELECT permission_key, is_allowed
         FROM role_permissions
         WHERE club_id = $1
           AND role_id = $2`,
        [clubId, role_id]
    )

    const permissions: PermissionMap = {}
    permissionsRes.rows.forEach((row: any) => {
        permissions[row.permission_key] = row.is_allowed
    })

    return {
        clubName: club.name,
        isFullAccess: false,
        permissions,
        roleName: club_role || role_name || null,
    }
}

async function getShiftStats(clubId: string): Promise<ShiftStats> {
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const metricMeta = await getReportMetricMeta(clubId)

    const [currentRows, previousRows] = await Promise.all([
        getShiftRevenueRows(clubId, currentMonthStart, nextMonthStart),
        getShiftRevenueRows(clubId, previousMonthStart, currentMonthStart),
    ])

    const revenueTotal = currentRows.reduce(
        (sum: number, row: any) => sum + calculateShiftIncomeTotal(row, metricMeta),
        0
    )
    const expensesTotal = currentRows.reduce((sum: number, row: any) => sum + normalizeMetricValue(row.expenses), 0)
    const previousRevenue = previousRows.reduce(
        (sum: number, row: any) => sum + calculateShiftIncomeTotal(row, metricMeta),
        0
    )
    const previousExpenses = previousRows.reduce((sum: number, row: any) => sum + normalizeMetricValue(row.expenses), 0)
    const operatingResult = revenueTotal - expensesTotal
    const previousOperatingResult = previousRevenue - previousExpenses

    return {
        revenueTotal,
        previousRevenueTotal: previousRevenue,
        currentRevenueParts: buildRevenueBreakdown(currentRows, metricMeta),
        previousRevenueParts: buildRevenueBreakdown(previousRows, metricMeta),
        revenueChange: previousRevenue > 0 ? ((revenueTotal - previousRevenue) / previousRevenue) * 100 : 0,
        expensesTotal,
        expensesChange: previousExpenses > 0 ? ((expensesTotal - previousExpenses) / previousExpenses) * 100 : 0,
        operatingResult,
        operatingChange: previousOperatingResult > 0
            ? ((operatingResult - previousOperatingResult) / previousOperatingResult) * 100
            : 0,
    }
}

async function getRevenueTrend(clubId: string, days: number): Promise<RevenuePoint[]> {
    const clubTimezone = await getClubTimezone(clubId)
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    startDate.setDate(startDate.getDate() - (days + 1))

    const [metricMeta, rows] = await Promise.all([
        getReportMetricMeta(clubId),
        getShiftRevenueRows(clubId, startDate.toISOString(), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
    ])

    const revenueByDate = new Map<string, number>()
    rows.forEach((row: any) => {
        const key = formatDateKeyInTimezone(row.period_at, clubTimezone)
        const current = revenueByDate.get(key) || 0
        revenueByDate.set(key, current + calculateShiftIncomeTotal(row, metricMeta))
    })

    return Array.from({ length: days }, (_, index) => {
        const date = new Date()
        date.setDate(date.getDate() - (days - 1 - index))
        const key = formatDateKeyInTimezone(date, clubTimezone)
        return {
            date: key,
            revenue: revenueByDate.get(key) || 0,
        }
    })
}

async function getRevenueInsights(clubId: string, lookbackDays: number): Promise<RevenueInsightsSnapshot> {
    const clubTimezone = await getClubTimezone(clubId)
    const metricMeta = await getReportMetricMeta(clubId)
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    startDate.setDate(startDate.getDate() - lookbackDays)

    const rows = await getShiftRevenueRows(
        clubId,
        startDate.toISOString(),
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    )

    const dailyTotals = new Map<string, number>()
    const shiftTypeDailyTotals = new Map<string, number>()

    rows.forEach((row: any) => {
        const dateKey = formatDateKeyInTimezone(row.period_at, clubTimezone)
        const amount = calculateShiftIncomeTotal(row, metricMeta)
        dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + amount)

        const shiftTypeKey = `${dateKey}:${row.shift_type || "DAY"}`
        shiftTypeDailyTotals.set(shiftTypeKey, (shiftTypeDailyTotals.get(shiftTypeKey) || 0) + amount)
    })

    const weekdayStats = new Map<number, { total: number; count: number }>()
    const weekendStats = { total: 0, count: 0 }
    const weekdayOnlyStats = { total: 0, count: 0 }

    Array.from({ length: 7 }, (_, weekday) => {
        weekdayStats.set(weekday, { total: 0, count: 0 })
    })

    const dailyEntries = Array.from(dailyTotals.entries())
        .map(([date, revenue]) => ({
            date,
            revenue,
            weekday: getDateObject(date).getDay(),
            isWeekend: isWeekendDate(date),
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

    dailyEntries.forEach(entry => {
        const current = weekdayStats.get(entry.weekday) || { total: 0, count: 0 }
        current.total += entry.revenue
        current.count += 1
        weekdayStats.set(entry.weekday, current)

        if (entry.isWeekend) {
            weekendStats.total += entry.revenue
            weekendStats.count += 1
        } else {
            weekdayOnlyStats.total += entry.revenue
            weekdayOnlyStats.count += 1
        }
    })

    const weekdayAverages = [1, 2, 3, 4, 5, 6, 0].map(weekday => {
        const stats = weekdayStats.get(weekday) || { total: 0, count: 0 }
        return {
            weekday,
            label: formatWeekdayFull(weekday),
            shortLabel: formatWeekdayShortByIndex(weekday),
            avgRevenue: stats.count > 0 ? stats.total / stats.count : 0,
            isWeekend: weekday === 0 || weekday === 6,
        }
    })

    const weekdaysWithData = weekdayAverages.filter(item => item.avgRevenue > 0)
    const bestWeekday = weekdaysWithData.reduce((best, item) => !best || item.avgRevenue > best.avgRevenue ? item : best, null as typeof weekdaysWithData[number] | null)
    const weakestWeekday = weekdaysWithData.reduce((worst, item) => !worst || item.avgRevenue < worst.avgRevenue ? item : worst, null as typeof weekdaysWithData[number] | null)

    const weekendAvg = weekendStats.count > 0 ? weekendStats.total / weekendStats.count : 0
    const weekdayAvg = weekdayOnlyStats.count > 0 ? weekdayOnlyStats.total / weekdayOnlyStats.count : 0
    const weekendDeltaPercent = weekdayAvg > 0 ? ((weekendAvg - weekdayAvg) / weekdayAvg) * 100 : 0

    const shiftTypeCombos = Array.from(shiftTypeDailyTotals.entries()).reduce((acc, [key, value]) => {
        const [, shiftType] = key.split(":")
        const date = key.slice(0, 10)
        const weekday = getDateObject(date).getDay()
        const comboKey = `${shiftType}:${weekday}`
        const current = acc.get(comboKey) || { shiftType, weekday, total: 0, count: 0 }
        current.total += value
        current.count += 1
        acc.set(comboKey, current)
        return acc
    }, new Map<string, { shiftType: string; weekday: number; total: number; count: number }>())

    const bestShiftCombo = Array.from(shiftTypeCombos.values())
        .filter(item => item.count >= 2)
        .map(item => ({
            ...item,
            avgRevenue: item.total / item.count,
        }))
        .sort((a, b) => b.avgRevenue - a.avgRevenue)[0] || null

    const latestEntry = dailyEntries[dailyEntries.length - 1] || null
    const latestWeekdayBaseline = latestEntry
        ? weekdayAverages.find(item => item.weekday === latestEntry.weekday)?.avgRevenue || 0
        : 0
    const latestVsTypical = latestEntry && latestWeekdayBaseline > 0
        ? ((latestEntry.revenue - latestWeekdayBaseline) / latestWeekdayBaseline) * 100
        : 0

    const insights: RevenueInsightsSnapshot["insights"] = []

    if (bestWeekday) {
        insights.push({
            title: "Сильный день",
            value: bestWeekday.label,
            description: `В среднем ${formatCurrency(bestWeekday.avgRevenue)} за день`,
            tone: "success",
        })
    }

    if (weakestWeekday) {
        insights.push({
            title: "Слабый день",
            value: weakestWeekday.label,
            description: `Чаще всего просадка именно здесь: ${formatCurrency(weakestWeekday.avgRevenue)}`,
            tone: "warning",
        })
    }

    if (weekendAvg > 0 || weekdayAvg > 0) {
        insights.push({
            title: "Выходные vs будни",
            value: formatSignedPercent(weekendDeltaPercent),
            description: weekendDeltaPercent >= 0
                ? `Выходные сильнее будней. В среднем ${formatCurrency(weekendAvg)} против ${formatCurrency(weekdayAvg)}`
                : `Будни сильнее выходных. В среднем ${formatCurrency(weekdayAvg)} против ${formatCurrency(weekendAvg)}`,
            tone: weekendDeltaPercent >= 0 ? "success" : "warning",
        })
    }

    if (bestShiftCombo) {
        insights.push({
            title: "Сильная комбинация",
            value: `${formatShiftType(bestShiftCombo.shiftType)} · ${formatWeekdayFull(bestShiftCombo.weekday)}`,
            description: `В среднем ${formatCurrency(bestShiftCombo.avgRevenue)} за такую смену`,
            tone: "default",
        })
    } else if (latestEntry) {
        insights.push({
            title: "Последний день",
            value: formatWeekdayFull(latestEntry.weekday),
            description: latestVsTypical >= 0
                ? `Последний такой день был выше обычного на ${formatSignedPercent(latestVsTypical)}`
                : `Последний такой день был ниже обычного на ${formatSignedPercent(latestVsTypical)}`,
            tone: latestVsTypical >= 0 ? "success" : "warning",
        })
    }

    return {
        insights,
        weekdayAverages,
    }
}

async function getFinanceSnapshot(clubId: string): Promise<FinanceSnapshot> {
    const accountsResult = await query(
        `SELECT COALESCE(SUM(current_balance), 0) as cash_balance
         FROM finance_accounts
         WHERE club_id = $1
           AND is_active = TRUE`,
        [clubId]
    )

    const expensesResult = await query(
        `SELECT
            fc.name as category_name,
            COALESCE(SUM(ft.amount), 0) as total_amount,
            COUNT(ft.id) as transaction_count
         FROM finance_transactions ft
         JOIN finance_categories fc ON ft.category_id = fc.id
         WHERE ft.club_id = $1
           AND ft.type = 'expense'
           AND ft.status = 'completed'
           AND ft.transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
           AND ft.transaction_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
         GROUP BY fc.id, fc.name
         ORDER BY total_amount DESC
         LIMIT 5`,
        [clubId]
    )

    return {
        cashBalance: Number(accountsResult.rows[0]?.cash_balance || 0),
        topExpenses: expensesResult.rows.map((row: any) => ({
            categoryName: row.category_name,
            totalAmount: Number(row.total_amount || 0),
            transactionCount: Number(row.transaction_count || 0),
        })),
    }
}

async function getPayrollSnapshot(clubId: string, month: number, year: number): Promise<PayrollSnapshot> {
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 1)

    const result = await query(
        `WITH accruals AS (
            SELECT
                s.user_id,
                COALESCE(SUM(COALESCE(s.calculated_salary, 0)), 0) as accrued
            FROM shifts s
            WHERE s.club_id = $1
              AND s.check_in >= $2
              AND s.check_in < $3
              AND s.status IN ('CLOSED', 'PAID', 'VERIFIED', 'ACTIVE')
            GROUP BY s.user_id
         ),
         payments_summary AS (
            SELECT
                p.user_id,
                COALESCE(SUM(p.amount), 0) as paid
            FROM payments p
            WHERE p.club_id = $1
              AND p.month = $4
              AND p.year = $5
            GROUP BY p.user_id
         )
         SELECT
            u.id as user_id,
            u.full_name,
            COALESCE(a.accrued, 0) as accrued,
            COALESCE(ps.paid, 0) as paid,
            GREATEST(COALESCE(a.accrued, 0) - COALESCE(ps.paid, 0), 0) as balance
         FROM club_employees ce
         JOIN users u ON u.id = ce.user_id
         LEFT JOIN accruals a ON a.user_id = u.id
         LEFT JOIN payments_summary ps ON ps.user_id = u.id
         WHERE ce.club_id = $1
           AND ce.is_active = TRUE
           AND ce.dismissed_at IS NULL
         ORDER BY balance DESC, accrued DESC, u.full_name ASC`,
        [clubId, monthStart.toISOString(), monthEnd.toISOString(), month, year]
    )

    const employees = result.rows.map((row: any) => ({
        userId: String(row.user_id),
        fullName: row.full_name,
        accrued: Number(row.accrued || 0),
        paid: Number(row.paid || 0),
        balance: Number(row.balance || 0),
    }))

    return {
        unpaidTotal: employees.reduce((sum, item) => sum + item.balance, 0),
        topDebts: employees.filter(item => item.balance > 0).slice(0, 5),
    }
}

async function getActiveShiftsSnapshot(clubId: string): Promise<ActiveShift[]> {
    const result = await query(
        `SELECT
            s.id,
            s.check_in,
            s.total_hours,
            COALESCE(s.shift_type, 'DAY') as shift_type,
            u.full_name as user_name,
            COALESCE(r.name, 'Сотрудник') as role_name
         FROM shifts s
         JOIN users u ON s.user_id = u.id
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE s.club_id = $1
           AND s.status = 'ACTIVE'
         ORDER BY s.check_in DESC`,
        [clubId]
    )

    return result.rows.map((row: any) => ({
        id: String(row.id),
        userName: row.user_name,
        role: row.role_name,
        shiftType: row.shift_type || "DAY",
        checkIn: row.check_in,
        totalHours: Number(row.total_hours || 0),
    }))
}

async function getNextScheduledShift(clubId: string): Promise<NextScheduledShift> {
    const clubTimezone = await getClubTimezone(clubId)
    const todayKey = formatDateKeyInTimezone(new Date(), clubTimezone)

    const result = await query(
        `WITH active_today AS (
            SELECT
                s.user_id,
                COALESCE(s.shift_type, 'DAY') as shift_type
            FROM shifts s
            WHERE s.club_id = $1
              AND s.status = 'ACTIVE'
              AND DATE(((s.check_in AT TIME ZONE 'UTC') AT TIME ZONE $2)) = $3::date
         )
         SELECT
            ws.date,
            ws.shift_type,
            u.full_name as user_name
         FROM work_schedules ws
         JOIN users u ON u.id = ws.user_id
         LEFT JOIN active_today a
           ON a.user_id = ws.user_id
          AND a.shift_type = ws.shift_type
         WHERE ws.club_id = $1
           AND ws.date >= $3::date
           AND a.user_id IS NULL
         ORDER BY
            ws.date ASC,
            CASE ws.shift_type WHEN 'DAY' THEN 1 WHEN 'NIGHT' THEN 2 ELSE 3 END ASC
         LIMIT 1`,
        [clubId, clubTimezone, todayKey]
    )

    const row = result.rows[0]
    if (!row) return null

    return {
        userName: row.user_name,
        shiftType: row.shift_type || "DAY",
        date: row.date instanceof Date ? row.date.toISOString().split("T")[0] : String(row.date),
    }
}

async function getRequestsSnapshot(clubId: string): Promise<RequestsSnapshot> {
    const countResult = await query(
        `SELECT COUNT(*) as open_count
         FROM employee_requests
         WHERE club_id = $1
           AND is_archived = FALSE
           AND status IN ('PENDING', 'IN_PROGRESS')`,
        [clubId]
    )

    const itemsResult = await query(
        `SELECT
            r.id,
            r.title,
            r.category,
            r.priority,
            r.status,
            r.created_at,
            u.full_name as user_name
         FROM employee_requests r
         JOIN users u ON u.id = r.user_id
         WHERE r.club_id = $1
           AND r.is_archived = FALSE
           AND r.status IN ('PENDING', 'IN_PROGRESS')
         ORDER BY
            CASE r.priority
                WHEN 'URGENT' THEN 1
                WHEN 'HIGH' THEN 2
                WHEN 'MEDIUM' THEN 3
                ELSE 4
            END,
            r.created_at DESC
         LIMIT 5`,
        [clubId]
    )

    return {
        openCount: Number(countResult.rows[0]?.open_count || 0),
        items: itemsResult.rows.map((row: any) => ({
            id: String(row.id),
            title: row.title,
            category: row.category,
            priority: row.priority,
            status: row.status,
            createdAt: row.created_at,
            userName: row.user_name,
        })),
    }
}

async function getEvaluationsSnapshot(clubId: string): Promise<EvaluationsSnapshot> {
    const countResult = await query(
        `SELECT COUNT(*) as pending_count
         FROM evaluations
         WHERE club_id = $1
           AND (status = 'pending' OR status IS NULL)`,
        [clubId]
    )

    const itemsResult = await query(
        `SELECT
            e.id,
            e.evaluation_date,
            t.name as template_name,
            u.full_name as employee_name,
            ev.full_name as evaluator_name
         FROM evaluations e
         JOIN evaluation_templates t ON e.template_id = t.id
         JOIN users u ON e.employee_id = u.id
         LEFT JOIN users ev ON e.evaluator_id = ev.id
         WHERE e.club_id = $1
           AND (e.status = 'pending' OR e.status IS NULL)
         ORDER BY e.evaluation_date DESC
         LIMIT 5`,
        [clubId]
    )

    return {
        pendingCount: Number(countResult.rows[0]?.pending_count || 0),
        items: itemsResult.rows.map((row: any) => ({
            id: String(row.id),
            templateName: row.template_name,
            employeeName: row.employee_name,
            evaluatorName: row.evaluator_name || null,
            evaluationDate: row.evaluation_date,
        })),
    }
}

async function getEquipmentSnapshot(clubId: string): Promise<EquipmentSnapshot> {
    const statsResult = await query(
        `SELECT
            (SELECT COUNT(*) FROM equipment WHERE club_id = $1) as total_count,
            (SELECT COUNT(*) FROM equipment_issues i JOIN equipment e ON i.equipment_id = e.id WHERE e.club_id = $1 AND i.status IN ('OPEN', 'IN_PROGRESS')) as active_issues,
            (SELECT COUNT(*) FROM equipment_maintenance_tasks t JOIN equipment e ON t.equipment_id = e.id WHERE e.club_id = $1 AND t.due_date < CURRENT_DATE AND t.status != 'COMPLETED') as overdue_tasks,
            (SELECT COUNT(*) FROM equipment_maintenance_tasks t JOIN equipment e ON t.equipment_id = e.id WHERE e.club_id = $1 AND t.due_date = CURRENT_DATE AND t.status != 'COMPLETED') as due_today_tasks,
            (SELECT COUNT(*) FROM equipment WHERE club_id = $1 AND warranty_expires >= CURRENT_DATE AND warranty_expires < CURRENT_DATE + INTERVAL '30 days') as expiring_warranty`,
        [clubId]
    )

    const issuesResult = await query(
        `SELECT
            i.id,
            i.title,
            i.severity,
            i.status,
            i.created_at,
            e.name as equipment_name,
            w.name as workstation_name
         FROM equipment_issues i
         JOIN equipment e ON i.equipment_id = e.id
         LEFT JOIN club_workstations w ON e.workstation_id = w.id
         WHERE e.club_id = $1
           AND i.status IN ('OPEN', 'IN_PROGRESS')
         ORDER BY
            CASE i.severity
                WHEN 'CRITICAL' THEN 1
                WHEN 'HIGH' THEN 2
                WHEN 'MEDIUM' THEN 3
                ELSE 4
            END,
            i.created_at DESC
         LIMIT 5`,
        [clubId]
    )

    const stats = statsResult.rows[0] || {}

    return {
        total: Number(stats.total_count || 0),
        activeIssues: Number(stats.active_issues || 0),
        overdueTasks: Number(stats.overdue_tasks || 0),
        dueTodayTasks: Number(stats.due_today_tasks || 0),
        expiringWarranty: Number(stats.expiring_warranty || 0),
        issues: issuesResult.rows.map((row: any) => ({
            id: String(row.id),
            title: row.title,
            severity: row.severity,
            status: row.status,
            equipmentName: row.equipment_name,
            workstationName: row.workstation_name || null,
            createdAt: row.created_at,
        })),
    }
}

async function getInventorySnapshot(clubId: string): Promise<InventorySnapshot> {
    const [tasks, sales] = await Promise.all([
        getClubTasks(clubId),
        getSalesAnalytics(clubId, 500),
    ])

    const since = new Date()
    since.setDate(since.getDate() - 30)

    const recentSales = sales.filter((item: any) => new Date(item.created_at) >= since)
    const returnRows = recentSales.filter((item: any) => item.is_return)

    const uniqueShiftDiscrepancies = new Map<string, number>()
    recentSales.forEach((item: any) => {
        const shiftId = item.shift_id_raw ? String(item.shift_id_raw) : null
        if (!shiftId) return
        if (uniqueShiftDiscrepancies.has(shiftId)) return
        uniqueShiftDiscrepancies.set(shiftId, Math.abs(Number(item.shift_revenue_difference || 0)))
    })

    return {
        openTasksCount: tasks.length,
        returnAmount: returnRows.reduce((sum: number, item: any) => sum + Math.abs(Number(item.price_at_time || 0) * Number(item.change_amount || 0)), 0),
        returnCount: returnRows.length,
        discrepancyAmount: Array.from(uniqueShiftDiscrepancies.values()).reduce((sum, value) => sum + value, 0),
        tasks: tasks.slice(0, 5).map((task: any) => ({
            id: String(task.id),
            title: task.title || null,
            type: task.type,
            priority: task.priority,
            productName: task.product_name || null,
            assigneeName: task.assignee_name || null,
            createdAt: task.created_at,
        })),
    }
}

async function getTeamSnapshot(clubId: string, year: number, month: number): Promise<TeamSnapshot> {
    const leaderboardState = await getClubEmployeeLeaderboardState(clubId, year, month)
    const leaderboard = leaderboardState.leaderboard || []
    const withScores = leaderboard.filter(item => Number.isFinite(item.score))
    const sorted = [...withScores].sort((a, b) => b.score - a.score)
    const evaluationEntries = leaderboard.filter(item => Number(item.evaluation_score || 0) > 0)

    return {
        top: sorted.slice(0, 3).map(item => ({
            userId: item.user_id,
            fullName: item.full_name,
            rank: item.rank,
            score: item.score,
            revenuePerShift: item.revenue_per_shift,
        })),
        bottom: sorted.slice(-3).reverse().map(item => ({
            userId: item.user_id,
            fullName: item.full_name,
            rank: item.rank,
            score: item.score,
            revenuePerShift: item.revenue_per_shift,
        })),
        averageEvaluation: evaluationEntries.length > 0
            ? evaluationEntries.reduce((sum, item) => sum + Number(item.evaluation_score || 0), 0) / evaluationEntries.length
            : 0,
        offPlanCount: leaderboard.filter(item => Number(item.planned_shifts || 0) > Number(item.completed_shifts || 0)).length,
    }
}

function SectionTitle({
    title,
    description,
    href,
}: {
    title: string
    description?: string
    href?: string
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {href ? (
                <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Открыть
                    <ChevronRight className="h-4 w-4" />
                </Link>
            ) : null}
        </div>
    )
}

export default async function ClubDashboardPage({
    params,
}: {
    params: Promise<{ clubId: string }>
}) {
    const { clubId } = await params
    const userId = (await cookies()).get("session_user_id")?.value

    if (!userId) {
        redirect("/login")
    }

    const access = await getDashboardAccess(clubId, userId)
    const canViewShifts = hasPermission(access, "view_shifts")
    const [
        shiftStats,
        revenueTrend,
        revenueInsights,
        activeShifts,
        nextScheduledShift,
    ] = await Promise.all([
        getShiftStats(clubId),
        getRevenueTrend(clubId, 30),
        getRevenueInsights(clubId, 84),
        canViewShifts ? getActiveShiftsSnapshot(clubId) : Promise.resolve([]),
        canViewShifts ? getNextScheduledShift(clubId) : Promise.resolve(null),
    ])

    const maxRevenue = Math.max(...revenueTrend.map(item => item.revenue), 1)
    const recentRevenueDays = [...revenueTrend.slice(-7)].reverse()
    const revenueScaleTicks = [1, 0.75, 0.5, 0.25, 0].map(multiplier => Math.round(maxRevenue * multiplier))
    const chartWidth = 920
    const chartHeight = 280
    const chartPaddingTop = 16
    const chartPaddingRight = 72
    const chartPaddingBottom = 36
    const chartPaddingLeft = 8
    const chartPlotWidth = chartWidth - chartPaddingLeft - chartPaddingRight
    const chartPlotHeight = chartHeight - chartPaddingTop - chartPaddingBottom
    const revenueChartPoints = revenueTrend.map((point, index) => {
        const x = revenueTrend.length > 1
            ? chartPaddingLeft + (index / (revenueTrend.length - 1)) * chartPlotWidth
            : chartPaddingLeft
        const y = chartPaddingTop + chartPlotHeight - (point.revenue / maxRevenue) * chartPlotHeight
        return {
            ...point,
            x,
            y,
        }
    })
    const revenueLinePath = revenueChartPoints
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ")
    const revenueAreaPath = revenueChartPoints.length > 0
        ? [
            `M ${revenueChartPoints[0].x} ${chartPaddingTop + chartPlotHeight}`,
            ...revenueChartPoints.map((point, index) => `${index === 0 ? "L" : "L"} ${point.x} ${point.y}`),
            `L ${revenueChartPoints[revenueChartPoints.length - 1].x} ${chartPaddingTop + chartPlotHeight}`,
            "Z",
        ].join(" ")
        : ""
    const latestRevenuePoint = revenueChartPoints[revenueChartPoints.length - 1] || null

    const kpis = [
        {
            key: "revenue",
            visible: true,
            node: (
                <Link href={`/clubs/${clubId}/shifts`} className="block h-full">
                    <Card className="h-full border-slate-200/80 shadow-sm transition-colors hover:border-primary/40">
                        <CardHeader className="space-y-4 pb-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                                    Выручка
                                </span>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                                        shiftStats.revenueChange > 0 && "border-emerald-200 bg-emerald-50 text-emerald-700",
                                        shiftStats.revenueChange < 0 && "border-rose-200 bg-rose-50 text-rose-700",
                                        shiftStats.revenueChange === 0 && "border-slate-200 bg-slate-50 text-slate-600"
                                    )}
                                >
                                    {formatSignedPercent(shiftStats.revenueChange)}
                                </Badge>
                            </div>
                            <div>
                                <CardDescription>Выручка за этот месяц</CardDescription>
                                <CardTitle className="mt-2 text-2xl">{formatCurrency(shiftStats.revenueTotal)}</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Прошлый месяц</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900">
                                    {shiftStats.previousRevenueTotal > 0
                                        ? formatCurrency(shiftStats.previousRevenueTotal)
                                        : "Нет данных"}
                                </p>
                                {shiftStats.previousRevenueParts.length > 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        {shiftStats.previousRevenueParts.map(part => `${part.label} ${formatCurrency(part.amount)}`).join(" · ")}
                                    </p>
                                ) : null}
                            </div>
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Этот месяц</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(shiftStats.revenueTotal)}</p>
                                {shiftStats.currentRevenueParts.length > 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        {shiftStats.currentRevenueParts.map(part => `${part.label} ${formatCurrency(part.amount)}`).join(" · ")}
                                    </p>
                                ) : null}
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Разница</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900">
                                    {formatCurrency(shiftStats.revenueTotal - shiftStats.previousRevenueTotal)}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {shiftStats.revenueChange >= 0 ? "Это больше прошлого месяца на " : "Это меньше прошлого месяца на "}
                                    {Math.abs(shiftStats.revenueChange).toFixed(1)}%
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ),
        },
        {
            key: "live",
            visible: canViewShifts,
            node: (
                <Link href={`/clubs/${clubId}/shifts`} className="block h-full">
                    <Card className="h-full border-slate-200/80 shadow-sm transition-colors hover:border-primary/40">
                        <CardHeader className="space-y-4 pb-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-bold uppercase tracking-wide text-slate-600">
                                    Смены
                                </span>
                            </div>
                            <div>
                                <CardDescription>Сейчас в клубе</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Кто сейчас на смене</p>
                                {activeShifts.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                        {activeShifts.slice(0, 3).map(item => (
                                            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                                                <span className="font-medium text-slate-900">{item.userName}</span>
                                                <span className="text-muted-foreground">{formatShiftType(item.shiftType)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-1 text-sm font-medium text-slate-900">Сейчас активных смен нет</p>
                                )}
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Кто следующий по смене</p>
                                {nextScheduledShift ? (
                                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                                        <span className="font-medium text-slate-900">{nextScheduledShift.userName}</span>
                                        <span className="text-muted-foreground">{formatShiftType(nextScheduledShift.shiftType)}</span>
                                    </div>
                                ) : (
                                    <p className="mt-1 text-sm font-medium text-slate-900">Следующая смена не запланирована</p>
                                )}
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Выручка за 7 дней</p>
                                <div className="mt-2 space-y-2">
                                    {recentRevenueDays.map(item => (
                                        <div
                                            key={item.date}
                                            className={cn(
                                                "flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm",
                                                isWeekendDate(item.date) && "bg-rose-50/80"
                                            )}
                                        >
                                            <span className={cn("text-muted-foreground", isWeekendDate(item.date) && "font-medium text-rose-700")}>
                                                {formatWeekdayShort(item.date)}, {formatDate(item.date)}
                                            </span>
                                            <span className="font-semibold text-slate-900">{formatCurrency(item.revenue)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ),
        },
    ].filter(item => item.visible && item.node)

    return (
        <PageShell maxWidth="7xl">
            <PageHeader
                title={access.clubName}
                description={`Owner dashboard клуба: деньги, риски, команда и live-состояние.${access.roleName ? ` Роль: ${access.roleName}.` : ""}`}
            >
                <Link href={`/clubs/${clubId}/finance`}>
                    <Button variant="outline">Финансы</Button>
                </Link>
                <Link href={`/clubs/${clubId}/shifts`}>
                    <Button variant="outline">Смены</Button>
                </Link>
                <Link href={`/clubs/${clubId}/requests`}>
                    <Button>Фокус на задачи</Button>
                </Link>
            </PageHeader>

            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
                {kpis.map(item => (
                    <div key={item.key} className="h-full">
                        {item.node}
                    </div>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.9fr)]">
                <Card className="border-slate-200/80 shadow-sm">
                    <CardHeader className="space-y-4">
                        <SectionTitle
                            title="Динамика выручки"
                            description="30 последних дней по закрытым сменам"
                            href={`/clubs/${clubId}/shifts`}
                        />
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3 sm:p-4">
                            <svg
                                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                                className="h-[220px] w-full sm:h-[260px] lg:h-[300px]"
                                role="img"
                                aria-label="График выручки за 30 дней"
                            >
                                {revenueScaleTicks.map((tick, index) => {
                                    const y = chartPaddingTop + chartPlotHeight - (tick / maxRevenue) * chartPlotHeight
                                    return (
                                        <g key={`${tick}-${index}`}>
                                            <line
                                                x1={chartPaddingLeft}
                                                x2={chartPaddingLeft + chartPlotWidth}
                                                y1={y}
                                                y2={y}
                                                stroke="#E2E8F0"
                                                strokeDasharray="4 4"
                                            />
                                            <text
                                                x={chartWidth - 4}
                                                y={y + 4}
                                                textAnchor="end"
                                                fontSize="11"
                                                fill="#64748B"
                                            >
                                                {formatCompactCurrency(tick)}
                                            </text>
                                        </g>
                                    )
                                })}

                                {revenueAreaPath ? (
                                    <path
                                        d={revenueAreaPath}
                                        fill="url(#revenueAreaGradient)"
                                        opacity="0.9"
                                    />
                                ) : null}

                                {revenueLinePath ? (
                                    <path
                                        d={revenueLinePath}
                                        fill="none"
                                        stroke="#2563EB"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                ) : null}

                                {revenueChartPoints.map((point, index) => {
                                    const showLabel = index === revenueChartPoints.length - 1 || index % 5 === 0
                                    return (
                                        <g key={point.date}>
                                            <circle
                                                cx={point.x}
                                                cy={point.y}
                                                r={index === revenueChartPoints.length - 1 ? 4.5 : 3}
                                                fill={point.revenue === 0 ? "#CBD5E1" : "#2563EB"}
                                                stroke="#fff"
                                                strokeWidth="2"
                                            />
                                            {showLabel ? (
                                                <text
                                                    x={point.x}
                                                    y={chartHeight - 10}
                                                    textAnchor="middle"
                                                    fontSize="11"
                                                    fill="#64748B"
                                                >
                                                    {formatDate(point.date)}
                                                </text>
                                            ) : null}
                                        </g>
                                    )
                                })}

                                {latestRevenuePoint ? (
                                    <g>
                                        <rect
                                            x={Math.max(latestRevenuePoint.x - 44, chartPaddingLeft)}
                                            y={Math.max(latestRevenuePoint.y - 36, chartPaddingTop)}
                                            width="88"
                                            height="24"
                                            rx="12"
                                            fill="#FFFFFF"
                                            stroke="#BFDBFE"
                                        />
                                        <text
                                            x={latestRevenuePoint.x}
                                            y={Math.max(latestRevenuePoint.y - 20, chartPaddingTop + 16)}
                                            textAnchor="middle"
                                            fontSize="11"
                                            fontWeight="600"
                                            fill="#1E40AF"
                                        >
                                            {formatCompactCurrency(latestRevenuePoint.revenue)}
                                        </text>
                                    </g>
                                ) : null}

                                <defs>
                                    <linearGradient id="revenueAreaGradient" x1="0" x2="0" y1="0" y2="1">
                                        <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.35" />
                                        <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.04" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <div className="mt-6 space-y-5 border-t border-slate-100 pt-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="font-semibold tracking-tight">Что видно по дням</h3>
                                    <p className="text-sm text-muted-foreground">Короткие выводы по последним 12 неделям выручки</p>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                {revenueInsights.insights.map((insight, index) => (
                                    <div
                                        key={`${insight.title}-${index}`}
                                        className={cn(
                                            "rounded-2xl border p-4",
                                            insight.tone === "success" && "border-emerald-200 bg-emerald-50/60",
                                            insight.tone === "warning" && "border-amber-200 bg-amber-50/60",
                                            insight.tone === "default" && "border-slate-200 bg-slate-50/70"
                                        )}
                                    >
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{insight.title}</p>
                                        <p className="mt-2 text-base font-semibold text-slate-900">{insight.value}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{insight.description}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Средняя выручка по дням недели</p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                                    {revenueInsights.weekdayAverages.map(item => (
                                        <div
                                            key={item.weekday}
                                            className={cn(
                                                "rounded-xl border bg-white px-3 py-2",
                                                item.isWeekend && "border-rose-200 bg-rose-50/70"
                                            )}
                                        >
                                            <p className={cn("text-[11px] font-semibold uppercase tracking-wide text-slate-500", item.isWeekend && "text-rose-700")}>
                                                {item.shortLabel}
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900">{formatCompactCurrency(item.avgRevenue)}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

            </div>

            <div className="grid gap-4 lg:grid-cols-4">
                <Link href={`/clubs/${clubId}/finance`}>
                    <Card className="h-full border-slate-200/80 shadow-sm transition-colors hover:border-primary/40">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                                <Briefcase className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-medium">Финансы</p>
                                <p className="text-sm text-muted-foreground">ДДС, счета и статьи расходов</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                <Link href={`/clubs/${clubId}/inventory`}>
                    <Card className="h-full border-slate-200/80 shadow-sm transition-colors hover:border-primary/40">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700">
                                <HardDrive className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-medium">Склад</p>
                                <p className="text-sm text-muted-foreground">Продажи, пополнение и инвентаризация</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                <Link href={`/clubs/${clubId}/equipment`}>
                    <Card className="h-full border-slate-200/80 shadow-sm transition-colors hover:border-primary/40">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
                                <Wrench className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-medium">Оборудование</p>
                                <p className="text-sm text-muted-foreground">Инциденты, обслуживание и регламент</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                <Link href={`/clubs/${clubId}/shifts`}>
                    <Card className="h-full border-slate-200/80 shadow-sm transition-colors hover:border-primary/40">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
                                <LayoutDashboard className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-medium">Смены</p>
                                <p className="text-sm text-muted-foreground">Выручка, отчеты и контроль по людям</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </PageShell>
    )
}
