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
  competitorIds: string[]
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

  // Generate round robin pairings for each group
  for (let g = 0; g < numGroups; g++) {
    const groupLabel = String.fromCharCode(65 + g); // A, B, C, D
    const groupComps = groups[g];

    let order = 1;
    for (let i = 0; i < groupComps.length; i++) {
      for (let j = i + 1; j < groupComps.length; j++) {
        await client.query(
          `INSERT INTO tournament_matches (tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, status, result)
           VALUES ($1, 0, $2, $3, $4, 'SCHEDULED', $5)`,
          [tournamentId, order, groupComps[i], groupComps[j], JSON.stringify({ group: groupLabel })]
        );
        order++;
      }
    }
  }
}

/**
 * Generates Playoff Bracket matches (round = 1, 2, 3...) for Single Elimination.
 */
export async function generatePlayoffs(
  client: PoolClient,
  tournamentId: string,
  competitorIds: string[]
): Promise<void> {
  // Shuffle or seed
  const competitors = [...competitorIds].sort(() => Math.random() - 0.5);
  const N = competitors.length;

  // Find nearest power of 2
  let power = 1;
  while (power < N) power *= 2;

  const numByes = power - N;
  const round1Size = power / 2;

  let compIndex = 0;
  for (let i = 1; i <= round1Size; i++) {
    const compA = competitors[compIndex++] || null;
    let compB = null;

    if (numByes >= i) {
      // This match has a bye: compA advances automatically
      // We will create the match, but mark it completed immediately
      await client.query(
        `INSERT INTO tournament_matches (tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, status, winner_competitor_id)
         VALUES ($1, 1, $2, $3, NULL, 'FINISHED', $3)`,
        [tournamentId, i, compA]
      );
    } else {
      compB = competitors[compIndex++] || null;
      await client.query(
        `INSERT INTO tournament_matches (tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, status)
         VALUES ($1, 1, $2, $3, $4, 'SCHEDULED')`,
        [tournamentId, i, compA, compB]
      );
    }
  }

  // Create empty slots for subsequent rounds
  let currentRoundSize = round1Size;
  let round = 1;
  while (currentRoundSize > 1) {
    round++;
    currentRoundSize /= 2;
    for (let i = 1; i <= currentRoundSize; i++) {
      await client.query(
        `INSERT INTO tournament_matches (tournament_id, round, order_in_round, competitor_a_id, competitor_b_id, status)
         VALUES ($1, $2, $3, NULL, NULL, 'SCHEDULED')`,
        [tournamentId, round, i]
      );
    }
  }
}

/**
 * Progresses the bracket when a match finishes.
 * If round = 0 (groups), we do nothing automatically (admin resolves group outcomes).
 * If round >= 1, we advance the winner to the next round slot.
 */
export async function advancePlayoffWinner(
  client: PoolClient,
  matchId: string,
  winnerCompetitorId: string
): Promise<void> {
  const matchRes = await client.query(
    `SELECT tournament_id, round, order_in_round FROM tournament_matches WHERE id = $1`,
    [matchId]
  );
  if (matchRes.rowCount === 0) return;

  const { tournament_id, round, order_in_round } = matchRes.rows[0];
  if (round === 0) return; // Group matches are processed differently

  const nextRound = round + 1;
  const nextOrder = Math.ceil(order_in_round / 2);
  const isPositionA = order_in_round % 2 !== 0;

  // Update next round's slot
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
}
