"use client";

import React from "react";
import { Trophy, Award, Gift, Sparkles, Coins, Percent, FileText, CheckCircle2 } from "lucide-react";
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
