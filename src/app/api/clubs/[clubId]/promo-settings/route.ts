import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireModuleAccess } from "@/lib/club-api-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "dashboard", "view");

    const { settings } = await request.json();

    const rawIps: string[] = Array.isArray(settings?.club_ips)
      ? settings.club_ips
      : Array.isArray(settings?.frag?.club_ips)
        ? settings.frag.club_ips
        : String(settings?.club_ip ?? settings?.frag?.club_ip ?? "").split(/[,;\s]+/);
    const cleanedIps = rawIps.map((ip) => String(ip).trim()).filter(Boolean);
    const primaryClubIp = cleanedIps[0] ? cleanedIps[0].slice(0, 45) : null;

    await query(
      `UPDATE clubs SET
                promo_settings = $1,
                ip_address = $3,
                bp_settings = jsonb_build_object(
                    'is_enabled', COALESCE(($1::jsonb->>'bp_enabled')::boolean, false),
                    'bp_price', COALESCE(($1::jsonb->>'bp_price')::numeric::integer, 1000),
                    'xp_per_ruble', COALESCE(($1::jsonb->>'bp_xp_per_rub')::numeric::integer, 1)
                )
             WHERE id = $2`,
      [JSON.stringify(settings), clubId, primaryClubIp],
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error?.status;
    if (status) {
      return NextResponse.json(
        { error: status === 401 ? "Unauthorized" : "Forbidden" },
        { status },
      );
    }
    console.error("Update Promo Settings Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
