import { PoolClient } from "pg";

export interface Competitor {
  id: string; // BIGINT as string
  displayName: string;
  elo?: number;
  playerId?: string;
  teamId?: string;
}

/**
 * Automatically balances registered solo players into teams for MIX tournaments.
 * Group players by ELO, then distributes them into balanced teams.
 */
export async function autobalanceMixTeams(
  client: PoolClient,
  clubId: number,
  tournamentId: string,
  players: { id: string; fullName: string; elo: number }[],
  teamSize = 5
): Promise<string[]> {
  // 1. Sort players by ELO descending
  const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);
  const numTeams = Math.floor(sortedPlayers.length / teamSize);

  if (numTeams === 0) {
    throw new Error("Недостаточно игроков для формирования хотя бы одной команды");
  }

  // 2. Distribute players into teams using "snake" sorting to balance average ELO
  const teamsPlayers: { id: string; fullName: string; elo: number }[][] = Array.from({ length: numTeams }, () => []);
  let ascending = true;

  for (let i = 0; i < sortedPlayers.length; i++) {
    const teamIndex = i % numTeams;
    const targetTeam = ascending ? teamIndex : numTeams - 1 - teamIndex;
    teamsPlayers[targetTeam].push(sortedPlayers[i]);

    if (teamIndex === numTeams - 1) {
      ascending = !ascending;
    }
  }

  const competitorIds: string[] = [];

  // 3. Create teams and add members in DB
  for (let t = 0; t < numTeams; t++) {
    const teamName = `Mix Team #${t + 1}`;
    const teamMembers = teamsPlayers[t];
    // Captain is the player with highest ELO in the team
    const captain = teamMembers[0];

    // Create team
    const teamRes = await client.query(
      `INSERT INTO teams (name, captain_id, club_id, invite_code)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [teamName, captain.id, clubId, Math.random().toString(36).substring(2, 8).toUpperCase()]
    );
    const teamId = teamRes.rows[0].id;

    // Add all members
    for (const member of teamMembers) {
      await client.query(
        `INSERT INTO team_members (team_id, player_id)
         VALUES ($1, $2)`,
        [teamId, member.id]
      );
    }

    // Register team as competitor in the tournament
    const compRes = await client.query(
      `INSERT INTO tournament_competitors (tournament_id, type, display_name, team_id)
       VALUES ($1, 'TEAM', $2, $3)
       RETURNING id`,
      [tournamentId, teamName, teamId]
    );

    const competitorId = compRes.rows[0].id;
    competitorIds.push(competitorId);

    // Create tournament entry
    await client.query(
      `INSERT INTO tournament_entries (tournament_id, competitor_id, status)
       VALUES ($1, $2, 'PAID')`,
      [tournamentId, competitorId]
    );
  }

  return competitorIds;
}

/**
 * Generates Round Robin matches for Group Stage (round = 0).
 * Groups are stored in match.result JSONB field: { group: 'A' }.
 */
export async function generateGroupStage(
  client: PoolClient,
  tournamentId: string,
  competitorIds: string[],
  startsAt?: Date | string | null
): Promise<void> {
  const N = competitorIds.length;
  let numGroups = 1;
  if (N >= 6 && N <= 10) numGroups = 2;
  else if (N > 10) numGroups = 4;

  // Split competitors into groups
  const shuffled = [...competitorIds].sort(() => Math.random() - 0.5);
  const groups: string[][] = Array.from({ length: numGroups }, () => []);

  for (let i = 0; i < N; i++) {
    groups[i % numGroups].push(shuffled[i]);
  }

  const baseTime = startsAt ? new Date(startsAt).getTime() : Date.now();
  let globalMatchNum = 1;

  // Generate round robin pairings for each group
  for (let g = 0; g < numGroups; g++) {
    const groupLabel = String.fromCharCode(65 + g); // A, B, C, D
    const groupComps = groups[g];

    let order = 1;
    for (let i = 0; i < groupComps.length; i++) {
      for (let j = i + 1; j < groupComps.length; j++) {
        const matchScheduledTime = new Date(baseTime + Math.floor((order - 1) / 2) * 45 * 60 * 1000);
        await client.query(
          `INSERT INTO tournament_matches (tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, status, scheduled_at, result)
           VALUES ($1, 0, $2, $3, $4, 'SCHEDULED', $5, $6)`,
          [
            tournamentId,
            order,
            groupComps[i],
            groupComps[j],
            matchScheduledTime,
            JSON.stringify({ stage: 'group', group: groupLabel, matchNumber: globalMatchNum }),
          ]
        );
        order++;
        globalMatchNum++;
      }
    }
  }
}

/**
 * Generates Playoff Bracket matches (round = 1, 2, 3...) for Single Elimination.
 * Assigns sequential match numbers (1, 2, 3...) and scheduled times.
 */
export async function generatePlayoffs(
  client: PoolClient,
  tournamentId: string,
  competitorIds: string[],
  startsAt?: Date | string | null
): Promise<void> {
  const competitors = [...competitorIds].sort(() => Math.random() - 0.5);
  const N = competitors.length;

  if (N < 2) return;

  // Find nearest power of 2
  let power = 2;
  while (power < N) power *= 2;

  const numByes = power - N;
  const round1Size = power / 2;

  const baseTime = startsAt ? new Date(startsAt).getTime() : Date.now();
  let globalMatchNum = 1;

  // Calculate rounds structure
  const roundCounts: number[] = [];
  let currentRoundSize = round1Size;
  while (currentRoundSize >= 1) {
    roundCounts.push(currentRoundSize);
    currentRoundSize = Math.floor(currentRoundSize / 2);
  }
  const totalRounds = roundCounts.length;

  // First pass: create empty slots for all rounds
  for (let r = 1; r <= totalRounds; r++) {
    const rSize = roundCounts[r - 1];
    const isFinalRound = r === totalRounds;

    for (let i = 1; i <= rSize; i++) {
      const matchScheduledTime = new Date(baseTime + (r - 1) * 60 * 60 * 1000 + (i - 1) * 15 * 60 * 1000);
      const stage = isFinalRound 
        ? 'final' 
        : (r === totalRounds - 1 ? 'semifinal' : (r === totalRounds - 2 ? 'quarterfinal' : 'playoff'));

      await client.query(
        `INSERT INTO tournament_matches (tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, status, scheduled_at, result)
         VALUES ($1, $2, $3, NULL, NULL, 'SCHEDULED', $4, $5)`,
        [
          tournamentId,
          r,
          i,
          matchScheduledTime,
          JSON.stringify({
            bracket: 'upper',
            matchNumber: globalMatchNum,
            stage,
          }),
        ]
      );
      globalMatchNum++;
    }

    // If this is the Final round and there were semi-finals (totalRounds >= 2), create 3rd Place Match!
    if (isFinalRound && totalRounds >= 2) {
      const thirdPlaceTime = new Date(baseTime + (r - 1) * 60 * 60 * 1000 + 30 * 60 * 1000);
      await client.query(
        `INSERT INTO tournament_matches (tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, status, scheduled_at, result)
         VALUES ($1, $2, 2, NULL, NULL, 'SCHEDULED', $3, $4)`,
        [
          tournamentId,
          r,
          thirdPlaceTime,
          JSON.stringify({
            bracket: 'upper',
            matchNumber: globalMatchNum,
            stage: 'bronze',
            isThirdPlace: true,
          }),
        ]
      );
      globalMatchNum++;
    }
  }

  // Populate Round 1 matches and advance BYEs
  let compIndex = 0;
  for (let i = 1; i <= round1Size; i++) {
    const compA = competitors[compIndex++] || null;
    let compB: string | null = null;

    if (i <= numByes) {
      // Bye match: compA advances directly to Round 2 (no fake score)
      await client.query(
        `UPDATE tournament_matches
         SET competitor_a_id = $1, competitor_b_id = NULL, status = 'FINISHED', winner_competitor_id = $1, score1 = 0, score2 = 0,
             result = result || '{"isBye": true}'::jsonb
         WHERE tournament_id = $2 AND round = 1 AND order_in_round = $3`,
        [compA, tournamentId, i]
      );

      // Advance compA to Round 2 slot immediately
      const nextOrder = Math.ceil(i / 2);
      const isPositionA = i % 2 !== 0;
      if (round1Size > 1) {
        if (isPositionA) {
          await client.query(
            `UPDATE tournament_matches
             SET competitor_a_id = $1
             WHERE tournament_id = $2 AND round = 2 AND order_in_round = $3`,
            [compA, tournamentId, nextOrder]
          );
        } else {
          await client.query(
            `UPDATE tournament_matches
             SET competitor_b_id = $1
             WHERE tournament_id = $2 AND round = 2 AND order_in_round = $3`,
            [compA, tournamentId, nextOrder]
          );
        }
      }
    } else {
      compB = competitors[compIndex++] || null;
      await client.query(
        `UPDATE tournament_matches
         SET competitor_a_id = $1, competitor_b_id = $2, status = 'SCHEDULED'
         WHERE tournament_id = $3 AND round = 1 AND order_in_round = $4`,
        [compA, compB, tournamentId, i]
      );
    }
  }
}

/**
 * Generates Double Elimination tournament bracket (Upper Bracket, Lower Bracket, Grand Final).
 * Assigns sequential match numbers (1, 2, 3...) and scheduled times.
 */
export async function generateDoubleElimination(
  client: PoolClient,
  tournamentId: string,
  competitorIds: string[],
  startsAt?: Date | string | null
): Promise<void> {
  const competitors = [...competitorIds].sort(() => Math.random() - 0.5);
  const N = competitors.length;

  if (N < 2) return;

  // Find nearest power of 2
  let power = 2;
  let k = 1;
  while (power < N) {
    power *= 2;
    k++;
  }

  const numByes = power - N;
  const round1Size = power / 2;
  const baseTime = startsAt ? new Date(startsAt).getTime() : Date.now();
  let globalMatchNum = 1;

  // 1. Create Upper Bracket matches (round = 1..k)
  let currentRoundSize = round1Size;
  for (let r = 1; r <= k; r++) {
    for (let i = 1; i <= currentRoundSize; i++) {
      const matchScheduledTime = new Date(baseTime + (r - 1) * 60 * 60 * 1000 + (i - 1) * 15 * 60 * 1000);
      await client.query(
        `INSERT INTO tournament_matches (tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, status, scheduled_at, result)
         VALUES ($1, $2, $3, NULL, NULL, 'SCHEDULED', $4, $5)`,
        [
          tournamentId,
          r,
          i,
          matchScheduledTime,
          JSON.stringify({
            bracket: 'upper',
            wbRound: r,
            matchNumber: globalMatchNum,
            stage: r === k ? 'wb_final' : 'wb',
          }),
        ]
      );
      globalMatchNum++;
    }
    currentRoundSize = Math.floor(currentRoundSize / 2);
  }

  // 2. Create Lower Bracket matches (round = 101 .. 100 + 2*(k-1))
  if (k >= 2) {
    const totalLbRounds = 2 * (k - 1);
    for (let lbR = 1; lbR <= totalLbRounds; lbR++) {
      const step = Math.floor((lbR - 1) / 2);
      const lbMatchesCount = Math.max(1, Math.floor(round1Size / Math.pow(2, step + 1)));

      for (let i = 1; i <= lbMatchesCount; i++) {
        const matchScheduledTime = new Date(baseTime + (lbR * 45) * 60 * 1000 + (i - 1) * 15 * 60 * 1000);
        await client.query(
          `INSERT INTO tournament_matches (tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, status, scheduled_at, result)
           VALUES ($1, $2, $3, NULL, NULL, 'SCHEDULED', $4, $5)`,
          [
            tournamentId,
            100 + lbR,
            i,
            matchScheduledTime,
            JSON.stringify({
              bracket: 'lower',
              lbRound: lbR,
              matchNumber: globalMatchNum,
              stage: lbR === totalLbRounds ? 'lb_final' : 'lb',
            }),
          ]
        );
        globalMatchNum++;
      }
    }
  }

  // 3. Create Grand Final match (round = 200)
  const grandFinalTime = new Date(baseTime + (k * 75) * 60 * 1000);
  await client.query(
    `INSERT INTO tournament_matches (tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, status, scheduled_at, result)
     VALUES ($1, 200, 1, NULL, NULL, 'SCHEDULED', $2, $3)`,
    [
      tournamentId,
      grandFinalTime,
      JSON.stringify({
        bracket: 'grand_final',
        matchNumber: globalMatchNum,
        stage: 'grand_final',
      }),
    ]
  );

  // 4. Populate Upper Bracket Round 1 and advance BYEs
  let compIndex = 0;
  for (let i = 1; i <= round1Size; i++) {
    const compA = competitors[compIndex++] || null;
    let compB: string | null = null;

    if (i <= numByes) {
      // Bye match: compA advances directly to WB Round 2 (no fake score)
      await client.query(
        `UPDATE tournament_matches
         SET competitor_a_id = $1, competitor_b_id = NULL, status = 'FINISHED', winner_competitor_id = $1, score1 = 0, score2 = 0,
             result = result || '{"isBye": true}'::jsonb
         WHERE tournament_id = $2 AND round = 1 AND order_in_round = $3`,
        [compA, tournamentId, i]
      );

      // Advance compA to WB Round 2 slot
      if (k > 1) {
        const nextOrder = Math.ceil(i / 2);
        const isPositionA = i % 2 !== 0;
        if (isPositionA) {
          await client.query(
            `UPDATE tournament_matches
             SET competitor_a_id = $1
             WHERE tournament_id = $2 AND round = 2 AND order_in_round = $3`,
            [compA, tournamentId, nextOrder]
          );
        } else {
          await client.query(
            `UPDATE tournament_matches
             SET competitor_b_id = $1
             WHERE tournament_id = $2 AND round = 2 AND order_in_round = $3`,
            [compA, tournamentId, nextOrder]
          );
        }
      }
    } else {
      compB = competitors[compIndex++] || null;
      await client.query(
        `UPDATE tournament_matches
         SET competitor_a_id = $1, competitor_b_id = $2, status = 'SCHEDULED'
         WHERE tournament_id = $3 AND round = 1 AND order_in_round = $4`,
        [compA, compB, tournamentId, i]
      );
    }
  }
}

/**
 * Progresses the bracket when a match finishes.
 * Handles Single Elimination, Double Elimination (Upper, Lower, Grand Final), and Group stages.
 */
export async function advancePlayoffWinner(
  client: PoolClient,
  matchId: string | number,
  winnerCompetitorId: string
): Promise<void> {
  const matchRes = await client.query(
    `SELECT tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, result 
     FROM tournament_matches 
     WHERE id = $1`,
    [matchId]
  );
  if (matchRes.rowCount === 0) return;

  const { tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, result } = matchRes.rows[0];
  if (round === 0) return; // Group matches are handled separately

  const loserId = String(winnerCompetitorId) === String(competitor_a_id) ? competitor_b_id : competitor_a_id;
  const bracket = result?.bracket || (round >= 100 && round < 200 ? 'lower' : round === 200 ? 'grand_final' : 'upper');

  // Check if tournament is Double Elimination by checking for presence of Lower Bracket matches
  const lbCheck = await client.query(
    `SELECT 1 FROM tournament_matches WHERE tournament_id = $1 AND round >= 100 LIMIT 1`,
    [tournament_id]
  );
  const isDoubleElim = (lbCheck.rowCount ?? 0) > 0;

  if (!isDoubleElim) {
    // ---------------- SINGLE ELIMINATION ----------------
    // Find max round (Final round)
    const maxRoundRes = await client.query(
      `SELECT MAX(round) as max_round FROM tournament_matches WHERE tournament_id = $1`,
      [tournament_id]
    );
    const maxRound = maxRoundRes.rows[0]?.max_round || 1;

    // If the finished match is already in the final round (Grand Final or 3rd place match), nothing to advance
    if (round >= maxRound) return;

    const nextRound = round + 1;
    const nextOrder = Math.ceil(order_in_round / 2);
    const isPositionA = order_in_round % 2 !== 0;

    // Check if this was the Semifinal round (round === maxRound - 1)
    const isSemiFinal = round === maxRound - 1 && maxRound >= 2;

    // 1. Advance winner to next round (Final or regular playoff match)
    if (isPositionA) {
      await client.query(
        `UPDATE tournament_matches
         SET competitor_a_id = $1
         WHERE tournament_id = $2 AND round = $3 AND order_in_round = $4`,
        [winnerCompetitorId, tournament_id, nextRound, nextOrder]
      );
    } else {
      await client.query(
        `UPDATE tournament_matches
         SET competitor_b_id = $1
         WHERE tournament_id = $2 AND round = $3 AND order_in_round = $4`,
        [winnerCompetitorId, tournament_id, nextRound, nextOrder]
      );
    }

    // 2. If it was Semifinal, route loser to 3rd Place match (round = maxRound, order_in_round = 2)
    if (isSemiFinal && loserId) {
      if (isPositionA) {
        await client.query(
          `UPDATE tournament_matches
           SET competitor_a_id = $1
           WHERE tournament_id = $2 AND round = $3 AND order_in_round = 2`,
          [loserId, tournament_id, maxRound]
        );
      } else {
        await client.query(
          `UPDATE tournament_matches
           SET competitor_b_id = $1
           WHERE tournament_id = $2 AND round = $3 AND order_in_round = 2`,
          [loserId, tournament_id, maxRound]
        );
      }
    }
  } else {
    // ---------------- DOUBLE ELIMINATION ----------------
    // Get max WB round (WB Final) and max LB round (LB Final)
    const maxWbRes = await client.query(
      `SELECT MAX(round) as max_wb FROM tournament_matches WHERE tournament_id = $1 AND round < 100`,
      [tournament_id]
    );
    const maxLbRes = await client.query(
      `SELECT MAX(round) as max_lb FROM tournament_matches WHERE tournament_id = $1 AND round >= 101 AND round < 200`,
      [tournament_id]
    );

    const maxWbRound = maxWbRes.rows[0]?.max_wb || 1;
    const maxLbRound = maxLbRes.rows[0]?.max_lb || 101;

    if (bracket === 'upper' || round < 100) {
      const wbRound = round;
      if (wbRound < maxWbRound) {
        // Winner advances to next Upper Bracket round
        const nextRound = wbRound + 1;
        const nextOrder = Math.ceil(order_in_round / 2);
        const isPositionA = order_in_round % 2 !== 0;

        await client.query(
          `UPDATE tournament_matches
           SET ${isPositionA ? 'competitor_a_id' : 'competitor_b_id'} = $1
           WHERE tournament_id = $2 AND round = $3 AND order_in_round = $4`,
          [winnerCompetitorId, tournament_id, nextRound, nextOrder]
        );

        // Loser drops to Lower Bracket
        if (loserId) {
          if (wbRound === 1) {
            // Drops to LB Round 1 (round 101)
            const lbOrder = Math.ceil(order_in_round / 2);
            const isLbPosA = order_in_round % 2 !== 0;
            await client.query(
              `UPDATE tournament_matches
               SET ${isLbPosA ? 'competitor_a_id' : 'competitor_b_id'} = $1
               WHERE tournament_id = $2 AND round = 101 AND order_in_round = $3`,
              [loserId, tournament_id, lbOrder]
            );
          } else {
            // Drops to LB Major round: 100 + 2*(wbRound - 1)
            const lbTargetRound = 100 + 2 * (wbRound - 1);
            await client.query(
              `UPDATE tournament_matches
               SET competitor_b_id = $1
               WHERE tournament_id = $2 AND round = $3 AND order_in_round = $4`,
              [loserId, tournament_id, lbTargetRound, order_in_round]
            );
          }
        }
      } else {
        // WB Final:
        // Winner goes to Grand Final (Slot A)
        await client.query(
          `UPDATE tournament_matches
           SET competitor_a_id = $1
           WHERE tournament_id = $2 AND round = 200 AND order_in_round = 1`,
          [winnerCompetitorId, tournament_id]
        );

        // Loser drops to LB Final (Slot B)
        if (loserId) {
          await client.query(
            `UPDATE tournament_matches
             SET competitor_b_id = $1
             WHERE tournament_id = $2 AND round = $3 AND order_in_round = 1`,
            [loserId, tournament_id, maxLbRound]
          );
        }
      }
    } else if (bracket === 'lower' || (round >= 101 && round < 200)) {
      const lbRound = round - 100;
      const isLbFinal = round === maxLbRound;

      if (!isLbFinal) {
        const isMinorRound = lbRound % 2 !== 0; // 1, 3, 5... (intra-LB matches)
        if (isMinorRound) {
          // Winner advances to next LB Major round (same order, Slot A)
          await client.query(
            `UPDATE tournament_matches
             SET competitor_a_id = $1
             WHERE tournament_id = $2 AND round = $3 AND order_in_round = $4`,
            [winnerCompetitorId, tournament_id, round + 1, order_in_round]
          );
        } else {
          // Winner advances to next LB Minor round (order = ceil(order/2))
          const nextOrder = Math.ceil(order_in_round / 2);
          const isPosA = order_in_round % 2 !== 0;
          await client.query(
            `UPDATE tournament_matches
             SET ${isPosA ? 'competitor_a_id' : 'competitor_b_id'} = $1
             WHERE tournament_id = $2 AND round = $3 AND order_in_round = $4`,
            [winnerCompetitorId, tournament_id, round + 1, nextOrder]
          );
        }
      } else {
        // LB Final Winner advances to Grand Final (Slot B)
        await client.query(
          `UPDATE tournament_matches
           SET competitor_b_id = $1
           WHERE tournament_id = $2 AND round = 200 AND order_in_round = 1`,
          [winnerCompetitorId, tournament_id]
        );
      }
    }
  }
}

/**
 * Resolves whether a specific match should be played in BO1, BO3, or BO5
 * based on the tournament configuration, round, and stage (semifinal, grand final).
 */
export function resolveMatchFormat(
  tournamentConfig: any,
  matchRound: number,
  maxRound?: number,
  matchResult?: any
): "bo1" | "bo3" | "bo5" {
  const baseFormat = (tournamentConfig?.matchFormat || "bo1") as "bo1" | "bo3" | "bo5";
  const semiFormat = (tournamentConfig?.semiFinalFormat || baseFormat) as "bo1" | "bo3" | "bo5";
  const grandFormat = (tournamentConfig?.grandFinalFormat || baseFormat) as "bo1" | "bo3" | "bo5";

  const stage = matchResult?.stage;

  if ((stage === "final" || stage === "grand_final" || matchRound === 200) && !matchResult?.isThirdPlace) {
    return grandFormat;
  }
  if (stage === "semifinal" || stage === "wb_final" || stage === "lb_final" || stage === "bronze" || matchResult?.isThirdPlace) {
    return semiFormat;
  }

  if (maxRound && maxRound > 0) {
    if (matchRound === maxRound && !matchResult?.isThirdPlace) return grandFormat;
    if (matchRound === maxRound && matchResult?.isThirdPlace) return semiFormat;
    if (matchRound === maxRound - 1 && maxRound >= 2) return semiFormat;
  }

  return baseFormat;
}


