"use server";

import { getClient } from "@/db";
import { cookies } from "next/headers";

import { resolveSteamId64 } from "@/lib/steam-resolver";

export async function updatePlayerLinks(formData: FormData) {
  const cookieStore = await cookies();
  const playerId = cookieStore.get("promo_player_id")?.value;

  if (!playerId) {
    return { error: "Unauthorized" };
  }

  let steamLink = formData.get("steam_link")?.toString() || "";
  let faceitLink = formData.get("faceit_link")?.toString() || "";

  let steamId = await resolveSteamId64(steamLink);

  const client = await getClient();
  try {
    await client.query(`
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_rank_tier INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_rank_name VARCHAR(100);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_leaderboard_rank INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_mmr INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_winrate NUMERIC(5,2);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_matches INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS dota_stats JSONB;
    `);

    let dotaStats: any = null;
    if (steamId) {
      const { fetchDotaStats } = await import("@/lib/dota-service");
      dotaStats = await fetchDotaStats(steamId);
    }

    if (dotaStats) {
      await client.query(
        `UPDATE promo_players 
         SET steam_link = $1, steam_id = $2, faceit_link = $3,
             dota_rank_tier = $5, dota_rank_name = $6, dota_leaderboard_rank = $7,
             dota_mmr = $8, dota_winrate = $9, dota_matches = $10, dota_stats = $11
         WHERE id = $4`,
        [
          steamLink,
          steamId,
          faceitLink,
          playerId,
          dotaStats.rankTier,
          dotaStats.rank?.nameRu || dotaStats.rank?.name || null,
          dotaStats.rank?.leaderboardRank || null,
          dotaStats.mmr,
          dotaStats.winrate,
          dotaStats.matches,
          JSON.stringify(dotaStats),
        ]
      );
    } else {
      await client.query(
        `UPDATE promo_players SET steam_link = $1, steam_id = $2, faceit_link = $3 WHERE id = $4`,
        [steamLink, steamId, faceitLink, playerId]
      );
    }

    return { success: true, steam_id: steamId, dotaSynced: Boolean(dotaStats) };
  } catch (e: any) {
    return { error: e.message };
  } finally {
    client.release();
  }
}
