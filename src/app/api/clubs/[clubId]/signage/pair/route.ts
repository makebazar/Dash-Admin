import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"
import { notifySignageDevice } from "@/lib/signage-events"
import { formatPairingCode, generateDeviceToken } from "@/lib/signage"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params
    await requireClubFullAccess(clubId)

    const body = await request.json()
    const pairingCode = formatPairingCode(body?.pairingCode)
    const requestedName = String(body?.name || "").trim() || null

    if (!pairingCode) {
      return NextResponse.json({ error: "Укажите код привязки" }, { status: 400 })
    }

    const deviceResult = await query(
      `
      SELECT *
      FROM club_signage_devices
      WHERE pairing_code = $1
      LIMIT 1
      `,
      [pairingCode]
    )

    if ((deviceResult.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Устройство с таким кодом не найдено" }, { status: 404 })
    }

    const device = deviceResult.rows[0]

    if (device.club_id && String(device.club_id) !== String(clubId)) {
      return NextResponse.json(
        { error: "Это устройство уже привязано к другому клубу" },
        { status: 409 }
      )
    }

    const result = await query(
      `
      UPDATE club_signage_devices
      SET
        club_id = $2,
        device_token = COALESCE(device_token, $3),
        name = COALESCE($4, name, screen_label, 'Экран'),
        status = 'paired',
        paired_at = COALESCE(paired_at, NOW()),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [device.id, clubId, generateDeviceToken(), requestedName]
    )

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

    console.error("Pair signage device error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
