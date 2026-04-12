import { normalizeSignageOrientation, type SignageOrientation } from "@/lib/signage"

export type SignageTransition = "none" | "fade" | "slide" | "zoom"
export type SignageMediaType = "image" | "video"

export type SignageSlide = {
  id: string
  title: string
  imageUrl: string
  mediaType: SignageMediaType
  transition: SignageTransition
  durationSec: number
  order: number
  startHour: number
  endHour: number
  weekdays: number[]
  enabled: boolean
}

export type SignageLayout = {
  version: 2
  mode: "slideshow"
  background: string
  transition: SignageTransition
  slides: SignageSlide[]
}

export function createDefaultSignageLayout(
  orientation: SignageOrientation = "landscape"
): SignageLayout {
  normalizeSignageOrientation(orientation)

  return {
    version: 2,
    mode: "slideshow",
    background: "#050816",
    transition: "fade",
    slides: [],
  }
}

export function normalizeSignageLayout(
  value: unknown,
  orientation: SignageOrientation = "landscape"
): SignageLayout {
  const fallback = createDefaultSignageLayout(orientation)

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

export function normalizeSignageTransition(value: unknown): SignageTransition {
  return value === "none" || value === "slide" || value === "zoom" ? value : "fade"
}

export function normalizeSignageSlide(
  value: unknown,
  fallbackTransition: SignageTransition = "fade"
): SignageSlide | null {
  if (!value || typeof value !== "object") return null

  const slide = value as Partial<SignageSlide>
  const imageUrl = typeof slide.imageUrl === "string" ? slide.imageUrl.trim() : ""
  if (!imageUrl) return null

  return {
    id: typeof slide.id === "string" && slide.id ? slide.id : createSlideId(),
    title: typeof slide.title === "string" ? slide.title : "Фото",
    imageUrl,
    mediaType: normalizeSignageMediaType(slide.mediaType, imageUrl),
    transition: normalizeSignageTransition(slide.transition ?? fallbackTransition),
    durationSec: typeof slide.durationSec === "number" ? Math.min(3600, Math.max(0, Math.round(slide.durationSec))) : 8,
    order: clampNumber(slide.order, 0, 999, 0),
    startHour: typeof slide.startHour === "number" ? Math.min(23, Math.max(0, Math.round(slide.startHour))) : 0,
    endHour: typeof slide.endHour === "number" ? Math.min(23, Math.max(0, Math.round(slide.endHour))) : 0,
    weekdays: normalizeSignageWeekdays(slide.weekdays),
    enabled: slide.enabled !== false,
  }
}

export function createSignageSlide(partial: Partial<SignageSlide> & { imageUrl: string }): SignageSlide {
  return normalizeSignageSlide({
    id: partial.id || createSlideId(),
    title: partial.title !== undefined ? partial.title : "Медиа",
    imageUrl: partial.imageUrl,
    mediaType: partial.mediaType,
    transition: partial.transition,
    durationSec: partial.durationSec ?? 8,
    order: partial.order ?? 0,
    startHour: partial.startHour ?? 0,
    endHour: partial.endHour ?? 0,
    weekdays: partial.weekdays ?? DEFAULT_SIGNAGE_WEEKDAYS,
    enabled: partial.enabled ?? true,
  })!
}

export function getActiveSlides(layout: SignageLayout, atDate = new Date()) {
  const hour = atDate.getHours()
  const weekday = atDate.getDay()
  const slides = Array.isArray(layout?.slides) ? layout.slides : []
  return slides
    .filter(
      (slide) =>
        slide.enabled &&
        isHourInRange(hour, slide.startHour, slide.endHour) &&
        isWeekdayAllowed(weekday, slide.weekdays)
    )
    .sort((a, b) => a.order - b.order)
}

export function isHourInRange(hour: number, startHour: number, endHour: number) {
  if (startHour === endHour) return true
  if (startHour < endHour) return hour >= startHour && hour < endHour
  return hour >= startHour || hour < endHour
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.round(numeric)))
}

const DEFAULT_SIGNAGE_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

export function normalizeSignageWeekdays(value: unknown) {
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

export function isWeekdayAllowed(weekday: number, allowedWeekdays: number[]) {
  return normalizeSignageWeekdays(allowedWeekdays).includes(weekday)
}

function createSlideId() {
  return `slide_${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeSignageMediaType(value: unknown, imageUrl = ""): SignageMediaType {
  if (value === "video" || value === "image") return value
  return inferSignageMediaTypeFromUrl(imageUrl)
}

export function inferSignageMediaTypeFromUrl(imageUrl: string): SignageMediaType {
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
