import { NextResponse } from "next/server";
import { query, getClient } from "@/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameType = searchParams.get("gameType") || "wheel";
    const requestedLevel = searchParams.get("level"); // New: optional explicit level filter
    const cookieStore = await cookies();
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;
    const playerId = cookieStore.get("promo_player_id")?.value;

    if (!activeClubId) {
      return NextResponse.json({ error: "No club context" }, { status: 400 });
    }

    // 1. Fetch prizes for the game
    const prizesResult = await query(
      `SELECT id, name, type, value, probability, image_url, game_slug, win_condition, target_level
       FROM promo_prizes
       WHERE club_id = $1 AND is_active = TRUE
       AND game_slug = $2
       ORDER BY probability DESC`,
      [activeClubId, gameType],
    );

    let prizes = prizesResult.rows;

    // 2. Identify player level
    let playerLevel: number | null = null;
    if (playerId) {
      const client = await getClient();
      try {
        const playerResult = await client.query(
          `SELECT b.total_xp FROM promo_player_balances b
           WHERE b.player_id = $1 AND b.club_id = $2`,
          [playerId, activeClubId],
        );

        if (playerResult.rowCount && playerResult.rows[0].total_xp !== null) {
          const { getPlayerLevelInfo } = await import("@/lib/promo-quests");
          const totalXp = parseFloat(playerResult.rows[0].total_xp || 0);
          const levelInfo = await getPlayerLevelInfo(
            client,
            activeClubId,
            totalXp,
          );
          playerLevel = levelInfo.currentLevel;
        }
      } finally {
        client.release();
      }
    }

    // 3. Determine filtering level (requested > player level > null)
    const effectiveLevel = requestedLevel
      ? parseInt(requestedLevel)
      : playerLevel;

    // 4. Apply Filtering / Decoration
    if (effectiveLevel !== null) {
      prizes = prizes.map((p) => ({
        ...p,
        is_available: p.target_level === effectiveLevel,
        player_level: effectiveLevel,
      }));

      // If this is for a specific game instance (not just a sidebar list),
      // we might want to return ONLY the relevant level prizes
      if (searchParams.has("gameType")) {
        prizes = prizes.filter((p) => p.target_level === effectiveLevel);
      }
    }

    return NextResponse.json({
      success: true,
      prizes: prizes,
    });
  } catch (error) {
    console.error("Promo Prizes Fetch Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
