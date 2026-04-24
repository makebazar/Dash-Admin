import { parseAssistantQueryWithOpenRouter } from "@/lib/assistant/openrouter"
import { getAssistantToolsSchema, executeAssistantTool, type AssistantToolCall } from "@/lib/assistant/agent-tools"

type AccessError = Error & { status?: number }

type ToolCallMessage = {
    id: string
    type: "function"
    function: { name: string; arguments: string }
}

type OpenRouterMessage = {
    role: "system" | "user" | "assistant" | "tool"
    content: string | null
    tool_call_id?: string
    name?: string
    tool_calls?: ToolCallMessage[]
}

export type AssistantAgentResponse =
    | { ok: true; message: string; trace: { tool_calls: any[]; raw_final: string } }
    | { ok: false; error: string; question?: string }

function toByteStringHeaderValue(value: string) {
    return value
        .split("")
        .filter((ch) => ch.charCodeAt(0) <= 255)
        .join("")
}

function normalizeErrorMessage(error: unknown) {
    const status = (error as AccessError)?.status
    if (status === 401) return "Unauthorized"
    if (status === 403) return "Forbidden"
    return "Internal Server Error"
}

function safeJsonParse(value: string) {
    try {
        return { ok: true as const, value: JSON.parse(value) }
    } catch {
        return { ok: false as const, value: null }
    }
}

function coerceToolCall(tool: ToolCallMessage): AssistantToolCall | null {
    const name = tool.function?.name
    const argsRaw = tool.function?.arguments
    if (typeof name !== "string" || typeof argsRaw !== "string") return null

    const parsed = safeJsonParse(argsRaw)
    const args = parsed.ok ? parsed.value : null
    if (!args || typeof args !== "object") return null

    const range_preset = String((args as any).range_preset || "")
    const adminsOnly = Boolean((args as any).adminsOnly)

    if (
        range_preset !== "today" &&
        range_preset !== "yesterday" &&
        range_preset !== "last_7_days" &&
        range_preset !== "this_week" &&
        range_preset !== "this_month" &&
        range_preset !== "last_month"
    ) {
        return null
    }

    if (name === "revenue_summary") return { name, arguments: { range_preset } }
    if (name === "revenue_by_day") return { name, arguments: { range_preset } }
    if (name === "compare_revenue") return { name, arguments: { range_preset } }
    if (name === "payroll_accrued") return { name, arguments: { range_preset, adminsOnly } }

    return null
}

export async function runAssistantAgent(clubId: string, text: string, now: Date = new Date()): Promise<AssistantAgentResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
        const parsed = await parseAssistantQueryWithOpenRouter(text, now)
        if (!parsed.ok) return parsed
        return { ok: false, error: "Agent mode requires OPENROUTER_API_KEY" }
    }

    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini"
    const referer = process.env.OPENROUTER_HTTP_REFERER
    const title = process.env.OPENROUTER_APP_TITLE || "DashAdmin"

    const tools = getAssistantToolsSchema()

    const messages: OpenRouterMessage[] = [
        {
            role: "system",
            content:
                "Ты карманный управляющий клуба. Ты умеешь считать выручку и начисления по зарплате по данным из системы. " +
                "Ты НЕ придумываешь цифры. Если данных недостаточно — задаёшь короткий уточняющий вопрос. " +
                "Используй tools, чтобы получить цифры. После получения цифр верни короткий ответ на русском. " +
                "Про админов: ставь adminsOnly=true только если в запросе явно есть 'админ'/'администратор'.",
        },
        { role: "user", content: text },
    ]

    const trace: { tool_calls: any[]; raw_final: string } = { tool_calls: [], raw_final: "" }

    const maxSteps = Math.max(1, Number(process.env.ASSISTANT_AGENT_MAX_STEPS || 4))
    const timeoutMs = Math.max(2000, Number(process.env.OPENROUTER_TIMEOUT_MS || 20000))
    const maxAttempts = Math.max(1, Number(process.env.OPENROUTER_MAX_ATTEMPTS || 2))

    for (let step = 0; step < maxSteps; step++) {
        let assistantMsg: OpenRouterMessage | null = null
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        ...(referer ? { "HTTP-Referer": toByteStringHeaderValue(String(referer)) } : {}),
                        ...(title ? { "X-Title": toByteStringHeaderValue(String(title)) } : {}),
                    },
                    body: JSON.stringify({
                        model,
                        temperature: 0,
                        messages,
                        tools,
                    }),
                    signal: AbortSignal.timeout(timeoutMs),
                })

                if (!res.ok) {
                    if (attempt + 1 >= maxAttempts) return { ok: false, error: `OpenRouter error ${res.status}` }
                    continue
                }

                const json = await res.json().catch(() => null)
                assistantMsg = json?.choices?.[0]?.message || null
                if (assistantMsg) break
            } catch {
                if (attempt + 1 >= maxAttempts) return { ok: false, error: "OpenRouter request failed" }
            }
        }

        if (!assistantMsg) return { ok: false, error: "Empty model response" }
        messages.push({
            role: "assistant",
            content: assistantMsg.content ?? null,
            tool_calls: assistantMsg.tool_calls,
        })

        const toolCalls: ToolCallMessage[] = Array.isArray(assistantMsg.tool_calls) ? assistantMsg.tool_calls : []
        if (toolCalls.length === 0) {
            const finalText = String(assistantMsg.content || "").trim()
            trace.raw_final = finalText
            if (!finalText) return { ok: false, error: "Empty final answer" }
            return { ok: true, message: finalText, trace }
        }

        for (const tc of toolCalls) {
            const coerced = coerceToolCall(tc)
            trace.tool_calls.push({ step, tool_call: tc, coerced })

            if (!coerced) {
                messages.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    content: JSON.stringify({ ok: false, error: "Invalid tool call" }),
                })
                continue
            }

            const result = await executeAssistantTool(clubId, coerced, now).catch((e) => ({
                ok: false,
                error: normalizeErrorMessage(e),
            }))

            messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ ok: true, result }),
            })
        }
    }

    return { ok: false, error: "Agent exceeded max steps" }
}
