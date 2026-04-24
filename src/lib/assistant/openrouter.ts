import { parseAssistantQuery, type AssistantParseResult, type AssistantIntent } from "@/lib/assistant/parse"
import { resolveAssistantRangePreset, type AssistantRangePreset } from "@/lib/assistant/range"

type LlmResult =
    | {
          type: "query"
          intent: AssistantIntent
          range_preset?: AssistantRangePreset
          adminsOnly?: boolean
      }
    | { type: "clarify"; question: string }

function isObject(value: any): value is Record<string, any> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function coerceLlmResult(value: any): LlmResult | null {
    if (!isObject(value)) return null
    const type = value.type
    if (type === "clarify") {
        const question = String(value.question || "").trim()
        if (!question) return null
        return { type: "clarify", question }
    }
    if (type !== "query") return null
    const intent = value.intent
    if (intent !== "revenue" && intent !== "payroll") return null
    const range_preset = value.range_preset
    const adminsOnly = Boolean(value.adminsOnly)
    if (range_preset !== undefined) {
        const preset = String(range_preset)
        if (
            preset !== "today" &&
            preset !== "yesterday" &&
            preset !== "last_7_days" &&
            preset !== "this_week" &&
            preset !== "this_month" &&
            preset !== "last_month"
        ) {
            return null
        }
        return { type: "query", intent, range_preset: preset as AssistantRangePreset, adminsOnly }
    }
    return { type: "query", intent, adminsOnly }
}

export async function parseAssistantQueryWithOpenRouter(text: string, now: Date = new Date()): Promise<AssistantParseResult> {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return parseAssistantQuery(text, now)

    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini"
    const referer = process.env.OPENROUTER_HTTP_REFERER
    const title = process.env.OPENROUTER_APP_TITLE || "DashAdmin"

    let content: string | null = null
    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                ...(referer ? { "HTTP-Referer": referer } : {}),
                ...(title ? { "X-Title": title } : {}),
            },
            body: JSON.stringify({
                model,
                temperature: 0,
                messages: [
                    {
                        role: "system",
                        content:
                            "Ты маршрутизатор запросов владельца клуба. Верни только валидный JSON без markdown. " +
                            "Формат: {\"type\":\"query\",\"intent\":\"revenue\"|\"payroll\",\"range_preset\":\"today\"|\"yesterday\"|\"last_7_days\"|\"this_week\"|\"this_month\"|\"last_month\", \"adminsOnly\":boolean}. " +
                            "Если запрос неоднозначный по периоду или смыслу, верни {\"type\":\"clarify\",\"question\":\"...\"}. " +
                            "Под 'adminsOnly' ставь true если пользователь явно просит про админов/администраторов.",
                    },
                    { role: "user", content: text },
                ],
                response_format: { type: "json_object" },
            }),
        })
        if (!res.ok) return parseAssistantQuery(text, now)
        const json = await res.json().catch(() => null)
        content = typeof json?.choices?.[0]?.message?.content === "string" ? json.choices[0].message.content : null
    } catch {
        return parseAssistantQuery(text, now)
    }

    if (!content || !content.trim()) return parseAssistantQuery(text, now)

    let parsed: any = null
    try {
        parsed = JSON.parse(content)
    } catch {
        return parseAssistantQuery(text, now)
    }

    const llm = coerceLlmResult(parsed)
    if (!llm) return parseAssistantQuery(text, now)

    if (llm.type === "clarify") return { ok: false, error: "Нужно уточнение", question: llm.question }

    const adminsOnly = Boolean(llm.adminsOnly)
    const range =
        llm.range_preset !== undefined
            ? resolveAssistantRangePreset(llm.range_preset, now, llm.intent)
            : resolveAssistantRangePreset(llm.intent === "payroll" ? "this_month" : "last_7_days", now, llm.intent)

    return { ok: true, intent: llm.intent, adminsOnly, range }
}
