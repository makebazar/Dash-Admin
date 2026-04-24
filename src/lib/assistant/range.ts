import type { AssistantIntent, AssistantRange } from "@/lib/assistant/parse"

export type AssistantRangePreset = "today" | "yesterday" | "last_7_days" | "this_week" | "this_month" | "last_month"

function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function addDays(d: Date, days: number) {
    const next = new Date(d)
    next.setDate(next.getDate() + days)
    return next
}

export function resolveAssistantRangePreset(preset: AssistantRangePreset, now: Date, intent: AssistantIntent): AssistantRange {
    if (preset === "yesterday") {
        const end = new Date(now)
        end.setHours(0, 0, 0, 0)
        const start = addDays(end, -1)
        return { start, end, label: "вчера" }
    }

    if (preset === "today") {
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        const end = addDays(start, 1)
        return { start, end, label: "сегодня" }
    }

    if (preset === "last_7_days") {
        const end = new Date(now)
        const start = addDays(end, -7)
        return { start, end, label: "последние 7 дней" }
    }

    if (preset === "this_week") {
        const end = new Date(now)
        const day = end.getDay()
        const diffToMon = (day + 6) % 7
        const start = addDays(new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0), -diffToMon)
        return { start, end, label: "текущая неделя" }
    }

    if (preset === "last_month") {
        const startThisMonth = startOfMonth(now)
        const start = new Date(startThisMonth.getFullYear(), startThisMonth.getMonth() - 1, 1, 0, 0, 0, 0)
        const end = startThisMonth
        return { start, end, label: "прошлый месяц" }
    }

    if (preset === "this_month") {
        const start = startOfMonth(now)
        const end = new Date(now)
        return { start, end, label: "текущий месяц" }
    }

    const start = intent === "payroll" ? startOfMonth(now) : addDays(now, -7)
    const end = new Date(now)
    return { start, end, label: intent === "payroll" ? "текущий месяц" : "последние 7 дней" }
}

