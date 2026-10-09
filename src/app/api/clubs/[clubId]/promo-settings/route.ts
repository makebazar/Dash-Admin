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

    const clubIp = settings?.club_ip !== undefined ? (settings.club_ip || null) : (settings?.frag?.club_ip !== undefined ? (settings.frag.club_ip || null) : null);

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
      [JSON.stringify(settings), clubId, clubIp],
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
