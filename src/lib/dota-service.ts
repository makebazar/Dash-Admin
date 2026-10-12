/**
 * Dota 2 Public Profile & Stats Service
 * Powered by OpenDota API & Steam ID conversion
 * Converts SteamID64 to 32-bit AccountID and retrieves rank, MMR, winrate and top heroes.
 */

export interface DotaRankInfo {
  tier: number | null;
  name: string;
  nameRu: string;
  medal: "herald" | "guardian" | "crusader" | "archon" | "legend" | "ancient" | "divine" | "immortal" | "unranked";
  stars: number;
  leaderboardRank: number | null;
  color: string;
  badgeUrl: string;
}

export interface DotaTopHero {
  heroId: number;
  heroName: string;
  heroNameRu: string;
  games: number;
  winrate: number;
  iconUrl: string;
}

export interface DotaProfileData {
  accountId: number;
  steamId64: string;
  personaname: string | null;
  avatar: string | null;
  rankTier: number | null;
  rank: DotaRankInfo;
  mmr: number | null;
  winrate: number | null;
  matches: number | null;
  wins: number;
  losses: number;
  topHeroes: DotaTopHero[];
  openDotaUrl: string;
  dotabuffUrl: string;
}

// Valve Dota 2 Hero IDs to localized names
export const DOTA_HEROES: Record<number, { name: string; nameRu: string; slug: string }> = {
  1: { name: "Anti-Mage", nameRu: "Anti-Mage", slug: "antimage" },
  2: { name: "Axe", nameRu: "Axe", slug: "axe" },
  3: { name: "Bane", nameRu: "Bane", slug: "bane" },
  4: { name: "Bloodseeker", nameRu: "Bloodseeker", slug: "bloodseeker" },
  5: { name: "Crystal Maiden", nameRu: "Crystal Maiden", slug: "crystal_maiden" },
  6: { name: "Drow Ranger", nameRu: "Drow Ranger", slug: "drow_ranger" },
  7: { name: "Earthshaker", nameRu: "Earthshaker", slug: "earthshaker" },
  8: { name: "Juggernaut", nameRu: "Juggernaut", slug: "juggernaut" },
  9: { name: "Mirana", nameRu: "Mirana", slug: "mirana" },
  10: { name: "Morphling", nameRu: "Morphling", slug: "morphling" },
  11: { name: "Shadow Fiend", nameRu: "Shadow Fiend", slug: "nevermore" },
  12: { name: "Phantom Lancer", nameRu: "Phantom Lancer", slug: "phantom_lancer" },
  13: { name: "Puck", nameRu: "Puck", slug: "puck" },
  14: { name: "Pudge", nameRu: "Pudge", slug: "pudge" },
  15: { name: "Razor", nameRu: "Razor", slug: "razor" },
  16: { name: "Sand King", nameRu: "Sand King", slug: "sand_king" },
  17: { name: "Storm Spirit", nameRu: "Storm Spirit", slug: "storm_spirit" },
  18: { name: "Sven", nameRu: "Sven", slug: "sven" },
  19: { name: "Tiny", nameRu: "Tiny", slug: "tiny" },
  20: { name: "Vengeful Spirit", nameRu: "Vengeful Spirit", slug: "vengefulspirit" },
  21: { name: "Windranger", nameRu: "Windranger", slug: "windrunner" },
  22: { name: "Zeus", nameRu: "Zeus", slug: "zuus" },
  23: { name: "Kunkka", nameRu: "Kunkka", slug: "kunkka" },
  25: { name: "Lina", nameRu: "Lina", slug: "lina" },
  26: { name: "Lion", nameRu: "Lion", slug: "lion" },
  27: { name: "Shadow Shaman", nameRu: "Shadow Shaman", slug: "shadow_shaman" },
  28: { name: "Slardar", nameRu: "Slardar", slug: "slardar" },
  29: { name: "Tidehunter", nameRu: "Tidehunter", slug: "tidehunter" },
  30: { name: "Witch Doctor", nameRu: "Witch Doctor", slug: "witch_doctor" },
  31: { name: "Lich", nameRu: "Lich", slug: "lich" },
  32: { name: "Riki", nameRu: "Riki", slug: "riki" },
  33: { name: "Enigma", nameRu: "Enigma", slug: "enigma" },
  34: { name: "Tinker", nameRu: "Tinker", slug: "tinker" },
  35: { name: "Sniper", nameRu: "Sniper", slug: "sniper" },
  36: { name: "Necrophos", nameRu: "Necrophos", slug: "necrolyte" },
  37: { name: "Warlock", nameRu: "Warlock", slug: "warlock" },
  38: { name: "Beastmaster", nameRu: "Beastmaster", slug: "beastmaster" },
  39: { name: "Queen of Pain", nameRu: "Queen of Pain", slug: "queenofpain" },
  40: { name: "Venomancer", nameRu: "Venomancer", slug: "venomancer" },
  41: { name: "Faceless Void", nameRu: "Faceless Void", slug: "faceless_void" },
  42: { name: "Wraith King", nameRu: "Wraith King", slug: "skeleton_king" },
  43: { name: "Death Prophet", nameRu: "Death Prophet", slug: "death_prophet" },
  44: { name: "Phantom Assassin", nameRu: "Phantom Assassin", slug: "phantom_assassin" },
  45: { name: "Pugna", nameRu: "Pugna", slug: "pugna" },
  46: { name: "Templar Assassin", nameRu: "Templar Assassin", slug: "templar_assassin" },
  47: { name: "Viper", nameRu: "Viper", slug: "viper" },
  48: { name: "Luna", nameRu: "Luna", slug: "luna" },
  49: { name: "Dragon Knight", nameRu: "Dragon Knight", slug: "dragon_knight" },
  50: { name: "Dazzle", nameRu: "Dazzle", slug: "dazzle" },
  51: { name: "Clockwerk", nameRu: "Clockwerk", slug: "rattletrap" },
  52: { name: "Leshrac", nameRu: "Leshrac", slug: "leshrac" },
  53: { name: "Nature's Prophet", nameRu: "Nature's Prophet", slug: "furion" },
  54: { name: "Lifestealer", nameRu: "Lifestealer", slug: "life_stealer" },
  55: { name: "Dark Seer", nameRu: "Dark Seer", slug: "dark_seer" },
  56: { name: "Clinkz", nameRu: "Clinkz", slug: "clinkz" },
  57: { name: "Omniknight", nameRu: "Omniknight", slug: "omniknight" },
  58: { name: "Enchantress", nameRu: "Enchantress", slug: "enchantress" },
  59: { name: "Huskar", nameRu: "Huskar", slug: "huskar" },
  60: { name: "Night Stalker", nameRu: "Night Stalker", slug: "night_stalker" },
  61: { name: "Broodmother", nameRu: "Broodmother", slug: "broodmother" },
  62: { name: "Bounty Hunter", nameRu: "Bounty Hunter", slug: "bounty_hunter" },
  63: { name: "Weaver", nameRu: "Weaver", slug: "weaver" },
  64: { name: "Jakiro", nameRu: "Jakiro", slug: "jakiro" },
  65: { name: "Batrider", nameRu: "Batrider", slug: "batrider" },
  66: { name: "Chen", nameRu: "Chen", slug: "chen" },
  67: { name: "Spectre", nameRu: "Spectre", slug: "spectre" },
  68: { name: "Ancient Apparition", nameRu: "Ancient Apparition", slug: "ancient_apparition" },
  69: { name: "Doom", nameRu: "Doom", slug: "doom_bringer" },
  70: { name: "Ursa", nameRu: "Ursa", slug: "ursa" },
  71: { name: "Spirit Breaker", nameRu: "Spirit Breaker", slug: "spirit_breaker" },
  72: { name: "Gyrocopter", nameRu: "Gyrocopter", slug: "gyrocopter" },
  73: { name: "Alchemist", nameRu: "Alchemist", slug: "alchemist" },
  74: { name: "Invoker", nameRu: "Invoker", slug: "invoker" },
  75: { name: "Silencer", nameRu: "Silencer", slug: "silencer" },
  76: { name: "Outworld Destroyer", nameRu: "Outworld Destroyer", slug: "obsidian_destroyer" },
  77: { name: "Lycan", nameRu: "Lycan", slug: "lycan" },
  78: { name: "Brewmaster", nameRu: "Brewmaster", slug: "brewmaster" },
  79: { name: "Shadow Demon", nameRu: "Shadow Demon", slug: "shadow_demon" },
  80: { name: "Lone Druid", nameRu: "Lone Druid", slug: "lone_druid" },
  81: { name: "Chaos Knight", nameRu: "Chaos Knight", slug: "chaos_knight" },
  82: { name: "Meepo", nameRu: "Meepo", slug: "meepo" },
  83: { name: "Treant Protector", nameRu: "Treant Protector", slug: "treant" },
  84: { name: "Ogre Magi", nameRu: "Ogre Magi", slug: "ogre_magi" },
  85: { name: "Undying", nameRu: "Undying", slug: "undying" },
  86: { name: "Rubick", nameRu: "Rubick", slug: "rubick" },
  87: { name: "Disruptor", nameRu: "Disruptor", slug: "disruptor" },
  88: { name: "Nyx Assassin", nameRu: "Nyx Assassin", slug: "nyx_assassin" },
  89: { name: "Naga Siren", nameRu: "Naga Siren", slug: "naga_siren" },
  90: { name: "Keeper of the Light", nameRu: "Keeper of the Light", slug: "keeper_of_the_light" },
  91: { name: "Io", nameRu: "Io", slug: "wisp" },
  92: { name: "Visage", nameRu: "Visage", slug: "visage" },
  93: { name: "Slark", nameRu: "Slark", slug: "slark" },
  94: { name: "Medusa", nameRu: "Medusa", slug: "medusa" },
  95: { name: "Troll Warlord", nameRu: "Troll Warlord", slug: "troll_warlord" },
  96: { name: "Centaur Warrunner", nameRu: "Centaur Warrunner", slug: "centaur" },
  97: { name: "Magnus", nameRu: "Magnus", slug: "magnataur" },
  98: { name: "Timbersaw", nameRu: "Timbersaw", slug: "shredder" },
  99: { name: "Bristleback", nameRu: "Bristleback", slug: "bristleback" },
  100: { name: "Tusk", nameRu: "Tusk", slug: "tusk" },
  101: { name: "Skywrath Mage", nameRu: "Skywrath Mage", slug: "skywrath_mage" },
  102: { name: "Abaddon", nameRu: "Abaddon", slug: "abaddon" },
  103: { name: "Elder Titan", nameRu: "Elder Titan", slug: "elder_titan" },
  104: { name: "Legion Commander", nameRu: "Legion Commander", slug: "legion_commander" },
  105: { name: "Techies", nameRu: "Techies", slug: "techies" },
  106: { name: "Ember Spirit", nameRu: "Ember Spirit", slug: "ember_spirit" },
  107: { name: "Earth Spirit", nameRu: "Earth Spirit", slug: "earth_spirit" },
  108: { name: "Underlord", nameRu: "Underlord", slug: "abyssal_underlord" },
  109: { name: "Terrorblade", nameRu: "Terrorblade", slug: "terrorblade" },
  110: { name: "Phoenix", nameRu: "Phoenix", slug: "phoenix" },
  111: { name: "Oracle", nameRu: "Oracle", slug: "oracle" },
  112: { name: "Winter Wyvern", nameRu: "Winter Wyvern", slug: "winter_wyvern" },
  113: { name: "Arc Warden", nameRu: "Arc Warden", slug: "arc_warden" },
  114: { name: "Monkey King", nameRu: "Monkey King", slug: "monkey_king" },
  119: { name: "Dark Willow", nameRu: "Dark Willow", slug: "dark_willow" },
  120: { name: "Pangolier", nameRu: "Pangolier", slug: "pangolier" },
  121: { name: "Grimstroke", nameRu: "Grimstroke", slug: "grimstroke" },
  123: { name: "Hoodwink", nameRu: "Hoodwink", slug: "hoodwink" },
  126: { name: "Void Spirit", nameRu: "Void Spirit", slug: "void_spirit" },
  128: { name: "Snapfire", nameRu: "Snapfire", slug: "snapfire" },
  129: { name: "Mars", nameRu: "Mars", slug: "mars" },
  131: { name: "Ringmaster", nameRu: "Ringmaster", slug: "ringmaster" },
  135: { name: "Dawnbreaker", nameRu: "Dawnbreaker", slug: "dawnbreaker" },
  136: { name: "Marci", nameRu: "Marci", slug: "marci" },
  137: { name: "Primal Beast", nameRu: "Primal Beast", slug: "primal_beast" },
  138: { name: "Muerta", nameRu: "Muerta", slug: "muerta" },
  145: { name: "Kez", nameRu: "Kez", slug: "kez" },
};

