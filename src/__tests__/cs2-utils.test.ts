import { describe, it, expect } from "vitest";
import { getNumericMatchId, parseCs2StatusPlayers } from "@/lib/cs2/utils";
import { resolveSteamId64 } from "@/lib/steam-resolver";

describe("CS2 & MatchZy Utils", () => {
  it("getNumericMatchId returns valid positive 31-bit integers", () => {
    const id1 = getNumericMatchId("dm-muudb7sd-60496f");
    const id2 = getNumericMatchId("dm-muudb7sd-60496f");
    const id3 = getNumericMatchId("12345");

    expect(id1).toBeGreaterThan(0);
    expect(id1).toBeLessThanOrEqual(2147483647);
    expect(id1).toBe(id2); // Deterministic
    expect(id3).toBe(12345);
  });

  it("parseCs2StatusPlayers parses CS2 dedicated server status outputs", () => {
    const sampleOutput = `
hostname: DashMatch: Team 1 vs Team 2
version : 1.40.5.2/14052 10188 secure
udp/ip  : 127.0.0.1:27015
os      : Windows Dedicated
# userid client_slot name ping loss state rate
# 2 1 "S1mple" 76561198034202275 00:42 15 0 active 127.0.0.1:27005
# 3 2 "BOT Vitaliy" BOT active
# 4 3 "B1t" [U:1:83789437] 00:15 22 0 active 127.0.0.1:27006
    `;

    const players = parseCs2StatusPlayers(sampleOutput);
    expect(players.length).toBe(3);

    expect(players[0].name).toBe("S1mple");
    expect(players[0].steamId).toBe("76561198034202275");
    expect(players[0].isBot).toBe(false);

    expect(players[1].name).toBe("BOT Vitaliy");
    expect(players[1].isBot).toBe(true);

    expect(players[2].name).toBe("B1t");
    expect(players[2].steamId).toBe("[U:1:83789437]");
    expect(players[2].isBot).toBe(false);
  });

  it("resolveSteamId64 handles all common Steam ID formats", async () => {
    // 1. Direct SteamID64
    expect(await resolveSteamId64("76561198034202275")).toBe("76561198034202275");
    // 2. Profile URL
    expect(await resolveSteamId64("https://steamcommunity.com/profiles/76561198034202275/")).toBe("76561198034202275");
    // 3. SteamID3
    expect(await resolveSteamId64("[U:1:73936547]")).toBe("76561198034202275");
    // 4. SteamID2
    expect(await resolveSteamId64("STEAM_0:1:36968273")).toBe("76561198034202275");
  });
});

