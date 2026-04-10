import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AlertTriangle, ChevronRight, ArrowRight, Zap, TrendingUp, Package, Clock, Users, Wrench } from "lucide-react"
import { query } from "@/db"
import { cn, formatLocalDate } from "@/lib/utils"
import { PageShell } from "@/components/layout/PageShell"
import { getClubTasks, getSalesAnalytics } from "./inventory/actions"
import { getClubEmployeeLeaderboardState } from "@/lib/employee-leaderboard"
import RevenueTrendChart from "./RevenueTrendChart"

export const dynamic = "force-dynamic"

// ... (All type definitions and helper functions remain exactly the same as original)
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
    criticalCount: number
    zeroStockCount: number
    categoryATotalCount: number
    categoryARiskCount: number
    categoryAItems: Array<{
        id: string
        name: string
        currentStock: number
        minStockLevel: number
        salesVelocity: number
        daysLeft: number | null
        status: "critical" | "warning" | "stable"
    }>
    criticalItems: Array<{
        id: string
        name: string
        currentStock: number
        minStockLevel: number
    }>
    tasks: InventoryTask[]
}

const currencyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 })
const compactCurrencyFormatter = new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 })

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
    if (value instanceof Date) return value.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })
    if (typeof value === "string" && value.includes("-")) {
        const [year, month, day] = value.split("-").map(Number)
        return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })
    }
    return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })
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
    return getDateObject(value).toLocaleDateString("ru-RU", { weekday: "short" })
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
    if (Array.isArray(value)) return value.reduce((sum, item) => sum + normalizeMetricValue(item), 0)
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    if (typeof value === "string") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    if (value && typeof value === "object") {
        if ("value" in value) return normalizeMetricValue((value as { value?: unknown }).value)
        return 0
    }
    return 0
}

function formatDateKeyInTimezone(value: Date | string, timeZone: string) {
    const date = value instanceof Date ? value : new Date(value)
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date)
    const year = parts.find(part => part.type === "year")?.value || "0000"
    const month = parts.find(part => part.type === "month")?.value || "01"
    const day = parts.find(part => part.type === "day")?.value || "01"
    return `${year}-${month}-${day}`
}

async function getClubTimezone(clubId: string) {
    const result = await query(`SELECT COALESCE(timezone, 'Europe/Moscow') as timezone FROM clubs WHERE id = $1`, [clubId])
    return result.rows[0]?.timezone || "Europe/Moscow"
}

