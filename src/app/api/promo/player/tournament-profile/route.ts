import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";
import { fetchFaceitStats } from "@/lib/faceit-service";
import { resolveSteamId64 } from "@/lib/steam-resolver";

export async function POST(request: Request) {
  const client = await getClient();
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;

    if (!playerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      nickname,
      avatarUrl,
      lftStatus,
      steamLink,
      faceitLink,
      syncFaceitNow,
      faceitElo,
      faceitLvl,
      faceitKd,
      faceitWinrate,
      faceitMatches,
    } = body;

    // Ensure columns exist in promo_players
    await client.query(`
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS lft_status VARCHAR(30) DEFAULT 'none';
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_elo INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_lvl INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_kd NUMERIC(5,2);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_winrate NUMERIC(5,2);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_matches INTEGER;
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_avatar TEXT;
    `);

    // Parse Faceit data if link provided or sync requested
    let faceitStats: any = null;
    if (faceitLink || syncFaceitNow) {
      const targetFaceit = faceitLink || "";
      if (targetFaceit) {
        faceitStats = await fetchFaceitStats(targetFaceit);
      }
    }

    // Parse SteamID64 accurately (handles profiles, vanity urls, SteamID2/3, raw ID64)
    let steamId: string | null = null;
    let resolvedSteamLink = steamLink;
    if (steamLink) {
      steamId = await resolveSteamId64(steamLink);
    }
    // Fallback to Faceit linked SteamID if user didn't provide direct steam link
    if (!steamId && faceitStats?.steamId64) {
      steamId = faceitStats.steamId64;
      if (!resolvedSteamLink) {
        resolvedSteamLink = `https://steamcommunity.com/profiles/${steamId}`;
      }
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let valIdx = 1;

    if (nickname !== undefined) {
      updates.push(`nickname = $${valIdx++}`);
      values.push(nickname ? nickname.trim() : null);
    }

    if (avatarUrl !== undefined) {
      updates.push(`avatar_url = $${valIdx++}`);
      values.push(avatarUrl);
    }

    if (lftStatus !== undefined) {
      const validStatus = ["lft", "in_team", "none"].includes(lftStatus) ? lftStatus : "none";
      updates.push(`lft_status = $${valIdx++}`);
      values.push(validStatus);
    }

    if (steamLink !== undefined) {
      updates.push(`steam_link = $${valIdx++}`);
      values.push(steamLink || null);
      updates.push(`steam_id = $${valIdx++}`);
      values.push(steamId);
    }

    if (faceitLink !== undefined) {
      updates.push(`faceit_link = $${valIdx++}`);
      values.push(faceitLink || null);
    }

    // Process Faceit Stats (automated or manual override)
    if (faceitStats) {
      if (faceitStats.level !== null && faceitStats.level !== undefined) {
        updates.push(`faceit_lvl = $${valIdx++}`);
        values.push(faceitStats.level);
      }
      if (faceitStats.elo !== null && faceitStats.elo !== undefined) {
        updates.push(`faceit_elo = $${valIdx++}`);
        values.push(faceitStats.elo);
      }
      if (faceitStats.kd !== null && faceitStats.kd !== undefined) {
        updates.push(`faceit_kd = $${valIdx++}`);
        values.push(faceitStats.kd);
      }
      if (faceitStats.winrate !== null && faceitStats.winrate !== undefined) {
        updates.push(`faceit_winrate = $${valIdx++}`);
        values.push(faceitStats.winrate);
      }
      if (faceitStats.matches !== null && faceitStats.matches !== undefined) {
        updates.push(`faceit_matches = $${valIdx++}`);
        values.push(faceitStats.matches);
      }
      if (faceitStats.avatar) {
        updates.push(`faceit_avatar = $${valIdx++}`);
        values.push(faceitStats.avatar);
      }
    } else {
      // Manual inputs if provided
      if (faceitElo !== undefined) {
        const parsedElo = faceitElo ? parseInt(String(faceitElo)) : null;
        updates.push(`faceit_elo = $${valIdx++}`);
        values.push(parsedElo);

        // Auto calculate level if not provided
        if (faceitLvl === undefined && parsedElo) {
          const autoLvl = parsedElo >= 2001 ? 10 : parsedElo >= 1751 ? 9 : parsedElo >= 1531 ? 8 : parsedElo >= 1351 ? 7 : parsedElo >= 1201 ? 6 : parsedElo >= 1051 ? 5 : parsedElo >= 901 ? 4 : parsedElo >= 751 ? 3 : parsedElo >= 501 ? 2 : 1;
          updates.push(`faceit_lvl = $${valIdx++}`);
          values.push(autoLvl);
        }
      }

      if (faceitLvl !== undefined) {
        const parsedLvl = faceitLvl ? parseInt(String(faceitLvl)) : null;
        updates.push(`faceit_lvl = $${valIdx++}`);
        values.push(parsedLvl);
      }

      if (faceitKd !== undefined) {
        const parsedKd = faceitKd ? parseFloat(String(faceitKd)) : null;
        updates.push(`faceit_kd = $${valIdx++}`);
        values.push(parsedKd);
      }

      if (faceitWinrate !== undefined) {
        const parsedWr = faceitWinrate ? parseFloat(String(faceitWinrate)) : null;
        updates.push(`faceit_winrate = $${valIdx++}`);
        values.push(parsedWr);
      }

      if (faceitMatches !== undefined) {
        const parsedMatches = faceitMatches ? parseInt(String(faceitMatches)) : null;
        updates.push(`faceit_matches = $${valIdx++}`);
        values.push(parsedMatches);
      }
    }

    if (updates.length > 0) {
      values.push(playerId);
      await client.query(
        `UPDATE promo_players SET ${updates.join(", ")} WHERE id = $${valIdx}`,
        values
      );
    }

    // Fetch updated record
    const result = await client.query(
      `SELECT id, full_name, nickname, avatar_url, lft_status, steam_link, steam_id, faceit_link,
              faceit_lvl, faceit_elo, faceit_kd, faceit_winrate, faceit_matches, faceit_avatar
       FROM promo_players
       WHERE id = $1`,
      [playerId]
    );

    return NextResponse.json({
      success: true,
      player: result.rows[0],
      faceitSynced: Boolean(faceitStats),
    });
  } catch (error: any) {
    console.error("Tournament Profile Update Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
