import { describe, it, expect } from 'vitest';
import { calculateCs2MatchElo, calculateStandardMatchElo } from '../lib/elo';

describe('ELO Engine Tests', () => {
  describe('calculateStandardMatchElo', () => {
    it('should calculate basic ELO changes for 1v1 match', () => {
      // Two players with equal ELO (1000) and same matches played (10 - calibrated)
      const res = calculateStandardMatchElo(1000, 1000, 10, 10, true);

      expect(res.p1Change).toBe(13);
      expect(res.p2Change).toBe(-13);
      expect(res.p1NewElo).toBe(1013);
      expect(res.p2NewElo).toBe(987);
    });

    it('should apply higher K-factor for uncalibrated players', () => {
      // Player 1 is uncalibrated (matchesPlayed = 2, K = 80)
      // Player 2 is calibrated (matchesPlayed = 10, K = 25)
      const res = calculateStandardMatchElo(1000, 1000, 2, 10, true);

      // P1 won: expected outcome 0.5, K=80 -> +40 ELO
      expect(res.p1Change).toBe(40);
      // P2 lost: expected outcome 0.5, K=25 -> -13 ELO (symmetric to +13)
      expect(res.p2Change).toBe(-13);
    });
  });

  describe('calculateCs2MatchElo', () => {
    it('should adjust ELO change based on individual ADR performance', () => {
      // Team 1 wins
      const team1 = [
        { playerId: 'p1', elo: 1000, matchesPlayed: 10, adr: 120 }, // High ADR (carry)
        { playerId: 'p2', elo: 1000, matchesPlayed: 10, adr: 40 },  // Low ADR (carried)
      ];
      const team2 = [
        { playerId: 'p3', elo: 1000, matchesPlayed: 10, adr: 90 },
        { playerId: 'p4', elo: 1000, matchesPlayed: 10, adr: 70 },
      ];

      // Lobby Avg ADR = (120+40+90+70)/4 = 320 / 4 = 80
      // p1 ADR factor = 120 / 80 = 1.5
      // p2 ADR factor = 40 / 80 = 0.5
      const res = calculateCs2MatchElo(team1, team2, true);

      const p1Result = res.find(r => r.playerId === 'p1')!;
      const p2Result = res.find(r => r.playerId === 'p2')!;

      // Both won, base ELO is 12.5.
      // p1 has 1.5 multiplier -> 12.5 * 1.5 = 18.75 -> rounded to 19
      expect(p1Result.eloChange).toBe(19);
      // p2 has 0.5 multiplier -> 12.5 * 0.5 = 6.25 -> rounded to 6
      expect(p2Result.eloChange).toBe(6);
    });

    it('should mitigate ELO loss for outstanding players on a losing team', () => {
      // Team 1 loses, but p1 carries
      const team1 = [
        { playerId: 'p1', elo: 1000, matchesPlayed: 10, adr: 120 }, // High ADR on losing team
        { playerId: 'p2', elo: 1000, matchesPlayed: 10, adr: 40 },
      ];
      const team2 = [
        { playerId: 'p3', elo: 1000, matchesPlayed: 10, adr: 90 },
        { playerId: 'p4', elo: 1000, matchesPlayed: 10, adr: 70 },
      ];

      // Lobby Avg ADR = 80
      // p1 ADR factor = 1.5. Lost base ELO = -12.5.
      // Since lost, ELO change is base / factor -> -12.5 / 1.5 = -8.33 -> rounded to -8
      // p2 ADR factor = 0.5. Lost base ELO = -12.5.
      // ELO change is base / factor -> -12.5 / 0.5 = -25
      const res = calculateCs2MatchElo(team1, team2, false);

      const p1Result = res.find(r => r.playerId === 'p1')!;
      const p2Result = res.find(r => r.playerId === 'p2')!;

      expect(p1Result.eloChange).toBe(-8);
      expect(p2Result.eloChange).toBe(-25);
    });
  });
});
