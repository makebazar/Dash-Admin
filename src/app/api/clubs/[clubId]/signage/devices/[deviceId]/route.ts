import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"
import { notifySignageDevice } from "@/lib/signage-events"
import { normalizeSignageOrientation } from "@/lib/signage"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clubId: string; deviceId: string }> }
) {
  try {
    const { clubId, deviceId } = await params
    await requireClubFullAccess(clubId)

    const body = await request.json()
    const name = typeof body?.name === "string" ? body.name.trim() : null
    const orientation =
      body?.orientation === undefined ? null : normalizeSignageOrientation(body.orientation)

    if (!name && !orientation) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 })
    }

    const result = await query(
      `
      UPDATE club_signage_devices
      SET
        name = COALESCE($3, name),
        orientation = COALESCE($4, orientation),
        updated_at = NOW()
      WHERE id = $1
        AND club_id = $2
      RETURNING *
      `,
      [deviceId, clubId, name, orientation]
    )

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Устройство не найдено" }, { status: 404 })
    }

    await notifySignageDevice(result.rows[0].id)

    return NextResponse.json({
      success: true,
      device: result.rows[0],
    })
  } catch (error: any) {
    const status = error?.status
    if (status) {
      return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status })
    }

    console.error("Rename signage device error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clubId: string; deviceId: string }> }
) {
  try {
    const { clubId, deviceId } = await params
    await requireClubFullAccess(clubId)

    const result = await query(
      `
      UPDATE club_signage_devices
      SET
        club_id = NULL,
        status = 'pending',
        paired_at = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND club_id = $2
      RETURNING *
      `,
      [deviceId, clubId]
    )

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Устройство не найдено" }, { status: 404 })
    }

    await notifySignageDevice(result.rows[0].id)

    return NextResponse.json({
      success: true,
      device: result.rows[0],
    })
  } catch (error: any) {
    const status = error?.status
    if (status) {
      return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status })
    }

    console.error("Unpair signage device error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
