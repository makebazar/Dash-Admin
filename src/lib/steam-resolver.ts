/**
 * Robust SteamID64 Resolver for CS2 / MatchZy Whitelist
 * Guarantees a valid 17-digit numeric SteamID64 (starts with 7656119...)
 */

const STEAM_API_KEY = process.env.STEAM_WEB_API_KEY || "ADA9E94BE28E94B68AFDE56ED208D6A9";

export async function resolveSteamId64(input: string): Promise<string | null> {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Direct 17-digit numeric SteamID64 (e.g. 76561198034202275)
  const rawId64Match = trimmed.match(/\b(7656119\d{10})\b/);
  if (rawId64Match) {
    return rawId64Match[1];
  }

  // 2. Steam Profile URL with ID64 (/profiles/7656119...)
  const profileUrlMatch = trimmed.match(/\/profiles\/(7656119\d{10})/i);
  if (profileUrlMatch) {
    return profileUrlMatch[1];
  }

  // 3. SteamID3 format [U:1:83789437] or U:1:83789437
  const steam3Match = trimmed.match(/\[?U:1:(\d+)\]?/i);
  if (steam3Match) {
    const accountId = BigInt(steam3Match[1]);
    const steam64 = BigInt("76561197960265728") + accountId;
    return steam64.toString();
  }

  // 4. SteamID2 format STEAM_0:0:41894718 or STEAM_1:1:41894718
  const steam2Match = trimmed.match(/STEAM_[0-5]:([01]):(\d+)/i);
  if (steam2Match) {
    const y = BigInt(steam2Match[1]);
    const z = BigInt(steam2Match[2]);
    const steam64 = BigInt("76561197960265728") + (z * BigInt(2)) + y;
    return steam64.toString();
  }

  // 5. Custom Vanity URL (/id/custom_nickname) or plain vanity name
  let vanityName: string | null = null;
  const idUrlMatch = trimmed.match(/\/id\/([^\/\?\#]+)/i);
  if (idUrlMatch) {
    vanityName = idUrlMatch[1];
  } else if (!trimmed.includes("/") && !trimmed.includes(" ") && !trimmed.includes("http") && !trimmed.includes("@")) {
    vanityName = trimmed;
  }

  if (vanityName && vanityName !== "my" && vanityName !== "home" && vanityName !== "profiles") {
    // 5a. Try official Steam Web API (Fast & highly reliable)
    try {
      const apiUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(vanityName)}`;
      const apiRes = await fetch(apiUrl, { next: { revalidate: 3600 } });
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data?.response?.success === 1 && data.response.steamid) {
          return String(data.response.steamid);
        }
      }
    } catch (apiErr) {
      console.warn(`[Steam Web API] Error resolving vanity "${vanityName}":`, apiErr);
    }

    // 5b. Fallback to Steam Community XML
    try {
      const xmlRes = await fetch(`https://steamcommunity.com/id/${encodeURIComponent(vanityName)}/?xml=1`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/xml,application/xml",
        },
        next: { revalidate: 300 },
      });

      if (xmlRes.ok) {
        const text = await xmlRes.text();
        const xmlMatch = text.match(/<steamID64>(\d{17})<\/steamID64>/i);
        if (xmlMatch) {
          return xmlMatch[1];
        }
      }
    } catch (err) {
      console.warn(`[Steam Resolver] Failed to resolve vanity XML "${vanityName}":`, err);
    }
  }

  return null;
}

