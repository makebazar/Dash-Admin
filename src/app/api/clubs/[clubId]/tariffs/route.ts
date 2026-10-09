import { NextResponse } from "next/server";
import { getSmartShellClientForClub } from "@/lib/smartshell/shift-sync";
import { query } from "@/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    const clubIdInt = parseInt(clubId, 10);
    if (isNaN(clubIdInt)) {
      return NextResponse.json({ error: "Invalid club ID" }, { status: 400 });
    }

    const tariffs: Array<{ id: string | number; name: string; duration?: number; source?: string }> = [];
    let zones: Array<{ id: string | number; title: string }> = [];

    // 1. Fetch from SmartShell
    const ssClient = await getSmartShellClientForClub(clubIdInt);
    if (ssClient) {
      const [ssTariffs, ssHostGroups] = await Promise.all([
        ssClient.getTariffs(),
        ssClient.getHostGroups(),
      ]);

      for (const t of ssTariffs) {
        if (t.is_active !== false) {
          tariffs.push({
            id: String(t.id),
            name: t.title,
            duration: t.duration,
            source: "smartshell",
          });
        }
      }

      zones = ssHostGroups.map((g) => ({
        id: String(g.id),
        title: g.title,
      }));
    }

    // 2. Fetch custom service_rules from promo_settings
    const clubRes = await query(`SELECT promo_settings FROM clubs WHERE id = $1`, [clubIdInt]);
    const promoSettings = clubRes.rows[0]?.promo_settings || {};
    if (Array.isArray(promoSettings.service_rules)) {
      for (const r of promoSettings.service_rules) {
        if (r.id && r.name && !tariffs.some(t => String(t.id) === String(r.id))) {
          tariffs.push({
            id: String(r.id),
            name: r.name,
            source: "custom",
          });
        }
      }
    }

    return NextResponse.json({ tariffs, zones });
  } catch (err: any) {
    console.error("[GET /api/clubs/[clubId]/tariffs error]:", err);
    return NextResponse.json({ error: "Failed to fetch tariffs" }, { status: 500 });
  }
}
