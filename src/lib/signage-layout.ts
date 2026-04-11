import { normalizeSignageOrientation, type SignageOrientation } from "@/lib/signage"

export type SignageTransition = "fade" | "slide" | "zoom"

export type SignageSlide = {
  id: string
  title: string
  imageUrl: string
  durationSec: number
  order: number
  startHour: number
  endHour: number
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
      .map(normalizeSignageSlide)
      .filter((slide): slide is SignageSlide => slide !== null)
      .sort((a, b) => a.order - b.order),
  }
}

export function normalizeSignageTransition(value: unknown): SignageTransition {
  return value === "slide" || value === "zoom" ? value : "fade"
}

export function normalizeSignageSlide(value: unknown): SignageSlide | null {
  if (!value || typeof value !== "object") return null

  const slide = value as Partial<SignageSlide>
  const imageUrl = typeof slide.imageUrl === "string" ? slide.imageUrl.trim() : ""
  if (!imageUrl) return null

  return {
    id: typeof slide.id === "string" && slide.id ? slide.id : createSlideId(),
    title: typeof slide.title === "string" ? slide.title : "Фото",
    imageUrl,
    durationSec: clampNumber(slide.durationSec, 3, 3600, 8),
    order: clampNumber(slide.order, 0, 999, 0),
    startHour: clampNumber(slide.startHour, 0, 23, 0),
    endHour: clampNumber(slide.endHour, 0, 23, 0),
    enabled: slide.enabled !== false,
  }
}

export function createSignageSlide(partial: Partial<SignageSlide> & { imageUrl: string }): SignageSlide {
  return normalizeSignageSlide({
    id: partial.id || createSlideId(),
    title: partial.title || "Фото",
    imageUrl: partial.imageUrl,
    durationSec: partial.durationSec ?? 8,
    order: partial.order ?? 0,
    startHour: partial.startHour ?? 0,
    endHour: partial.endHour ?? 0,
    enabled: partial.enabled ?? true,
  })!
}

export function getActiveSlides(layout: SignageLayout, atDate = new Date()) {
  const hour = atDate.getHours()
  const slides = Array.isArray(layout?.slides) ? layout.slides : []
  return slides
    .filter((slide) => slide.enabled && isHourInRange(hour, slide.startHour, slide.endHour))
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

function createSlideId() {
  return `slide_${Math.random().toString(36).slice(2, 10)}`
}
