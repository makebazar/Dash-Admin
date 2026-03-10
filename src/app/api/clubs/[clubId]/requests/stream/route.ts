import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getClient, query } from "@/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    const userId = (await cookies()).get("session_user_id")?.value
    const { clubId } = await params
    const clubIdInt = parseInt(clubId)

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accessRes = await query(
        `
        SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
        UNION
        SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
        `,
        [clubIdInt, userId]
    )

    if ((accessRes.rowCount || 0) === 0) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const encoder = new TextEncoder()
    let closed = false
    let dbClient: Awaited<ReturnType<typeof getClient>> | null = null
    let notificationHandler: ((msg: { payload?: string }) => void) | null = null
    let pingTimer: NodeJS.Timeout | null = null

    const stream = new ReadableStream({
        start(controller) {
            const sendEvent = (event: string, payload: unknown) => {
                if (closed) return
                controller.enqueue(
                    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
                )
            }

            const setupListener = async () => {
                try {
                    dbClient = await getClient()
                    notificationHandler = (msg: { payload?: string }) => {
                        if (!msg.payload) return
                        if (msg.payload === clubId) {
                            sendEvent("update", { ts: Date.now() })
                        }
                    }
                    dbClient.on("notification", notificationHandler)
                    await dbClient.query(`LISTEN employee_requests_updates`)
                    sendEvent("ready", { ok: true })
                } catch {
                    sendEvent("ready", { ok: false })
                }
            }

            setupListener()
            pingTimer = setInterval(() => {
                if (!closed) sendEvent("ping", { ts: Date.now() })
            }, 15000)
        },
        async cancel() {
            closed = true
            if (pingTimer) clearInterval(pingTimer)
            if (dbClient) {
                if (notificationHandler) {
                    dbClient.off("notification", notificationHandler)
                }
                await dbClient.query(`UNLISTEN employee_requests_updates`)
                dbClient.release()
                dbClient = null
            }
        }
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive"
        }
    })
}
