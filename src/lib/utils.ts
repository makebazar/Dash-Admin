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
