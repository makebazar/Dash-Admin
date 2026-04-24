import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"
import { ensureClubSubscriptionActive } from "@/lib/club-subscription-guard"
import { hasColumn } from "@/lib/db-compat"
import { formatDateKeyInTimezone, getMonthRangeInTimezone } from "@/lib/utils"

export const dynamic = "force-dynamic"

type ShiftType = "DAY" | "NIGHT"

function getJsDowFromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year || 0, (month || 1) - 1, day || 1, 12, 0, 0)).getUTCDay()
}

function trimmedMean(values: number[], trimRatio: number) {
  const clean = values.filter(v => Number.isFinite(v))
  if (clean.length === 0) return 0
  const sorted = [...clean].sort((a, b) => a - b)
  const trim = Math.floor(sorted.length * trimRatio)
  const sliced = sorted.slice(trim, Math.max(trim, sorted.length - trim))
  if (sliced.length === 0) return sorted[Math.floor(sorted.length / 2)] || 0
  const sum = sliced.reduce((acc, v) => acc + v, 0)
  return sum / sliced.length
}

function allocateTargets(totalTarget: number, weights: number[]) {
  const safeTotal = Number.isFinite(totalTarget) ? totalTarget : 0
  const safeWeights = weights.map(w => (Number.isFinite(w) && w > 0 ? w : 0))
  const sumWeights = safeWeights.reduce((acc, v) => acc + v, 0)
  if (safeTotal <= 0 || sumWeights <= 0) {
    return safeWeights.map(() => 0)
  }

  const raws = safeWeights.map(w => (safeTotal * w) / sumWeights)
  const floors = raws.map(v => Math.floor(v))
  let remainder = Math.round(safeTotal - floors.reduce((acc, v) => acc + v, 0))

  const order = raws
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)

  const result = [...floors]
  for (let i = 0; i < order.length && remainder > 0; i++) {
    result[order[i].idx] += 1
    remainder -= 1
  }

  return result
}

async function getClubTimezone(clubId: number) {
  try {
    const res = await query(`SELECT timezone FROM clubs WHERE id = $1`, [clubId])
    return res.rows[0]?.timezone || "Europe/Moscow"
  } catch {
    return "Europe/Moscow"
  }
}

