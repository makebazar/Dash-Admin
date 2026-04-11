import { NextResponse } from "next/server"
import { query } from "@/db"
import { getSignageRemoteBaseUrl, proxyJsonRequest } from "@/lib/signage-server-url"

export async function POST(request: Request) {
  try {
    const remoteBaseUrl = getSignageRemoteBaseUrl(request)
    if (remoteBaseUrl) {
      return proxyJsonRequest(request, `${remoteBaseUrl}/api/signage/device/heartbeat`)
    }

    const body = await request.json()
    const deviceId = String(body?.deviceId || "").trim()
    const deviceToken = String(body?.deviceToken || "").trim() || null

    if (!deviceId && !deviceToken) {
      return NextResponse.json({ error: "deviceId or deviceToken is required" }, { status: 400 })
    }

    const result = await query(
      `
      UPDATE club_signage_devices
      SET
        last_seen_at = NOW(),
        status = CASE WHEN club_id IS NULL THEN 'pending' ELSE 'paired' END,
        updated_at = NOW()
      WHERE ($1::text IS NOT NULL AND device_token = $1)
         OR ($2::text IS NOT NULL AND device_id = $2)
      RETURNING id, club_id, status, last_seen_at
      `,
      [deviceToken, deviceId || null]
    )

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      device: result.rows[0],
    })
  } catch (error) {
    console.error("Signage heartbeat error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
