export type AssistantIntent = "revenue" | "payroll"

export type AssistantRange = {
    start: Date
    end: Date
    label: string
}

export type AssistantParseResult =
    | {
          ok: true
          intent: AssistantIntent
          range: AssistantRange
          adminsOnly: boolean
      }
    | {
          ok: false
          error: string
          question?: string
      }

function normalizeText(text: string) {
    return text
        .toLowerCase()
        .replace(/[.,!?;:()\[\]{}"']/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function addDays(d: Date, days: number) {
    const next = new Date(d)
    next.setDate(next.getDate() + days)
    return next
}

function parseRange(text: string, now: Date, intent: AssistantIntent): AssistantRange {
    const t = normalizeText(text)

    if (t.includes("вчера")) {
        const end = new Date(now)
        end.setHours(0, 0, 0, 0)
        const start = addDays(end, -1)
        return { start, end, label: "вчера" }
    }

    if (t.includes("сегодня")) {
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        const end = addDays(start, 1)
        return { start, end, label: "сегодня" }
    }

    if (t.includes("последн") && (t.includes("недел") || t.includes("7 дней") || t.includes("семь дней"))) {
        const end = new Date(now)
        const start = addDays(end, -7)
        return { start, end, label: "последние 7 дней" }
    }

    if (t.includes("недел") && (t.includes("эта") || t.includes("текущ"))) {
        const end = new Date(now)
        const day = end.getDay()
        const diffToMon = (day + 6) % 7
        const start = addDays(new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0), -diffToMon)
        return { start, end, label: "текущая неделя" }
    }

    if (t.includes("прошл") && t.includes("месяц")) {
        const startThisMonth = startOfMonth(now)
        const start = new Date(startThisMonth.getFullYear(), startThisMonth.getMonth() - 1, 1, 0, 0, 0, 0)
        const end = startThisMonth
        return { start, end, label: "прошлый месяц" }
    }

    if (t.includes("этот месяц") || t.includes("текущ") && t.includes("месяц")) {
        const start = startOfMonth(now)
        const end = new Date(now)
        return { start, end, label: "текущий месяц" }
    }

    if (intent === "payroll") {
        const start = startOfMonth(now)
        const end = new Date(now)
        return { start, end, label: "текущий месяц" }
    }

    const end = new Date(now)
    const start = addDays(end, -7)
    return { start, end, label: "последние 7 дней" }
}

function detectIntent(text: string): AssistantIntent | null {
    const t = normalizeText(text)
    const hasRevenue =
        t.includes("выруч") || t.includes("доход") || t.includes("оборот") || t.includes("продаж") || t.includes("прибыл")
    const hasPayroll = t.includes("зарплат") || t === "зп" || t.includes(" зп ") || t.includes("начисл") || t.includes("выплат")

    if (hasRevenue && !hasPayroll) return "revenue"
    if (hasPayroll && !hasRevenue) return "payroll"
    if (hasRevenue && hasPayroll) return "revenue"
    return null
}

export function parseAssistantQuery(text: string, now: Date = new Date()): AssistantParseResult {
    const normalized = normalizeText(text)
    if (!normalized) return { ok: false, error: "Пустой запрос" }

    const intent = detectIntent(normalized)
    if (!intent) return { ok: false, error: "Не понял запрос. Спроси про выручку или зарплату." }

    const adminsOnly = normalized.includes("админ")
    const range = parseRange(normalized, now, intent)

    return { ok: true, intent, range, adminsOnly }
}
