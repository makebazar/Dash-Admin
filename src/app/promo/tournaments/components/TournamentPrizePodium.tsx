"use client";

import React, { useMemo } from "react";
import { Trophy, Award, Gift, Sparkles, Coins, Percent, FileText, CheckCircle2, Crown, Target, Zap, Shield, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const finalMatch = matches.find((m) => m.round === Math.max(...matches.map((x) => x.round)));
  const championCompFromMatch =
    finalMatch && finalMatch.winner_competitor_id
      ? competitors.find((c) => String(c.id) === String(finalMatch.winner_competitor_id))
      : null;

  const firstStanding = standings.find((s: any) => s.place === 1);
  const secondStanding = standings.find((s: any) => s.place === 2);
  const thirdStanding = standings.find((s: any) => s.place === 3);

  const firstWinner = firstStanding
    ? competitors.find((c) => String(c.id) === String(firstStanding.competitor_id)) || { display_name: firstStanding.display_name }
    : championCompFromMatch;

  const secondWinner = secondStanding
    ? competitors.find((c) => String(c.id) === String(secondStanding.competitor_id)) || { display_name: secondStanding.display_name }
    : null;

  const thirdWinner = thirdStanding
    ? competitors.find((c) => String(c.id) === String(thirdStanding.competitor_id)) || { display_name: thirdStanding.display_name }
    : null;

  // Nominations & Special Awards
  const activeNominations = useMemo(() => {
    const rawNoms = tournament.prize_distribution?.nominations || [];
    return rawNoms.filter((n: any) => n.enabled);
  }, [tournament.prize_distribution]);

  // Aggregate stats from all tournament matches
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

    matches.forEach((m) => {
      const stats = m.result?.stats || m.match_stats;
      if (!stats) return;

      const team1Players = Array.isArray(stats.team1?.players)
        ? stats.team1.players
        : typeof stats.team1?.players === "object"
        ? Object.values(stats.team1.players)
        : [];
      const team2Players = Array.isArray(stats.team2?.players)
        ? stats.team2.players
        : typeof stats.team2?.players === "object"
        ? Object.values(stats.team2.players)
        : [];

      const totalRounds = (m.score1 || 0) + (m.score2 || 0) || 1;

      [...team1Players, ...team2Players].forEach((p: any) => {
        const key = String(p.steamid || p.steamId || p.name || "");
        if (!key) return;

        if (!playerAgg[key]) {
          playerAgg[key] = {
            name: p.name || p.nickname || "Игрок",
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
        }

        const k = Number(p.kills ?? p.stats?.kills ?? 0) || 0;
        const d = Number(p.deaths ?? p.stats?.deaths ?? 0) || 0;
        const a = Number(p.assists ?? p.stats?.assists ?? 0) || 0;
        const dmg = Number(p.damage ?? p.stats?.damage ?? 0) || 0;
        const hs = Number(p.headshot_kills ?? p.stats?.headshot_kills ?? 0) || 0;
        const mvp = Number(p.mvps ?? p.stats?.mvps ?? 0) || 0;
        const fk = Number(p.first_kills ?? p.stats?.first_kills ?? 0) || 0;
        const cl = Number(p.clutches ?? p.stats?.clutches ?? (p["1v1"] || 0) + (p["1v2"] || 0)) || 0;

        const kpr = k / totalRounds;
        const dpr = d / totalRounds;
        const apr = a / totalRounds;
        const adr = dmg / totalRounds;
        const impact = 2.13 * kpr + 0.42 * apr - 0.41;
        const rating = Number(p.rating) || (0.0073 * 70 + 0.3591 * kpr - 0.5329 * dpr + 0.2372 * impact + 0.0032 * adr + 0.1587);

        playerAgg[key].kills += k;
        playerAgg[key].deaths += d;
        playerAgg[key].assists += a;
        playerAgg[key].damage += dmg;
        playerAgg[key].headshot_kills += hs;
        playerAgg[key].mvps += mvp;
        playerAgg[key].first_kills += fk;
        playerAgg[key].clutches += cl;
        playerAgg[key].rounds += totalRounds;
        playerAgg[key].maps += 1;
        playerAgg[key].ratingsSum += rating;
      });
    });

    const playersList = Object.values(playerAgg).filter((p) => p.rounds > 0);
    if (playersList.length === 0) return {};

    const winners: Record<string, { name: string; statValue: string }> = {};

    // 1. MVP (Highest average Rating 2.0)
    const mvpLeader = [...playersList].sort((a, b) => (b.ratingsSum / b.maps) - (a.ratingsSum / a.maps))[0];
    if (mvpLeader) {
      winners["mvp"] = {
        name: mvpLeader.name,
        statValue: `Рейтинг ${(mvpLeader.ratingsSum / mvpLeader.maps).toFixed(2)}`,
      };
    }

    // 2. Headshot King (Highest % HS with min 3 kills)
    const hsLeader = [...playersList].filter((p) => p.kills >= 3).sort((a, b) => (b.headshot_kills / b.kills) - (a.headshot_kills / a.kills))[0] || playersList[0];
    if (hsLeader) {
      const pct = hsLeader.kills > 0 ? Math.round((hsLeader.headshot_kills / hsLeader.kills) * 100) : 0;
      winners["headshot"] = {
        name: hsLeader.name,
        statValue: `${pct}% HS (${hsLeader.headshot_kills} в голову)`,
      };
    }

    // 3. Damage Leader (Highest ADR)
    const dmgLeader = [...playersList].sort((a, b) => (b.damage / b.rounds) - (a.damage / a.rounds))[0];
    if (dmgLeader) {
      winners["damage"] = {
        name: dmgLeader.name,
        statValue: `${(dmgLeader.damage / dmgLeader.rounds).toFixed(1)} ADR`,
      };
    }

    // 4. Clutch Master (Most clutches)
    const clutchLeader = [...playersList].sort((a, b) => b.clutches - a.clutches)[0];
    if (clutchLeader) {
      winners["clutch"] = {
        name: clutchLeader.name,
        statValue: `${clutchLeader.clutches} клатчей`,
      };
    }

    // 5. First Blood King (Most First Kills)
    const entryLeader = [...playersList].sort((a, b) => b.first_kills - a.first_kills)[0];
    if (entryLeader) {
      winners["entry"] = {
        name: entryLeader.name,
        statValue: `${entryLeader.first_kills} первых фрагов`,
      };
    }

    return winners;
  }, [activeNominations, matches]);

  const getPlacementRank = (p: any, idx: number) => {
    if (p.label.includes("1") || p.id === "1") return 1;
    if (p.label.includes("2") || p.id === "2") return 2;
    if (p.label.includes("3") || p.id === "3") return 3;
    return idx + 1;
  };

  const firstPlace = placements.find((p: any) => getPlacementRank(p, 0) === 1);
  const secondPlace = placements.find((p: any) => getPlacementRank(p, 1) === 2);
  const thirdPlace = placements.find((p: any) => getPlacementRank(p, 2) === 3);

  const renderPodiumCard = (p: any, rank: 1 | 2 | 3, winnerComp?: any) => {
    if (!p) return null;

    const cashAmount = Math.round((activePrizePool * (p.cashPct || 0)) / 100);
    const matchedItem = itemPool.find((i: any) => i.id === p.itemId);
    const itemName = matchedItem ? matchedItem.name : p.item;

    const rankConfig = {
      1: {
        height: "min-h-[280px]",
        bg: "bg-gradient-to-b from-yellow-500/15 via-[#131316] to-[#0c0c0e]",
        border: "border-yellow-500/40 shadow-[0_0_30px_rgba(234,179,8,0.1)]",
        badgeBg: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        icon: <Trophy className="w-8 h-8 text-yellow-400" />,
        title: "1 Место • Чемпион",
        order: "order-1 sm:order-2",
        scale: "sm:scale-105 z-10",
      },
      2: {
        height: "min-h-[260px]",
        bg: "bg-gradient-to-b from-slate-400/15 via-[#131316] to-[#0c0c0e]",
        border: "border-slate-400/30 shadow-[0_0_20px_rgba(148,163,184,0.08)]",
        badgeBg: "bg-slate-400/20 text-slate-300 border-slate-400/30",
        icon: <Award className="w-7 h-7 text-slate-300" />,
        title: "2 Место • Серебро",
        order: "order-2 sm:order-1",
        scale: "z-0",
      },
      3: {
        height: "min-h-[240px]",
        bg: "bg-gradient-to-b from-amber-700/15 via-[#131316] to-[#0c0c0e]",
        border: "border-amber-700/30 shadow-[0_0_20px_rgba(180,83,9,0.08)]",
        badgeBg: "bg-amber-700/20 text-amber-400 border-amber-700/30",
        icon: <Award className="w-6 h-6 text-amber-500" />,
        title: "3 Место • Бронза",
        order: "order-3",
        scale: "z-0",
      },
    }[rank];

    return (
      <div
        className={cn(
          "rounded-[2.5rem] border p-6 flex flex-col justify-between transition-all relative overflow-hidden",
          rankConfig.height,
          rankConfig.bg,
          rankConfig.border,
          rankConfig.order,
          rankConfig.scale
        )}
      >
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              {rankConfig.icon}
            </div>
            <span
              className={cn(
                "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border",
                rankConfig.badgeBg
              )}
            >
              {p.cashPct}% Фонда
            </span>
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
              {rankConfig.title}
            </span>
            {winnerComp ? (
              <div className="mt-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-base font-black text-white uppercase italic truncate">
                  {winnerComp.display_name}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Prize breakdown */}
        <div className="space-y-2.5 pt-4 border-t border-white/5">
          {cashAmount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-yellow-500" />
                Наличные:
              </span>
              <span className="text-base font-black text-white italic">
                {formatCurrency(cashAmount)}
              </span>
            </div>
          )}

          {p.bonus > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                Баланс клуба:
              </span>
              <span className="text-xs font-black text-orange-400">
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
              <span className="text-xs font-bold text-purple-300 truncate max-w-[120px]">
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
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span>Пьедестал победителей и распределение призов</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Общий фонд: {formatCurrency(activePrizePool)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
          {renderPodiumCard(secondPlace, 2, secondWinner)}
          {renderPodiumCard(firstPlace, 1, firstWinner)}
          {renderPodiumCard(thirdPlace, 3, thirdWinner)}
        </div>
      </div>

      {/* Other placements if more than 3 */}
      {placements.length > 3 && (
        <div className="bg-[#0c0c0e]/95 border border-white/5 rounded-[2rem] p-6 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">
            Дополнительные призовые места
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {placements.slice(3).map((p: any, idx: number) => {
              const cashAmount = Math.round((activePrizePool * (p.cashPct || 0)) / 100);
              return (
                <div
                  key={p.id || idx}
                  className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-gray-300">{p.label}</span>
                  <div className="flex items-center gap-3">
                    {cashAmount > 0 && <span className="font-black text-white">{formatCurrency(cashAmount)}</span>}
                    {p.bonus > 0 && <span className="font-bold text-orange-400">+{p.bonus} Б</span>}
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

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Дисциплина:</span>
                <span className="font-black text-white uppercase">{tournament.discipline}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Формат сетки:</span>
                <span className="font-black text-white">
                  {tournament.config?.bracketType === "round_robin" ? "Группы + Плей-офф" : "Single Elimination"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Формат матчей:</span>
                <span className="font-black text-orange-500 uppercase">
                  {(tournament.config?.matchFormat || "bo1").toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Взнос:</span>
                <span className="font-black text-white">
                  {tournament.entry_fee > 0 ? formatCurrency(tournament.entry_fee) : "Бесплатно"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">Макс. участников:</span>
                <span className="font-black text-white">
                  {tournament.config?.maxParticipants || "Без ограничений"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
