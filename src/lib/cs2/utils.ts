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
    } else {
      // New CS2 format without '#' and without SteamID:
      //   2    02:06    0    0     active 786432 10.188.1.102:60971 'neutolim'
      //   3      BOT    0    0     active      0 'DemoRecorder'
      const match = trimmed.match(/^(\d+)\s+([^\s]+)\s+(\d+)\s+(\d+)\s+([^\s]+)\s+(\d+)\s*(.*?)\s*'([^']*)'$/);
      if (match) {
        const id = match[1];
        const time = match[2];
        const ping = match[3];
        const name = match[8];
        const isBot = time.toUpperCase() === "BOT" || /bot/i.test(name);
        
        players.push({
          id,
          name,
          steamId: isBot ? `bot_${id}` : `ID_${id}`,
          ping,
          isBot,
        });
      }
    }
  }

  return players;
}

/**
 * Known Steam Workshop map aliases mapping friendly shortnames to Steam Workshop IDs.
 */
export const CS2_WORKSHOP_MAP_ALIASES: Record<string, string> = {
  aim_map: "3070549948",
  awp_lego_2: "3810240726",
  awp_lego: "3810240726",
  aim_botz: "3070244462",
  aim_redline: "3070243672",
  aim_ak47: "3070243672",
  aim_headshot: "3070549948",
  aim_dust2: "3070549948",
  aim_pistol_cs2: "3070549948",
  aim_aztec: "3070549948",
};

/**
 * Normalizes map names, strips "workshop/", "ws:", URL params, and resolves workshop aliases to numeric IDs.
 * MatchZy requires pure numeric IDs for workshop maps in its maplist to execute `host_workshop_map <id>`.
 */
export function normalizeCS2Map(rawMap?: string): string {
  if (!rawMap) return "de_dust2";
  const trimmed = rawMap.trim();
  if (!trimmed) return "de_dust2";

  // URL format: steamcommunity.com/sharedfiles/filedetails/?id=3070549948
  const urlMatch = trimmed.match(/[?&]id=(\d+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Prefix format: workshop/3070549948, ws:3070549948, workshop:3070549948
  const wsPrefixMatch = trimmed.match(/^(?:workshop\/|ws:|workshop:)?(\d+)$/i);
  if (wsPrefixMatch) {
    return wsPrefixMatch[1];
  }

  // Strip leading workshop/ if non-numeric
  const stripped = trimmed.replace(/^(?:workshop\/|ws:|workshop:)/i, "").trim();

  // Alias lookup
  const aliasId = CS2_WORKSHOP_MAP_ALIASES[stripped.toLowerCase()] || CS2_WORKSHOP_MAP_ALIASES[trimmed.toLowerCase()];
  if (aliasId) {
    return aliasId;
  }

  return stripped || "de_dust2";
}

/**
 * Returns true if the map is a Steam Workshop map (numeric ID).
 */
export function isWorkshopMap(mapName?: string): boolean {
  const norm = normalizeCS2Map(mapName);
  return /^\d+$/.test(norm);
}