/**
 * Converts 64-bit SteamID to 32-bit AccountID
 */
export function steamId64ToAccountId(steamId64: string): number | null {
  if (!steamId64) return null;
  const clean = steamId64.trim();
  if (/^\d{6,10}$/.test(clean)) {
    return parseInt(clean, 10);
  }
  if (!/^\d{17}$/.test(clean)) return null;
  try {
    const id64 = BigInt(clean);
    const base = BigInt("76561197960265728");
    if (id64 <= base) return null;
    return Number(id64 - base);
  } catch {
    return null;
  }
}

/**
 * Converts 32-bit AccountID back to 64-bit SteamID
 */
export function accountIdToSteamId64(accountId: number): string {
  const base = BigInt("76561197960265728");
  return (base + BigInt(accountId)).toString();
}

/**
 * Parses OpenDota rank_tier (e.g. 11-80) into localized rank details and medals
 */
export function parseDotaRank(rankTier: number | null, leaderboardRank?: number | null): DotaRankInfo {
  if (!rankTier || rankTier < 10) {
    return {
      tier: null,
      name: "Unranked",
      nameRu: "Без ранга",
      medal: "unranked",
      stars: 0,
      leaderboardRank: null,
      color: "#94a3b8",
      badgeUrl: "https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_0.png",
    };
  }

  const medalNum = Math.floor(rankTier / 10);
  const stars = rankTier % 10;

  const MEDALS: Record<number, { name: string; nameRu: string; medal: DotaRankInfo["medal"]; color: string }> = {
    1: { name: "Herald", nameRu: "Рекрут", medal: "herald", color: "#64748b" },
    2: { name: "Guardian", nameRu: "Страж", medal: "guardian", color: "#475569" },
    3: { name: "Crusader", nameRu: "Рыцарь", medal: "crusader", color: "#38bdf8" },
    4: { name: "Archon", nameRu: "Герой", medal: "archon", color: "#fbbf24" },
    5: { name: "Legend", nameRu: "Легенда", medal: "legend", color: "#f97316" },
    6: { name: "Ancient", nameRu: "Властелин", medal: "ancient", color: "#a855f7" },
    7: { name: "Divine", nameRu: "Божество", medal: "divine", color: "#ec4899" },
    8: { name: "Immortal", nameRu: "Титан", medal: "immortal", color: "#e11d48" },
  };

  const meta = MEDALS[medalNum] || { name: "Rank", nameRu: "Ранг", medal: "unranked", color: "#94a3b8" };

  let name = `${meta.name} ${stars > 0 ? stars : ""}`.trim();
  let nameRu = `${meta.nameRu} ${stars > 0 ? stars : ""}`.trim();

  if (medalNum === 8) {
    if (leaderboardRank && leaderboardRank > 0) {
      name = `Immortal #${leaderboardRank}`;
      nameRu = `Титан #${leaderboardRank}`;
    } else {
      name = "Immortal";
      nameRu = "Титан";
    }
  }

  const badgeUrl = `https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_${medalNum}.png`;

  return {
    tier: rankTier,
    name,
    nameRu,
    medal: meta.medal,
    stars,
    leaderboardRank: leaderboardRank || null,
    color: meta.color,
    badgeUrl,
  };
}

