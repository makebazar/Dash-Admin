import { NextResponse } from "next/server"
import { getArenaInvite } from "@/lib/arena-access"
import { getClient, query } from "@/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function assertStreamAccess(matchId: string) {
    const invite = await getArenaInvite()
    if (!invite) return { ok: false as const, error: "Unauthorized", status: 401 }
    if (invite.kind !== "JUDGE" && invite.kind !== "PARTICIPANT") return { ok: false as const, error: "Forbidden", status: 403 }

    const matchRes = await query(`SELECT tournament_id, competitor_a_id, competitor_b_id FROM tournament_matches WHERE id = $1 LIMIT 1`, [matchId])
    if ((matchRes.rowCount || 0) === 0) return { ok: false as const, error: "Not found", status: 404 }
    const match = matchRes.rows[0]

    if (invite.kind === "JUDGE") {
        if (!invite.tournament_id || Number(invite.tournament_id) !== Number(match.tournament_id)) {
            return { ok: false as const, error: "Forbidden", status: 403 }
        }
    } else {
        if (!invite.tournament_id || !invite.competitor_id) return { ok: false as const, error: "Invalid session", status: 400 }
        if (Number(invite.tournament_id) !== Number(match.tournament_id)) return { ok: false as const, error: "Forbidden", status: 403 }
        if (Number(invite.competitor_id) !== Number(match.competitor_a_id) && Number(invite.competitor_id) !== Number(match.competitor_b_id)) {
            return { ok: false as const, error: "Forbidden", status: 403 }
        }
    }

    return { ok: true as const }
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ matchId: string }> }
) {
    const { matchId } = await params
    const access = await assertStreamAccess(matchId)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const encoder = new TextEncoder()
    let closed = false
    let dbClient: Awaited<ReturnType<typeof getClient>> | null = null
    let notificationHandler: ((msg: { payload?: string }) => void) | null = null
    let pingTimer: NodeJS.Timeout | null = null

    const stream = new ReadableStream({
        start(controller) {
            const sendEvent = (event: string, payload: unknown) => {
                if (closed) return
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
            }

            const setupListener = async () => {
                try {
                    dbClient = await getClient()
                    notificationHandler = (msg: { payload?: string }) => {
                        if (!msg.payload) return
                        try {
                            const data = JSON.parse(msg.payload)
                            if (String(data?.matchId) === String(matchId)) {
                                sendEvent("update", { ts: Date.now() })
                            }
                        } catch {
                        }
                    }
                    dbClient.on("notification", notificationHandler)
                    await dbClient.query(`LISTEN tournament_match_messages`)
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
                if (notificationHandler) dbClient.off("notification", notificationHandler)
                await dbClient.query(`UNLISTEN tournament_match_messages`)
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
