import { NextResponse } from "next/server"
import { query } from "@/db"
import {
  formatPairingCode,
  normalizePairingCode,
  normalizeSignageOrientation,
  resolveScreenLabel,
} from "@/lib/signage"
import { normalizeSignageLayout } from "@/lib/signage-layout"
import { getSignageRemoteBaseUrl, proxyJsonRequest } from "@/lib/signage-server-url"
import { isActivePauseControl, normalizeSignageControlAction } from "@/lib/signage-runtime"

type DisplaySnapshot = {
  id?: string
  label?: string
  bounds?: {
    x?: number
    y?: number
    width?: number
    height?: number
  }
  scaleFactor?: number
  rotation?: number
  primary?: boolean
}

export async function POST(request: Request) {
  try {
    const remoteBaseUrl = getSignageRemoteBaseUrl(request)
    if (remoteBaseUrl) {
      return await proxyJsonRequest(request, `${remoteBaseUrl}/api/signage/device/bootstrap`)
    }

    const body = await request.json()

    const deviceId = String(body?.deviceId || "").trim()
    const deviceToken = String(body?.deviceToken || "").trim() || null
    const requestedOrientation = normalizeSignageOrientation(body?.orientation)
    const pairingCode = formatPairingCode(body?.pairingCode)
    const selectedDisplayId = body?.selectedDisplayId ? String(body.selectedDisplayId) : null
    const displays = Array.isArray(body?.displays) ? (body.displays as DisplaySnapshot[]) : []
    const screenLabel = resolveScreenLabel(displays, selectedDisplayId)

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 })
    }

    if (!normalizePairingCode(pairingCode)) {
      return NextResponse.json({ error: "pairingCode is required" }, { status: 400 })
    }

    const existingResult = await query(
      `
      SELECT
        d.*,
        c.name AS club_name
      FROM club_signage_devices d
      LEFT JOIN clubs c ON c.id = d.club_id
      WHERE (($1::text IS NOT NULL AND d.device_token = $1) OR d.device_id = $2)
      ORDER BY
        CASE WHEN $1::text IS NOT NULL AND d.device_token = $1 THEN 0 ELSE 1 END,
        d.id DESC
      LIMIT 1
      `,
      [deviceToken, deviceId]
    )

    let result

    if ((existingResult.rowCount || 0) === 0) {
      result = await query(
        `
        INSERT INTO club_signage_devices (
          device_id,
          device_token,
          pairing_code,
          orientation,
          selected_display_id,
          screen_label,
          display_info,
          status,
          last_seen_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending', NOW(), NOW())
        RETURNING *
        `,
        [
          deviceId,
          deviceToken,
          pairingCode,
          requestedOrientation,
          selectedDisplayId,
          screenLabel,
          JSON.stringify(displays),
        ]
      )
    } else {
      const existing = existingResult.rows[0]
      const nextStatus = existing.club_id ? "paired" : "pending"
      const resolvedOrientation = existing.club_id
        ? normalizeSignageOrientation(existing.orientation)
        : requestedOrientation

      result = await query(
        `
        UPDATE club_signage_devices
        SET
          device_id = $2,
          pairing_code = $3,
          orientation = $4,
          selected_display_id = $5,
          screen_label = $6,
          display_info = $7::jsonb,
          status = $8,
          last_seen_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [
          existing.id,
          deviceId,
          pairingCode,
          resolvedOrientation,
          selectedDisplayId,
          screenLabel,
          JSON.stringify(displays),
          nextStatus,
        ]
      )
    }

    const device = result.rows[0]
    const clubResult = device.club_id
      ? await query(`SELECT id, name FROM clubs WHERE id = $1 LIMIT 1`, [device.club_id])
      : { rows: [] as Array<{ id: number; name: string }> }

    const club = clubResult.rows[0] || null
    const activePause = isActivePauseControl(device)

    return NextResponse.json({
      device: {
        id: device.id,
        deviceId: device.device_id,
        deviceToken: device.device_token || null,
        pairingCode: device.pairing_code,
        name: device.name || null,
        status: device.status,
        orientation: device.orientation,
        selectedDisplayId: device.selected_display_id || null,
        screenLabel: device.screen_label || null,
        paired: Boolean(device.club_id),
        clubId: device.club_id || null,
        clubName: club?.name || null,
        layoutJson: normalizeSignageLayout(device.layout_json, device.orientation),
        currentSlideId: device.current_slide_id || null,
        controlAction: normalizeSignageControlAction(device.control_action),
        controlSlideId: device.control_slide_id || null,
        controlUntil: activePause ? device.control_until || null : null,
        controlUpdatedAt: device.control_updated_at || null,
        serverUpdatedAt: device.updated_at || null,
      },
    })
  } catch (error) {
    console.error("Signage bootstrap error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
