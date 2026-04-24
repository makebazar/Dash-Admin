const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Client } = require('pg')

function toByteStringHeaderValue(value) {
  return String(value)
    .split('')
    .filter((ch) => ch.charCodeAt(0) <= 255)
    .join('')
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function addDays(d, days) {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function resolveRangePreset(preset, now, intent) {
  if (preset === 'yesterday') {
    const end = new Date(now)
    end.setHours(0, 0, 0, 0)
    const start = addDays(end, -1)
    return { start, end, label: 'вчера' }
  }

  if (preset === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const end = addDays(start, 1)
    return { start, end, label: 'сегодня' }
  }

  if (preset === 'last_7_days') {
    const end = new Date(now)
    const start = addDays(end, -7)
    return { start, end, label: 'последние 7 дней' }
  }

  if (preset === 'this_week') {
    const end = new Date(now)
    const day = end.getDay()
    const diffToMon = (day + 6) % 7
    const start = addDays(new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0), -diffToMon)
    return { start, end, label: 'текущая неделя' }
  }

  if (preset === 'last_month') {
    const startThisMonth = startOfMonth(now)
    const start = new Date(startThisMonth.getFullYear(), startThisMonth.getMonth() - 1, 1, 0, 0, 0, 0)
    const end = startThisMonth
    return { start, end, label: 'прошлый месяц' }
  }

  if (preset === 'this_month') {
    const start = startOfMonth(now)
    const end = new Date(now)
    return { start, end, label: 'текущий месяц' }
  }

  const start = intent === 'payroll' ? startOfMonth(now) : addDays(now, -7)
  const end = new Date(now)
  return { start, end, label: intent === 'payroll' ? 'текущий месяц' : 'последние 7 дней' }
}

async function openRouterParse(text) {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing')

  const referer = process.env.OPENROUTER_HTTP_REFERER
  const title = process.env.OPENROUTER_APP_TITLE || 'DashAdmin'

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (referer) headers['HTTP-Referer'] = toByteStringHeaderValue(referer)
  if (title) headers['X-Title'] = toByteStringHeaderValue(title)

  let res = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content:
                'Ты маршрутизатор запросов владельца клуба. Верни только валидный JSON без markdown. ' +
                'Формат: {"type":"query","intent":"revenue"|"payroll","range_preset":"today"|"yesterday"|"last_7_days"|"this_week"|"this_month"|"last_month", "adminsOnly":boolean}. ' +
                'Если запрос неоднозначный по периоду или смыслу, верни {"type":"clarify","question":"..."}. ' +
                "Под 'adminsOnly' ставь true если пользователь явно просит про админов/администраторов.",
            },
            { role: 'user', content: text },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(30000),
      })
      break
    } catch (e) {
      if (attempt === 2) return { ok: false, error: 'openrouter_fetch_failed', status: 0 }
    }
  }

  const json = await res.json().catch(() => null)
  const content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content
  if (!res.ok || typeof content !== 'string') {
    return { ok: false, error: 'openrouter_failed', status: res.status }
  }
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    return { ok: false, error: 'bad_json', content }
  }
  return { ok: true, parsed, model }
}

function formatRub(value) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function normalizeFields(schema) {
  if (Array.isArray(schema)) return schema
  if (schema && typeof schema === 'object' && Array.isArray(schema.fields)) return schema.fields
  return []
}

function num(v) {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : 0
  return Number.isFinite(n) ? n : 0
}

async function getIncomeMetrics(client, clubId) {
  const tpl = await client.query(
    `SELECT schema FROM club_report_templates
     WHERE club_id = $1 AND is_active = true
     ORDER BY created_at DESC
     LIMIT 1`,
    [clubId]
  )
  const schema = tpl.rows[0]?.schema
  const fields = normalizeFields(schema)
  const fromTemplate = fields
    .filter((f) => String(f.field_type || '').toUpperCase() === 'INCOME')
    .map((f) => ({
      key: String(f.metric_key || f.key || '').trim(),
      label: String(f.custom_label || f.label || f.metric_key || f.key || '').trim(),
    }))
    .filter((m) => Boolean(m.key))

  const defaults = [
    { key: 'cash_income', label: 'Наличные' },
    { key: 'card_income', label: 'Карта' },
  ]

  const unique = new Map()
  for (const m of [...defaults, ...fromTemplate]) {
    if (!unique.has(m.key)) unique.set(m.key, m)
  }
  return Array.from(unique.values())
}