async function getReportMetricMeta(clubId: string): Promise<MetricMeta> {
    const templateRes = await query(`SELECT schema FROM club_report_templates WHERE club_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1`, [clubId])
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

function calculateShiftIncomeTotal(shift: { cash_income?: number | string | null; card_income?: number | string | null; report_data?: unknown }, metricMeta: MetricMeta) {
    let total = 0
    const cash = normalizeMetricValue(shift.cash_income)
    const card = normalizeMetricValue(shift.card_income)
    if (metricMeta["cash_income"]?.category === "INCOME" || !metricMeta["cash_income"]) total += cash
    if (metricMeta["card_income"]?.category === "INCOME" || !metricMeta["card_income"]) total += card
    const reportData = typeof shift.report_data === "string" ? JSON.parse(shift.report_data || "{}") : shift.report_data
    if (reportData && typeof reportData === "object" && !Array.isArray(reportData)) {
        Object.entries(reportData).forEach(([key, value]) => {
            if (metricMeta[key]?.category === "INCOME" && !["cash_income", "card_income", "total_revenue", "revenue_cash", "revenue_card", "cash", "card"].includes(key)) {
                total += normalizeMetricValue(value)
            }
        })
    }
    return total
}

function buildRevenueBreakdown(rows: any[], metricMeta: MetricMeta): Array<{ key: string; label: string; amount: number }> {
    const totals = new Map<string, { label: string; amount: number }>()
    const add = (key: string, amount: number) => {
        if (!Number.isFinite(amount) || amount === 0) return
        const label = metricMeta[key]?.label || key
        const current = totals.get(key) || { label, amount: 0 }
        current.amount += amount
        totals.set(key, current)
    }
    rows.forEach((row: any) => {
        if (metricMeta["cash_income"]?.category === "INCOME" || !metricMeta["cash_income"]) add("cash_income", normalizeMetricValue(row.cash_income))
        if (metricMeta["card_income"]?.category === "INCOME" || !metricMeta["card_income"]) add("card_income", normalizeMetricValue(row.card_income))
        const reportData = typeof row.report_data === "string" ? JSON.parse(row.report_data || "{}") : row.report_data
        if (reportData && typeof reportData === "object" && !Array.isArray(reportData)) {
            Object.entries(reportData).forEach(([key, value]) => {
                if (metricMeta[key]?.category === "INCOME" && !["cash_income", "card_income", "total_revenue", "revenue_cash", "revenue_card", "cash", "card"].includes(key)) {
                    add(key, normalizeMetricValue(value))
                }
            })
        }
    })
    return Array.from(totals.entries()).map(([key, value]) => ({ key, label: value.label, amount: value.amount })).sort((a, b) => b.amount - a.amount)
}

async function getShiftRevenueRows(clubId: string, startDate: string, endDate: string) {
    const result = await query(
        `SELECT s.id, s.cash_income, s.card_income, s.expenses, s.report_data, COALESCE(s.shift_type, 'DAY') as shift_type, s.check_in as period_at
         FROM shifts s LEFT JOIN shift_reports sr ON s.shift_report_id = sr.id
         WHERE COALESCE(s.club_id, sr.club_id) = $1 AND s.status NOT IN ('ACTIVE', 'CANCELLED') AND s.check_in >= $2::timestamp AND s.check_in < $3::timestamp`,
        [clubId, startDate, endDate]
    )
    return result.rows
}

function hasPermission(access: DashboardAccess, key: string) {
    return access.isFullAccess || access.permissions[key] === true
}

async function getDashboardAccess(clubId: string, userId: string): Promise<DashboardAccess> {
    const clubRes = await query(`SELECT id, name, owner_id FROM clubs WHERE id = $1`, [clubId])
    if ((clubRes.rowCount || 0) === 0) redirect("/dashboard")
    const club = clubRes.rows[0]
    if (String(club.owner_id) === String(userId)) return { clubName: club.name, isFullAccess: true, permissions: {}, roleName: "Владелец" }
    
    const userRoleRes = await query(
        `SELECT ce.role as club_role, u.role_id, r.name as role_name
         FROM club_employees ce LEFT JOIN users u ON u.id = ce.user_id LEFT JOIN roles r ON r.id = u.role_id
         WHERE ce.club_id = $1 AND ce.user_id = $2 AND ce.is_active = TRUE AND ce.dismissed_at IS NULL`,
        [clubId, userId]
    )
    if ((userRoleRes.rowCount || 0) === 0) redirect("/dashboard")
    const { role_id, role_name, club_role } = userRoleRes.rows[0]
    if (club_role === "Владелец" || club_role === "Админ" || role_name === "Админ" || club_role === "Управляющий" || role_name === "Управляющий") {
        return { clubName: club.name, isFullAccess: true, permissions: {}, roleName: club_role || role_name || null }
    }
    if (!role_id) return { clubName: club.name, isFullAccess: false, permissions: {}, roleName: club_role || role_name || null }
    
    const permissionsRes = await query(`SELECT permission_key, is_allowed FROM role_permissions WHERE club_id = $1 AND role_id = $2`, [clubId, role_id])
    const permissions: PermissionMap = {}
    permissionsRes.rows.forEach((row: any) => { permissions[row.permission_key] = row.is_allowed })
    return { clubName: club.name, isFullAccess: false, permissions, roleName: club_role || role_name || null }
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

    const revenueTotal = currentRows.reduce((sum: number, row: any) => sum + calculateShiftIncomeTotal(row, metricMeta), 0)
    const expensesTotal = currentRows.reduce((sum: number, row: any) => sum + normalizeMetricValue(row.expenses), 0)
    const previousRevenue = previousRows.reduce((sum: number, row: any) => sum + calculateShiftIncomeTotal(row, metricMeta), 0)
    const previousExpenses = previousRows.reduce((sum: number, row: any) => sum + normalizeMetricValue(row.expenses), 0)
    const operatingResult = revenueTotal - expensesTotal
    const previousOperatingResult = previousRevenue - previousExpenses

    return {
        revenueTotal, previousRevenueTotal: previousRevenue, currentRevenueParts: buildRevenueBreakdown(currentRows, metricMeta), previousRevenueParts: buildRevenueBreakdown(previousRows, metricMeta),
        revenueChange: previousRevenue > 0 ? ((revenueTotal - previousRevenue) / previousRevenue) * 100 : 0,
        expensesTotal, expensesChange: previousExpenses > 0 ? ((expensesTotal - previousExpenses) / previousExpenses) * 100 : 0,
        operatingResult, operatingChange: previousOperatingResult > 0 ? ((operatingResult - previousOperatingResult) / previousOperatingResult) * 100 : 0,
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
        return { date: key, revenue: revenueByDate.get(key) || 0 }
    })
}

