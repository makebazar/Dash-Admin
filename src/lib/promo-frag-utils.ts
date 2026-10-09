export const OFFICIAL_CS2_COMPETITIVE_MAPS = [
  "de_mirage",
  "de_dust2",
  "de_inferno",
  "de_nuke",
  "de_anubis",
  "de_ancient",
  "de_vertigo",
  "de_overpass",
  "de_train",
  "de_cache",
  "cs_office",
  "cs_italy"
];

export function isOfficialCompetitiveMap(mapName: string): boolean {
  if (!mapName || typeof mapName !== "string") return false;
  const cleanMap = mapName.trim().toLowerCase();
  return OFFICIAL_CS2_COMPETITIVE_MAPS.includes(cleanMap);
}

export function isValidTournamentMatch(m: any): boolean {
  if (!m) return false;
  
  // Whitelist check for CS2 maps (Premier, Matchmaking, Faceit)
  if (m.game === "CS2" || !m.game) {
    if (!isOfficialCompetitiveMap(m.map)) {
      return false;
    }
  }

  // Exclude 0:0 score matches that have abnormal kills (>30) or no victory event (bot / local practice sessions)
  const events: string[] = typeof m.events === 'string' ? JSON.parse(m.events) : (m.events || []);
  const hasWinEvent = events.some(evt => typeof evt === 'string' && (evt.toLowerCase().includes("победа") || evt.includes("🏆")));
  
  if ((m.score === "0:0" || !m.score) && !hasWinEvent && (m.kills || 0) > 30) {
    return false;
  }

  return true;
}

export function calculateTournamentPoints(matches: any[], maxBestMatches: number = 15) {
  // Filter out invalid/practice/bot matches
  const validMatches = matches.filter(isValidTournamentMatch);

  // First, calculate points for each individual match
  const matchPointsList = validMatches.map(m => {
    const isCs2 = m.game === "CS2";
    const events: string[] = typeof m.events === "string" ? JSON.parse(m.events) : (m.events || []);
    
    let matchPoints = 0;
    
    if (isCs2) {
      matchPoints += (m.kills || 0) * 1.0;
      matchPoints += (m.assists || 0) * 0.5;
      matchPoints -= (m.deaths || 0) * 0.8; // -0.8 penalty for deaths in CS2
      matchPoints += (m.headshots || 0) * 0.5;

      let isWin = false;
      events.forEach(evt => {
        if (!evt) return;
        const lower = evt.toLowerCase();
        if (lower.includes("победа") || lower.includes("🏆")) isWin = true;
        if (lower.includes("нож") || lower.includes("🔪")) matchPoints += 5.0;
        if (lower.includes("zeus") || lower.includes("зевс") || lower.includes("⚡")) matchPoints += 3.0;
        if (lower.includes("mvp") || lower.includes("звезда") || lower.includes("⭐️")) matchPoints += 2.0;
        if (lower.includes("double kill")) matchPoints += 1.0;
        if (lower.includes("triple kill")) matchPoints += 2.0;
        if (lower.includes("quad kill")) matchPoints += 5.0;
        if (lower.includes("ace!")) matchPoints += 10.0;
      });

      if (isWin) {
        matchPoints += 15.0;
      } else {
        matchPoints -= 10.0;
      }
    } else if (m.game === "PUBG") {
      matchPoints += (m.kills || 0) * 2.0;

      let isWin = false;
      let isTop10 = false;
      events.forEach(evt => {
        if (!evt) return;
        const lower = evt.toLowerCase();
        if (lower.includes("победа") || lower.includes("топ-1") || lower.includes("🏆")) isWin = true;
        if (lower.includes("топ-10") || lower.includes("🎖️")) isTop10 = true;
      });

      if (isWin) {
        matchPoints += 20.0;
      } else {
        if (isTop10) {
          matchPoints += 10.0;
        } else {
          matchPoints -= 10.0;
        }
      }
    } else {
      // Dota 2
      matchPoints += (m.kills || 0) * 1.5;
      matchPoints += (m.assists || 0) * 0.75;
      matchPoints -= (m.deaths || 0) * 1.0; // -1.0 penalty for deaths in Dota
      matchPoints += (m.last_hits || 0) * 0.05;

      let isWin = false;
      events.forEach(evt => {
        if (!evt) return;
        const lower = evt.toLowerCase();
        if (lower.includes("союзных") || lower.includes("🛡️")) matchPoints += 0.5;
        if (lower.includes("богатство") || lower.includes("💰")) matchPoints += 0.2;
        if (lower.includes("победа") || lower.includes("🏆")) isWin = true;
        if (lower.includes("killing spree")) matchPoints += 2.0;
        if (lower.includes("mega kill")) matchPoints += 5.0;
        if (lower.includes("beyond godlike")) matchPoints += 10.0;
      });

      if (isWin) {
        matchPoints += 15.0;
      } else {
        matchPoints -= 10.0;
      }
    }

    return { match: m, points: Math.max(0, matchPoints) };
  });

  // Sort matches by points descending
  const sortedMatches = [...matchPointsList].sort((a, b) => b.points - a.points);

  // Take top N (15) matches
  const bestMatchesData = sortedMatches.slice(0, maxBestMatches);
  const totalPoints = bestMatchesData.reduce((sum, item) => sum + item.points, 0);

  // General totals from ALL valid matches
  let wins = 0;
  let losses = 0;
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;

  validMatches.forEach(m => {
    totalKills += m.kills || 0;
    totalDeaths += m.deaths || 0;
    totalAssists += m.assists || 0;

    let isWin = false;
    const events: string[] = typeof m.events === "string" ? JSON.parse(m.events) : (m.events || []);
    events.forEach(evt => {
      if (!evt) return;
      const lower = evt.toLowerCase();
      if (lower.includes("победа") || lower.includes("🏆") || lower.includes("топ-1")) isWin = true;
    });

    if (isWin) wins++;
    else losses++;
  });

  return {
    points: Math.round(totalPoints * 10) / 10,
    wins,
    losses,
    matchesCount: validMatches.length,
    totalKills,
    totalDeaths,
    totalAssists,
    bestMatches: bestMatchesData
  };
}

