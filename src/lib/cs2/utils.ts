/**
 * CS2 & MatchZy Utilities for DashAdmin
 */

/**
 * Generates a stable positive 31-bit integer ID for MatchZy (1 <= id <= 2,000,000,000).
 * MatchZy requires matchid in JSON configs and events to be a valid integer between 0 and 2147483647.
 */
export function getNumericMatchId(str: string): number {
  if (!str) return 1;
  const num = parseInt(str, 10);
  if (!isNaN(num) && num > 0 && num <= 2147483647) {
    return num;
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 2000000000) + 1;
}

export interface ParsedCs2Player {
  id: string; // userid
  name: string;
  steamId: string; // SteamID64 or SteamID3/2 or bot_id
  ping: string;
  isBot: boolean;
}

/**
 * Robust parser for CS2 dedicated server `status` and `css_players` console outputs.
 */
export function parseCs2StatusPlayers(rconText?: string): ParsedCs2Player[] {
  if (!rconText) return [];
  const players: ParsedCs2Player[] = [];
  const lines = rconText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip status headers
    if (
      trimmed.startsWith("# userid") ||
      trimmed.startsWith("# name") ||
      trimmed.startsWith("hostname:") ||
      trimmed.startsWith("version :") ||
      trimmed.startsWith("udp/ip  :") ||
      trimmed.startsWith("os      :") ||
      trimmed.startsWith("type    :") ||
      trimmed.startsWith("map     :") ||
      trimmed.startsWith("players :")
    ) {
      continue;
    }

    // Standard CS2 status line format:
    // #  2 1 "PlayerName" [U:1:12345678] 00:45 32 0 active 127.0.0.1:27005
    // or
    // # 2 "PlayerName" STEAM_1:0:123456789 15 ...
    // or
    // # 3 2 "BOT Vitaliy" BOT active
    if (trimmed.startsWith("#")) {
      const isBot = /bot/i.test(trimmed);
      const nameMatch = trimmed.match(/"([^"]+)"/);
      const name = nameMatch ? nameMatch[1] : "";

      // User ID (# 2 or #  2 1)
      const idMatch = trimmed.match(/^#\s*(\d+)/);
      const id = idMatch ? idMatch[1] : "";

      if (name) {
        // Find ping if present
        const pingMatch = trimmed.match(/\s+(\d+)\s+(?:active|spawning|challenging)/i) ||
          trimmed.match(/\d+:\d+\s+(\d+)/);
        const ping = pingMatch ? pingMatch[1] : "0";

        // Find SteamID (SteamID64, SteamID3, or SteamID2)
        const steam64Match = trimmed.match(/(7656\d{13})/);
        const steam3Match = trimmed.match(/(\[U:1:\d+\])/);
        const steam2Match = trimmed.match(/(STEAM_[0-5]:[01]:\d+)/);

        let steamId = "";
        if (steam64Match) {
          steamId = steam64Match[1];
        } else if (steam3Match) {
          steamId = steam3Match[1];
        } else if (steam2Match) {
          steamId = steam2Match[1];
        } else if (isBot) {
          steamId = `bot_${id || name}`;
        } else {
          steamId = `ID_${id || name}`;
        }

        players.push({
          id: id || steamId,
          name,
          steamId,
          ping,
          isBot,
        });
      }
    } else if (trimmed.includes("[CSS]") && trimmed.includes("(") && trimmed.includes(")")) {
      // CounterStrikeSharp list format: [CSS] Nickname (76561198012345678)
      const match = trimmed.match(/(?:\[CSS\]\s*)?(?:#\d+:\s*)?([^(]+)\s*\((7656\d{13})\)/);
      if (match) {
        players.push({
          id: match[2].trim(),
          name: match[1].replace(/\[CSS\]\s*/g, '').trim(),
          steamId: match[2].trim(),
          ping: "0",
          isBot: false,
        });
      }
    }
  }

  return players;
}
