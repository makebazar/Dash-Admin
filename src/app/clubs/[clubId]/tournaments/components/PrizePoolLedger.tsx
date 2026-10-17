"use client";
import React, { useState } from "react";
import {
  Trophy,
  Coins,
  Gift,
  Percent,
  CheckCircle2,
  Sparkles,
  Phone,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

const getCompetitorInfo = (c?: Competitor | null) => {
  if (!c) return { name: "—", subText: null, phone: "—" };
  const isTeam = c.type === "TEAM" || Boolean(c.team_id || c.promo_team_id);

  if (isTeam) {
    const captain =
      c.team_members?.find((m: any) => m.role === "captain") ||
      c.team_members?.[0];
    const phone =
      c.meta?.captainPhone ||
      captain?.phoneNumber ||
      c.meta?.phone ||
      "—";
    const captainName =
      captain?.fullName ||
      captain?.nickname ||
      c.meta?.captainName ||
      null;
    return {
      name: c.display_name,
      subText: captainName ? `Капитан: ${captainName}` : null,
      phone,
    };
  }

  const name =
    c.player_full_name ||
    c.player_name ||
    c.display_name;
  const nick =
    c.player_name && c.player_name !== name ? c.player_name : null;
  const phone =
    c.player_phone ||
    c.meta?.phone ||
    c.meta?.phoneNumber ||
    c.team_members?.[0]?.phoneNumber ||
    "—";

  return {
    name,
    subText: nick ? `Ник: ${nick}` : null,
    phone,
  };
};

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

  const isFree = parseFloat(String(tournament.entry_fee || 0)) === 0;
  const eligibleWinners = competitors.filter(
    (c) => c.payment_status !== "RESERVE" && (isFree || c.payment_status === "PAID")
  );

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

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Actual Cash Pool */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-medium text-emerald-600 block">
            Фактический фонд
          </span>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 font-mono">
            {actualPool.toLocaleString("ru-RU")} ₽
          </div>
          <span className="text-[11px] text-slate-500 font-normal block">
            Собрано с {paidComps} оплативших
          </span>
        </div>

        {/* Planned Cash Pool */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-medium text-slate-500 block">
            Плановый фонд
          </span>
          <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
            {plannedPool.toLocaleString("ru-RU")} ₽
          </div>
          <span className="text-[11px] text-slate-500 font-normal block">
            При 100% слотов ({maxS})
          </span>
        </div>

        {/* Bonus Pool */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-medium text-blue-600 block">
            Бонусы клуба
          </span>
          <div className="text-2xl font-bold tracking-tight text-blue-600 font-mono">
            {activeBonusPool.toLocaleString("ru-RU")} Б
          </div>
          <span className="text-[11px] text-slate-500 font-normal block">
            Бонусный фонд клуба
          </span>
        </div>

        {/* Club Share */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-medium text-amber-600 block">
            Комиссия клуба
          </span>
          <div className="text-2xl font-bold tracking-tight text-amber-600 font-mono">
            {share}%
          </div>
          <span className="text-[11px] text-slate-500 font-normal block">
            {tournament.prize_pool_mode === "fixed"
              ? "Фиксированный фонд"
              : "Динамический режим"}
          </span>
        </div>
      </div>

      {/* 2. Prize Placements & Payout Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Распределение призов и выдача наград
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                Таблица призовых мест, назначенных победителей и контактов для выдачи
              </p>
            </div>
          </div>

          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            Слотов: {prizeSlots.length}
          </span>
        </div>

        {prizeSlots.length === 0 ? (
          <div className="text-center py-14 text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Призовая сетка не настроена для этого турнира
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-xs font-semibold text-slate-500 bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Призовой слот</th>
                  <th className="py-3 px-4">Что выиграл</th>
                  <th className="py-3 px-4">Победитель (Имя)</th>
                  <th className="py-3 px-4">Номер телефона</th>
                  <th className="py-3 px-4 text-right">Статус / Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                  const plannedRewardCash = Math.round(plannedPool * cashPctFraction);

                  const winnerComp = payoutForSlot
                    ? competitors.find((c) => String(c.id) === String(payoutForSlot.competitor_id))
                    : null;
                  const paidWinnerInfo = getCompetitorInfo(winnerComp);

                  const selectedCompId = selectedWinners[slot.uniqueKey];
                  const selectedComp = selectedCompId
                    ? eligibleWinners.find((c) => String(c.id) === String(selectedCompId))
                    : null;
                  const selectedCompInfo = getCompetitorInfo(selectedComp);

                  return (
                    <tr key={slot.uniqueKey} className="hover:bg-slate-50/70 transition-colors">
                      {/* Слот / Место */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center text-[11px] font-bold">
                            {slot.slotIndex + 1}
                          </span>
                          <span>{slotUniqueName}</span>
                        </div>
                      </td>

                      {/* Что выиграл */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {actualRewardCash > 0 && (
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                              <Coins className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{actualRewardCash.toLocaleString("ru-RU")} ₽</span>
                              {plannedRewardCash !== actualRewardCash && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  (план: {plannedRewardCash} ₽)
                                </span>
                              )}
                            </span>
                          )}
                          {slot.bonus > 0 && (
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                              <span>{slot.bonus.toLocaleString("ru-RU")} Б</span>
                            </span>
                          )}
                          {slot.item && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 max-w-[220px] truncate"
                              title={slot.item}
                            >
                              <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="truncate">{slot.item}</span>
                            </span>
                          )}
                          {!actualRewardCash && !slot.bonus && !slot.item && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      {/* Победитель (Имя) */}
                      <td className="py-3.5 px-4 min-w-[220px]">
                        {payoutForSlot ? (
                          <div>
                            <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                              {paidWinnerInfo.name}
                            </div>
                            {paidWinnerInfo.subText && (
                              <div className="text-[11px] text-slate-400">
                                {paidWinnerInfo.subText}
                              </div>
                            )}
                          </div>
                        ) : (
                          <select
                            value={selectedWinners[slot.uniqueKey] || ""}
                            onChange={(e) =>
                              setSelectedWinners({
                                ...selectedWinners,
                                [slot.uniqueKey]: e.target.value,
                              })
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                          >
                            <option value="">Выберите победителя...</option>
                            {eligibleWinners.map((c) => {
                              const info = getCompetitorInfo(c);
                              return (
                                <option key={c.id} value={c.id}>
                                  {info.name} {info.phone !== "—" ? `(${info.phone})` : ""}
                                </option>
                              );
                            })}
                          </select>
                        )}
                      </td>

                      {/* Номер телефона */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {payoutForSlot ? (
                          <span className="font-mono text-xs text-slate-700 font-medium">
                            {paidWinnerInfo.phone}
                          </span>
                        ) : selectedComp ? (
                          <span className="font-mono text-xs text-slate-900 font-semibold">
                            {selectedCompInfo.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Статус / Действие */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {payoutForSlot ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Выплачено</span>
                            </span>
                            {(payoutForSlot.paid_at || payoutForSlot.created_at) && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                {new Date(
                                  (payoutForSlot.paid_at || payoutForSlot.created_at)!
                                ).toLocaleString("ru-RU", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            disabled={!selectedWinners[slot.uniqueKey]}
                            onClick={() => {
                              const competitorId = selectedWinners[slot.uniqueKey];
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
                            className="h-8 rounded-xl px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer shadow-xs disabled:opacity-40"
                          >
                            <span>Выдать</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Payouts History Ledger */}
      {payouts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            История всех выплат ({payouts.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-xs font-semibold text-slate-500 bg-slate-50/50 border-b border-slate-100">
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
                  const comp = competitors.find((c) => String(c.id) === String(p.competitor_id));
                  const compInfo = getCompetitorInfo(comp);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 text-slate-700">
                      <td className="p-3 text-slate-900 font-semibold">
                        <div>{compInfo.name}</div>
                        {compInfo.phone !== "—" && (
                          <div className="text-[11px] text-slate-400 font-mono font-normal">
                            {compInfo.phone}
                          </div>
                        )}
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
