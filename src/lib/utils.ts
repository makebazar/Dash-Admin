import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const LAUNDRY_EQUIPMENT_TYPES = new Set(["MOUSEPAD"])

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isLaundryEquipmentType(type?: string | null) {
  return Boolean(type && LAUNDRY_EQUIPMENT_TYPES.has(type))
}
