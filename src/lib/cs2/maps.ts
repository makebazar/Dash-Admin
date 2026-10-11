/**
 * CS2 Map Data and Previews for DashAdmin
 */

export interface CS2MapMeta {
  name: string;
  image: string;
  desc: string;
  type: "competitive" | "wingman" | "aim" | "classic" | "workshop";
}

export const CS2_STANDARD_MAPS: Record<string, CS2MapMeta> = {
  // 5v5 Premier & Active Duty
  de_mirage: {
    name: "Mirage",
    image: "/images/maps/de_mirage.png",
    desc: "Главный соревновательный выбор, открытые пленты и мид",
    type: "competitive",
  },
  de_dust2: {
    name: "Dust II",
    image: "/images/maps/de_dust2.png",
    desc: "Золотая классика Counter-Strike, длинные дуэли",
    type: "competitive",
  },
  de_inferno: {
    name: "Inferno",
    image: "/images/maps/de_inferno.png",
    desc: "Тактический контроль банана, ковров и апартаментов",
    type: "competitive",
  },
  de_nuke: {
    name: "Nuke",
    image: "/images/maps/de_nuke.png",
    desc: "Двухуровневый атомный комплекс, улица и рампа",
    type: "competitive",
  },
  de_ancient: {
    name: "Ancient",
    image: "/images/maps/de_ancient.png",
    desc: "Древние руины майя, джунгли и узкие коннекторы",
    type: "competitive",
  },
  de_anubis: {
    name: "Anubis",
    image: "/images/maps/de_anubis.png",
    desc: "Песчаные каналы, мост и быстрые размены",
    type: "competitive",
  },
  de_vertigo: {
    name: "Vertigo",
    image: "/images/maps/de_vertigo.png",
    desc: "Высотный небоскрёб на этапе строительства",
    type: "competitive",
  },
  de_overpass: {
    name: "Overpass",
    image: "/images/maps/de_overpass.png",
    desc: "Берлинский парк, каналы и эстакада",
    type: "competitive",
  },
  de_train: {
    name: "Train",
    image: "/images/maps/de_train.png",
    desc: "Железнодорожное депо, поезда и узкие переходы",
    type: "competitive",
  },
  cs_office: {
    name: "Office",
    image: "/images/maps/cs_office.png",
    desc: "Зимний офисный комплекс, спасение заложников",
    type: "classic",
  },
  cs_italy: {
    name: "Italy",
    image: "/images/maps/cs_italy.png",
    desc: "Итальянские улочки и винные погреба",
    type: "classic",
  },
};

export const CS2_DEFAULT_5V5_POOL = [
  "de_mirage",
  "de_dust2",
  "de_inferno",
  "de_nuke",
  "de_ancient",
  "de_anubis",
  "de_vertigo",
];

export const CS2_DEFAULT_WINGMAN_POOL = [
  "de_inferno",
  "de_overpass",
  "de_vertigo",
  "de_nuke",
];

export const CS2_DEFAULT_AIM_POOL = [
  "aim_redline",
  "aim_map",
  "aim_warmup",
];

export function getTournamentDefaultMapPool(type?: string): string[] {
  if (type === "1vs1" || type === "aim_1v1") {
    return CS2_DEFAULT_AIM_POOL;
  }
  if (type === "2vs2" || type === "mix_2vs2") {
    return CS2_DEFAULT_WINGMAN_POOL;
  }
  return CS2_DEFAULT_5V5_POOL;
}

export interface ResolvedMapInfo {
  id: string;
  name: string;
  image: string;
  desc: string;
  isCustom: boolean;
  workshopId?: string | null;
  badgeLabel: string;
}

export function resolveTournamentMapInfo(
  mapIdOrName: string,
  customMaps: any[] = []
): ResolvedMapInfo {
  if (!mapIdOrName) {
    return {
      id: "tbd",
      name: "TBD",
      image: "/images/maps/de_mirage.png",
      desc: "Карта будет определена",
      isCustom: false,
      badgeLabel: "Standard",
    };
  }

  const cleanId = String(mapIdOrName).trim();
  const lower = cleanId.toLowerCase();

  // 1. Standard competitive / official maps
  if (CS2_STANDARD_MAPS[lower]) {
    const std = CS2_STANDARD_MAPS[lower];
    return {
      id: lower,
      name: std.name,
      image: std.image,
      desc: std.desc,
      isCustom: false,
      badgeLabel: std.type === "competitive" ? "Active Duty" : "Classic",
    };
  }

  // 2. Custom workshop maps
  const custom = customMaps.find(
    (cm: any) =>
      String(cm.map_id) === cleanId ||
      String(cm.id) === cleanId ||
      (cm.name && cm.name.toLowerCase() === lower) ||
      (cm.name && cm.name.toLowerCase().replace(/[^a-z0-9]/g, "") === lower.replace(/[^a-z0-9]/g, ""))
  );

  if (custom) {
    return {
      id: String(custom.map_id || cleanId),
      name: custom.name,
      image: custom.image_url || "/images/maps/de_mirage.png",
      desc: custom.description || "Пользовательская карта из Мастерской Steam",
      isCustom: true,
      workshopId: custom.map_id,
      badgeLabel: "Workshop",
    };
  }

  // 3. Fallback for custom / aim maps
  const prettyName = cleanId
    .replace(/^(de_|cs_|ws_|aim_|awp_)/gi, "")
    .replace(/_/g, " ")
    .toUpperCase();

  return {
    id: cleanId,
    name: prettyName,
    image: `/images/maps/${cleanId}.png`,
    desc: "Соревновательная локация",
    isCustom: cleanId.startsWith("aim_") || cleanId.startsWith("awp_") || !cleanId.startsWith("de_"),
    badgeLabel: cleanId.startsWith("aim_") || cleanId.startsWith("awp_") ? "Aim / AWP" : "Custom",
  };
}
