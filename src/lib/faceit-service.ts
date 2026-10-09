/**
 * Faceit Public Profile & Stats Parser
 * Supports official Open Faceit API (with FACEIT_API_KEY) and fallback manual resolution.
 */

export interface FaceitProfileData {
  nickname: string;
  userId: string | null;
  steamId64: string | null;
  avatar: string | null;
  level: number | null;
  elo: number | null;
  kd: number | null;
  winrate: number | null;
  matches: number | null;
}

export function extractFaceitNickname(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  
  // Check if it's a URL (e.g. https://www.faceit.com/ru/players/bALLImAk or https://faceit.com/en/players/s1mple)
  const match = trimmed.match(/(?:faceit\.com\/[a-z]{2}\/players\/|faceit\.com\/players\/)([^\/\?\#]+)/i);
  if (match && match[1]) {
    return decodeURIComponent(match[1].trim());
  }

  // If simple string without spaces and without slashes
  if (!trimmed.includes("/") && !trimmed.includes(" ")) {
    return trimmed;
  }

  return null;
}

export function calculateFaceitLevel(elo: number): number {
  if (!elo || elo <= 0) return 1;
  if (elo >= 2001) return 10;
  if (elo >= 1751) return 9;
  if (elo >= 1531) return 8;
  if (elo >= 1351) return 7;
  if (elo >= 1201) return 6;
  if (elo >= 1051) return 5;
  if (elo >= 901) return 4;
  if (elo >= 751) return 3;
  if (elo >= 501) return 2;
  return 1;
}

export async function fetchFaceitStats(urlOrNickname: string): Promise<FaceitProfileData | null> {
  const nickname = extractFaceitNickname(urlOrNickname);
  if (!nickname) return null;

  const apiKey = process.env.FACEIT_API_KEY;

  // 1. If FACEIT_API_KEY is configured, use official Open Faceit API v4
  if (apiKey) {
    try {
      const userRes = await fetch(`https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(nickname)}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
        next: { revalidate: 60 },
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        const userId = userData.player_id || userData.id;
        const resolvedNickname = userData.nickname || nickname;
        const avatar = userData.avatar || null;

        const cs2Game = userData.games?.cs2 || userData.games?.csgo || {};
        const elo = cs2Game.faceit_elo ? Number(cs2Game.faceit_elo) : null;
        const level = cs2Game.skill_level ? Number(cs2Game.skill_level) : (elo ? calculateFaceitLevel(elo) : null);
        const steamId64 = cs2Game.game_player_id || userData.platforms?.steam || null;

        let kd: number | null = null;
        let winrate: number | null = null;
        let matches: number | null = null;

        // Fetch CS2 lifetime stats
        try {
          const statsRes = await fetch(`https://open.faceit.com/data/v4/players/${userId}/stats/cs2`, {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Accept": "application/json",
            },
            next: { revalidate: 60 },
          });

          if (statsRes.ok) {
            const statsData = await statsRes.json();
            const lifetime = statsData?.lifetime || statsData;
            if (lifetime) {
              const rawKd = lifetime["Average K/D Ratio"] || lifetime["k6"] || lifetime.kd;
              if (rawKd) kd = parseFloat(String(rawKd));

              const rawWr = lifetime["Win Rate %"] || lifetime["k1"] || lifetime.win_rate;
              if (rawWr) winrate = parseFloat(String(rawWr).replace("%", ""));

              const rawMatches = lifetime["Matches"] || lifetime["m1"] || lifetime.matches;
              if (rawMatches) matches = parseInt(String(rawMatches));
            }
          }
        } catch (e) {
          console.warn(`[Faceit Service] CS2 Stats lookup failed for ${userId}:`, e);
        }

        return {
          nickname: resolvedNickname,
          userId,
          steamId64,
          avatar,
          level,
          elo,
          kd,
          winrate,
          matches,
        };
      }
    } catch (err) {
      console.error(`[Faceit Service] Open Faceit API error:`, err);
    }
  }

  // 2. Fallback attempt: Public web endpoint (may be Cloudflare challenged)
  try {
    const publicRes = await fetch(`https://api.faceit.com/users/v1/nicknames/${encodeURIComponent(nickname)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 60 },
    });

    if (publicRes.ok) {
      const userData = await publicRes.json();
      const payload = userData?.payload || userData;
      if (payload?.id) {
        const userId = payload.id;
        const resolvedNickname = payload.nickname || nickname;
        const avatar = payload.avatar || null;
        const cs2Game = payload.games?.cs2 || payload.games?.csgo || {};
        const elo = cs2Game.faceit_elo ? Number(cs2Game.faceit_elo) : null;
        const level = cs2Game.skill_level ? Number(cs2Game.skill_level) : (elo ? calculateFaceitLevel(elo) : null);
        const steamId64 = cs2Game.game_player_id || payload.steam_id_64 || payload.platforms?.steam?.id || null;

        return {
          nickname: resolvedNickname,
          userId,
          steamId64,
          avatar,
          level,
          elo,
          kd: null,
          winrate: null,
          matches: null,
        };
      }
    }
  } catch (err) {
    // Cloudflare or network error
  }

  return null;
}
