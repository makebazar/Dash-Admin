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
