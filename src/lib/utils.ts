import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const LAUNDRY_EQUIPMENT_TYPES = new Set(["MOUSEPAD"])

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isLaundryEquipmentType(type?: string | null) {
  return Boolean(type && LAUNDRY_EQUIPMENT_TYPES.has(type))
}

export function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatDateKeyInTimezone(value: Date | string, timeZone: string) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = value instanceof Date ? value : new Date(value)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find(part => part.type === "year")?.value || "0000"
  const month = parts.find(part => part.type === "month")?.value || "01"
  const day = parts.find(part => part.type === "day")?.value || "01"

  return `${year}-${month}-${day}`
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year || 0, (month || 1) - 1, day || 1, 12, 0, 0, 0)
}

export function getDatePartsInTimezone(value: Date | string, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  return {
    year: Number(parts.find(part => part.type === "year")?.value || 0),
    month: Number(parts.find(part => part.type === "month")?.value || 1),
    day: Number(parts.find(part => part.type === "day")?.value || 1),
  }
}

export function getMonthRangeInTimezone(value: Date | string, timeZone: string) {
  const { year, month } = getDatePartsInTimezone(value, timeZone)
  const lastDay = new Date(year, month, 0).getDate()
  const monthStr = String(month).padStart(2, "0")

  return {
    year,
    month,
    firstDay: `${year}-${monthStr}-01`,
    lastDay: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  }
}

const CLIENT_COMPRESSIBLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

type UploadImageOptions = {
  maxDimension?: number
  quality?: number
}

export async function optimizeFileBeforeUpload(
  file: File,
  options: UploadImageOptions = {}
): Promise<File> {
  const maxDimension = options.maxDimension ?? 1600
  const quality = options.quality ?? 0.82

  if (typeof window === "undefined") return file
  if (!CLIENT_COMPRESSIBLE_IMAGE_TYPES.has(file.type)) return file

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = objectUrl
    })

    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (!width || !height) return file

    const ratio = Math.min(1, maxDimension / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * ratio))
    const targetHeight = Math.max(1, Math.round(height * ratio))
    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight

    const context = canvas.getContext("2d", { alpha: true })
    if (!context) return file

    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    const prefersWebP = file.type === "image/png" || file.type === "image/webp"
    const outputType = prefersWebP ? "image/webp" : "image/jpeg"
    const extension = prefersWebP ? "webp" : "jpg"

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, quality)
    })

    if (!blob) return file
    if (ratio === 1 && blob.size >= file.size) return file

    const optimizedName = file.name.replace(/\.[^/.]+$/, "") + `.${extension}`
    return new File([blob], optimizedName, {
      type: outputType,
      lastModified: Date.now(),
    })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
