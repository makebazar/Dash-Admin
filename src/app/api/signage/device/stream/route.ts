import { NextResponse } from "next/server"
import { getClient, query } from "@/db"
import { SIGNAGE_DEVICE_UPDATES_CHANNEL } from "@/lib/signage-events"
import { formatPairingCode } from "@/lib/signage"
import { getSignageRemoteBaseUrl, proxyEventStream } from "@/lib/signage-server-url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const remoteBaseUrl = getSignageRemoteBaseUrl(request)
  if (remoteBaseUrl) {
    const requestUrl = new URL(request.url)
    return await proxyEventStream(`${remoteBaseUrl}/api/signage/device/stream?${requestUrl.searchParams.toString()}`)
  }

  const { searchParams } = new URL(request.url)
  const deviceId = String(searchParams.get("deviceId") || "").trim()
  const deviceToken = String(searchParams.get("deviceToken") || "").trim() || null
  const pairingCode = formatPairingCode(searchParams.get("pairingCode") || "")

  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required" }, { status: 400 })
  }

  const authResult = await query(
    `
    SELECT id
    FROM club_signage_devices
    WHERE device_id = $1
      AND (
        ($2::text IS NOT NULL AND device_token = $2)
        OR ($3::text <> '' AND pairing_code = $3)
      )
    LIMIT 1
    `,
    [deviceId, deviceToken, pairingCode]
  )

  if ((authResult.rowCount || 0) === 0) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 })
  }

  const dbDeviceId = String(authResult.rows[0].id)
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
            if (msg.payload === dbDeviceId) {
              sendEvent("update", { deviceId: dbDeviceId, ts: Date.now() })
            }
          }
          dbClient.on("notification", notificationHandler)
          await dbClient.query(`LISTEN ${SIGNAGE_DEVICE_UPDATES_CHANNEL}`)
          sendEvent("ready", { ok: true })
        } catch (error) {
          console.error("Signage stream setup error:", error)
          sendEvent("ready", { ok: false })
        }
      }

      void setupListener()
      pingTimer = setInterval(() => {
        sendEvent("ping", { ts: Date.now() })
      }, 15000)
    },
    async cancel() {
      closed = true
      if (pingTimer) clearInterval(pingTimer)
      if (dbClient) {
        if (notificationHandler) {
          dbClient.off("notification", notificationHandler)
        }
        await dbClient.query(`UNLISTEN ${SIGNAGE_DEVICE_UPDATES_CHANNEL}`)
        dbClient.release()
        dbClient = null
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
