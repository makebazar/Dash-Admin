"use client";
import React, { useState } from "react";
import {
  Users,
  X,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bot,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tournament, Competitor } from "../types";

interface CompetitorsListProps {
  tournament: Tournament;
  competitors: Competitor[];
  onConfirmPayment: (competitorId: string) => void;
  onTogglePlayerPayment: (
    competitorId: string,
    playerId: string,
    paid: boolean
  ) => void;
  onPromoteCompetitor: (competitorId: string) => void;
  onDeleteCompetitor: (competitorId: string) => void;
  onGenerateBots?: (count?: number) => void;
  onClearBots?: () => void;
  isGeneratingBots?: boolean;
}

export function CompetitorsList({
  tournament,
  competitors,
  onConfirmPayment,
  onTogglePlayerPayment,
  onPromoteCompetitor,
  onDeleteCompetitor,
  onGenerateBots,
  onClearBots,
  isGeneratingBots = false,
}: CompetitorsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "paid" | "unpaid" | "reserve"
  >("all");
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>(
    {}
  );

  const mainCompetitors = competitors.filter(
    (c) => c.payment_status !== "RESERVE"
  );
  const reserveCompetitors = competitors.filter(
    (c) => c.payment_status === "RESERVE"
  );
  const paidCompetitors = mainCompetitors.filter(
    (c) => c.payment_status === "PAID"
  );
  const unpaidCompetitors = mainCompetitors.filter(
    (c) => c.payment_status !== "PAID"
  );

  const maxParticipants = tournament.config?.maxParticipants || 16;
  const isEditable =
    tournament.status === "REGISTRATION" || tournament.status === "DRAFT";
  const hasBots = competitors.some(
    (c) =>
      c.meta?.isBot ||
      c.display_name?.includes("(BOT)") ||
      c.display_name?.includes("[BOT]")
  );

  // Filter logic
  const filteredCompetitors = competitors.filter((c) => {
    // Status filter
    if (statusFilter === "paid" && c.payment_status !== "PAID") return false;
    if (
      statusFilter === "unpaid" &&
      (c.payment_status === "PAID" || c.payment_status === "RESERVE")
    )
      return false;
    if (statusFilter === "reserve" && c.payment_status !== "RESERVE")
      return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchDisplayName = c.display_name?.toLowerCase().includes(q);
      const matchMembers = c.team_members?.some(
        (m) =>
          m.fullName?.toLowerCase().includes(q) ||
          m.phoneNumber?.toLowerCase().includes(q)
      );
      if (!matchDisplayName && !matchMembers) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total registered */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-medium text-slate-500 block">
            Всего участников
          </span>
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {mainCompetitors.length}{" "}
            <span className="text-xs font-normal text-slate-400">
              / {maxParticipants}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-normal block">
            Основной состав слотов
          </span>
        </div>

        {/* Paid */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-medium text-emerald-600 block">
            Оплачено
          </span>
          <div className="text-2xl font-bold tracking-tight text-emerald-600">
            {paidCompetitors.length}
          </div>
          <span className="text-[11px] text-slate-500 font-normal block">
            Подтвержденные слоты
          </span>
        </div>

        {/* Unpaid */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-medium text-amber-600 block">
            Ожидает взноса
          </span>
          <div className="text-2xl font-bold tracking-tight text-amber-600">
            {unpaidCompetitors.length}
          </div>
          <span className="text-[11px] text-slate-500 font-normal block">
            Неоплаченные заявки
          </span>
        </div>

        {/* Reserve */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-xs font-medium text-blue-600 block">
            В резерве
          </span>
          <div className="text-2xl font-bold tracking-tight text-blue-600">
            {reserveCompetitors.length}
          </div>
          <span className="text-[11px] text-slate-500 font-normal block">
            Очередь ожидания
          </span>
        </div>
      </div>

      {/* 2. Search and Status Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск участника по имени, никнейму или телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex bg-slate-100/70 p-1 rounded-xl border border-slate-200/60 overflow-x-auto shrink-0 gap-1">
            {[
              { id: "all", label: "Все", count: competitors.length },
              { id: "paid", label: "Оплачено", count: paidCompetitors.length },
              {
                id: "unpaid",
                label: "Ожидают взноса",
                count: unpaidCompetitors.length,
              },
              {
                id: "reserve",
                label: "Резерв",
                count: reserveCompetitors.length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
                  statusFilter === tab.id
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold",
                    statusFilter === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-600"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Competitors List */}
        {filteredCompetitors.length === 0 ? (
          <div className="text-center py-16 space-y-1.5 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs font-semibold text-slate-400">
              Участники не найдены
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs font-bold text-orange-500 hover:underline cursor-pointer"
              >
                Сбросить поиск
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCompetitors.map((c, index) => {
              const isTeam = c.type === "TEAM";
              const hasMembers =
                isTeam && c.team_members && Array.isArray(c.team_members);
              const isExpanded = !!expandedTeams[c.id];
              const isReserve = c.payment_status === "RESERVE";
              const isPaid = c.payment_status === "PAID";

              const paidMembersCount = Array.isArray(c.meta?.paidPlayerIds)
                ? c.meta.paidPlayerIds.length
                : isPaid
                ? c.team_members?.length || 0
                : 0;
              const totalMembersCount = c.team_members?.length || 0;

              const isDota = tournament?.discipline?.toLowerCase().includes("dota");

              const fullName = isTeam
                ? c.display_name
                : (c.player_full_name || c.display_name);

              const rawNickname = !isTeam
                ? (c.player_name || c.meta?.nickname || (c.player_full_name && c.player_full_name !== c.display_name ? c.display_name : undefined))
                : undefined;
              const nickname = rawNickname?.replace(/^@/, "");

              const phone = isTeam
                ? (c.player_phone || c.meta?.captainPhone || c.meta?.phone)
                : (c.player_phone || c.meta?.phoneNumber || c.meta?.phone);

              const hasSteam = Boolean(
                c.player_steam_id ||
                c.meta?.steamId ||
                c.meta?.steam_id ||
                c.meta?.steamId64 ||
                (isTeam && c.team_members?.some((m) => m.steamId))
              );

              const ratingText = isDota
                ? (c.player_dota_mmr
                    ? `${c.player_dota_mmr} MMR`
                    : c.player_dota_rank_name || c.meta?.dotaRankName || (c.meta?.dotaMmr ? `${c.meta.dotaMmr} MMR` : "Без ранга Dota"))
                : `${c.player_elo || c.meta?.elo || 1000} ELO`;

              return (
                <div
                  key={c.id}
                  className={cn(
                    "rounded-3xl border transition-all overflow-hidden",
                    isReserve
                      ? "bg-amber-50/20 border-amber-200/50"
                      : isPaid
                      ? "bg-slate-50/80 border-slate-200/80 hover:border-slate-300"
                      : "bg-white border-slate-200 hover:border-orange-300 shadow-xs"
                  )}
                >
                  {/* Main competitor header row */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Info & expand toggle */}
                    <div
                      onClick={() => {
                        if (hasMembers) {
                          setExpandedTeams((prev) => ({
                            ...prev,
                            [c.id]: !prev[c.id],
                          }));
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 flex-1 min-w-0",
                        hasMembers && "cursor-pointer select-none"
                      )}
                    >
                      {/* Details (No user avatar icon) */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                          {/* Full Name */}
                          <span className="text-sm font-black text-slate-900 truncate">
                            {fullName}
                          </span>

                          {/* Nickname */}
                          {nickname && nickname !== fullName && (
                            <span className="text-xs font-semibold text-slate-500">
                              @{nickname}
                            </span>
                          )}

                          {/* Phone number */}
                          {phone && (
                            <span className="text-xs font-medium text-slate-500 font-mono">
                              {phone}
                            </span>
                          )}

                          {/* Type typography */}
                          <span className="text-xs font-medium text-slate-400">
                            {isTeam ? "Команда" : "Одиночный игрок"}
                          </span>

                          {/* Rating (Dota MMR or CS ELO) */}
                          {(!isTeam || c.player_elo || c.player_dota_mmr || c.meta?.elo || c.meta?.dotaMmr) && (
                            <span className="text-xs font-bold text-orange-600 font-mono">
                              {ratingText}
                            </span>
                          )}

                          {/* Steam status typography */}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs font-medium",
                              hasSteam ? "text-emerald-700" : "text-slate-400"
                            )}
                          >
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                hasSteam ? "bg-emerald-500" : "bg-slate-300"
                              )}
                            />
                            <span>{hasSteam ? "Steam подключен" : "Steam не привязан"}</span>
                          </span>

                          {/* Reserve typography */}
                          {isReserve && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span>Резерв</span>
                            </span>
                          )}
                        </div>

                        {/* Subtitle for teams */}
                        {isTeam && (
                          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1">
                            {hasMembers && (
                              <span className="text-slate-600 font-bold">
                                Состав: {c.team_members?.length || 0} игроков
                              </span>
                            )}
                            {Array.isArray(c.meta?.paidPlayerIds) && !isPaid && (
                              <span>
                                Оплачено:{" "}
                                <strong className="text-slate-800">
                                  {paidMembersCount} из {totalMembersCount}
                                </strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Accordion indicator */}
                      {hasMembers && (
                        <div className="text-slate-400 hover:text-slate-600 p-1">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Payment status and actions */}
                    <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                      {/* Payment Status (typography) / Action */}
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 px-1 py-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span>Оплачено</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => onConfirmPayment(c.id)}
                          className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                        >
                          <span>
                            {isTeam && paidMembersCount > 0
                              ? "Оплатить все"
                              : "Подтвердить оплату"}
                          </span>
                        </button>
                      )}

                      {/* Promote button for reserve */}
                      {isReserve && isEditable && (
                        <button
                          onClick={() => onPromoteCompetitor(c.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest px-3.5 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
                          title="Перевести заявку в основной состав"
                        >
                          В основу
                        </button>
                      )}

                      {/* Delete button */}
                      {isEditable && (
                        <button
                          onClick={() => onDeleteCompetitor(c.id)}
                          className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                          title="Аннулировать регистрацию"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded team roster with payment toggles per player */}
                  {isExpanded && hasMembers && (
                    <div className="border-t border-slate-200/60 bg-white/70 p-4 space-y-2.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                        Состав команды (Индивидуальный статус оплаты)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {c.team_members?.map((m: any) => {
                          const isMemberPaid =
                            isPaid ||
                            (Array.isArray(c.meta?.paidPlayerIds) &&
                              c.meta.paidPlayerIds.includes(m.id));
                          const memberHasSteam = Boolean(m.steamId);
                          const memberRating = isDota
                            ? (m.dotaMmr
                                ? `${m.dotaMmr} MMR`
                                : m.dotaRankName || (m.elo ? `${m.elo} MMR` : "Без ранга Dota"))
                            : `${m.elo || 1000} ELO`;
                          return (
                            <div
                              key={m.id}
                              className="flex justify-between items-center text-xs bg-white border border-slate-200 p-3 rounded-2xl shadow-xs"
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isMemberPaid}
                                  onChange={(e) => {
                                    onTogglePlayerPayment(
                                      c.id,
                                      m.id,
                                      e.target.checked
                                    );
                                  }}
                                  className="accent-orange-500 w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-800">
                                      {m.fullName}
                                    </span>
                                    {m.nickname && m.nickname !== m.fullName && (
                                      <span className="text-slate-500 font-semibold text-[11px]">
                                        @{m.nickname.replace(/^@/, "")}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {m.phoneNumber && (
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {m.phoneNumber}
                                      </span>
                                    )}
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 text-[10px] font-medium",
                                        memberHasSteam ? "text-emerald-700" : "text-slate-400"
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "w-1 h-1 rounded-full shrink-0",
                                          memberHasSteam ? "bg-emerald-500" : "bg-slate-300"
                                        )}
                                      />
                                      <span>{memberHasSteam ? "Steam подключен" : "Steam не привязан"}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span className="font-black text-orange-500 font-mono text-xs">
                                {memberRating}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
