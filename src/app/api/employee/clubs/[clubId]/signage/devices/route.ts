import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireEmployeeActiveShift } from "@/lib/employee-signage-access"
import { getSignageRuntimeColumns, getSignageRuntimeSelect, isActivePauseControl } from "@/lib/signage-runtime"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params
    await requireEmployeeActiveShift(clubId)

    const runtimeColumns = await getSignageRuntimeColumns()
    const result = await query(
      `
      SELECT
        id,
        name,
        orientation,
        screen_label,
        selected_display_id,
        last_seen_at,
        ${getSignageRuntimeSelect(runtimeColumns)},
        CASE
          WHEN last_seen_at IS NOT NULL AND last_seen_at > NOW() - INTERVAL '90 seconds' THEN TRUE
          ELSE FALSE
        END AS is_online
      FROM club_signage_devices
      WHERE club_id = $1
      ORDER BY COALESCE(last_seen_at, created_at) DESC, id DESC
      `,
      [clubId]
    )

    return NextResponse.json({
      devices: result.rows.map((device) => ({
        id: device.id,
        name: device.name || null,
        orientation: device.orientation === "portrait" ? "portrait" : "landscape",
        screenLabel: device.screen_label || null,
        selectedDisplayId: device.selected_display_id || null,
        isOnline: Boolean(device.is_online),
        currentSlideId: device.current_slide_id || null,
        isStopped: isActivePauseControl(device),
        stopUntil: isActivePauseControl(device) ? device.control_until || null : null,
      })),
    })
  } catch (error: any) {
    const status = error?.status
    if (status) {
      const message =
        status === 401
          ? "Unauthorized"
          : status === 409
            ? "Активная смена не найдена"
            : "Forbidden"
      return NextResponse.json({ error: message }, { status })
    }

    console.error("Get employee signage devices error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
