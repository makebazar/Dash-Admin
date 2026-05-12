import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const phone = searchParams.get("phone");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let whereClause = "";
    const params: any[] = [clubId];

    if (phone) {
      if (phone.length < 4) {
        return NextResponse.json({ players: [] });
      }
      whereClause = "AND p.phone_number LIKE $2";
      params.push(`%${phone}%`);
    }

    const result = await query(
      `SELECT
        p.id,
        p.phone_number,
        p.full_name,
        COALESCE(b.total_xp, 0) as total_xp,
        COALESCE(b.bonus_balance, 0) as bonus_balance,
        (SELECT COUNT(*)::int FROM promo_tickets t WHERE t.player_id = p.id AND t.club_id = $1 AND t.status = 'available' AND (t.expires_at IS NULL OR t.expires_at > NOW())) as tickets_count
       FROM promo_players p
       LEFT JOIN promo_player_balances b ON p.id = b.player_id AND b.club_id = $1
       WHERE 1=1 ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT 50`,
      params,
    );

    return NextResponse.json({ players: result.rows });
  } catch (error) {
    console.error("Fetch Players Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
