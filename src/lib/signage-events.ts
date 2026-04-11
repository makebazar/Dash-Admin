import { query } from "@/db"

const SIGNAGE_DEVICE_UPDATES_CHANNEL = "signage_device_updates"

export async function notifySignageDevice(deviceId: string | number) {
  await query(`SELECT pg_notify($1, $2)`, [
    SIGNAGE_DEVICE_UPDATES_CHANNEL,
    String(deviceId),
  ])
}

export { SIGNAGE_DEVICE_UPDATES_CHANNEL }