/**
 * Approximate MMR calculated from rank_tier when exact MMR is hidden by player
 */
export function estimateMmrFromRankTier(rankTier: number | null): number | null {
  if (!rankTier || rankTier < 10) return null;
  const medal = Math.floor(rankTier / 10);
  const stars = Math.max(1, Math.min(5, rankTier % 10));

  // Base MMR per medal (approximate Valve thresholds)
  const baseMmr: Record<number, number> = {
    1: 150,   // Herald
    2: 770,   // Guardian
    3: 1540,  // Crusader
    4: 2310,  // Archon
    5: 3080,  // Legend
    6: 3850,  // Ancient
    7: 4620,  // Divine
    8: 5620,  // Immortal
  };

  const start = baseMmr[medal] || 1000;
  return start + (stars - 1) * 154;
}

/**
 * Fetches Dota 2 profile data from OpenDota by SteamID64 or 32-bit AccountID
 */
export async function fetchDotaStats(steamIdOrAccountId: string): Promise<DotaProfileData | null> {
  const accountId = steamId64ToAccountId(steamIdOrAccountId);
  if (!accountId) return null;

  try {
    const [profileRes, wlRes, heroesRes] = await Promise.all([
      fetch(`https://api.opendota.com/api/players/${accountId}`, {
        headers: { "User-Agent": "DashAdmin/1.0" },
        next: { revalidate: 300 },
      }),
      fetch(`https://api.opendota.com/api/players/${accountId}/wl`, {
        headers: { "User-Agent": "DashAdmin/1.0" },
        next: { revalidate: 300 },
      }),
      fetch(`https://api.opendota.com/api/players/${accountId}/heroes`, {
        headers: { "User-Agent": "DashAdmin/1.0" },
        next: { revalidate: 300 },
      }),
    ]);

    if (!profileRes.ok) {
      console.warn(`[Dota Service] OpenDota returned ${profileRes.status} for ${accountId}`);
      return null;
    }

    const data = await profileRes.json();
    const wl = wlRes.ok ? await wlRes.json() : { win: 0, lose: 0 };
    const heroesData = heroesRes.ok ? await heroesRes.json() : [];

    const wins = typeof wl.win === "number" ? wl.win : 0;
    const losses = typeof wl.lose === "number" ? wl.lose : 0;
    const totalMatches = wins + losses;
    const winrate = totalMatches > 0 ? parseFloat(((wins / totalMatches) * 100).toFixed(1)) : null;

    const rankTier = typeof data.rank_tier === "number" ? data.rank_tier : null;
    const leaderboardRank = typeof data.leaderboard_rank === "number" ? data.leaderboard_rank : null;
    const rank = parseDotaRank(rankTier, leaderboardRank);

    // MMR estimate: prefer OpenDota's estimate or fallback to rank tier calculation
    let mmr: number | null = null;
    if (data.mmr_estimate?.estimate) {
      mmr = Number(data.mmr_estimate.estimate);
    } else if (rankTier) {
      mmr = estimateMmrFromRankTier(rankTier);
    }

    // Top 3 heroes
    const sortedHeroes = Array.isArray(heroesData)
      ? heroesData
          .filter((h: any) => h.games > 0)
          .sort((a: any, b: any) => b.games - a.games)
          .slice(0, 3)
          .map((h: any) => {
            const hid = parseInt(h.hero_id, 10);
            const hMeta = DOTA_HEROES[hid] || { name: `Hero #${hid}`, nameRu: `Герой #${hid}`, slug: "unknown" };
            const hWr = h.games > 0 ? parseFloat(((h.win / h.games) * 100).toFixed(1)) : 0;
            return {
              heroId: hid,
              heroName: hMeta.name,
              heroNameRu: hMeta.nameRu,
              games: h.games,
              winrate: hWr,
              iconUrl: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${hMeta.slug}.png`,
            };
          })
      : [];

    const steamId64 = accountIdToSteamId64(accountId);

    return {
      accountId,
      steamId64,
      personaname: data.profile?.personaname || null,
      avatar: data.profile?.avatarfull || data.profile?.avatar || null,
      rankTier,
      rank,
      mmr,
      winrate,
      matches: totalMatches > 0 ? totalMatches : null,
      wins,
      losses,
      topHeroes: sortedHeroes,
      openDotaUrl: `https://www.opendota.com/players/${accountId}`,
      dotabuffUrl: `https://www.dotabuff.com/players/${accountId}`,
    };
  } catch (err) {
    console.error(`[Dota Service] Error fetching stats for ${accountId}:`, err);
    return null;
  }
}
