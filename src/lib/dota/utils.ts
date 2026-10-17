/**
 * Utility functions for Dota 2 tournament lobbies and matches.
 */

export function formatDotaGameMode(
  mode?: string | null,
  tourneyType?: string | null,
  tourneyConfig?: any
): string {
  const m = (mode || tourneyConfig?.gameMode || tourneyConfig?.settings?.gameMode || "").toUpperCase();
  const t = (tourneyType || tourneyConfig?.type || tourneyConfig?.settings?.type || "").toLowerCase();

  if (m === "1V1MID" || m === "1V1" || t === "1vs1" || t === "solo") {
    return "1v1 Solo Mid";
  }
  if (m === "CM") return "Captains Mode";
  if (m === "AP") return "All Pick";
  if (m === "TURBO") return "Turbo";
  if (m === "CD") return "Captains Draft";
  if (m === "RD") return "Random Draft";
  if (m === "AR") return "All Random";

  if (mode && mode.trim()) return mode;
  return "Captains Mode";
}