export function parseEventItem(raw: string) {
  if (!raw) return null;
  let text = raw.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
  text = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
  text = text.replace(/\s*\([^)]*\)$/gi, '').trim();
  text = text.replace(/руб\./gi, 'TP');

  const pointsMatch = text.match(/\+([0-9.,]+)\s*TP/i);
  let pointsVal = 0;
  if (pointsMatch) {
    let valStr = pointsMatch[1].replace(',', '.');
    pointsVal = parseFloat(valStr) || 0;
  }

  let titleStr = text.replace(/\s*\+[0-9.,]+\s*TP/gi, '').trim();

  return {
    title: titleStr || text,
    unitPoints: pointsVal
  };
}

export function getMatchPointBreakdown(m: any) {
  if (!m) return [];
  const isCs2 = m.game === "CS2";
  const isPubg = m.game === "PUBG";
  const events: string[] = typeof m.events === "string" ? JSON.parse(m.events) : (m.events || []);

  const items: { title: string; points: number }[] = [];

  let isWin = false;
  let isTop10 = false;

  events.forEach(evt => {
    if (!evt) return;
    const lower = evt.toLowerCase();
    if (lower.includes("победа") || lower.includes("🏆") || lower.includes("топ-1")) isWin = true;
    if (lower.includes("топ-10") || lower.includes("🎖️")) isTop10 = true;
  });

  if (isCs2) {
    if (isWin) {
      items.push({ title: "Победа в матче", points: 15.0 });
    } else {
      items.push({ title: "Поражение в матче", points: -10.0 });
    }
    if ((m.kills || 0) > 0) {
      items.push({ title: `Убийства (${m.kills})`, points: (m.kills || 0) * 1.0 });
    }
    if ((m.assists || 0) > 0) {
      items.push({ title: `Помощь (${m.assists})`, points: (m.assists || 0) * 0.5 });
    }
    if ((m.headshots || 0) > 0) {
      items.push({ title: `Попадания в голову (${m.headshots})`, points: (m.headshots || 0) * 0.5 });
    }
    if ((m.deaths || 0) > 0) {
      items.push({ title: `Штраф за смерти (${m.deaths})`, points: -(m.deaths || 0) * 0.8 });
    }
  } else if (isPubg) {
    if (isWin) {
      items.push({ title: "Победа (Топ-1)", points: 20.0 });
    } else if (isTop10) {
      items.push({ title: "Попадание в Топ-10", points: 10.0 });
    } else {
      items.push({ title: "Штраф за поражение", points: -10.0 });
    }
    if ((m.kills || 0) > 0) {
      items.push({ title: `Убийства (${m.kills})`, points: (m.kills || 0) * 2.0 });
    }
  } else {
    if (isWin) {
      items.push({ title: "Победа в матче", points: 15.0 });
    } else {
      items.push({ title: "Поражение в матче", points: -10.0 });
    }
    if ((m.kills || 0) > 0) {
      items.push({ title: `Убийства (${m.kills})`, points: (m.kills || 0) * 1.5 });
    }
    if ((m.assists || 0) > 0) {
      items.push({ title: `Помощь (${m.assists})`, points: (m.assists || 0) * 0.75 });
    }
    if ((m.last_hits || 0) > 0) {
      items.push({ title: `Ластхиты (${m.last_hits})`, points: (m.last_hits || 0) * 0.05 });
    }
    if ((m.denies || 0) > 0) {
      items.push({ title: `Денаи союзных крипов (${m.denies})`, points: (m.denies || 0) * 0.05 });
    }
    if ((m.deaths || 0) > 0) {
      items.push({ title: `Штраф за смерти (${m.deaths})`, points: -(m.deaths || 0) * 1.0 });
    }
  }

  const eventCounts = new Map<string, { count: number; unitPoints: number }>();

  events.forEach(rawEvt => {
    const parsed = parseEventItem(rawEvt);
    if (!parsed || !parsed.title) return;

    const lower = parsed.title.toLowerCase();
    if (lower.includes("победа") || lower.includes("топ-1")) return;

    const existing = eventCounts.get(parsed.title);
    if (existing) {
      existing.count += 1;
    } else {
      eventCounts.set(parsed.title, { count: 1, unitPoints: parsed.unitPoints });
    }
  });

  eventCounts.forEach((val, key) => {
    const totalPts = val.unitPoints > 0 ? val.count * val.unitPoints : 0;
    items.push({
      title: val.count > 1 ? `${key} (x${val.count})` : key,
      points: totalPts
    });
  });

  return items;
}
