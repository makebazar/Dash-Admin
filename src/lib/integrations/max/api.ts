const API_BASE = "https://platform-api.max.ru"

export async function maxSendMessage(chatId: string, text: string) {
    const token = process.env.MAX_BOT_TOKEN
    if (!token) throw new Error("MAX_BOT_TOKEN is not set")

    const url = new URL(`${API_BASE}/messages`)
    url.searchParams.set("chat_id", chatId)

    const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
            Authorization: token,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
    })

    if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`MAX sendMessage failed: ${res.status} ${body}`)
    }

    const json = await res.json().catch(() => null)
    if (json && json.success === false) {
        throw new Error(`MAX sendMessage failed: ${JSON.stringify(json)}`)
    }
}

export async function maxSendChatAction(chatId: string, action: "typing_on" | "sending_photo" | "sending_video" | "sending_audio" | "sending_file") {
    const token = process.env.MAX_BOT_TOKEN
    if (!token) throw new Error("MAX_BOT_TOKEN is not set")

    const res = await fetch(`${API_BASE}/chats/${encodeURIComponent(chatId)}/actions`, {
        method: "POST",
        headers: {
            Authorization: token,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
    })

    if (!res.ok) return
    const json = await res.json().catch(() => null)
    if (json && json.success === false) return
}

export async function maxSetWebhookSubscription(webhookUrl: string, secret: string) {
    const token = process.env.MAX_BOT_TOKEN
    if (!token) throw new Error("MAX_BOT_TOKEN is not set")

    const res = await fetch(`${API_BASE}/subscriptions`, {
        method: "POST",
        headers: {
            Authorization: token,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            url: webhookUrl,
            update_types: ["message_created", "bot_started"],
            secret,
        }),
    })

    if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`MAX subscriptions failed: ${res.status} ${body}`)
    }

    const json = await res.json().catch(() => null)
    if (json && json.success === false) {
        throw new Error(`MAX subscriptions failed: ${JSON.stringify(json)}`)
    }

    return json
}
