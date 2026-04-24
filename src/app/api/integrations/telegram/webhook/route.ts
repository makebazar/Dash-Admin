import { NextRequest, NextResponse } from "next/server"
import { query } from "@/db"
import { runAssistantAgent } from "@/lib/assistant/agent"

type TelegramUpdate = {
    update_id?: number
    message?: {
        message_id: number
        chat: { id: number | string }
        text?: string
        from?: { id: number | string }
    }
    edited_message?: TelegramUpdate["message"]
}

async function telegramSendMessage(chatId: string, text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set")

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text,
        }),
    })
}

async function bindChatByCode(code: string, chatId: string) {
    const linkRes = await query(
        `
        SELECT id, club_id
        FROM telegram_link_codes
        WHERE code = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
        `,
        [code]
    )

    if ((linkRes.rowCount || 0) === 0) return { ok: false as const, error: "Код не найден или истёк" }

    const row = linkRes.rows[0]
    const clubId = String(row.club_id)

    await query(
        `UPDATE telegram_link_codes
         SET used_at = NOW(), telegram_chat_id = $2
         WHERE id = $1`,
        [row.id, chatId]
    )

    await query(
        `
        INSERT INTO club_telegram_chats (club_id, telegram_chat_id, linked_by)
        VALUES ($1, $2, NULL)
        ON CONFLICT (telegram_chat_id)
        DO UPDATE SET club_id = EXCLUDED.club_id, revoked_at = NULL
        `,
        [clubId, chatId]
    )

    return { ok: true as const, clubId }
}

async function findClubIdByChat(chatId: string) {
    const res = await query(
        `
        SELECT club_id
        FROM club_telegram_chats
        WHERE telegram_chat_id = $1
          AND revoked_at IS NULL
        LIMIT 1
        `,
        [chatId]
    )
    if ((res.rowCount || 0) === 0) return null
    return String(res.rows[0].club_id)
}

async function handleTelegramText(chatId: string, text: string) {
    if (!text) return

    const normalized = text.trim().toLowerCase()
    if (normalized === "привет" || normalized === "hello" || normalized === "hi") {
        void telegramSendMessage(
            chatId,
            "Привет. Спроси, например: \"выручка за последнюю неделю\" или \"сколько по зарплате за этот месяц\"."
        ).catch(() => null)
        return
    }

    if (text.startsWith("/start")) {
        const parts = text.split(" ").map((s) => s.trim()).filter(Boolean)
        const code = parts[1] || ""
        if (!code) {
            void telegramSendMessage(chatId, "Пришли ссылку из DashAdmin: /start <code>").catch(() => null)
            return
        }

        const bind = await bindChatByCode(code, chatId)
        if (!bind.ok) {
            void telegramSendMessage(chatId, bind.error).catch(() => null)
            return
        }

        void telegramSendMessage(chatId, "Ок, чат подключён. Пиши вопросы про выручку или зарплату.").catch(() => null)
        return
    }

    const clubId = await findClubIdByChat(chatId)
    if (!clubId) {
        void telegramSendMessage(chatId, "Чат не привязан к клубу. Открой DashAdmin → подключение Telegram → получи ссылку.").catch(
            () => null
        )
        return
    }

    const result = await runAssistantAgent(clubId, text, new Date())
    if (!result.ok) {
        void telegramSendMessage(chatId, result.question || result.error).catch(() => null)
        return
    }

    void telegramSendMessage(chatId, result.message).catch(() => null)
}

export async function POST(request: NextRequest) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (secret) {
        const header = request.headers.get("x-telegram-bot-api-secret-token")
        if (header !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as TelegramUpdate | null
    if (!body) return NextResponse.json({ ok: true })

    const msg = body.message || body.edited_message
    if (!msg) return NextResponse.json({ ok: true })

    const chatId = String(msg.chat.id)
    const text = String(msg.text || "").trim()
    if (!text) return NextResponse.json({ ok: true })

    try {
        await handleTelegramText(chatId, text)
    } catch (error) {
        console.error("Telegram webhook error:", error)
    }

    return NextResponse.json({ ok: true })
}
