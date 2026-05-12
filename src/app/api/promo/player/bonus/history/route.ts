import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await query(
      `SELECT h.id, h.result_data->>'amount' as amount, h.created_at, q.status
       FROM promo_history h
       LEFT JOIN promo_prize_queue q ON q.history_id = h.id
       WHERE h.player_id = $1 AND h.club_id = $2 AND h.game_type = 'WITHDRAW'
       ORDER BY h.created_at DESC`,
      [playerId, activeClubId],
    );

    return NextResponse.json({
      success: true,
      history: result.rows.map((row) => ({
        id: row.id,
        amount: parseFloat(row.amount),
        date: row.created_at,
        status: row.status || "pending", // Default to pending if not in queue yet
        statusLabel:
          row.status === "claimed"
            ? "Зачислено"
            : row.status === "canceled"
              ? "Отклонено"
              : "Ожидает",
      })),
    });
  } catch (error) {
    console.error("Bonus History Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
