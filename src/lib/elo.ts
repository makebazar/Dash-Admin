/**
 * ELO Calculation Engine for DashAdmin Tournaments
 */

export interface EloPlayerInput {
  playerId: string;
  elo: number;
  matchesPlayed: number;
  adr: number; // Average Damage per Round
}

export interface EloCalculationResult {
  playerId: string;
  oldElo: number;
  newElo: number;
  eloChange: number;
  isCalibrated: boolean;
}

function roundSymmetric(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

/**
 * Calculates ELO changes for a CS2 match based on team averages and individual performance (ADR).
 */
export function calculateCs2MatchElo(
  team1Players: EloPlayerInput[],
  team2Players: EloPlayerInput[],
  team1Won: boolean
): EloCalculationResult[] {
  if (team1Players.length === 0 || team2Players.length === 0) {
    return [];
  }

  // 1. Calculate Average Team ELOs
  const avgEloTeam1 = team1Players.reduce((sum, p) => sum + p.elo, 0) / team1Players.length;
  const avgEloTeam2 = team2Players.reduce((sum, p) => sum + p.elo, 0) / team2Players.length;

  // 2. Calculate Lobby Average ADR
  const totalAdr =
    team1Players.reduce((sum, p) => sum + p.adr, 0) +
    team2Players.reduce((sum, p) => sum + p.adr, 0);
  const totalPlayers = team1Players.length + team2Players.length;
  const lobbyAvgAdr = totalPlayers > 0 ? totalAdr / totalPlayers : 80;

  const results: EloCalculationResult[] = [];

  // Helper to process a team
  const processTeam = (
    currentTeamPlayers: EloPlayerInput[],
    opponentAvgElo: number,
    won: boolean
  ) => {
    for (const player of currentTeamPlayers) {
      // Determine K-factor (calibration check)
      const kFactor = player.matchesPlayed < 5 ? 80 : 25;

      // Expected outcome for this player against opponent team average ELO
      const expectedOutcome = 1 / (1 + Math.pow(10, (opponentAvgElo - player.elo) / 400));
      const actualOutcome = won ? 1 : 0;

      // Base ELO change
      const baseEloChange = kFactor * (actualOutcome - expectedOutcome);

      // Performance adjustment (ADR factor)
      // Guard against zero division and handle edge cases
      const adrFactor = lobbyAvgAdr > 0 ? player.adr / lobbyAvgAdr : 1.0;
      // Clamp between 0.5 and 1.5
      const clampedFactor = Math.max(0.5, Math.min(1.5, adrFactor));

      let finalChange = 0;
      if (won) {
        // Multiplier for good performance when winning
        finalChange = baseEloChange * clampedFactor;
      } else {
        // Mitigation of loss for good performance when losing
        // Divisor decreases points lost when factor is high (>1.0)
        finalChange = baseEloChange / clampedFactor;
      }

      const eloChange = roundSymmetric(finalChange);
      const newElo = Math.max(100, player.elo + eloChange); // Minimum ELO floor is 100
      const newMatchesCount = player.matchesPlayed + 1;

      results.push({
        playerId: player.playerId,
        oldElo: player.elo,
        newElo,
        eloChange,
        isCalibrated: newMatchesCount >= 5,
      });
    }
  };

  // Process Team 1 (against Team 2's average ELO)
  processTeam(team1Players, avgEloTeam2, team1Won);

  // Process Team 2 (against Team 1's average ELO)
  processTeam(team2Players, avgEloTeam1, !team1Won);

  return results;
}

/**
 * Calculates ELO changes for standard 1v1 match (e.g. FIFA, UFC) with no individual performance metrics.
 */
export function calculateStandardMatchElo(
  player1Elo: number,
  player2Elo: number,
  player1MatchesPlayed: number,
  player2MatchesPlayed: number,
  p1Won: boolean
): { p1Change: number; p2Change: number; p1NewElo: number; p2NewElo: number } {
  const kFactorP1 = player1MatchesPlayed < 5 ? 80 : 25;
  const kFactorP2 = player2MatchesPlayed < 5 ? 80 : 25;

  const expectedOutcomeP1 = 1 / (1 + Math.pow(10, (player2Elo - player1Elo) / 400));
  const expectedOutcomeP2 = 1 - expectedOutcomeP1;

  const actualOutcomeP1 = p1Won ? 1 : 0;
  const actualOutcomeP2 = p1Won ? 0 : 1;

  const p1Change = roundSymmetric(kFactorP1 * (actualOutcomeP1 - expectedOutcomeP1));
  const p2Change = roundSymmetric(kFactorP2 * (actualOutcomeP2 - expectedOutcomeP2));

  return {
    p1Change,
    p2Change,
    p1NewElo: Math.max(100, player1Elo + p1Change),
    p2NewElo: Math.max(100, player2Elo + p2Change),
  };
}
