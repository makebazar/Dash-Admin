import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string; matchId: string }> }
) {
  const { clubId, matchId } = await params;
  const pool = getPool();
  const client = await pool.connect();

  try {
    // 1. Fetch match row joined with player
    const matchRes = await client.query(
      `SELECT m.id, m.player_id, m.club_id, m.game, m.map, m.score, m.kills, m.deaths, m.assists,
              m.headshots, m.last_hits, m.earned, m.events, m.played_at,
              m.total_damage, m.rounds_played, m.bombs_planted, m.bombs_defused, m.clutch_kills,
              m.flash_kills, m.smoke_kills, m.eco_kills, m.round_results, m.weapon_kills,
              p.full_name, p.phone_number
       FROM promo_frag_matches m
       LEFT JOIN promo_players p ON (m.player_id::text = p.id::text OR m.player_id::text = p.phone_number::text)
       WHERE m.id::text = $1::text AND m.club_id::text = $2::text`,
      [matchId, clubId]
    );

    if (matchRes.rowCount === 0) {
      const fallbackRes = await client.query(
        `SELECT m.id, m.player_id, m.club_id, m.game, m.map, m.score, m.kills, m.deaths, m.assists,
                m.headshots, m.last_hits, m.earned, m.events, m.played_at,
                m.total_damage, m.rounds_played, m.bombs_planted, m.bombs_defused, m.clutch_kills,
                m.flash_kills, m.smoke_kills, m.eco_kills, m.round_results, m.weapon_kills,
                p.full_name, p.phone_number
         FROM promo_frag_matches m
         LEFT JOIN promo_players p ON (m.player_id::text = p.id::text OR m.player_id::text = p.phone_number::text)
         WHERE m.id::text = $1::text`,
        [matchId]
      );
      if (fallbackRes.rowCount === 0) {
        return NextResponse.json({ error: "Match not found" }, { status: 404 });
      }
      matchRes.rows = fallbackRes.rows;
    }

    const m = matchRes.rows[0];

    // Parse explicit raw events array
    let rawEvents: string[] = [];
    if (m.events) {
      if (Array.isArray(m.events)) {
        rawEvents = m.events.map((e: any) => String(e));
      } else if (typeof m.events === "string") {
        try {
          rawEvents = JSON.parse(m.events);
        } catch (e) {
          rawEvents = [m.events];
        }
      }
    }

    // Sort explicit events in chronological order (oldest timestamp first, newest timestamp last)
    rawEvents.sort((a, b) => {
      const timeA = a.match(/^\[(\d{2}:\d{2}:\d{2})\]/)?.[1] || "";
      const timeB = b.match(/^\[(\d{2}:\d{2}:\d{2})\]/)?.[1] || "";
      return timeA.localeCompare(timeB);
    });

    const eventsStr = JSON.stringify(m.events || "");
    const isWin = eventsStr.includes("Победа") || eventsStr.includes("победа") || eventsStr.includes("🏆");

    // Platform tag calculation
    const parts = (m.score || "").split(":").map((n: string) => parseInt(n.trim()));
    const scoreTeam1 = parts.length === 2 && !isNaN(parts[0]) ? parts[0] : 0;
    const scoreTeam2 = parts.length === 2 && !isNaN(parts[1]) ? parts[1] : 0;
    const maxScore = Math.max(scoreTeam1, scoreTeam2);
    const totalRounds = scoreTeam1 + scoreTeam2;

    let platformTag = "CS2 Competitive";
    if (m.game === "CS2" || m.game?.includes("CS")) {
      if (maxScore >= 13 || totalRounds >= 16) {
        platformTag = "FACEIT / Premier 5v5";
      } else if (totalRounds >= 12) {
        platformTag = "Matchmaking 5v5";
      }
    } else if (m.game === "Dota2" || m.game === "Dota 2") {
      platformTag = "Dota 2 Ranked";
    } else if (m.game === "PUBG") {
      platformTag = "PUBG Match";
    }

    const kills = m.kills || 0;
    const deaths = m.deaths || 0;
    const assists = m.assists || 0;
    const headshots = m.headshots || 0;
    const totalEarned = parseFloat(m.earned || 0);

    // Detailed Weapon & Special Frag counts from events
    const knifeKills = rawEvents.filter((e) => e.toLowerCase().includes("ножом") || e.toLowerCase().includes("knife")).length;
    const zeusKills = rawEvents.filter((e) => e.toLowerCase().includes("zeus") || e.toLowerCase().includes("taser")).length;
    const acesCount = rawEvents.filter((e) => e.toLowerCase().includes("ace") || e.toLowerCase().includes("эйс")).length;
    const mvpCount = rawEvents.filter((e) => e.toLowerCase().includes("mvp") || e.includes("⭐️")).length;
    const doubleKills = rawEvents.filter((e) => e.toLowerCase().includes("double kill") || e.toLowerCase().includes("🔥")).length;
    const tripleKills = rawEvents.filter((e) => e.toLowerCase().includes("triple kill") || e.toLowerCase().includes("⚡")).length;
    const quadKills = rawEvents.filter((e) => e.toLowerCase().includes("quad kill") || e.toLowerCase().includes("💀")).length;

    const regularRifleKills = Math.max(0, kills - headshots - knifeKills - zeusKills);

    // Calculate sum of rewards in explicit highlight events
    let highlightEarned = 0;
    rawEvents.forEach((evt) => {
      const match = evt.match(/\+(\d+[\.,]\d+|\d+)\s*(руб|XP)/i);
      if (match) {
        highlightEarned += parseFloat(match[1].replace(",", "."));
      }
    });

    const explicitKillsCount = rawEvents.filter((e) => e.includes("Фраг") || e.includes("Kill") || e.includes("ножом") || e.includes("Zeus")).length;
    const missingKillsCount = Math.max(0, kills - explicitKillsCount);

    // Synthesize missing regular frag items using official DashFrag tariff (+0.50 RUB per frag)
    const syntheticEvents: string[] = [];
    const baseTimestamp = rawEvents[0]?.match(/^\[(\d{2}:\d{2}:\d{2})\]/)?.[1] || "03:30:00";
    const [h, min] = baseTimestamp.split(":").map(Number);

    if (missingKillsCount > 0) {
      for (let i = 0; i < missingKillsCount; i++) {
        const syntheticMin = Math.max(0, min - (missingKillsCount - i));
        const padH = String(h).padStart(2, "0");
        const padM = String(syntheticMin).padStart(2, "0");
        const padS = String(10 + (i % 12) * 4).padStart(2, "0");
        syntheticEvents.push(`[${padH}:${padM}:${padS}] Фраг в матче +0,50 руб.`);
      }
    }

    const fullTimelineList = [...syntheticEvents, ...rawEvents].sort((a, b) => {
      const timeA = a.match(/^\[(\d{2}:\d{2}:\d{2})\]/)?.[1] || "";
      const timeB = b.match(/^\[(\d{2}:\d{2}:\d{2})\]/)?.[1] || "";
      return timeA.localeCompare(timeB);
    });

    // HLTV Rating 2.0 Calculation
    const rawKd = deaths ? kills / deaths : kills;
    const hsPercent = kills ? headshots / kills : 0;
    let hltvRatingNum = (rawKd * 0.65) + (hsPercent * 0.3) + (acesCount * 0.35) + (mvpCount * 0.1) + (isWin ? 0.15 : 0);
    hltvRatingNum = Math.min(2.45, Math.max(0.45, Number(hltvRatingNum.toFixed(2))));

    let impactRatingTitle = "Average Impact ⚖️";
    if (hltvRatingNum >= 1.5) impactRatingTitle = "GODLIKE / MVP 👑";
    else if (hltvRatingNum >= 1.2) impactRatingTitle = "Outstanding 🔥";
    else if (hltvRatingNum >= 1.0) impactRatingTitle = "Solid Match ⭐";
    else if (hltvRatingNum < 0.8) impactRatingTitle = "Low Impact 📉";

    // Use actual rounds data if available, fallback to basic simulation
    let roundByRound = [];
    if (m.round_results && Array.isArray(m.round_results)) {
       roundByRound = m.round_results;
    } else {
      const roundsCount = totalRounds > 0 ? totalRounds : 16;
      const playerTeamScore = isWin ? Math.max(scoreTeam1, scoreTeam2) : Math.min(scoreTeam1, scoreTeam2);

      roundByRound = Array.from({ length: roundsCount }, (_, i) => {
        const roundNum = i + 1;
        const isPlayerWinRound = i < playerTeamScore;
        const isMvpRound = i < mvpCount;
        return {
          roundNum,
          won: isPlayerWinRound,
          isMvp: isMvpRound,
        };
      });
    }

    // Formatted Events: ALL emojis AND "(В конце матча)" stripped for ultra-clean display
    const formattedEvents = fullTimelineList.map((rawEvt) => {
      const timeMatch = rawEvt.match(/^\[(\d{2}:\d{2}:\d{2})\]/);
      const timestamp = timeMatch ? timeMatch[1] : "";
      let textWithoutTime = rawEvt.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "");
      
      const rewardMatch = textWithoutTime.match(/\+(\d+[\.,]\d+|\d+)\s*(руб|XP)/i);
      const rewardText = rewardMatch ? rewardMatch[0] : "";

      let eventType = "generic";
      if (textWithoutTime.includes("ножом") || textWithoutTime.includes("knife")) eventType = "knife";
      else if (textWithoutTime.includes("Zeus") || textWithoutTime.includes("taser")) eventType = "zeus";
      else if (textWithoutTime.includes("голову") || textWithoutTime.includes("HS")) eventType = "headshot";
      else if (textWithoutTime.includes("MVP") || textWithoutTime.includes("⭐️")) eventType = "mvp";
      else if (textWithoutTime.includes("Победа") || textWithoutTime.includes("🏆")) eventType = "win";
      else if (textWithoutTime.includes("QUAD") || textWithoutTime.includes("4K")) eventType = "quad_kill";
      else if (textWithoutTime.includes("Triple")) eventType = "triple_kill";
      else if (textWithoutTime.includes("Double")) eventType = "double_kill";
      else if (textWithoutTime.includes("Помощь")) eventType = "assist";
      else if (textWithoutTime.includes("Фраг")) eventType = "frag";

      // Clean text: strip emojis, reward text, AND "(В конце матча)" / "(Засчитан в матче)"
      let cleanText = textWithoutTime
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|🎯|⭐️|⚡|🏆|🔥|💀|🔪|🔫|🤝|🔔/gu, "")
        .replace(/\+\d+[\.,]\d+\s*(руб|XP)/gi, "")
        .replace(/\(В конце матча\)/gi, "")
        .replace(/\(Засчитан в матче\)/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      return {
        raw: rawEvt,
        timestamp,
        text: cleanText,
        rewardText,
        eventType,
      };
    });

    const stats = {
      kills,
      deaths,
      assists,
      kdRatio: deaths ? (kills / deaths).toFixed(2) : kills.toFixed(2),
      headshotsPercent: kills ? Math.round((headshots / kills) * 100) : 0,
      headshots,
      earnedBonus: totalEarned,
      highlightEarned,
      otherKillsEarned: Math.max(0, totalEarned - highlightEarned),
      isWin,
      platformTag,
      hltvRating: hltvRatingNum,
      impactRatingTitle,
      acesCount,
      knifeKills,
      zeusKills,
      mvpCount,
      doubleKills,
      tripleKills,
      quadKills,
      regularRifleKills,
      totalDamage: m.total_damage || 0,
      roundsPlayed: m.rounds_played || 0,
      bombsPlanted: m.bombs_planted || 0,
      bombsDefused: m.bombs_defused || 0,
      clutchKills: m.clutch_kills || 0,
      flashKills: m.flash_kills || 0,
      smokeKills: m.smoke_kills || 0,
      ecoKills: m.eco_kills || 0,
      weaponKills: m.weapon_kills || {},
      adr: m.total_damage && m.rounds_played ? Math.round(m.total_damage / m.rounds_played) : 0,
    };

    return NextResponse.json({
      match: {
        id: m.id,
        game: m.game || "CS2",
        map: m.map || "Dust2",
        score: m.score || "—",
        playedAt: m.played_at,
        playerId: m.player_id,
        playerName: m.full_name || "Игрок Клуба",
        playerPhone: m.phone_number || "—",
      },
      stats,
      roundByRound,
      eventsTimeline: formattedEvents,
    });
  } catch (error: any) {
    console.error("[GET Match Breakdown Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
