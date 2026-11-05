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

export function calculateMatchPoints(m: any) {
  const isCs2 = m.game === "CS2";
  const events: string[] = typeof m.events === "string" ? JSON.parse(m.events) : (m.events || []);

  let matchPoints = 0;
  let isWin = false;
  let killsPoints = 0;
  let assistsPoints = 0;
  let deathsPoints = 0;
  let headshotsPoints = 0;
  let specialsPoints = 0;
  let winPoints = 0;

  if (isCs2) {
    killsPoints = (m.kills || 0) * 1.0;
    assistsPoints = (m.assists || 0) * 0.5;
    deathsPoints = -(m.deaths || 0) * 0.8;
    headshotsPoints = (m.headshots || 0) * 0.5;

    events.forEach(evt => {
      if (!evt) return;
      const lower = evt.toLowerCase();
      if (lower.includes("победа") || lower.includes("🏆")) isWin = true;
      if (lower.includes("нож") || lower.includes("🔪")) specialsPoints += 5.0;
      if (lower.includes("zeus") || lower.includes("зевс") || lower.includes("⚡")) specialsPoints += 3.0;
      if (lower.includes("mvp") || lower.includes("звезда") || lower.includes("⭐️")) specialsPoints += 2.0;
      if (lower.includes("double kill")) specialsPoints += 1.0;
      if (lower.includes("triple kill")) specialsPoints += 2.0;
      if (lower.includes("quad kill")) specialsPoints += 5.0;
      if (lower.includes("ace!")) specialsPoints += 10.0;
    });

    winPoints = isWin ? 15.0 : -10.0;
    matchPoints = killsPoints + assistsPoints + deathsPoints + headshotsPoints + specialsPoints + winPoints;
  } else if (m.game === "PUBG") {
    killsPoints = (m.kills || 0) * 2.0;
    let isTop10 = false;
    let isTop3 = false;
    events.forEach(evt => {
      if (!evt) return;
      const lower = evt.toLowerCase();
      if (lower.includes("победа") || lower.includes("топ-1") || lower.includes("🏆")) isWin = true;
      if (lower.includes("топ-3") || lower.includes("🥉")) isTop3 = true;
      if (lower.includes("топ-10") || lower.includes("🎖️")) isTop10 = true;
      if (lower.includes("хедшот") || lower.includes("🎯")) specialsPoints += 0.5;
      if (lower.includes("урон") || lower.includes("💥")) specialsPoints += 0.5;
      if (lower.includes("дистанция") || lower.includes("пройдено") || lower.includes("🏃")) specialsPoints += 0.5;
      if (lower.includes("снайпер") || lower.includes("🏹")) specialsPoints += 2.0;
    });

    winPoints = isWin ? 20.0 : isTop3 ? 15.0 : isTop10 ? 10.0 : -10.0;
    matchPoints = killsPoints + specialsPoints + winPoints;
  } else {
    // Dota 2
    killsPoints = (m.kills || 0) * 1.5;
    assistsPoints = (m.assists || 0) * 0.75;
    deathsPoints = -(m.deaths || 0) * 1.0;
    const lastHitsPoints = (m.last_hits || 0) * 0.05;

    events.forEach(evt => {
      if (!evt) return;
      const lower = evt.toLowerCase();
      if (lower.includes("союзных") || lower.includes("🛡️") || lower.includes("denies") || lower.includes("денай")) specialsPoints += 0.5;
      if (lower.includes("богатство") || lower.includes("💰") || lower.includes("networth") || lower.includes("золот")) specialsPoints += 0.2;
      if (lower.includes("победа") || lower.includes("🏆")) isWin = true;
      if (lower.includes("killing spree")) specialsPoints += 2.0;
      if (lower.includes("mega kill")) specialsPoints += 5.0;
      if (lower.includes("beyond godlike")) specialsPoints += 10.0;
      if (lower.includes("поставлен") || (lower.includes("вард") && !lower.includes("снос") && !lower.includes("уничтож"))) specialsPoints += 1.0;
      if (lower.includes("снос") || lower.includes("уничтожение вражеского варда") || lower.includes("ward destroy")) specialsPoints += 0.5;
    });

    winPoints = isWin ? 15.0 : -10.0;
    matchPoints = killsPoints + assistsPoints + deathsPoints + lastHitsPoints + specialsPoints + winPoints;
  }

  const finalPoints = Math.max(0, Math.round(matchPoints * 10) / 10);

  return {
    points: finalPoints,
    rawPoints: matchPoints,
    isWin,
    breakdown: {
      kills: killsPoints,
      assists: assistsPoints,
      deaths: deathsPoints,
      headshots: headshotsPoints,
      specials: specialsPoints,
      win: winPoints,
    }
  };
}