async function ensureSalesPlanTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS sales_plan_month_targets (
      id BIGSERIAL PRIMARY KEY,
      club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      target_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
      history_weeks INTEGER NOT NULL DEFAULT 8,
      updated_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(club_id, year, month)
    );
    CREATE INDEX IF NOT EXISTS idx_sales_plan_month_targets_club_period ON sales_plan_month_targets(club_id, year, month);
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS shift_sales_plans (
      id BIGSERIAL PRIMARY KEY,
      club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      shift_type VARCHAR(20) NOT NULL,
      target_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(club_id, date, shift_type)
    );
    CREATE INDEX IF NOT EXISTS idx_shift_sales_plans_club_date ON shift_sales_plans(club_id, date);
  `)
}

async function getMetricCategories(clubId: number) {
  const metricCategories: Record<string, string> = {}
  try {
    const res = await query(`SELECT key, category FROM system_metrics WHERE club_id = $1`, [clubId])
    for (const row of res.rows) {
      metricCategories[String(row.key)] = String(row.category || "")
    }
  } catch {}
  return metricCategories
}

function calculateShiftIncome(
  shift: any,
  metricCategories: Record<string, string>,
  cashKey: string,
  cardKey: string
) {
  let total = 0

  if (metricCategories[cashKey] === "INCOME" || !metricCategories[cashKey]) {
    total += parseFloat(shift[cashKey] || 0)
  }
  if (metricCategories[cardKey] === "INCOME" || !metricCategories[cardKey]) {
    total += parseFloat(shift[cardKey] || 0)
  }

  if (shift.report_data) {
    const data = typeof shift.report_data === "string" ? JSON.parse(shift.report_data) : shift.report_data
    Object.keys(data).forEach(key => {
      if (metricCategories[key] === "INCOME" && key !== cashKey && key !== cardKey) {
        total += parseFloat(data[key] || 0)
      }
    })
  }

  return total
}

function buildMonthDates(firstDay: string, lastDay: string) {
  const [y1, m1, d1] = firstDay.split("-").map(Number)
  const [y2, m2, d2] = lastDay.split("-").map(Number)
  const start = Date.UTC(y1 || 0, (m1 || 1) - 1, d1 || 1, 12, 0, 0)
  const end = Date.UTC(y2 || 0, (m2 || 1) - 1, d2 || 1, 12, 0, 0)

  const dates: string[] = []
  for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
    const dt = new Date(t)
    const year = dt.getUTCFullYear()
    const month = String(dt.getUTCMonth() + 1).padStart(2, "0")
    const day = String(dt.getUTCDate()).padStart(2, "0")
    dates.push(`${year}-${month}-${day}`)
  }
  return dates
}

async function computeWeightMap(args: {
  clubId: number
  timeZone: string
  historyWeeks: number
  cashKey: string
  cardKey: string
}) {
  const { clubId, timeZone, historyWeeks, cashKey, cardKey } = args
  const metricCategories = await getMetricCategories(clubId)

  const historyDays = Math.max(7, Math.min(7 * 26, historyWeeks * 7))
  const end = new Date()
  const start = new Date(end.getTime() - historyDays * 24 * 60 * 60 * 1000)

  const shiftsRes = await query(
    `
    SELECT id, check_in, shift_type, ${cashKey} as cash_value, ${cardKey} as card_value, report_data
    FROM shifts
    WHERE club_id = $1
      AND check_in IS NOT NULL
      AND check_out IS NOT NULL
      AND check_in >= $2::timestamp
      AND check_in <= $3::timestamp
    `,
    [clubId, start.toISOString(), end.toISOString()]
  )

  const bucket: Record<string, number[]> = {}
  const shiftTypeFallback: Record<string, number[]> = { DAY: [], NIGHT: [] }

  for (const s of shiftsRes.rows) {
    const shiftType: ShiftType = String(s.shift_type || "DAY").toUpperCase() === "NIGHT" ? "NIGHT" : "DAY"
    const checkIn = s.check_in
    const dateKey = formatDateKeyInTimezone(checkIn, timeZone)
    const jsDow = getJsDowFromDateKey(dateKey)
    const revenue = calculateShiftIncome(
      { ...s, [cashKey]: s.cash_value, [cardKey]: s.card_value },
      metricCategories,
      cashKey,
      cardKey
    )

    const key = `${jsDow}:${shiftType}`
    if (!bucket[key]) bucket[key] = []
    bucket[key].push(revenue)
    shiftTypeFallback[shiftType].push(revenue)
  }

  const result: Record<string, number> = {}
  for (let dow = 0; dow <= 6; dow++) {
    for (const shiftType of ["DAY", "NIGHT"] as ShiftType[]) {
      const key = `${dow}:${shiftType}`
      const values = bucket[key] || []
      const w =
        trimmedMean(values, 0.1) ||
        trimmedMean(shiftTypeFallback[shiftType] || [], 0.1) ||
        1
      result[key] = Number.isFinite(w) && w > 0 ? w : 1
    }
  }

  return { weightMap: result, metricCategories }
}

async function getFactMap(args: {
  clubId: number
  timeZone: string
  firstDay: string
  lastDay: string
  cashKey: string
  cardKey: string
}) {
  const { clubId, timeZone, firstDay, lastDay, cashKey, cardKey } = args
  const metricCategories = await getMetricCategories(clubId)

  const shiftsRes = await query(
    `
    SELECT id, check_in, shift_type, ${cashKey} as cash_value, ${cardKey} as card_value, report_data
    FROM shifts
    WHERE club_id = $1
      AND check_in IS NOT NULL
      AND check_out IS NOT NULL
      AND check_in >= $2::date
      AND check_in < ($3::date + INTERVAL '1 day')
    `,
    [clubId, firstDay, lastDay]
  )

  const factMap: Record<string, number> = {}
  for (const s of shiftsRes.rows) {
    const shiftType: ShiftType = String(s.shift_type || "DAY").toUpperCase() === "NIGHT" ? "NIGHT" : "DAY"
    const dateKey = formatDateKeyInTimezone(s.check_in, timeZone)
    const revenue = calculateShiftIncome(
      { ...s, [cashKey]: s.cash_value, [cardKey]: s.card_value },
      metricCategories,
      cashKey,
      cardKey
    )
    const key = `${dateKey}:${shiftType}`
    factMap[key] = (factMap[key] || 0) + revenue
  }

  return factMap
}

export async function GET(request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params
    await requireClubFullAccess(clubId)
    const subscriptionCheck = await ensureClubSubscriptionActive(clubId)
    if (!subscriptionCheck.ok) return subscriptionCheck.response

    const clubIdInt = Number(clubId)
    if (!Number.isFinite(clubIdInt)) {
      return NextResponse.json({ error: "Invalid clubId" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url, `http://${request.headers.get("host") || "localhost"}`)
    const monthRaw = Number(searchParams.get("month") || new Date().getMonth() + 1)
    const yearRaw = Number(searchParams.get("year") || new Date().getFullYear())

    if (!Number.isFinite(monthRaw) || monthRaw < 1 || monthRaw > 12 || !Number.isFinite(yearRaw) || yearRaw < 2000) {
      return NextResponse.json({ error: "Invalid month/year" }, { status: 400 })
    }

    await ensureSalesPlanTables()

    const timeZone = await getClubTimezone(clubIdInt)
    const { firstDay, lastDay } = getMonthRangeInTimezone(new Date(yearRaw, monthRaw - 1, 15), timeZone)

    const cashKey = (await hasColumn("shifts", "cash_income")) ? "cash_income" : "cash_revenue"
    const cardKey = (await hasColumn("shifts", "card_income")) ? "card_income" : "card_revenue"

    const monthTargetRes = await query(
      `SELECT target_revenue, history_weeks, updated_at FROM sales_plan_month_targets WHERE club_id = $1 AND year = $2 AND month = $3`,
      [clubIdInt, yearRaw, monthRaw]
    )
    const monthTargetRow = monthTargetRes.rows[0] || null

    const plansRes = await query(
      `
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, shift_type, target_revenue
      FROM shift_sales_plans
      WHERE club_id = $1 AND date >= $2::date AND date <= $3::date
      ORDER BY date ASC, shift_type ASC
      `,
      [clubIdInt, firstDay, lastDay]
    )

    const planMap: Record<string, number> = {}
    for (const row of plansRes.rows) {
      const shiftType = String(row.shift_type || "").toUpperCase() === "NIGHT" ? "NIGHT" : "DAY"
      const key = `${row.date}:${shiftType}`
      planMap[key] = Number(row.target_revenue || 0)
    }

    const factMap = await getFactMap({ clubId: clubIdInt, timeZone, firstDay, lastDay, cashKey, cardKey })
    const dates = buildMonthDates(firstDay, lastDay)

    const rows = dates.flatMap(dateKey => {
      const jsDow = getJsDowFromDateKey(dateKey)
      const shiftRows = (["DAY", "NIGHT"] as ShiftType[]).map(shiftType => {
        const key = `${dateKey}:${shiftType}`
        return {
          date: dateKey,
          dow: jsDow,
          shift_type: shiftType,
          target_revenue: planMap[key] || 0,
          fact_revenue: factMap[key] || 0,
        }
      })
      return shiftRows
    })

    return NextResponse.json({
      month: monthRaw,
      year: yearRaw,
      timeZone,
      month_target: monthTargetRow
        ? {
            target_revenue: Number(monthTargetRow.target_revenue || 0),
            history_weeks: Number(monthTargetRow.history_weeks || 8),
            updated_at: monthTargetRow.updated_at,
          }
        : null,
      rows,
    })
  } catch (error: any) {
    const status = error?.status || 500
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params
    await requireClubFullAccess(clubId)
    const subscriptionCheck = await ensureClubSubscriptionActive(clubId)
    if (!subscriptionCheck.ok) return subscriptionCheck.response

    const clubIdInt = Number(clubId)
    if (!Number.isFinite(clubIdInt)) {
      return NextResponse.json({ error: "Invalid clubId" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const month = Number(body.month)
    const year = Number(body.year)
    const targetRevenue = Number(body.target_revenue)
    const historyWeeks = Number(body.history_weeks)

    if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year) || year < 2000) {
      return NextResponse.json({ error: "Invalid month/year" }, { status: 400 })
    }
    if (!Number.isFinite(targetRevenue) || targetRevenue < 0) {
      return NextResponse.json({ error: "Invalid target_revenue" }, { status: 400 })
    }
    if (!Number.isFinite(historyWeeks) || historyWeeks < 1 || historyWeeks > 26) {
      return NextResponse.json({ error: "Invalid history_weeks" }, { status: 400 })
    }

    await ensureSalesPlanTables()

    const timeZone = await getClubTimezone(clubIdInt)
    const { firstDay, lastDay } = getMonthRangeInTimezone(new Date(year, month - 1, 15), timeZone)

    const cashKey = (await hasColumn("shifts", "cash_income")) ? "cash_income" : "cash_revenue"
    const cardKey = (await hasColumn("shifts", "card_income")) ? "card_income" : "card_revenue"

    const dates = buildMonthDates(firstDay, lastDay)
    const planSlots = dates.flatMap(dateKey => {
      const jsDow = getJsDowFromDateKey(dateKey)
      return (["DAY", "NIGHT"] as ShiftType[]).map(shiftType => ({
        dateKey,
        jsDow,
        shiftType,
      }))
    })

    const { weightMap } = await computeWeightMap({
      clubId: clubIdInt,
      timeZone,
      historyWeeks,
      cashKey,
      cardKey,
    })

    const weights = planSlots.map(s => weightMap[`${s.jsDow}:${s.shiftType}`] || 1)
    const allocated = allocateTargets(Math.round(targetRevenue), weights)

    const values: any[] = [clubIdInt]
    const tuples: string[] = []
    planSlots.forEach((slot, i) => {
      const base = i * 3
      values.push(slot.dateKey, slot.shiftType, allocated[i])
      tuples.push(`($1, $${base + 2}::date, $${base + 3}::text, $${base + 4}::numeric)`)
    })

    await query(
      `
      INSERT INTO shift_sales_plans (club_id, date, shift_type, target_revenue)
      VALUES ${tuples.join(", ")}
      ON CONFLICT (club_id, date, shift_type)
      DO UPDATE SET target_revenue = EXCLUDED.target_revenue, updated_at = NOW()
      `,
      values
    )

    await query(
      `
      INSERT INTO sales_plan_month_targets (club_id, year, month, target_revenue, history_weeks)
      VALUES ($1, $2, $3, $4::numeric, $5)
      ON CONFLICT (club_id, year, month)
      DO UPDATE SET target_revenue = EXCLUDED.target_revenue, history_weeks = EXCLUDED.history_weeks, updated_at = NOW()
      `,
      [clubIdInt, year, month, targetRevenue, historyWeeks]
    )

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    const status = error?.status || 500
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status })
  }
}

