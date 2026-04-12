import { NextResponse } from "next/server"
import { query } from "@/db"
import { getSignageRuntimeColumns } from "@/lib/signage-runtime"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const deviceId = String(body?.deviceId || "").trim()
    const deviceToken = String(body?.deviceToken || "").trim() || null
    const currentSlideId = String(body?.currentSlideId || "").trim() || null

    if (!deviceId || !deviceToken) {
      return NextResponse.json({ error: "deviceId and deviceToken are required" }, { status: 400 })
    }

    const runtimeColumns = await getSignageRuntimeColumns()
    if (!runtimeColumns.hasCurrentSlideId) {
      return NextResponse.json({ success: true })
    }

    const updateClauses = ["current_slide_id = $3"]
    if (runtimeColumns.hasControlAction) {
      updateClauses.push("control_action = CASE WHEN control_action = 'jump' THEN NULL ELSE control_action END")
    }
    if (runtimeColumns.hasControlAction && runtimeColumns.hasControlSlideId) {
      updateClauses.push("control_slide_id = CASE WHEN control_action = 'jump' THEN NULL ELSE control_slide_id END")
    }
    if (runtimeColumns.hasControlAction && runtimeColumns.hasControlUntil) {
      updateClauses.push("control_until = CASE WHEN control_action = 'jump' THEN NULL ELSE control_until END")
    }
    if (runtimeColumns.hasControlAction && runtimeColumns.hasControlUpdatedAt) {
      updateClauses.push("control_updated_at = CASE WHEN control_action = 'jump' THEN NULL ELSE control_updated_at END")
    }

    const result = await query(
      `
      UPDATE club_signage_devices
      SET ${updateClauses.join(",\n        ")}
      WHERE device_id = $1
        AND device_token = $2
      RETURNING id
      `,
      [deviceId, deviceToken, currentSlideId]
    )

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update current signage slide error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