async function getRevenueInsights(clubId: string, lookbackDays: number): Promise<RevenueInsightsSnapshot> {
    const clubTimezone = await getClubTimezone(clubId)
    const metricMeta = await getReportMetricMeta(clubId)
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    startDate.setDate(startDate.getDate() - lookbackDays)

    const rows = await getShiftRevenueRows(clubId, startDate.toISOString(), new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
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
    Array.from({ length: 7 }, (_, weekday) => { weekdayStats.set(weekday, { total: 0, count: 0 }) })

    const dailyEntries = Array.from(dailyTotals.entries())
        .map(([date, revenue]) => ({ date, revenue, weekday: getDateObject(date).getDay(), isWeekend: isWeekendDate(date) }))
        .sort((a, b) => a.date.localeCompare(b.date))

    dailyEntries.forEach(entry => {
        const current = weekdayStats.get(entry.weekday) || { total: 0, count: 0 }
        current.total += entry.revenue
        current.count += 1
        weekdayStats.set(entry.weekday, current)
        if (entry.isWeekend) { weekendStats.total += entry.revenue; weekendStats.count += 1 } 
        else { weekdayOnlyStats.total += entry.revenue; weekdayOnlyStats.count += 1 }
    })

    const weekdayAverages = [1, 2, 3, 4, 5, 6, 0].map(weekday => {
        const stats = weekdayStats.get(weekday) || { total: 0, count: 0 }
        return { weekday, label: formatWeekdayFull(weekday), shortLabel: formatWeekdayShortByIndex(weekday), avgRevenue: stats.count > 0 ? stats.total / stats.count : 0, isWeekend: weekday === 0 || weekday === 6 }
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
        .map(item => ({ ...item, avgRevenue: item.total / item.count }))
        .sort((a, b) => b.avgRevenue - a.avgRevenue)[0] || null

    const latestEntry = dailyEntries[dailyEntries.length - 1] || null
    const latestWeekdayBaseline = latestEntry ? weekdayAverages.find(item => item.weekday === latestEntry.weekday)?.avgRevenue || 0 : 0
    const latestVsTypical = latestEntry && latestWeekdayBaseline > 0 ? ((latestEntry.revenue - latestWeekdayBaseline) / latestWeekdayBaseline) * 100 : 0

    const insights: RevenueInsightsSnapshot["insights"] = []
    if (bestWeekday) insights.push({ title: "Сильный день", value: bestWeekday.label, description: `В среднем ${formatCurrency(bestWeekday.avgRevenue)} за день`, tone: "success" })
    if (weakestWeekday) insights.push({ title: "Слабый день", value: weakestWeekday.label, description: `Чаще всего просадка именно здесь: ${formatCurrency(weakestWeekday.avgRevenue)}`, tone: "warning" })
    if (weekendAvg > 0 || weekdayAvg > 0) insights.push({ title: "Выходные vs будни", value: formatSignedPercent(weekendDeltaPercent), description: weekendDeltaPercent >= 0 ? `Выходные сильнее. В среднем ${formatCurrency(weekendAvg)} против ${formatCurrency(weekdayAvg)}` : `Будни сильнее. В среднем ${formatCurrency(weekdayAvg)} против ${formatCurrency(weekendAvg)}`, tone: weekendDeltaPercent >= 0 ? "success" : "warning" })
    if (bestShiftCombo) insights.push({ title: "Сильная смена", value: `${formatShiftType(bestShiftCombo.shiftType)} · ${formatWeekdayFull(bestShiftCombo.weekday)}`, description: `В среднем ${formatCurrency(bestShiftCombo.avgRevenue)}`, tone: "default" })
    else if (latestEntry) insights.push({ title: "Последний день", value: formatWeekdayFull(latestEntry.weekday), description: latestVsTypical >= 0 ? `Выше обычного на ${formatSignedPercent(latestVsTypical)}` : `Ниже обычного на ${formatSignedPercent(latestVsTypical)}`, tone: latestVsTypical >= 0 ? "success" : "warning" })

    return { insights, weekdayAverages }
}

async function getActiveShiftsSnapshot(clubId: string): Promise<ActiveShift[]> {
    const result = await query(
        `SELECT s.id, s.check_in, s.total_hours, COALESCE(s.shift_type, 'DAY') as shift_type, u.full_name as user_name, COALESCE(r.name, 'Сотрудник') as role_name
         FROM shifts s JOIN users u ON s.user_id = u.id LEFT JOIN roles r ON u.role_id = r.id
         WHERE s.club_id = $1 AND s.status = 'ACTIVE' ORDER BY s.check_in DESC`,
        [clubId]
    )
    return result.rows.map((row: any) => ({ id: String(row.id), userName: row.user_name, role: row.role_name, shiftType: row.shift_type || "DAY", checkIn: row.check_in, totalHours: Number(row.total_hours || 0) }))
}

async function getNextScheduledShift(clubId: string): Promise<NextScheduledShift> {
    const clubTimezone = await getClubTimezone(clubId)
    const todayKey = formatDateKeyInTimezone(new Date(), clubTimezone)
    const result = await query(
        `WITH active_today AS (
            SELECT s.user_id, COALESCE(s.shift_type, 'DAY') as shift_type FROM shifts s
            WHERE s.club_id = $1 AND s.status = 'ACTIVE' AND DATE(((s.check_in AT TIME ZONE 'UTC') AT TIME ZONE $2)) = $3::date
         )
         SELECT ws.date, ws.shift_type, u.full_name as user_name
         FROM work_schedules ws JOIN users u ON u.id = ws.user_id LEFT JOIN active_today a ON a.user_id = ws.user_id AND a.shift_type = ws.shift_type
         WHERE ws.club_id = $1 AND ws.date >= $3::date AND a.user_id IS NULL
         ORDER BY ws.date ASC, CASE ws.shift_type WHEN 'DAY' THEN 1 WHEN 'NIGHT' THEN 2 ELSE 3 END ASC LIMIT 1`,
        [clubId, clubTimezone, todayKey]
    )
    const row = result.rows[0]
    if (!row) return null
    return { userName: row.user_name, shiftType: row.shift_type || "DAY", date: row.date instanceof Date ? formatLocalDate(row.date) : String(row.date) }
}

async function getInventorySnapshot(clubId: string): Promise<InventorySnapshot> {
    const [tasks, sales, criticalItemsResult, categoryAMetricsResult, categoryAItemsResult] = await Promise.all([
        getClubTasks(clubId),
        getSalesAnalytics(clubId, 500),
        query(
            `SELECT id, name, current_stock, min_stock_level, COUNT(*) OVER() as total_critical_count, SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) OVER() as total_zero_stock_count
            FROM warehouse_products WHERE club_id = $1 AND is_active = TRUE AND min_stock_level > 0 AND current_stock <= min_stock_level
            ORDER BY CASE WHEN current_stock <= 0 THEN 0 ELSE 1 END, (current_stock - min_stock_level) ASC, name ASC LIMIT 5`,
            [clubId]
        ),
        query(
            `SELECT COUNT(*) FILTER (WHERE is_active = TRUE AND COALESCE(abc_category, 'C') = 'A') as total_a_count,
            COUNT(*) FILTER (WHERE is_active = TRUE AND COALESCE(abc_category, 'C') = 'A' AND (current_stock <= 0 OR (COALESCE(min_stock_level, 0) > 0 AND current_stock < min_stock_level) OR (COALESCE(sales_velocity, 0) > 0 AND current_stock / NULLIF(sales_velocity, 0) < 2))) as total_a_risk_count
            FROM warehouse_products WHERE club_id = $1`,
            [clubId]
        ),
        query(
            `SELECT id, name, current_stock, min_stock_level, COALESCE(sales_velocity, 0) as sales_velocity
            FROM warehouse_products WHERE club_id = $1 AND is_active = TRUE AND COALESCE(abc_category, 'C') = 'A'
            AND (current_stock <= 0 OR (COALESCE(min_stock_level, 0) > 0 AND current_stock < min_stock_level) OR (COALESCE(sales_velocity, 0) > 0 AND current_stock / NULLIF(sales_velocity, 0) < 2))
            ORDER BY CASE WHEN current_stock <= 0 THEN 0 WHEN COALESCE(min_stock_level, 0) > 0 AND current_stock < min_stock_level THEN 1 WHEN COALESCE(sales_velocity, 0) > 0 AND current_stock / NULLIF(sales_velocity, 0) < 2 THEN 2 ELSE 3 END, current_stock ASC, sales_velocity DESC, name ASC LIMIT 6`,
            [clubId]
        ),
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

    const criticalItems = criticalItemsResult.rows.map((row: any) => ({ id: String(row.id), name: String(row.name), currentStock: Number(row.current_stock || 0), minStockLevel: Number(row.min_stock_level || 0) }))
    const criticalTotalsRow = criticalItemsResult.rows[0]
    const categoryAItems = categoryAItemsResult.rows.map((row: any) => {
        const currentStock = Number(row.current_stock || 0)
        const minStockLevel = Number(row.min_stock_level || 0)
        const salesVelocity = Number(row.sales_velocity || 0)
        const daysLeft = salesVelocity > 0 ? currentStock / salesVelocity : null
        const status = currentStock <= 0 || (minStockLevel > 0 && currentStock < minStockLevel) ? "critical" : daysLeft !== null && daysLeft < 2 ? "warning" : "stable"
        return { id: String(row.id), name: String(row.name), currentStock, minStockLevel, salesVelocity, daysLeft, status } satisfies InventorySnapshot["categoryAItems"][number]
    })
    const categoryATotalsRow = categoryAMetricsResult.rows[0]

    return {
        openTasksCount: tasks.length, returnAmount: returnRows.reduce((sum: number, item: any) => sum + Math.abs(Number(item.price_at_time || 0) * Number(item.change_amount || 0)), 0),
        returnCount: returnRows.length, discrepancyAmount: Array.from(uniqueShiftDiscrepancies.values()).reduce((sum, value) => sum + value, 0),
        criticalCount: Number(criticalTotalsRow?.total_critical_count || 0), zeroStockCount: Number(criticalTotalsRow?.total_zero_stock_count || 0),
        categoryATotalCount: Number(categoryATotalsRow?.total_a_count || 0), categoryARiskCount: Number(categoryATotalsRow?.total_a_risk_count || 0),
        categoryAItems, criticalItems,
        tasks: tasks.slice(0, 5).map((task: any) => ({ id: String(task.id), title: task.title || null, type: task.type, priority: task.priority, productName: task.product_name || null, assigneeName: task.assignee_name || null, createdAt: task.created_at })),
    }
}

export default async function ClubDashboardPage({ params }: { params: Promise<{ clubId: string }> }) {
    const { clubId } = await params
    const userId = (await cookies()).get("session_user_id")?.value

    if (!userId) redirect("/login")

    const access = await getDashboardAccess(clubId, userId)
    const canViewShifts = hasPermission(access, "view_shifts")
    
    const [shiftStats, revenueTrendHistory, revenueInsights, inventorySnapshot, activeShifts, nextScheduledShift] = await Promise.all([
        getShiftStats(clubId), getRevenueTrend(clubId, 60), getRevenueInsights(clubId, 84),
        getInventorySnapshot(clubId), canViewShifts ? getActiveShiftsSnapshot(clubId) : Promise.resolve([]),
        canViewShifts ? getNextScheduledShift(clubId) : Promise.resolve(null),
    ])

    const revenueTrend = revenueTrendHistory.slice(-30)
    const previousRevenueTrend = revenueTrendHistory.slice(-60, -30)
    const recentRevenueDays = [...revenueTrend.slice(-7)].reverse()

    return (
        <PageShell maxWidth="5xl">
            {/* Minimalist Header */}
            <div className="mb-12">
                <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-5 w-5 text-black fill-current" />
                    <span className="text-sm font-medium tracking-wide uppercase text-slate-500">Обзор клуба</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                    {access.clubName}
                </h1>
            </div>

            <div className="flex flex-col gap-12">
                {/* 1. Primary Focus: Revenue (Full Bleed Area) */}
                <section>
                    <div className="flex items-baseline justify-between mb-6">
                        <h2 className="text-2xl font-bold tracking-tight">Выручка за месяц</h2>
                        <Link href={`/clubs/${clubId}/shifts`} className="group flex items-center text-sm font-medium text-slate-500 hover:text-black transition-colors">
                            Все смены <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="md:w-1/3">
                            <div className="h-full flex flex-col justify-center border-l-2 border-black pl-6">
                                <p className="text-[3rem] leading-none font-bold tracking-tighter text-slate-900 mb-2">
                                    {formatCurrency(shiftStats.revenueTotal)}
                                </p>
                                <div className="flex items-center gap-3">
                                    <span className={cn("text-sm font-medium", shiftStats.revenueChange >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                        {formatSignedPercent(shiftStats.revenueChange)}
                                    </span>
                                    <span className="text-sm text-slate-500">к прошлому месяцу</span>
                                </div>
                                
                                {shiftStats.currentRevenueParts.length > 0 && (
                                    <div className="mt-8 space-y-3">
                                        {shiftStats.currentRevenueParts.map(part => (
                                            <div key={part.key} className="flex items-center justify-between text-sm">
                                                <span className="text-slate-500">{part.label}</span>
                                                <span className="font-medium">{formatCurrency(part.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="md:w-2/3 h-[400px] bg-white rounded-2xl border border-slate-200 p-4">
                            <RevenueTrendChart currentData={revenueTrend} previousData={previousRevenueTrend} />
                        </div>
                    </div>
                </section>

                <hr className="border-slate-200" />

                {/* 2. Operations & Inventory (Split Layout) */}
                <div className="grid md:grid-cols-2 gap-12">
                    
                    {/* Active Shifts */}
                    <section>
                        <div className="flex items-center gap-2 mb-6">
                            <Clock className="h-5 w-5 text-slate-400" />
                            <h2 className="text-xl font-bold tracking-tight">Операционка</h2>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Сейчас на смене</p>
                                {activeShifts.length > 0 ? (
                                    <div className="space-y-3">
                                        {activeShifts.slice(0, 3).map(item => (
                                            <div key={item.id} className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
                                                <div>
                                                    <p className="font-medium text-slate-900">{item.userName}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{item.role}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-medium">{formatShiftType(item.shiftType)}</p>
                                                    <p className="text-xs text-emerald-600 mt-0.5">В процессе</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-500 border border-slate-200 border-dashed">
                                        Сейчас активных смен нет
                                    </div>
                                )}
                            </div>

                            {nextScheduledShift && (
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Следующая смена</p>
                                    <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
                                        <span className="font-medium text-slate-900">{nextScheduledShift.userName}</span>
                                        <span className="text-sm text-slate-500">{formatShiftType(nextScheduledShift.shiftType)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Inventory Alerts */}
                    <section>
                        <div className="flex items-baseline justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-slate-400" />
                                <h2 className="text-xl font-bold tracking-tight">Склад (Топ-6)</h2>
                            </div>
                            <Link href={`/clubs/${clubId}/inventory`} className="group flex items-center text-sm font-medium text-slate-500 hover:text-black transition-colors">
                                Весь склад <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {inventorySnapshot.categoryAItems.length > 0 ? (
                                inventorySnapshot.categoryAItems.map(item => (
                                    <div key={item.id} className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
                                        <div>
                                            <p className="font-medium text-slate-900">{item.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={cn(
                                                    "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                                    item.status === "critical" && "bg-rose-100 text-rose-700",
                                                    item.status === "warning" && "bg-amber-100 text-amber-700",
                                                    item.status === "stable" && "bg-emerald-100 text-emerald-700"
                                                )}>
                                                    {item.status === "critical" ? "Критично" : item.status === "warning" ? "Скоро" : "Норма"}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    {item.daysLeft !== null ? `запас: ${item.daysLeft.toFixed(1)} дн.` : "запас не рассчитан"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-slate-900">{item.currentStock}</p>
                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Остаток</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-slate-50 rounded-xl p-8 text-center border border-slate-200 border-dashed">
                                    <p className="text-sm text-slate-500">Проблемных товаров категории A нет</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <hr className="border-slate-200" />

                {/* 3. Analytics Insights (Text driven) */}
                <section>
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="h-5 w-5 text-slate-400" />
                        <h2 className="text-xl font-bold tracking-tight">Инсайты</h2>
                    </div>
                    
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {revenueInsights.insights.map((insight, index) => (
                            <div key={index} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{insight.title}</p>
                                    <p className="text-lg font-bold text-slate-900 leading-tight mb-2">{insight.value}</p>
                                </div>
                                <p className="text-sm text-slate-500">{insight.description}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </PageShell>
    )
}
