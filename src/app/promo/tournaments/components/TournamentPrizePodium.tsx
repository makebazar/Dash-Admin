"use client";

import React, { useMemo } from "react";
import {
  Trophy,
  Award,
  Gift,
  Sparkles,
  Coins,
  FileText,
  CheckCircle2,
  Crown,
  Target,
  Layers,
  Clock,
  Swords,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveTournamentMapInfo,
  getTournamentDefaultMapPool,
} from "@/lib/cs2/maps";

interface TournamentPrizePodiumProps {
  tournament: any;
  competitors: any[];
  matches?: any[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function TournamentPrizePodium({
  tournament,
  competitors,
  matches = [],
}: TournamentPrizePodiumProps) {
  const isTeamFormat = tournament.type === "2vs2" || tournament.type === "5vs5";
  const teamSize =
    tournament.type === "2vs2" || tournament.type === "mix_2vs2"
      ? 2
      : tournament.type === "5vs5" || tournament.type === "mix_5vs5"
      ? 5
      : 1;

  const parsePrizeDistribution = (data: any) => {
    if (!data) return { totalBonusPool: 0, placements: [] };
    if (Array.isArray(data.placements)) {
      return {
        totalBonusPool: data.totalBonusPool || 0,
        placements: data.placements.map((p: any) => ({
          ...p,
          cashPct: p.cashPct <= 1 ? Math.round(p.cashPct * 100) : p.cashPct,
          itemId: p.itemId || "",
          item: p.item || "",
          itemScope: p.itemScope || "player",
        })),
      };
    }
    const placements: any[] = [];
    const keys = Object.keys(data).filter((k) => k !== "_meta");
    keys.sort((a, b) => parseInt(a) - parseInt(b));
    keys.forEach((key) => {
      const item = data[key];
      placements.push({
        id: key,
        label: `${key} Место`,
        cashPct: Math.round((item.cashPct || 0) * 100),
        bonus: item.bonus || 0,
        item: item.item || "",
        itemId: item.itemId || "",
        itemScope: item.itemScope || "player",
      });
    });
    return { totalBonusPool: data._meta?.totalBonusPool || 0, placements };
  };

  const calcDynamicPrizePool = (count: number) => {
    const feeType = tournament.config?.entryFeeType || "player";
    const mult = isTeamFormat && feeType === "player" ? teamSize : 1;
    const totalCollected = count * parseFloat(tournament.entry_fee || 0) * mult;
    const netPool = totalCollected * (1 - (tournament.club_share_pct || 0) / 100);
    return Math.max(0, Math.round(netPool));
  };

  const { totalBonusPool, placements } = parsePrizeDistribution(tournament.prize_distribution);

  const paidCount = competitors.filter((c) => c.payment_status === "PAID").length;
  const maxParticipants = tournament.config?.maxParticipants || 16;

  const cashPrize =
    tournament.prize_pool_mode === "fixed"
      ? parseFloat(tournament.fixed_prize_amount || 0)
      : calcDynamicPrizePool(paidCount);

  const cashPrizePlanned =
    tournament.prize_pool_mode === "fixed"
      ? parseFloat(tournament.fixed_prize_amount || 0)
      : calcDynamicPrizePool(maxParticipants);

  const activePrizePool =
    tournament.prize_pool_mode === "dynamic" ? cashPrizePlanned : cashPrize;

  // Item pool mapping
  const itemPool = tournament.config?.itemPool || [];

  // Determine winners if tournament is finished
  const standings = tournament.config?.final_standings || [];
  const maxRound = matches.length > 0 ? Math.max(...matches.map((x) => x.round)) : 0;
  const finalMatch = matches.find((m) => m.round === maxRound && m.order_in_round === 1);
  
  const championCompFromMatch =
    finalMatch && finalMatch.winner_competitor_id
      ? competitors.find((c) => String(c.id) === String(finalMatch.winner_competitor_id))
      : null;

  const runnerUpFromMatch =
    finalMatch && finalMatch.winner_competitor_id
      ? competitors.find((c) =>
          String(c.id) ===
          (String(finalMatch.winner_competitor_id) === String(finalMatch.competitor_a_id)
            ? String(finalMatch.competitor_b_id)
            : String(finalMatch.competitor_a_id))
        )
      : null;

  const firstStanding = standings.find((s: any) => s.place === 1);
  const secondStanding = standings.find((s: any) => s.place === 2);
  const thirdStanding = standings.find((s: any) => s.place === 3);

  const resolveCompetitor = (standing: any, fallbackComp: any) => {
    if (!standing && !fallbackComp) return null;
    const compId = standing?.competitor_id || fallbackComp?.id;
    const name = standing?.display_name || fallbackComp?.display_name;
    const found = competitors.find(
      (c) =>
        (compId && String(c.id) === String(compId)) ||
        (name && c.display_name && c.display_name.trim().toLowerCase() === name.trim().toLowerCase())
    );
    if (found) return found;
    return standing || fallbackComp;
  };

  const firstWinner = resolveCompetitor(firstStanding, championCompFromMatch);
  const secondWinner = resolveCompetitor(secondStanding, runnerUpFromMatch);
  const thirdWinner = resolveCompetitor(thirdStanding, null);

  // 3rd place existence logic:
  // 1. If finished: only if place 3 was recorded in standings or thirdWinner exists.
  // 2. If not finished: only if there are > 2 competitors or registration allows > 2 slots.
  const isFinished = tournament.status === "FINISHED" || standings.length > 0;
  const maxSlots = Number(
    tournament.config?.maxParticipants || tournament.config?.settings?.maxParticipants || 0
  );
  const totalCompetitors = competitors.length;

  const hasThirdPlace = isFinished
    ? Boolean(thirdStanding || thirdWinner)
    : (totalCompetitors > 2 || (tournament.status === "REGISTRATION" && (maxSlots > 2 || maxSlots === 0)));

  // Placements rank helper
  const getPlacementRank = (p: any, idx: number) => {
    if (p.label.includes("1") || p.id === "1") return 1;
    if (p.label.includes("2") || p.id === "2") return 2;
    if (p.label.includes("3") || p.id === "3") return 3;
    return idx + 1;
  };

  const firstPlace = placements.find((p: any) => getPlacementRank(p, 0) === 1);
  const secondPlace = placements.find((p: any) => getPlacementRank(p, 1) === 2);
  const thirdPlace = hasThirdPlace
    ? placements.find((p: any) => getPlacementRank(p, 2) === 3)
    : null;

  // Extra placements (only if 3rd place exists and more than 3 were configured)
  const extraPlacements = hasThirdPlace && placements.length > 3 ? placements.slice(3) : [];

  // Match format resolution
  const cfg = tournament.config?.settings || tournament.config || {};
  const baseFmt = String(cfg.matchFormat || cfg.match_format || "bo1").toLowerCase();
  const semiFmt = String(cfg.semiFinalFormat || cfg.semi_final_format || baseFmt).toLowerCase();
  const grandFmt = String(cfg.grandFinalFormat || cfg.grand_final_format || baseFmt).toLowerCase();

  const formatSummary = useMemo(() => {
    const getDesc = (fmt: string) =>
      fmt === "bo1" ? "до 1 победы" : fmt === "bo3" ? "до 2 побед" : "до 3 побед";

    if (baseFmt === semiFmt && baseFmt === grandFmt) {
      return {
        isUnified: true,
        headline: `Все матчи: ${baseFmt.toUpperCase()}`,
        stages: [
          {
            label: "Все раунды сетки",
            format: baseFmt.toUpperCase(),
            desc: getDesc(baseFmt),
          },
        ],
      };
    }

    const stages: { label: string; format: string; desc: string }[] = [];
    stages.push({
      label: "Основная сетка",
      format: baseFmt.toUpperCase(),
      desc: getDesc(baseFmt),
    });

    if (semiFmt !== baseFmt) {
      stages.push({
        label: "Полуфинал (1/2)",
        format: semiFmt.toUpperCase(),
        desc: getDesc(semiFmt),
      });
    }

    stages.push({
      label: "Гранд-финал",
      format: grandFmt.toUpperCase(),
      desc: getDesc(grandFmt),
    });

    const headlineParts = [`Сетка: ${baseFmt.toUpperCase()}`];
    if (semiFmt !== baseFmt) headlineParts.push(`1/2: ${semiFmt.toUpperCase()}`);
    headlineParts.push(`Финал: ${grandFmt.toUpperCase()}`);

    return {
      isUnified: false,
      headline: headlineParts.join(" • "),
      stages,
    };
  }, [baseFmt, semiFmt, grandFmt]);

  // Map Pool resolution
  const rawMapPool = cfg.mapPool || [];
  const customMaps = cfg.customMaps || [];
  const activeMapPool = useMemo(() => {
    if (Array.isArray(rawMapPool) && rawMapPool.length > 0) {
      return rawMapPool;
    }
    return getTournamentDefaultMapPool(tournament.type);
  }, [rawMapPool, tournament.type]);

  const resolvedMaps = useMemo(() => {
    return activeMapPool.map((mapId: string) =>
      resolveTournamentMapInfo(mapId, customMaps)
    );
  }, [activeMapPool, customMaps]);

  // Nominations & Special Awards (CS2 only)
  const activeNominations = useMemo(() => {
    if (tournament.discipline !== "cs2") return [];
    const rawNoms = tournament.prize_distribution?.nominations || [];
    return rawNoms.filter((n: any) => n.enabled);
  }, [tournament.discipline, tournament.prize_distribution]);

  // Aggregate stats from all tournament matches for nominations
  const nominationWinners = useMemo(() => {
    if (activeNominations.length === 0) return {};

    const playerAgg: Record<
      string,
      {
        name: string;
        kills: number;
        deaths: number;
        assists: number;
        damage: number;
        headshot_kills: number;
        mvps: number;
        first_kills: number;
        clutches: number;
        rounds: number;
        maps: number;
        ratingsSum: number;
      }
    > = {};

    const extractTeamPlayers = (teamObj: any) => {
      if (!teamObj?.players) return [];
      if (Array.isArray(teamObj.players)) return teamObj.players;
      if (typeof teamObj.players === "object") return Object.values(teamObj.players);
      return [];
    };

    const processMapPlayers = (team1Players: any[], team2Players: any[], mapRounds: number) => {
      [...team1Players, ...team2Players].forEach((p: any) => {
        const pSteam = String(p.steamid || p.steamId || p.steam_id || p.id || "").trim();
        const cleanSteam = /^\d{17}$/.test(pSteam) ? pSteam : "";
        const pName = String(p.name || p.nickname || "").trim();
        const key = cleanSteam || pName.toLowerCase();
        if (!key) return;

        if (!playerAgg[key]) {
          playerAgg[key] = {
            name: pName || "Игрок",
            kills: 0,
            deaths: 0,
            assists: 0,
            damage: 0,
            headshot_kills: 0,
            mvps: 0,
            first_kills: 0,
            clutches: 0,
            rounds: 0,
            maps: 0,
            ratingsSum: 0,
          };
        } else if (pName && playerAgg[key].name === "Игрок") {
          playerAgg[key].name = pName;
        }

        const k = Number(p.kills ?? p.stats?.kills ?? p.stats?.k ?? 0) || 0;
        const d = Number(p.deaths ?? p.stats?.deaths ?? p.stats?.d ?? 0) || 0;
        const a = Number(p.assists ?? p.stats?.assists ?? p.stats?.a ?? 0) || 0;
        const dmg = Number(p.damage ?? p.stats?.damage ?? p.stats?.dmg ?? 0) || 0;
        const hs = Number(p.headshot_kills ?? p.stats?.headshot_kills ?? p.stats?.hs ?? 0) || 0;
        const mvp = Number(p.mvps ?? p.mvp ?? p.stats?.mvp ?? p.stats?.mvps ?? 0) || 0;
        const fk = Number(
          p.first_kills ??
          p.stats?.first_kills ??
          ((p.stats?.first_kills_t || 0) + (p.stats?.first_kills_ct || 0))
        ) || 0;
        const cl = Number(
          p.clutches ??
          p.stats?.clutches ??
          ((p["1v1"] || 0) + (p["1v2"] || 0) + (p["1v3"] || 0)) +
          ((p.stats?.["1v1"] || 0) + (p.stats?.["1v2"] || 0) + (p.stats?.["1v3"] || 0))
        ) || 0;

        const safeRounds = Math.max(1, mapRounds);
        const kpr = k / safeRounds;
        const dpr = d / safeRounds;
        const apr = a / safeRounds;
        const adr = dmg / safeRounds;
        const impact = 2.13 * kpr + 0.42 * apr - 0.41;
        const kastVal = Number(p.kast ?? p.stats?.kast ?? 70) || 70;
        const calculatedRating = 0.0073 * (kastVal > 0 ? kastVal : 70) + 0.3591 * kpr - 0.5329 * dpr + 0.2372 * impact + 0.0032 * adr + 0.1587;
        const rating = Number(p.rating) || calculatedRating;

        playerAgg[key].kills += k;
        playerAgg[key].deaths += d;
        playerAgg[key].assists += a;
        playerAgg[key].damage += dmg;
        playerAgg[key].headshot_kills += hs;
        playerAgg[key].mvps += mvp;
        playerAgg[key].first_kills += fk;
        playerAgg[key].clutches += cl;
        playerAgg[key].rounds += safeRounds;
        playerAgg[key].maps += 1;
        playerAgg[key].ratingsSum += Math.max(0.1, Math.min(3.0, rating));
      });
    };

    matches.forEach((m) => {
      // 1. Check if match has maps in result.maps, maps_history, or mapsHistory
      const rawMaps = m.result?.maps || m.maps_history || m.mapsHistory;
      const mapEntries = (rawMaps && typeof rawMaps === "object") ? Object.values(rawMaps) : [];

      if (mapEntries.length > 0) {
        // Multi-map series (BO3 / BO5): process each individual map separately
        mapEntries.forEach((mapData: any) => {
          const stats = mapData.stats;
          if (!stats) return;
          const t1 = extractTeamPlayers(stats.team1);
          const t2 = extractTeamPlayers(stats.team2);
          const mapRounds = (mapData.score1 ?? 0) + (mapData.score2 ?? 0);
          const totalKills = [...t1, ...t2].reduce((sum: number, p: any) => sum + (Number(p.kills ?? p.stats?.kills ?? 0) || 0), 0);
          if (mapRounds === 0 && totalKills === 0) return;
          processMapPlayers(t1, t2, mapRounds);
        });
      } else {
        // Single map fallback (BO1)
        const stats = m.result?.stats || m.match_stats;
        if (!stats) return;
        const t1 = extractTeamPlayers(stats.team1);
        const t2 = extractTeamPlayers(stats.team2);
        const totalRounds = (m.score1 || 0) + (m.score2 || 0) || 1;
        processMapPlayers(t1, t2, totalRounds);
      }
    });

    const playersList = Object.values(playerAgg).filter((p) => p.rounds > 0);
    if (playersList.length === 0) return {};

    const winners: Record<string, { name: string; statValue: string }> = {};

    const mvpLeader = [...playersList].sort((a, b) => (b.ratingsSum / b.maps) - (a.ratingsSum / a.maps))[0];
    if (mvpLeader) {
      winners["mvp"] = {
        name: mvpLeader.name,
        statValue: `Рейтинг ${(mvpLeader.ratingsSum / mvpLeader.maps).toFixed(2)} (${mvpLeader.kills} фрагов)`,
      };
    }

    const hsLeader = [...playersList].filter((p) => p.kills >= 3).sort((a, b) => (b.headshot_kills / b.kills) - (a.headshot_kills / a.kills))[0] || playersList[0];
    if (hsLeader) {
      const pct = hsLeader.kills > 0 ? Math.round((hsLeader.headshot_kills / hsLeader.kills) * 100) : 0;
      winners["headshot"] = {
        name: hsLeader.name,
        statValue: `${pct}% HS (${hsLeader.headshot_kills} в голову)`,
      };
    }

    const dmgLeader = [...playersList].sort((a, b) => (b.damage / b.rounds) - (a.damage / a.rounds))[0];
    if (dmgLeader) {
      winners["damage"] = {
        name: dmgLeader.name,
        statValue: `${(dmgLeader.damage / dmgLeader.rounds).toFixed(1)} ADR (${dmgLeader.damage.toLocaleString()} урона)`,
      };
    }

    const clutchLeader = [...playersList].sort((a, b) => b.clutches - a.clutches)[0];
    if (clutchLeader) {
      winners["clutch"] = {
        name: clutchLeader.name,
        statValue: `${clutchLeader.clutches} клатчей`,
      };
    }

    const entryLeader = [...playersList].sort((a, b) => b.first_kills - a.first_kills)[0];
    if (entryLeader) {
      winners["entry"] = {
        name: entryLeader.name,
        statValue: `${entryLeader.first_kills} первых фрагов`,
      };
    }

    // Additional common awards aliases
    const fragsLeader = [...playersList].sort((a, b) => b.kills - a.kills)[0];
    if (fragsLeader) {
      winners["frags"] = {
        name: fragsLeader.name,
        statValue: `${fragsLeader.kills} фрагов`,
      };
      winners["kills"] = winners["frags"];
    }

    const assistsLeader = [...playersList].sort((a, b) => b.assists - a.assists)[0];
    if (assistsLeader) {
      winners["assists"] = {
        name: assistsLeader.name,
        statValue: `${assistsLeader.assists} ассистов`,
      };
      winners["support"] = winners["assists"];
    }

    return winners;
  }, [activeNominations, matches]);

  // Sleek, modern esports podium card renderer
  const renderPodiumCard = (p: any, rank: 1 | 2 | 3, winnerComp?: any) => {
    if (!p) return null;

    const cashAmount = Math.round((activePrizePool * (p.cashPct || 0)) / 100);
    const matchedItem = itemPool.find((i: any) => i.id === p.itemId);
    const itemName = matchedItem ? matchedItem.name : p.item;

    const rankConfig = {
      1: {
        minHeight: "min-h-[280px]",
        gradient: "from-amber-500/15 via-[#141418] to-[#0c0c0e]",
        border: "border-amber-500/35 hover:border-amber-500/60 shadow-[0_0_35px_rgba(245,158,11,0.08)]",
        topLine: "from-transparent via-amber-400/80 to-transparent",
        accentColor: "text-amber-400",
        rankLabel: "1-е Место",
        subLabel: "Чемпион турнира",
        icon: (
          <Crown className="w-6 h-6 text-amber-400 fill-amber-400/20 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]" />
        ),
        avatarBg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
        scale: hasThirdPlace ? "sm:scale-105 z-10" : "z-10",
        order: hasThirdPlace ? "order-1 sm:order-2" : "order-1",
      },
      2: {
        minHeight: "min-h-[260px]",
        gradient: "from-slate-300/10 via-[#141418] to-[#0c0c0e]",
        border: "border-slate-400/25 hover:border-slate-400/50 shadow-[0_0_25px_rgba(148,163,184,0.05)]",
        topLine: "from-transparent via-slate-300/60 to-transparent",
        accentColor: "text-slate-300",
        rankLabel: "2-е Место",
        subLabel: "Вице-чемпион",
        icon: (
          <Award className="w-6 h-6 text-slate-300 drop-shadow-[0_0_10px_rgba(148,163,184,0.4)]" />
        ),
        avatarBg: "bg-slate-400/15 border-slate-400/30 text-slate-300",
        scale: "z-0",
        order: hasThirdPlace ? "order-2 sm:order-1" : "order-2",
      },
      3: {
        minHeight: "min-h-[250px]",
        gradient: "from-amber-700/10 via-[#141418] to-[#0c0c0e]",
        border: "border-amber-700/25 hover:border-amber-700/50 shadow-[0_0_25px_rgba(180,83,9,0.05)]",
        topLine: "from-transparent via-amber-600/60 to-transparent",
        accentColor: "text-amber-500",
        rankLabel: "3-е Место",
        subLabel: "Бронзовый призёр",
        icon: (
          <Award className="w-6 h-6 text-amber-500 drop-shadow-[0_0_10px_rgba(180,83,9,0.4)]" />
        ),
        avatarBg: "bg-amber-700/15 border-amber-700/30 text-amber-500",
        scale: "z-0",
        order: "order-3",
      },
    }[rank];

    return (
      <div
        className={cn(
          "rounded-[2.2rem] border p-6 flex flex-col justify-between transition-all relative overflow-hidden group",
          rankConfig.minHeight,
          "bg-gradient-to-b",
          rankConfig.gradient,
          rankConfig.border,
          rankConfig.order,
          rankConfig.scale
        )}
      >
        {/* Top ambient highlight line */}
        <div className={cn("absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r", rankConfig.topLine)} />
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/5 rounded-full blur-3xl pointer-events-none group-hover:bg-white/10 transition-colors" />

        {/* Header: Rank emblem & Share */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center shrink-0">
                {rankConfig.icon}
              </div>
              <div>
                <span className={cn("text-xs font-black uppercase tracking-wider block", rankConfig.accentColor)}>
                  {rankConfig.rankLabel}
                </span>
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">
                  {rankConfig.subLabel}
                </span>
              </div>
            </div>

            {/* Seamless percentage callout without nested container badge */}
            <div className="text-right shrink-0">
              <span className="text-sm font-black font-mono text-white/95 tracking-tight block">
                {p.cashPct}%
              </span>
              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider block">
                фонда
              </span>
            </div>
          </div>

          {/* Winner details */}
          {winnerComp ? (
            (() => {
              const avatarUrl =
                winnerComp?.player_avatar_url ||
                winnerComp?.avatar_url ||
                winnerComp?.faceit_avatar ||
                winnerComp?.team_logo ||
                winnerComp?.logo_url ||
                (Array.isArray(winnerComp?.team_members) && winnerComp.team_members[0]?.avatarUrl);
              return (
                <div className="mt-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={winnerComp.display_name}
                      className="w-9 h-9 rounded-xl object-cover shrink-0 border border-white/10 shadow-sm"
                    />
                  ) : (
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 border",
                        rankConfig.avatarBg
                      )}
                    >
                      {winnerComp.display_name?.slice(0, 2) || "🏆"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">
                      Победитель
                    </span>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-base font-black text-white uppercase italic tracking-tight truncate">
                        {winnerComp.display_name}
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="mt-4 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-2.5 text-gray-500 text-xs">
              <Clock className="w-4 h-4 text-gray-600 shrink-0" />
              <span className="italic font-medium">Определится по итогам финала</span>
            </div>
          )}
        </div>

        {/* Prize breakdown */}
        <div className="space-y-2 pt-4 border-t border-white/5 mt-4">
          {cashAmount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Призовые:
              </span>
              <span className="text-base font-black text-white font-mono">
                {formatCurrency(cashAmount)}
              </span>
            </div>
          )}

          {p.bonus > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Баланс клуба:
              </span>
              <span className="text-sm font-black text-orange-400 font-mono">
                +{p.bonus} Б
              </span>
            </div>
          )}

          {itemName && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-purple-400" />
                Приз:
              </span>
              <span className="text-xs font-bold text-purple-300 truncate max-w-[140px]">
                {itemName}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* 3D Champion Podium */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Пьедестал победителей и распределение призов</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Общий фонд: {formatCurrency(activePrizePool)}
          </span>
        </div>

        {hasThirdPlace && thirdPlace ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
            {renderPodiumCard(secondPlace, 2, secondWinner)}
            {renderPodiumCard(firstPlace, 1, firstWinner)}
            {renderPodiumCard(thirdPlace, 3, thirdWinner)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto gap-6 items-stretch">
            {renderPodiumCard(firstPlace, 1, firstWinner)}
            {renderPodiumCard(secondPlace, 2, secondWinner)}
          </div>
        )}
      </div>

      {/* Additional placements if more than 3 */}
      {extraPlacements.length > 0 && (
        <div className="bg-[#0c0c0e]/95 border border-white/5 rounded-[2rem] p-6 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">
            Дополнительные призовые места
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {extraPlacements.map((p: any, idx: number) => {
              const cashAmount = Math.round((activePrizePool * (p.cashPct || 0)) / 100);
              return (
                <div
                  key={p.id || idx}
                  className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-gray-300">{p.label}</span>
                  <div className="flex items-center gap-3">
                    {cashAmount > 0 && (
                      <span className="font-black text-white">{formatCurrency(cashAmount)}</span>
                    )}
                    {p.bonus > 0 && (
                      <span className="font-bold text-orange-400">+{p.bonus} Б</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tournament Nominations & Special Awards */}
      {activeNominations.length > 0 && (
        <div className="bg-[#0c0c0e]/95 border border-white/5 rounded-[2.5rem] p-7 space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Индивидуальные номинации турнира
                </h3>
                <p className="text-[11px] text-gray-400 font-medium">
                  Специальные призы за выдающиеся достижения и статистику по итогам всех сыгранных матчей
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeNominations.map((nom: any) => {
              const winner = nominationWinners[nom.id];
              return (
                <div
                  key={nom.id}
                  className="bg-white/[0.02] border border-white/5 hover:border-orange-500/30 rounded-3xl p-5 flex flex-col justify-between space-y-4 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{nom.icon || "👑"}</span>
                        <div>
                          <span className="text-xs font-black uppercase text-white block tracking-wide">
                            {nom.label}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium line-clamp-1">
                            {nom.description}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Winner info */}
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-3 mt-3">
                      <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                        Лидер номинации:
                      </span>
                      {winner ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-xs font-black text-white uppercase italic truncate">
                              {winner.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-black font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-lg shrink-0">
                            {winner.statValue}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-500 italic">
                          Определится по итогам матчей
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Prize breakdown */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                      Награда:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {nom.cashAmount > 0 && (
                        <span className="font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          {formatCurrency(nom.cashAmount)}
                        </span>
                      )}
                      {nom.bonusAmount > 0 && (
                        <span className="font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          +{nom.bonusAmount} Б
                        </span>
                      )}
                      {nom.item && (
                        <span className="font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 truncate max-w-[130px]">
                          <Gift className="w-3 h-3 shrink-0" />
                          {nom.item}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tournament Rules & Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rules Text */}
        <div className="lg:col-span-2 bg-[#0c0c0e]/95 border border-white/5 rounded-[2.5rem] p-7 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-500">
            <FileText className="w-4 h-4" />
            <span>Регламент и правила турнира</span>
          </div>
          <div className="text-xs text-gray-300 leading-relaxed font-medium bg-black/40 p-6 rounded-3xl border border-white/5 max-h-72 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
            {tournament.rules || "Организатор не указал подробные правила для этого турнира."}
          </div>
        </div>

        {/* Info summary */}
        <div className="bg-[#0c0c0e]/95 border border-white/5 rounded-[2.5rem] p-7 space-y-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
              Параметры турнира
            </span>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Дисциплина:</span>
                <span className="font-black text-white uppercase">{tournament.discipline || "CS2"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Формат сетки:</span>
                <span className="font-black text-white">
                  {cfg.bracketType === "round_robin"
                    ? "Группы + Плей-офф"
                    : cfg.bracketType === "double_elimination"
                    ? "Double Elimination"
                    : "Single Elimination"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Формат матчей:</span>
                <span className="font-black text-orange-400 uppercase text-right">
                  {formatSummary.headline}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Взнос:</span>
                <span className="font-black text-white">
                  {parseFloat(String(tournament.entry_fee || 0)) > 0
                    ? formatCurrency(parseFloat(tournament.entry_fee))
                    : "Бесплатно"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Макс. участников:</span>
                <span className="font-black text-white">
                  {cfg.maxParticipants ? `${cfg.maxParticipants} слотов` : "Без ограничений"}
                </span>
              </div>
            </div>

            {/* Stage formats breakdown */}
            <div className="pt-2 space-y-2 border-t border-white/5">
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 block">
                Регламент серий по стадиям:
              </span>
              <div className="space-y-1.5">
                {formatSummary.stages.map((st, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[11px] bg-white/[0.02] px-3 py-1.5 rounded-xl border border-white/5"
                  >
                    <span className="text-gray-300 font-medium">{st.label}:</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="font-black text-orange-400">{st.format}</span>
                      <span className="text-gray-500 text-[10px]">({st.desc})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tournament Map Pool */}
      <div className="bg-[#0c0c0e]/95 border border-white/5 rounded-[2.5rem] p-7 space-y-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="border-b border-white/5 pb-4 space-y-1">
          <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
            Соревновательный пул карт (Map Pool)
          </h3>
          <p className="text-[11px] text-gray-400 font-medium">
            Карты турнира для процедуры вето: баны и выбор локации перед каждым матчем
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {resolvedMaps.map((map) => (
            <div
              key={map.id}
              className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-orange-500/50 transition-all aspect-[4/3] flex flex-col justify-end p-2.5 shadow-lg bg-[#141418]"
            >
              <img
                src={map.image}
                alt={map.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-70 group-hover:opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              <div className="relative z-10">
                <span className="text-xs font-black uppercase tracking-wider text-white block truncate">
                  {map.name}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-[11px] text-gray-400 font-medium bg-black/40 px-4 py-2.5 rounded-2xl border border-white/5">
          В сериях BO1 команды по очереди банят карты до 1 решающей. В сериях BO3 выбирают по карте и играют десайдер.
        </div>
      </div>
    </div>
  );
}
