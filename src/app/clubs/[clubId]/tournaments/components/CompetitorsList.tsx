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
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Всего участников
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {mainCompetitors.length}{" "}
            <span className="text-xs font-bold text-slate-400">
              / {maxParticipants}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            Основной состав слотов
          </span>
        </div>

        {/* Paid */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
              Оплачено
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {paidCompetitors.length}
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            Подтвержденные слоты
          </span>
        </div>

        {/* Unpaid */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
              Ожидает взноса
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {unpaidCompetitors.length}
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            Неоплаченные заявки
          </span>
        </div>

        {/* Reserve */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
              В резерве
            </span>
            <AlertCircle className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600">
            {reserveCompetitors.length}
          </div>
          <span className="text-[10px] text-slate-500 font-medium block">
            Очередь ожидания
          </span>
        </div>
      </div>

      {/* 2. Dev Test Bots Toolbar (if REGISTRATION / DRAFT) */}
      {isEditable && onGenerateBots && (
        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-indigo-950 block">
                  Тестовые боты (Автозаполнение)
                </span>
                <span className="text-[9px] font-black uppercase bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded">
                  Dev Test
                </span>
              </div>
              <span className="text-[10px] text-indigo-700 font-medium mt-0.5 block">
                Мгновенное заполнение свободных слотов для проверки сетки и регламента
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isGeneratingBots}
              onClick={() => onGenerateBots(4)}
              className="px-3 py-2 bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-900 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-xs cursor-pointer"
            >
              +4 Бота
            </button>
            <button
              type="button"
              disabled={isGeneratingBots}
              onClick={() => onGenerateBots(8)}
              className="px-3 py-2 bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-900 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-xs cursor-pointer"
            >
              +8 Ботов
            </button>
            <button
              type="button"
              disabled={isGeneratingBots}
              onClick={() => onGenerateBots()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {isGeneratingBots ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Создание...</span>
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5" />
                  <span>Заполнить все слоты</span>
                </>
              )}
            </button>
            {hasBots && onClearBots && (
              <button
                type="button"
                onClick={onClearBots}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Очистить ботов
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Search and Status Filters */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск участника по имени, никнейму или телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors shadow-xs"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto shrink-0">
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
                  "px-3.5 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
                  statusFilter === tab.id
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                    statusFilter === tab.id
                      ? "bg-slate-100 text-slate-700"
                      : "bg-slate-200/70 text-slate-600"
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
          <div className="text-center py-16 space-y-2 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
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
                        "flex items-center gap-3.5 flex-1 min-w-0",
                        hasMembers && "cursor-pointer select-none"
                      )}
                    >
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden flex items-center justify-center shrink-0">
                        {c.team_logo ? (
                          <img
                            src={c.team_logo}
                            alt={c.display_name}
                            className="w-full h-full object-cover"
                          />
                        ) : isTeam ? (
                          <Users className="w-5 h-5 text-orange-500" />
                        ) : (
                          <span className="text-sm font-black text-orange-500 uppercase">
                            {c.display_name.substring(0, 2)}
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-slate-900 truncate block">
                            {c.display_name}
                          </span>

                          <span
                            className={cn(
                              "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border font-mono",
                              isTeam
                                ? "bg-orange-50 text-orange-600 border-orange-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            )}
                          >
                            {isTeam ? "Команда" : "Одиночный игрок"}
                          </span>

                          {(c.player_elo || c.meta?.elo) && !isTeam && (
                            <span className="text-[10px] font-black text-orange-600 font-mono">
                              {c.player_elo || c.meta?.elo} ELO
                            </span>
                          )}

                          {isReserve && (
                            <span className="text-[8px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-mono">
                              Резерв
                            </span>
                          )}
                        </div>

                        {/* Subtitle */}
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                          {hasMembers && (
                            <span className="text-slate-600 font-bold">
                              Состав: {c.team_members?.length || 0} игроков
                            </span>
                          )}
                          {isTeam &&
                            Array.isArray(c.meta?.paidPlayerIds) &&
                            !isPaid && (
                              <span>
                                Оплачено:{" "}
                                <strong className="text-slate-800">
                                  {paidMembersCount} из {totalMembersCount}
                                </strong>
                              </span>
                            )}
                        </div>
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
                      {/* Payment Status Badge / Action */}
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-3 py-2 rounded-xl">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
                                  <span className="font-black text-slate-800 block">
                                    {m.fullName}
                                  </span>
                                  {m.phoneNumber && (
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {m.phoneNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="font-black text-orange-500 font-mono text-xs">
                                {m.elo ? `${m.elo} ELO` : "1000 ELO"}
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
