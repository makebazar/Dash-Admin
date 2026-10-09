"use client";
import React, { useState } from "react";
import {
  Trophy,
  Coins,
  Gift,
  Percent,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tournament,
  Competitor,
  Payout,
  parsePrizeDistribution,
  getPrizeSlotsList,
} from "../types";

interface PrizePoolLedgerProps {
  tournament: Tournament;
  competitors: Competitor[];
  payouts: Payout[];
  onConfirmPayout: (
    competitorId: string,
    cashAmount: number,
    bonusAmount: number,
    itemDetails: string,
    slotUniqueName: string
  ) => void;
}

export function PrizePoolLedger({
  tournament,
  competitors,
  payouts,
  onConfirmPayout,
}: PrizePoolLedgerProps) {
  const [selectedWinners, setSelectedWinners] = useState<
    Record<string, string>
  >({});

  const { totalBonusPool: activeBonusPool, placements: activePlacements } =
    parsePrizeDistribution(tournament.prize_distribution);
  const prizeSlots = getPrizeSlotsList(activePlacements);

  const isTeam = tournament.type === "2vs2" || tournament.type === "5vs5";
  const tSize =
    tournament.type === "2vs2" || tournament.type === "mix_2vs2"
      ? 2
      : tournament.type === "5vs5" || tournament.type === "mix_5vs5"
      ? 5
      : 1;
  const feeType = tournament.config?.entryFeeType || "player";
  const mult = isTeam && feeType === "player" ? tSize : 1;
  const feePerComp = parseFloat(String(tournament.entry_fee || 0)) * mult;

  const paidComps = competitors.filter(
    (x) => x.payment_status === "PAID"
  ).length;
  const maxS = tournament.config?.maxParticipants || 16;
  const share = tournament.club_share_pct || 0;

  const actualPool =
    tournament.prize_pool_mode === "fixed"
      ? parseFloat(String(tournament.fixed_prize_amount || 0))
      : Math.round(paidComps * feePerComp * (1 - share / 100));

  const plannedPool =
    tournament.prize_pool_mode === "fixed"
      ? parseFloat(String(tournament.fixed_prize_amount || 0))
      : Math.round(maxS * feePerComp * (1 - share / 100));

  const paidWinnersList = competitors.filter(
    (c) => c.payment_status === "PAID"
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Actual Cash Pool */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
              Фактический фонд
            </span>
            <Coins className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {actualPool.toLocaleString("ru-RU")} ₽
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            Собрано с {paidComps} оплаченных
          </span>
        </div>

        {/* Planned Cash Pool */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Плановый фонд
            </span>
            <Trophy className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {plannedPool.toLocaleString("ru-RU")} ₽
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            При 100% слотов ({maxS})
          </span>
        </div>

        {/* Bonus Pool */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
              Бонусы клуба
            </span>
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 font-mono">
            {activeBonusPool.toLocaleString("ru-RU")} Б
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            Бонусный фонд клуба
          </span>
        </div>

        {/* Club Share */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
              Комиссия клуба
            </span>
            <Percent className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-black text-orange-600 font-mono">
            {share}%
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            {tournament.prize_pool_mode === "fixed"
              ? "Фиксированный фонд"
              : "Динамический режим"}
          </span>
        </div>
      </div>

      {/* 2. Prize Placements & Payout Grid */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-50 rounded-2xl text-yellow-600">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase italic tracking-tight text-slate-900">
                Распределение призов и выдача наград
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Назначение победителей по завершению матчей
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            Слотов награждения: {prizeSlots.length}
          </span>
        </div>

        {prizeSlots.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            Призовая сетка не настроена
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prizeSlots.map((slot) => {
              const slotUniqueName =
                slot.totalSlots > 1
                  ? `${slot.label} #${slot.slotIndex + 1}`
                  : slot.label;
              const payoutForSlot = payouts.find(
                (p) =>
                  p.item_details &&
                  p.item_details.includes(`(${slotUniqueName})`)
              );

              const cashPctFraction =
                slot.cashPct > 1 ? slot.cashPct / 100 : slot.cashPct;
              const actualRewardCash = Math.round(actualPool * cashPctFraction);
              const plannedRewardCash = Math.round(
                plannedPool * cashPctFraction
              );

              let winnerComp = null;
              if (payoutForSlot) {
                winnerComp = competitors.find(
                  (c) => c.id === payoutForSlot.competitor_id
                );
              }

              return (
                <div
                  key={slot.uniqueKey}
                  className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black uppercase tracking-tight text-slate-900">
                        {slotUniqueName}
                      </span>
                      {payoutForSlot ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Выплачено</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                          Ожидает победителя
                        </span>
                      )}
                    </div>

                    {/* Rewards breakdown */}
                    <div className="space-y-1.5 text-xs font-bold pt-1">
                      {(actualRewardCash > 0 || plannedRewardCash > 0) && (
                        <div className="flex items-center justify-between text-emerald-700 bg-white border border-emerald-100 p-2.5 rounded-xl">
                          <span className="text-[11px] font-bold">
                            Наличные призовые:
                          </span>
                          <span className="font-mono font-black text-sm">
                            {actualRewardCash} ₽
                            <span className="text-[10px] text-slate-400 font-normal ml-1">
                              (план: {plannedRewardCash} ₽)
                            </span>
                          </span>
                        </div>
                      )}

                      {slot.bonus > 0 && (
                        <div className="flex items-center justify-between text-blue-700 bg-white border border-blue-100 p-2.5 rounded-xl">
                          <span className="text-[11px] font-bold">
                            Бонусы на баланс:
                          </span>
                          <span className="font-mono font-black text-sm">
                            {slot.bonus} Б
                          </span>
                        </div>
                      )}

                      {slot.item &&
                        (() => {
                          const matchedItem =
                            tournament.config?.itemPool?.find(
                              (i: any) => i.id === slot.itemId
                            );
                          const isTeamFormat =
                            tournament.type === "2vs2" ||
                            tournament.type === "5vs5";
                          const scopeString = isTeamFormat
                            ? slot.itemScope === "team"
                              ? " (на команду)"
                              : " (каждому)"
                            : "";
                          return (
                            <div className="flex items-center justify-between text-amber-700 bg-white border border-amber-100 p-2.5 rounded-xl">
                              <span className="text-[11px] font-bold">
                                Предметный приз:
                              </span>
                              <span className="font-black text-xs truncate max-w-[200px]">
                                {slot.item}
                                {scopeString}
                                {matchedItem && ` (${matchedItem.cost} ₽)`}
                              </span>
                            </div>
                          );
                        })()}
                    </div>
                  </div>

                  {/* Payout control action */}
                  <div className="pt-2 border-t border-slate-200/60">
                    {payoutForSlot ? (
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-slate-500">Получатель:</span>
                        <span className="font-black text-slate-900">
                          {winnerComp?.display_name || payoutForSlot.competitor_id}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedWinners[slot.uniqueKey] || ""}
                          onChange={(e) =>
                            setSelectedWinners({
                              ...selectedWinners,
                              [slot.uniqueKey]: e.target.value,
                            })
                          }
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500 font-bold"
                        >
                          <option value="">Выберите победителя...</option>
                          {paidWinnersList.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.display_name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const competitorId =
                              selectedWinners[slot.uniqueKey];
                            if (!competitorId) {
                              alert("Выберите победителя из списка");
                              return;
                            }
                            onConfirmPayout(
                              competitorId,
                              actualRewardCash,
                              slot.bonus,
                              slot.item || "",
                              slotUniqueName
                            );
                          }}
                          disabled={!selectedWinners[slot.uniqueKey]}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                        >
                          Выдать
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Payouts History Ledger */}
      {payouts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 space-y-4 shadow-sm">
          <h3 className="text-base font-black uppercase italic tracking-tight text-slate-900 border-b border-slate-100 pb-3">
            История выплат турнира ({payouts.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="p-3">Участник</th>
                  <th className="p-3">Наличные</th>
                  <th className="p-3">Бонусы</th>
                  <th className="p-3">Предметы</th>
                  <th className="p-3">Дата выдачи</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((p) => {
                  const comp = competitors.find((c) => c.id === p.competitor_id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 font-bold text-slate-700">
                      <td className="p-3 text-slate-900 font-black">
                        {comp?.display_name || p.competitor_id}
                      </td>
                      <td className="p-3 text-emerald-600 font-mono">
                        {p.amount > 0 ? `${p.amount} ₽` : "—"}
                      </td>
                      <td className="p-3 text-blue-600 font-mono">
                        {p.bonus_amount ? `${p.bonus_amount} Б` : "—"}
                      </td>
                      <td className="p-3 text-amber-600">
                        {p.item_details || "—"}
                      </td>
                      <td className="p-3 text-slate-400 font-normal">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleString("ru-RU", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
