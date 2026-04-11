export type SignageOrientation = "landscape" | "portrait"

export function normalizeSignageOrientation(value: unknown): SignageOrientation {
  return value === "portrait" ? "portrait" : "landscape"
}

export function normalizePairingCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
}

export function formatPairingCode(value: unknown) {
  const normalized = normalizePairingCode(value).replace(/[^A-Z0-9]/g, "")
  if (!normalized) return ""
  if (normalized.length <= 4) return normalized
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`
}

export function generateDeviceToken() {
  const bytes = new Uint8Array(24)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function resolveScreenLabel(
  displays: Array<{ id?: string; label?: string }> | undefined,
  selectedDisplayId: unknown
) {
  const targetId = selectedDisplayId ? String(selectedDisplayId) : null
  if (!targetId || !Array.isArray(displays)) return null

  const selected = displays.find((display) => String(display?.id || "") === targetId)
  const label = selected?.label?.trim()
  return label || null
}
