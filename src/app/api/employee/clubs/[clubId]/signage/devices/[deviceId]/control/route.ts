import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireEmployeeActiveShift } from "@/lib/employee-signage-access"
import { getActiveSlides, normalizeSignageLayout } from "@/lib/signage-layout"
import {
  getSignageRuntimeColumns,
  getSignageRuntimeSelect,
  isActivePauseControl,
} from "@/lib/signage-runtime"
import { notifySignageDevice } from "@/lib/signage-events"

type ControlAction = "next" | "prev" | "stop"

function formatDevicePayload(device: any, slides: any[], overrideCurrentSlideId?: string | null) {
  const activePause = isActivePauseControl(device)
  const currentSlideId =
    overrideCurrentSlideId ??
    (activePause
      ? device.control_slide_id || null
      : device.current_slide_id || slides[0]?.id || null)

  return {
    id: device.id,
    name: device.name || null,
    orientation: device.orientation === "portrait" ? "portrait" : "landscape",
    screenLabel: device.screen_label || null,
    selectedDisplayId: device.selected_display_id || null,
    isOnline: Boolean(device.is_online),
    currentSlideId,
    isStopped: activePause,
    stopUntil: activePause ? device.control_until || null : null,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string; deviceId: string }> }
) {
  try {
    const { clubId, deviceId } = await params
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
        layout_json,
        ${getSignageRuntimeSelect(runtimeColumns)},
        CASE
          WHEN last_seen_at IS NOT NULL AND last_seen_at > NOW() - INTERVAL '90 seconds' THEN TRUE
          ELSE FALSE
        END AS is_online
      FROM club_signage_devices
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [deviceId, clubId]
    )

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Экран не найден" }, { status: 404 })
    }

    const device = result.rows[0]
    const layout = normalizeSignageLayout(device.layout_json, device.orientation)
    const slides = getActiveSlides(layout)

    return NextResponse.json({
      device: formatDevicePayload(device, slides),
      slides: slides.map((slide) => ({
        id: slide.id,
        title: slide.title,
        imageUrl: slide.imageUrl,
        mediaType: slide.mediaType,
        durationSec: slide.durationSec,
        order: slide.order,
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

    console.error("Get employee signage control error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string; deviceId: string }> }
) {
  try {
    const { clubId, deviceId } = await params
    await requireEmployeeActiveShift(clubId)

    const body = await request.json().catch(() => ({}))
    const action = body?.action as ControlAction
    const requestedCurrentSlideId =
      typeof body?.currentSlideId === "string" && body.currentSlideId.trim()
        ? body.currentSlideId.trim()
        : null
    if (action !== "next" && action !== "prev" && action !== "stop") {
      return NextResponse.json({ error: "Некорректное действие" }, { status: 400 })
    }

    const runtimeColumns = await getSignageRuntimeColumns()
    if (
      !runtimeColumns.hasCurrentSlideId ||
      !runtimeColumns.hasControlAction ||
      !runtimeColumns.hasControlSlideId ||
      !runtimeColumns.hasControlUntil ||
      !runtimeColumns.hasControlUpdatedAt
    ) {
      return NextResponse.json(
        { error: "Миграция signage runtime не применена" },
        { status: 503 }
      )
    }

    const result = await query(
      `
      SELECT
        id,
        name,
        orientation,
        screen_label,
        selected_display_id,
        layout_json,
        ${getSignageRuntimeSelect(runtimeColumns)},
        CASE
          WHEN last_seen_at IS NOT NULL AND last_seen_at > NOW() - INTERVAL '90 seconds' THEN TRUE
          ELSE FALSE
        END AS is_online
      FROM club_signage_devices
      WHERE id = $1
        AND club_id = $2
      LIMIT 1
      `,
      [deviceId, clubId]
    )

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Экран не найден" }, { status: 404 })
    }

    const device = result.rows[0]
    const layout = normalizeSignageLayout(device.layout_json, device.orientation)
    const slides = getActiveSlides(layout)
    if (slides.length === 0) {
      return NextResponse.json({ error: "Нет активных слайдов" }, { status: 400 })
    }

    const activePause = isActivePauseControl(device)
    const requestedCurrentIndex = requestedCurrentSlideId
      ? slides.findIndex((slide) => slide.id === requestedCurrentSlideId)
      : -1
    const fallbackSlideId = activePause
      ? device.control_slide_id || null
      : requestedCurrentSlideId || device.current_slide_id || null
    const currentIndex = Math.max(
      0,
      requestedCurrentIndex >= 0
        ? requestedCurrentIndex
        : slides.findIndex((slide) => slide.id === fallbackSlideId)
    )

    const targetIndex =
      action === "next"
        ? (currentIndex + 1) % slides.length
        : action === "prev"
          ? (currentIndex - 1 + slides.length) % slides.length
          : currentIndex

    const targetSlide = slides[targetIndex]
    const updateResult = await query(
      `
      UPDATE club_signage_devices
      SET
        current_slide_id = $4,
        control_action = $3::varchar,
        control_slide_id = $4,
        control_until = CASE
          WHEN $3::varchar = 'pause' THEN NOW() + INTERVAL '2 minutes'
          ELSE NULL
        END,
        control_updated_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND club_id = $2
      RETURNING
        id,
        name,
        orientation,
        screen_label,
        selected_display_id,
        current_slide_id,
        control_action,
        control_slide_id,
        control_until,
        control_updated_at
      `,
      [deviceId, clubId, action === "stop" ? "pause" : "jump", targetSlide.id]
    )

    await notifySignageDevice(deviceId)

    return NextResponse.json({
      success: true,
      device: formatDevicePayload(
        {
          ...device,
          ...updateResult.rows[0],
          is_online: device.is_online,
        },
        slides,
        targetSlide.id
      ),
      slides: slides.map((slide) => ({
        id: slide.id,
        title: slide.title,
        imageUrl: slide.imageUrl,
        mediaType: slide.mediaType,
        durationSec: slide.durationSec,
        order: slide.order,
      })),
    })
  } catch (error: any) {
    const status = error?.status
    if (status) {
      const message =
        status === 401
          ? "Unauthorized"
          : status === 409
            ? "Управление доступно только во время активной смены"
            : "Forbidden"
      return NextResponse.json({ error: message }, { status })
    }

    console.error("Update employee signage control error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
