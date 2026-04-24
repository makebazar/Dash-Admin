import { NextRequest, NextResponse } from "next/server"
import { query } from "@/db"
import { runAssistantAgent } from "@/lib/assistant/agent"
import { maxSendChatAction, maxSendMessage } from "@/lib/integrations/max/api"

type MaxUpdate =
    | {
          update_type: "message_created"
          timestamp: number
          message?: any
      }
    | {
          update_type: "bot_started"
          timestamp: number
          chat_id: number | string
          payload?: string | null
          user?: any
      }
    | {
          update_type: string
          timestamp?: number
          [key: string]: any
      }

function getChatIdFromMessage(message: any) {
    return (
        message?.recipient?.chat_id ??
        message?.recipient?.chat?.chat_id ??
        message?.chat_id ??
        message?.chat?.chat_id ??
        null
    )
}

function getTextFromMessage(message: any) {
    return message?.body?.text ?? message?.text ?? null
}

async function bindChatByCode(code: string, chatId: string) {
    const res = await query(
        `SELECT id, club_id, expires_at, used_at
         FROM max_link_codes
         WHERE code = $1
         LIMIT 1`,
        [code]
    )
    if (!res.rowCount) return { ok: false as const, error: "Код не найден" }

    const row = res.rows[0]
    if (row.used_at) return { ok: false as const, error: "Код уже использован" }
    if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false as const, error: "Код просрочен" }

    await query(
        `INSERT INTO club_max_chats (club_id, max_chat_id, linked_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (max_chat_id)
         DO UPDATE SET club_id = EXCLUDED.club_id, revoked_at = NULL`,
        [row.club_id, chatId, null]
    )

    await query(
        `UPDATE max_link_codes
         SET used_at = NOW(), max_chat_id = $2
         WHERE id = $1`,
        [row.id, chatId]
    )

    return { ok: true as const, clubId: String(row.club_id) }
}

async function findClubIdByChat(chatId: string) {
    const res = await query(
        `SELECT club_id
         FROM club_max_chats
         WHERE max_chat_id = $1 AND revoked_at IS NULL
         LIMIT 1`,
        [chatId]
    )
    if (!res.rowCount) return null
    return String(res.rows[0].club_id)
}

async function handleMessage(chatId: string, text: string) {
    const normalized = text.trim().toLowerCase()
    if (normalized === "привет" || normalized === "hello" || normalized === "hi") {
        await maxSendMessage(chatId, "Привет. Спроси, например: \"выручка за последнюю неделю\" или \"сколько по зарплате за этот месяц\".")
        return
    }

    void maxSendChatAction(chatId, "typing_on").catch(() => null)

    const clubId = await findClubIdByChat(chatId)
    if (!clubId) {
        await maxSendMessage(chatId, "Чат не привязан к клубу. Открой DashAdmin → подключение MAX → получи ссылку и перейди по ней.")
        return
    }

    const result = await runAssistantAgent(clubId, text, new Date())
    if (!result.ok) {
        await maxSendMessage(chatId, result.question || result.error)
        return
    }

    await maxSendMessage(chatId, result.message)
}

export async function POST(request: NextRequest) {
    const secret = process.env.MAX_WEBHOOK_SECRET
    if (secret) {
        const header = request.headers.get("x-max-bot-api-secret")
        if (header !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const update = (await request.json().catch(() => null)) as MaxUpdate | null
    if (!update) return NextResponse.json({ ok: true })

    try {
        if (update.update_type === "bot_started") {
            const chatId = String((update as any).chat_id ?? "")
            const payload = String((update as any).payload ?? "").trim()
            if (!chatId) return NextResponse.json({ ok: true })

            if (!payload) {
                await maxSendMessage(chatId, "Открой DashAdmin → подключение MAX → получи ссылку и перейди по ней.")
                return NextResponse.json({ ok: true })
            }

            const bind = await bindChatByCode(payload, chatId)
            if (!bind.ok) {
                await maxSendMessage(chatId, bind.error)
                return NextResponse.json({ ok: true })
            }

            await maxSendMessage(chatId, "Ок, чат подключён. Пиши вопросы про выручку или зарплату.")
            return NextResponse.json({ ok: true })
        }

        if (update.update_type === "message_created") {
            const message = (update as any).message
            const chatIdRaw = getChatIdFromMessage(message)
            const textRaw = getTextFromMessage(message)
            const chatId = chatIdRaw != null ? String(chatIdRaw) : ""
            const text = textRaw != null ? String(textRaw).trim() : ""
            if (!chatId || !text) return NextResponse.json({ ok: true })

            await handleMessage(chatId, text)
            return NextResponse.json({ ok: true })
        }
    } catch (error) {
        console.error("MAX webhook error:", error)
    }

    return NextResponse.json({ ok: true })
}
