import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"
import { notifySignageDevice } from "@/lib/signage-events"
import { normalizeSignageLayout, createDefaultSignageLayout } from "@/lib/signage-layout"
import { normalizeSignageOrientation } from "@/lib/signage"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string; deviceId: string }> }
) {
  try {
    const { clubId, deviceId } = await params
    await requireClubFullAccess(clubId)

    const result = await query(
      `
      SELECT id, orientation, layout_json
      FROM club_signage_devices
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [deviceId, clubId]
    )

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Устройство не найдено" }, { status: 404 })
    }

    const device = result.rows[0]
    const orientation = normalizeSignageOrientation(device.orientation)
    const layout = normalizeSignageLayout(device.layout_json, orientation)

    return NextResponse.json({
      deviceId: device.id,
      orientation,
      layout,
    })
  } catch (error: any) {
    const status = error?.status
    if (status) {
      return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status })
    }

    console.error("Get signage layout error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clubId: string; deviceId: string }> }
) {
  try {
    const { clubId, deviceId } = await params
    await requireClubFullAccess(clubId)

    const body = await request.json()
    const requestedOrientation = normalizeSignageOrientation(body?.orientation)
    const nextLayout =
      body?.layout === null
        ? createDefaultSignageLayout(requestedOrientation)
        : normalizeSignageLayout(body?.layout, requestedOrientation)

    const result = await query(
      `
      UPDATE club_signage_devices
      SET
        orientation = $3,
        layout_json = $4::jsonb,
        updated_at = NOW()
      WHERE id = $1
        AND club_id = $2
      RETURNING id, orientation, layout_json
      `,
      [deviceId, clubId, requestedOrientation, JSON.stringify(nextLayout)]
    )

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Устройство не найдено" }, { status: 404 })
    }

    await notifySignageDevice(result.rows[0].id)

    return NextResponse.json({
      success: true,
      deviceId: result.rows[0].id,
      orientation: result.rows[0].orientation,
      layout: normalizeSignageLayout(result.rows[0].layout_json, requestedOrientation),
    })
  } catch (error: any) {
    const status = error?.status
    if (status) {
      return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status })
    }

    console.error("Update signage layout error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