export function calculateTournamentPoints(matches: any[], maxBestMatches: number = 15) {
  // Filter out invalid/practice/bot matches
  const validMatches = matches.filter(isValidTournamentMatch);

  // First, calculate points for each individual match
  const matchPointsList = validMatches.map(m => {
    const calc = calculateMatchPoints(m);
    return {
      match: m,
      points: calc.points,
      isWin: calc.isWin,
      breakdown: calc.breakdown
    };
  });

  // Sort matches by points descending
  const sortedMatches = [...matchPointsList].sort((a, b) => b.points - a.points);

  // Take top N (15) matches
  const bestMatchesData = sortedMatches.slice(0, maxBestMatches);
  const totalPoints = bestMatchesData.reduce((sum, item) => sum + item.points, 0);

  // Set of best match identifiers
  const bestSet = new Set(bestMatchesData.map(b => b.match.id || b.match));

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

  const allMatchesDetails = matchPointsList.map(item => ({
    match: item.match,
    points: item.points,
    isWin: item.isWin,
    isCounted: bestSet.has(item.match.id || item.match),
    breakdown: item.breakdown,
  }));

  return {
    points: Math.round(totalPoints * 10) / 10,
    wins,
    losses,
    matchesCount: validMatches.length,
    totalKills,
    totalDeaths,
    totalAssists,
    bestMatches: bestMatchesData,
    allMatches: allMatchesDetails
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

export const TOURNAMENT_RULES_TEMPLATES = {
  CS2: `🏆 ПРАВИЛА НАЧИСЛЕНИЯ ОЧКОВ (ГИБРИДНАЯ СИСТЕМА CS2)

Чтобы сделать соревнование честным и дать шанс каждому игроку (а не только тем, кто играет круглосуточно), система учитывает лучшие матчи и личный скилл!

1. ЛИМИТ ЛУЧШИХ МАТЧЕЙ (Best of 15)
• В зачёт вашей турнирной таблицы идут 15 ваших лучших матчей.
• Вы можете сыграть сколько угодно игр — неудачные игры не снизят ваш рекорд, а хорошие улучшат позицию!

2. ФОРМУЛА РАСЧЕТА ОЧКОВ ЗА ОДИН МАТЧ
Очки за каждый сыгранный матч складываются из командного результата и личного скилла:

Командный результат:
• Победа в матче: +15.0 очков
• Поражение в матче: -10.0 очков

Личная статистика (Скилл):
• Каждое убийство (Kill): +1.0 очко
• Помощь в убийстве (Assist): +0.5 очка
• Каждая смерть (Death): -0.8 очка
• Попадание в голову (Headshot): +0.5 очка

Особые достижения в матче:
• Звезда MVP: +2.0 очка
• Убийство с ножа: +5.0 очков
• Убийство с Zeus: +3.0 очка
• Double Kill: +1.0 очко
• Triple Kill: +2.0 очка
• Quad Kill: +5.0 очков
• Ace: +10.0 очков

* Минимальный балл за матч равен 0 (даже при худшей игре вы не уйдёте в минус за отдельную игру).

3. КВАЛИФИКАЦИЯ
• Для попадания в официальный рейтинг турнира необходимо сыграть минимум игр, установленных регламентом.`,

  Dota2: `🏆 ПРАВИЛА НАЧИСЛЕНИЯ ОЧКОВ (ГИБРИДНАЯ СИСТЕМА DOTA 2)

Чтобы сделать соревнование честным и дать шанс каждому игроку, система учитывает лучшие матчи и личный скилл!

1. ЛИМИТ ЛУЧШИХ МАТЧЕЙ (Best of 15)
• В зачёт турнирной таблицы идут 15 ваших лучших матчей.
• Играйте сколько угодно — плохие игры отсеиваются, лучшие поднимают вас в топе!

2. ФОРМУЛА РАСЧЕТА ОЧКОВ ЗА ОДИН МАТЧ

Командный результат:
• Победа в матче: +15.0 очков
• Поражение в матче: -10.0 очков

Личная статистика (Скилл):
• Убийство героя (Kill): +1.5 очка
• Ассист в замесе (Assist): +0.75 очка
• Добитый крип (Last Hit): +0.05 очка
• Каждые 5 Denies (денай крипа): +0.5 очка
• Каждые 1000 Gold Networth: +0.2 очка
• Каждая смерть (Death): -1.0 очко

Особые достижения:
• Killing Spree (3 стрик): +2.0 очка
• Mega Kill (5 стрик): +5.0 очков
• Beyond Godlike (10+ стрик): +10.0 очков
• Каждые 5 поставленных вардов: +1.0 очко
• Снос вражеского варда: +0.5 очка

* Минимальный балл за матч равен 0.

3. КВАЛИФИКАЦИЯ
• Для попадания в турнирную таблицу необходимо сыграть минимум игр, указанных в регламенте.`,

  ALL: `🏆 ПРАВИЛА НАЧИСЛЕНИЯ ОЧКОВ (CS2 + DOTA 2)

В зачёт турнирной таблицы идут 15 лучших матчей по любой из дисциплин (CS2 или Dota 2).

1. ФОРМУЛА ОЧКОВ CS2
Командный результат:
• Победа в матче: +15.0 очков
• Поражение в матче: -10.0 очков

Личная статистика:
• Убийство: +1.0 очко
• Ассист: +0.5 очка
• Смерть: -0.8 очка
• Хедшот: +0.5 очка
• MVP раунда: +2.0 очка
• Нож: +5.0 очков | Zeus: +3.0 очка
• Double Kill / Triple / Quad / Ace: +1.0 / +2.0 / +5.0 / +10.0 очков

2. ФОРМУЛА ОЧКОВ DOTA 2
Командный результат:
• Победа в матче: +15.0 очков
• Поражение в матче: -10.0 очков

Личная статистика:
• Убийство героя: +1.5 очка
• Ассист в замесе: +0.75 очка
• Добитый крип: +0.05 очка
• Каждые 5 Denies: +0.5 очка
• Каждые 1000 Networth: +0.2 очка
• Смерть: -1.0 очко
• Killing Spree / Mega Kill / Beyond Godlike: +2.0 / +5.0 / +10.0 очков
• Варды (поставить 5 / снести): +1.0 / +0.5 очка

* Минимальный балл за любой матч равен 0.

3. КВАЛИФИКАЦИЯ
• Для попадания в турнирную таблицу необходимо сыграть минимум игр, установленных регламентом.`
};
