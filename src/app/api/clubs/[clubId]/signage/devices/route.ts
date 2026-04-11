import { NextResponse } from "next/server"
import { query } from "@/db"
import { requireClubFullAccess } from "@/lib/club-api-access"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params
    await requireClubFullAccess(clubId)

    const result = await query(
      `
      SELECT
        id,
        club_id,
        device_id,
        pairing_code,
        name,
        status,
        orientation,
        selected_display_id,
        screen_label,
        display_info,
        last_seen_at,
        paired_at,
        created_at,
        updated_at,
        CASE
          WHEN last_seen_at IS NOT NULL AND last_seen_at > NOW() - INTERVAL '90 seconds' THEN TRUE
          ELSE FALSE
        END AS is_online
      FROM club_signage_devices
      WHERE club_id = $1
      ORDER BY COALESCE(last_seen_at, created_at) DESC, id DESC
      `,
      [clubId]
    )

    return NextResponse.json({ devices: result.rows })
  } catch (error: any) {
    const status = error?.status
    if (status) {
      return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status })
    }

    console.error("Get club signage devices error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
