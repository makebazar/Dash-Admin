import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";
import { isOfficialCompetitiveMap } from "@/lib/promo-frag-utils";

export const dynamic = "force-dynamic";

function sanitizeCookieValue(val?: string): string | null {
  if (!val) return null;
  let clean = decodeURIComponent(val).trim().replace(/^s:/, '').replace(/^"|"$/g, '');
  if (clean.includes('.')) {
    clean = clean.split('.')[0];
  }
  return clean || null;
}

// POST /api/promo/frag/match — Save a completed frag match from the local agent
export async function POST(request: Request) {
  let client;
  try {
    const cookieStore = await cookies();
    const rawPlayerId = cookieStore.get("promo_player_id")?.value;
    const rawActiveClubId = cookieStore.get("promo_active_club_id")?.value;

    const playerId = sanitizeCookieValue(rawPlayerId);
    const activeClubId = sanitizeCookieValue(rawActiveClubId);

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    client = await getClient();

    const body = await request.json();
    const {
      game = "CS2",
      map = "Unknown",
      score = "0:0",
      kills = 0,
      deaths = 0,
      assists = 0,
      headshots = 0,
      lastHits = 0,
      earnedBonuses = 0,
      events = [],
      // Extended CS2 fields
      totalDamage = 0,
      roundsPlayed = 0,
      bombsPlanted = 0,
      bombsDefused = 0,
      clutchKills = 0,
      flashKills = 0,
      smokeKills = 0,
      ecoKills = 0,
      roundResults = [],
      weaponKills = {},
      // Extended Dota 2 fields
      denies = 0,
      gpm = 0,
      xpm = 0,
      netWorth = 0,
      heroName = "",
      wardsPlaced = 0,
      wardsDestroyed = 0,
      dotaStats = {},
    } = body;

    // CS2 whitelist & practice/bot match validation
    if (game === "CS2") {
      if (!isOfficialCompetitiveMap(map)) {
        return NextResponse.json({ success: true, ignored: true, message: "Map is not in official competitive pool" });
      }
    }

    // Ignore bot sessions (0:0 score with >30 kills without victory event)
    const hasWinEvent = Array.isArray(events) && events.some((evt: any) => typeof evt === "string" && (evt.toLowerCase().includes("победа") || evt.includes("🏆")));
    const isBotSession = (score === "0:0" || !score) && !hasWinEvent && kills > 30;

    if (isBotSession) {
      return NextResponse.json({ success: true, ignored: true, message: "Bot/practice session ignored" });
    }

    // Extract dotaStats values if present in sub-object
    const finalDenies = dotaStats.denies ?? denies;
    const finalGpm = dotaStats.gpm ?? gpm;
    const finalXpm = dotaStats.xpm ?? xpm;
    const finalNetWorth = dotaStats.netWorth ?? netWorth;
    const finalHeroName = dotaStats.heroName ?? heroName;
    const finalWardsPlaced = dotaStats.wardsPlaced ?? wardsPlaced;
    const finalWardsDestroyed = dotaStats.wardsDestroyed ?? wardsDestroyed;

    await client.query(
      `INSERT INTO promo_frag_matches
         (player_id, club_id, game, map, score, kills, deaths, assists, headshots, last_hits, earned, events,
          total_damage, rounds_played, bombs_planted, bombs_defused, clutch_kills, flash_kills, smoke_kills, eco_kills, round_results, weapon_kills,
          hero_name, denies, gpm, xpm, net_worth, wards_placed, wards_destroyed, dota_stats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)`,
      [
        playerId,
        activeClubId,
        game,
        map,
        score,
        kills,
        deaths,
        assists,
        headshots,
        lastHits,
        earnedBonuses,
        JSON.stringify(events),
        totalDamage,
        roundsPlayed,
        bombsPlanted,
        bombsDefused,
        clutchKills,
        flashKills,
        smokeKills,
        ecoKills,
        JSON.stringify(roundResults),
        JSON.stringify(weaponKills),
        finalHeroName,
        finalDenies,
        finalGpm,
        finalXpm,
        finalNetWorth,
        finalWardsPlaced,
        finalWardsDestroyed,
        JSON.stringify(dotaStats),
      ]
    );

    // Ensure player has a balance record for this club
    await client.query(
      `INSERT INTO promo_player_balances (player_id, club_id, total_xp, bonus_balance)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT DO NOTHING`,
      [playerId, activeClubId]
    );

    // Fetch club's max_bonus_per_match tariff setting if configured
    let finalEarned = Number(earnedBonuses) || 0;
    const clubSettingsRes = await client.query(
      `SELECT settings FROM clubs WHERE id = $1`,
      [activeClubId]
    );
    const clubFragTariffs = clubSettingsRes.rows[0]?.settings?.frag?.tariffs;
    if (clubFragTariffs && typeof clubFragTariffs.max_bonus_per_match === "number") {
      const cap = clubFragTariffs.max_bonus_per_match;
      if (cap > 0 && finalEarned > cap) {
        finalEarned = cap;
      }
    }

    // Credit match earnings to player's balance
    if (finalEarned > 0) {
      await client.query(
        `UPDATE promo_player_balances
         SET bonus_balance = COALESCE(bonus_balance, 0) + $1
         WHERE player_id = $2 AND club_id = $3`,
        [finalEarned, playerId, activeClubId]
      );

      // Record in promo_history
      await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'frag', $3)`,
        [
          playerId,
          activeClubId,
          JSON.stringify({
            action: `frag_${game.toLowerCase()}_match`,
            amount: earnedBonuses,
            game: game,
            map: map,
            score: score,
            kills: kills,
            deaths: deaths,
            timestamp: new Date().toISOString()
          })
        ]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Frag Match Save Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
