import { describe, it, expect } from "vitest"
import { parseAssistantQuery } from "@/lib/assistant/parse"

describe("parseAssistantQuery", () => {
    it("parses revenue last week", () => {
        const now = new Date("2026-04-24T12:00:00.000Z")
        const res = parseAssistantQuery("что по выручке за последнюю неделю", now)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.intent).toBe("revenue")
        expect(res.range.label).toBe("последние 7 дней")
    })

    it("parses payroll current month by default", () => {
        const now = new Date("2026-04-24T12:00:00.000Z")
        const res = parseAssistantQuery("сколько вышло по зарплате", now)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.intent).toBe("payroll")
        expect(res.range.label).toBe("текущий месяц")
    })

    it("detects adminsOnly", () => {
        const now = new Date("2026-04-24T12:00:00.000Z")
        const res = parseAssistantQuery("сколько зп у админов за текущий месяц", now)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        expect(res.intent).toBe("payroll")
        expect(res.adminsOnly).toBe(true)
    })
})

