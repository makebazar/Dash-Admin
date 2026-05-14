import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameType = searchParams.get("gameType");
    const cookieStore = await cookies();
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!activeClubId) {
      return NextResponse.json({ error: "No club context" }, { status: 400 });
    }

    const prizesResult = await query(
      `SELECT id, name, type, value, probability, image_url, game_slug, win_condition
       FROM promo_prizes
       WHERE club_id = $1 AND is_active = TRUE
       AND game_slug = $2
       ORDER BY probability DESC`,
      [activeClubId, gameType || "wheel"],
    );
    return NextResponse.json({
      success: true,
      prizes: prizesResult.rows,
    });
  } catch (error) {
    console.error("Promo Prizes Fetch Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
