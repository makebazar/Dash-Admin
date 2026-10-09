export interface Tournament {
  id: number;
  club_id: number;
  name: string;
  discipline: string;
  type: string;
  status: "DRAFT" | "REGISTRATION" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  entry_fee: number | string;
  club_share_pct: number;
  prize_pool_mode?: "dynamic" | "fixed";
  fixed_prize_amount?: number | string;
  prize_distribution?: any;
  rules?: string;
  starts_at?: string | null;
  config?: {
    maxParticipants?: number;
    entryFeeType?: "player" | "team";
    mapPool?: string[];
    itemPool?: Array<{ id: string; name: string; cost: number }>;
    bracketType?: "single_elimination" | "double_elimination" | "round_robin";
    matchFormat?: "bo1" | "bo3" | "bo5";
    semiFinalFormat?: "bo1" | "bo3" | "bo5";
    grandFinalFormat?: "bo1" | "bo3" | "bo5";
    [key: string]: any;
  };
  created_at?: string;
}

export interface DashMatchAgentInfo {
  is_online: boolean;
  lan_ip: string;
  base_port: number;
  max_instances: number;
  instances?: Array<{
    id: string;
    match_id: string;
    port: number;
    map: string;
    state: string;
    pid: number;
  }>;
  last_heartbeat?: string | null;
}

export interface ActiveCs2MatchInfo {
  id: string;
  map_name: string;
  match_format: string;
  team1_name: string;
  team2_name: string;
  status: string;
  port: number;
  server_ip: string;
  score1: number;
  score2: number;
  game_state?: string;
  rcon_last_command?: string;
  rcon_last_response?: string;
  match_stats?: any;
  config_data?: any;
}

export interface Competitor {
  id: string;
  tournament_id: number;
  user_id?: string;
  team_id?: string;
  display_name: string;
  type: "SOLO" | "TEAM";
  payment_status: "PENDING_PAYMENT" | "PAID" | "RESERVE";
  player_elo?: number;
  team_logo?: string;
  team_members?: Array<{
    id: string;
    fullName: string;
    phoneNumber?: string;
    elo?: number;
  }>;
  meta?: {
    isBot?: boolean;
    elo?: number;
    paidPlayerIds?: string[];
    [key: string]: any;
  };
}

export interface Match {
  id: number;
  tournament_id: number;
  round: number;
  competitor_a_id?: string | null;
  competitor_b_id?: string | null;
  score1: number;
  score2: number;
  winner_competitor_id?: string | null;
  status: string;
  cs2_server_id?: string | null;
  scheduled_at?: string | null;
  result?: {
    matchNumber?: number;
    group?: string;
    isTechWin?: boolean;
    isBye?: boolean;
    techWinReason?: string;
    [key: string]: any;
  };
}

export interface Payout {
  id: number;
  tournament_id: number;
  competitor_id: string;
  amount: number;
  bonus_amount?: number;
  prize_type?: string;
  item_details?: string;
  created_at?: string;
}

export interface RulesTemplate {
  id: string;
  club_id: number;
  discipline: string;
  name: string;
  rules_text: string;
  created_at?: string;
}

export interface Placement {
  id: string;
  label: string;
  cashPct: number;
  bonus: number;
  item?: string;
  itemId?: string;
  itemScope?: "player" | "team";
}

export interface PrizeSlot extends Placement {
  slotIndex: number;
  totalSlots: number;
  uniqueKey: string;
}

export const getCountFromLabel = (label: string): number => {
  if (!label) return 1;
  const rangeMatch = label.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    if (end >= start) {
      return (end - start) + 1;
    }
  }
  return 1;
};

export const parsePrizeDistribution = (data: any): { totalBonusPool: number; placements: Placement[] } => {
  if (!data) {
    return { totalBonusPool: 0, placements: [] };
  }
  if (Array.isArray(data.placements)) {
    return {
      totalBonusPool: data.totalBonusPool || 0,
      placements: data.placements.map((p: any) => ({
        ...p,
        cashPct: p.cashPct <= 1 ? Math.round(p.cashPct * 100) : p.cashPct,
        itemId: p.itemId || "",
        item: p.item || "",
        itemScope: p.itemScope || "player"
      }))
    };
  }
  const placements: Placement[] = [];
  const keys = Object.keys(data).filter(k => k !== "_meta");
  keys.sort((a, b) => parseInt(a) - parseInt(b));
  keys.forEach(key => {
    const item = data[key];
    placements.push({
      id: key,
      label: `${key} Место`,
      cashPct: Math.round((item.cashPct || 0) * 100),
      bonus: item.bonus || 0,
      item: item.item || "",
      itemId: item.itemId || "",
      itemScope: item.itemScope || "player"
    });
  });
  return {
    totalBonusPool: data._meta?.totalBonusPool || 0,
    placements
  };
};

export const getPrizeSlotsList = (placements: Placement[]): PrizeSlot[] => {
  const slots: PrizeSlot[] = [];
  placements.forEach((p) => {
    const count = getCountFromLabel(p.label);
    for (let i = 0; i < count; i++) {
      slots.push({
        ...p,
        slotIndex: i,
        totalSlots: count,
        uniqueKey: `${p.label}-${i}`
      });
    }
  });
  return slots;
};

export const formatTypeLabel = (tType: string): string => {
  const mapping: Record<string, string> = {
    solo: "Solo",
    team: "Team 5x5",
    mix: "Mix ELO",
    "1vs1": "1vs1 Solo",
    "2vs2": "2vs2 Team",
    "5vs5": "5vs5 Team",
    mix_2vs2: "Mix 2vs2",
    mix_5vs5: "Mix 5vs5",
  };
  return mapping[tType] || tType;
};
