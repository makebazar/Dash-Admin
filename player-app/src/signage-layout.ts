import type { SignageLayout, SignageMediaType, SignageSlide, SignageTransition } from "./types"

export function createDefaultSignageLayout(): SignageLayout {
  return {
    version: 2,
    mode: "slideshow",
    background: "#050816",
    transition: "fade",
    slides: [],
  }
}

export function normalizeSignageTransition(value: unknown): SignageTransition {
  return value === "none" || value === "slide" || value === "zoom" ? value : "fade"
}

export function normalizeSignageLayout(value: unknown): SignageLayout {
  const fallback = createDefaultSignageLayout()

  if (!value || typeof value !== "object") {
    return fallback
  }

  const layout = value as Partial<SignageLayout>
  const rawSlides = Array.isArray(layout.slides) ? layout.slides : []

  return {
    version: 2,
    mode: "slideshow",
    background:
      typeof layout.background === "string" && layout.background
        ? layout.background
        : fallback.background,
    transition: normalizeSignageTransition(layout.transition),
    slides: rawSlides
      .map((slide) => normalizeSignageSlide(slide, normalizeSignageTransition(layout.transition)))
      .filter((slide): slide is SignageSlide => slide !== null)
      .sort((a, b) => a.order - b.order),
  }
}

export function getActiveSlides(layout: SignageLayout, atDate = new Date()) {
  const minutesInDay = atDate.getHours() * 60 + atDate.getMinutes()
  const weekday = atDate.getDay()
  const slides = Array.isArray(layout?.slides) ? layout.slides : []
  return slides
    .filter(
      (slide) =>
        slide.enabled &&
        isTimeInRange(minutesInDay, slide.startHour, slide.startMinute, slide.endHour, slide.endMinute) &&
        isWeekdayAllowed(weekday, slide.weekdays)
    )
    .sort((a, b) => a.order - b.order)
}

function normalizeSignageSlide(
  value: unknown,
  fallbackTransition: SignageTransition = "fade"
): SignageSlide | null {
  if (!value || typeof value !== "object") return null

  const slide = value as Partial<SignageSlide>
  const imageUrl = typeof slide.imageUrl === "string" ? slide.imageUrl.trim() : ""
  if (!imageUrl) return null

  return {
    id: typeof slide.id === "string" && slide.id ? slide.id : `slide_${Math.random().toString(36).slice(2, 10)}`,
    title: typeof slide.title === "string" ? slide.title : "Медиа",
    imageUrl,
    mediaType: normalizeSignageMediaType(slide.mediaType, imageUrl),
    transition: normalizeSignageTransition(slide.transition ?? fallbackTransition),
    durationSec: clampNumber(slide.durationSec, 3, 3600, 8),
    order: clampNumber(slide.order, 0, 999, 0),
    startHour: clampNumber(slide.startHour, 0, 23, 0),
    endHour: clampNumber(slide.endHour, 0, 23, 0),
    startMinute: clampNumber(slide.startMinute, 0, 59, 0),
    endMinute: clampNumber(slide.endMinute, 0, 59, 0),
    weekdays: normalizeSignageWeekdays(slide.weekdays),
    enabled: slide.enabled !== false,
  }
}

function isTimeInRange(
  minutesInDay: number,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number
) {
  const startTotal = startHour * 60 + startMinute
  const endTotal = endHour * 60 + endMinute

  if (startTotal === endTotal) return true
  if (startTotal < endTotal) return minutesInDay >= startTotal && minutesInDay < endTotal
  return minutesInDay >= startTotal || minutesInDay < endTotal
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.round(numeric)))
}

const DEFAULT_SIGNAGE_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

function normalizeSignageWeekdays(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_SIGNAGE_WEEKDAYS

  const normalized = Array.from(
    new Set(
      value
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        .sort((a, b) => a - b)
    )
  )

  return normalized.length > 0 ? normalized : DEFAULT_SIGNAGE_WEEKDAYS
}

function isWeekdayAllowed(weekday: number, allowedWeekdays: number[]) {
  return normalizeSignageWeekdays(allowedWeekdays).includes(weekday)
}

function normalizeSignageMediaType(value: unknown, imageUrl = ""): SignageMediaType {
  if (value === "video" || value === "image") return value
  return inferSignageMediaTypeFromUrl(imageUrl)
}

function inferSignageMediaTypeFromUrl(imageUrl: string): SignageMediaType {
  try {
    const parsed = new URL(imageUrl, "https://dashadmin.local")
    const pathname = parsed.pathname.toLowerCase()
    if (/\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(pathname)) {
      return "video"
    }
  } catch {
    if (/\.(mp4|webm|mov|m4v|ogg|ogv)(\?.*)?$/i.test(imageUrl.toLowerCase())) {
      return "video"
    }
  }

  return "image"
}