async function getRevenue(client, clubId, range) {
  const startIso = range.start.toISOString()
  const endIso = range.end.toISOString()

  const incomeMetrics = await getIncomeMetrics(client, clubId)
  const res = await client.query(
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

  let expenses = 0
  const totals = new Map()

  for (const row of res.rows) {
    expenses += num(row.expenses)
    const rd = row.report_data && typeof row.report_data === 'object' ? row.report_data : {}

    for (const m of incomeMetrics) {
      const key = m.key
      let amount = 0
      if (key === 'cash_income') amount = num(row.cash_income)
      else if (key === 'card_income') amount = num(row.card_income)
      else amount = num(rd[key])

      const prev = totals.get(key)
      if (prev) prev.amount += amount
      else totals.set(key, { key, label: m.label, amount })
    }
  }

  const items = Array.from(totals.values())
  const revenueTotal = items.reduce((acc, it) => acc + it.amount, 0)
  return {
    revenue_total: revenueTotal,
    revenue_items: items,
    expenses_total: expenses,
    profit_total: revenueTotal - expenses,
    shifts_count: Number(res.rowCount || 0),
  }
}

async function getPayroll(client, clubId, range, adminsOnly) {
  const startIso = range.start.toISOString()
  const endIso = range.end.toISOString()

  const perEmployeeRes = await client.query(
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
    .map((r) => ({
      user_id: r.user_id,
      full_name: r.full_name,
      accrued_total: Number(r.accrued_total || 0),
      shifts_count: Number(r.shifts_count || 0),
    }))
    .filter((e) => (adminsOnly ? e.accrued_total > 0 : true))

  const accrued_total = employees.reduce((acc, e) => acc + e.accrued_total, 0)
  const shifts_count = employees.reduce((acc, e) => acc + e.shifts_count, 0)

  return {
    accrued_total,
    shifts_count,
    employees_count: employees.length,
    top: employees.slice(0, 5),
  }
}

async function run() {
  const clubId = Number(process.env.ASSISTANT_CLUB_ID || 1)
  const tests = [
    'выручка за последнюю неделю',
    'выручка за прошлый месяц',
    'по выручке вчера',
    'сколько по зарплате за этот месяц',
    'сколько вышло по зарплате у админов за текущий месяц',
    'ну че по бабкам за прошлый месяц?',
  ]

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  const now = new Date()

  for (const text of tests) {
    const parsedRes = await openRouterParse(text)
    if (!parsedRes.ok) {
      console.log(JSON.stringify({ text, ok: false, error: parsedRes.error, status: parsedRes.status }, null, 2))
      continue
    }

    const parsed = parsedRes.parsed
    if (parsed.type === 'clarify') {
      console.log(JSON.stringify({ text, ok: true, type: 'clarify', question: parsed.question }, null, 2))
      continue
    }

    const intent = parsed.intent
    const preset = parsed.range_preset
    const adminsOnly = Boolean(parsed.adminsOnly)
    const range = resolveRangePreset(preset, now, intent)

    if (intent === 'revenue') {
      const data = await getRevenue(client, clubId, range)
      const items = Array.isArray(data.revenue_items) ? data.revenue_items : []
      const parts = items
        .filter((i) => Number(i.amount || 0) > 0)
        .sort((a, b) => {
          if (a.key === 'cash_income') return -1
          if (b.key === 'cash_income') return 1
          if (a.key === 'card_income') return -1
          if (b.key === 'card_income') return 1
          return Number(b.amount || 0) - Number(a.amount || 0)
        })
        .map((i) => `${i.label || i.key} ${formatRub(Number(i.amount || 0))}`)
      const breakdown = parts.length ? ` (${parts.join(' / ')})` : ''
      console.log(
        JSON.stringify(
          {
            text,
            intent,
            range: { label: range.label, start: range.start.toISOString(), end: range.end.toISOString() },
            message: `Выручка за ${range.label}: ${formatRub(data.revenue_total)} ₽${breakdown}, смен: ${data.shifts_count}`,
            raw: { ...data, adminsOnly },
          },
          null,
          2
        )
      )
      continue
    }

    const data = await getPayroll(client, clubId, range, adminsOnly)
    console.log(
      JSON.stringify(
        {
          text,
          intent,
          range: { label: range.label, start: range.start.toISOString(), end: range.end.toISOString() },
          message: `Начислено по зарплате${adminsOnly ? ' (админы)' : ''} за ${range.label}: ${formatRub(data.accrued_total)} ₽, сотрудников: ${
            data.employees_count
          }, смен: ${data.shifts_count}`,
          raw: data,
        },
        null,
        2
      )
    )
  }

  await client.end()
}

run().catch((e) => {
  console.error(String(e && e.message ? e.message : e))
  process.exit(1)
})
