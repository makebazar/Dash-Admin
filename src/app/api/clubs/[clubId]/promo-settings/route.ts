import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const { settings } = await request.json();
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await query(
      `UPDATE clubs SET
                promo_settings = $1,
                bp_settings = jsonb_build_object(
                    'is_enabled', COALESCE(($1->>'bp_enabled')::boolean, false),
                    'bp_price', COALESCE(($1->>'bp_price')::integer, 1000),
                    'xp_per_ruble', COALESCE(($1->>'bp_xp_per_rub')::integer, 1)
                )
             WHERE id = $2`,
      [JSON.stringify(settings), clubId],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update Promo Settings Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
