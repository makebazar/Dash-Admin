// Shared helper functions for Frag Statistics and Tournaments

export function calculateTournamentPoints(matches: any[], maxBestMatches: number = 15) {
  // First, calculate points for each individual match
  const matchPointsList = matches.map(m => {
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

    return Math.max(0, matchPoints);
  });

  // Sort matches by points descending
  const sortedPoints = [...matchPointsList].sort((a, b) => b - a);

  // Take top N (15) matches
  const bestPoints = sortedPoints.slice(0, maxBestMatches);
  const totalPoints = bestPoints.reduce((sum, pts) => sum + pts, 0);

  // General totals from ALL matches
  let wins = 0;
  let losses = 0;
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;

  matches.forEach(m => {
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
    matchesCount: matches.length,
    totalKills,
    totalDeaths,
    totalAssists
  };
}
