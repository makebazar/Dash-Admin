// Shared helper functions for Frag Statistics and Tournaments

export function calculateTournamentPoints(matches: any[]) {
  let points = 0;
  let wins = 0;
  let losses = 0;
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;

  matches.forEach(m => {
    const isCs2 = m.game === "CS2";
    const events: string[] = typeof m.events === "string" ? JSON.parse(m.events) : (m.events || []);
    
    let matchPoints = 0;

    totalKills += m.kills || 0;
    totalDeaths += m.deaths || 0;
    totalAssists += m.assists || 0;
    
    if (isCs2) {
      // CS2 Formula
      matchPoints += (m.kills || 0) * 1.0;
      matchPoints += (m.assists || 0) * 0.5;
      matchPoints -= (m.deaths || 0) * 0.5;
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
        wins++;
      } else {
        matchPoints += 3.0;
        losses++;
      }
    } else {
      // Dota 2 Formula
      matchPoints += (m.kills || 0) * 1.5;
      matchPoints += (m.assists || 0) * 0.75;
      matchPoints -= (m.deaths || 0) * 0.75;
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
        wins++;
      } else {
        matchPoints += 3.0;
        losses++;
      }
    }

    points += matchPoints;
  });

  return {
    points: Math.round(Math.max(0, points) * 10) / 10,
    wins,
    losses,
    matchesCount: matches.length,
    totalKills,
    totalDeaths,
    totalAssists
  };
}
