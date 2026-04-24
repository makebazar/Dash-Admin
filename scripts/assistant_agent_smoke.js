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

function resolveRangePreset(preset, now) {
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
  return { start: addDays(now, -7), end: new Date(now), label: 'последние 7 дней' }
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

async function getIncomeKeys(db, clubId) {
  const tpl = await db.query(
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

async function toolRevenueSummary(db, clubId, preset, now) {
  const range = resolveRangePreset(preset, now)
  const startIso = range.start.toISOString()
  const endIso = range.end.toISOString()
  const incomeMetrics = await getIncomeKeys(db, clubId)
  const res = await db.query(
    `SELECT cash_income, card_income, expenses, report_data
     FROM shifts
     WHERE club_id = $1 AND check_in >= $2 AND check_in < $3 AND status NOT IN ('ACTIVE','CANCELLED')`,
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

  const revenue_items = Array.from(totals.values())
  const total = revenue_items.reduce((acc, it) => acc + it.amount, 0)
  return {
    range,
    revenue_total: total,
    revenue_items,
    expenses_total: expenses,
    shifts_count: Number(res.rowCount || 0),
    profit_total: total - expenses,
  }
}

async function toolPayrollAccrued(db, clubId, preset, adminsOnly, now) {
  const range = resolveRangePreset(preset, now)
  const startIso = range.start.toISOString()
  const endIso = range.end.toISOString()
  const per = await db.query(
    `
    SELECT u.full_name, COALESCE(SUM(COALESCE(s.calculated_salary,0)),0) as accrued_total
    FROM shifts s
    JOIN users u ON u.id = s.user_id
    WHERE s.club_id = $1 AND s.check_in >= $2 AND s.check_in < $3 AND s.status IN ('CLOSED','PAID','VERIFIED','ACTIVE')
    GROUP BY u.full_name
    ORDER BY accrued_total DESC
    LIMIT 10
    `,
    [clubId, startIso, endIso]
  )
  return { range, adminsOnly: Boolean(adminsOnly), top: per.rows }
}

async function run() {
  const key = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
  if (!key) throw new Error('OPENROUTER_API_KEY missing')
  const referer = process.env.OPENROUTER_HTTP_REFERER
  const title = process.env.OPENROUTER_APP_TITLE || 'DashAdmin'

  const clubId = Number(process.env.ASSISTANT_CLUB_ID || 1)

  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()

  const tools = [
    {
      type: 'function',
      function: {
        name: 'revenue_summary',
        description: 'Свод выручки по сменам: нал/безнал, расходы, прибыль, количество смен.',
        parameters: {
          type: 'object',
          properties: { range_preset: { type: 'string', enum: ['today','yesterday','last_7_days','this_week','this_month','last_month'] } },
          required: ['range_preset'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'payroll_accrued',
        description: 'Начисления по зарплате по сменам за период.',
        parameters: {
          type: 'object',
          properties: {
            range_preset: { type: 'string', enum: ['today','yesterday','last_7_days','this_week','this_month','last_month'] },
            adminsOnly: { type: 'boolean' },
          },
          required: ['range_preset'],
        },
      },
    },
  ]

  const prompts = [
    'что по выручке за последнюю неделю',
    'сколько по зарплате за этот месяц',
    'ну че по бабкам за прошлый месяц?',
  ]

  for (const text of prompts) {
    const messages = [
      { role: 'system', content: 'Ты управляющий. Используй tools и не выдумывай цифры. Ответь кратко.' },
      { role: 'user', content: text },
    ]

    let res = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            ...(referer ? { 'HTTP-Referer': toByteStringHeaderValue(referer) } : {}),
            ...(title ? { 'X-Title': toByteStringHeaderValue(title) } : {}),
          },
          body: JSON.stringify({ model, temperature: 0, messages, tools }),
          signal: AbortSignal.timeout(30000),
        })
        break
      } catch (e) {
        if (attempt === 2) throw e
      }
    }

    const json = await res.json()
    const msg = json?.choices?.[0]?.message
    const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : []
    const now = new Date()

    for (const tc of toolCalls) {
      const name = tc.function?.name
      const args = JSON.parse(tc.function?.arguments || '{}')
      let out = { ok: false }
      if (name === 'revenue_summary') out = { ok: true, result: await toolRevenueSummary(db, clubId, args.range_preset, now) }
      if (name === 'payroll_accrued') out = { ok: true, result: await toolPayrollAccrued(db, clubId, args.range_preset, args.adminsOnly, now) }
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out) })
    }

    let res2 = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res2 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            ...(referer ? { 'HTTP-Referer': toByteStringHeaderValue(referer) } : {}),
            ...(title ? { 'X-Title': toByteStringHeaderValue(title) } : {}),
          },
          body: JSON.stringify({ model, temperature: 0, messages }),
          signal: AbortSignal.timeout(30000),
        })
        break
      } catch (e) {
        if (attempt === 2) throw e
      }
    }
    const json2 = await res2.json()
    const finalText = json2?.choices?.[0]?.message?.content
    console.log('---')
    console.log(text)
    console.log(finalText)
  }

  await db.end()
}

run().catch((e) => {
  console.error(String(e && e.message ? e.message : e))
  if (e && e.cause) console.error(String(e.cause && e.cause.message ? e.cause.message : e.cause))
  if (e && e.stack) console.error(String(e.stack))
  process.exit(1)
})
