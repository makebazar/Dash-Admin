"use client";
import React from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Users,
  Coins,
  Settings,
  ArrowLeft,
  Edit,
  Trash2,
  Play,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tournament,
  Competitor,
  Match,
  Payout,
  DashMatchAgentInfo,
  formatTypeLabel,
  parsePrizeDistribution,
} from "../types";

interface TournamentDetailHeaderProps {
  clubId: string;
  tournament: Tournament;
  competitors: Competitor[];
  matches: Match[];
  payouts: Payout[];
  activeTab: "bracket" | "competitors" | "prizes" | "info";
  onSelectTab: (tab: "bracket" | "competitors" | "prizes" | "info") => void;
  onBack: () => void;
  onDelete: () => void;
  onStartTournament: () => void;
  onOpenRebuildModal: () => void;
  dashmatchAgent?: DashMatchAgentInfo | null;
}

export function TournamentDetailHeader({
  clubId,
  tournament,
  competitors,
  matches,
  payouts,
  activeTab,
  onSelectTab,
  onBack,
  onDelete,
  onStartTournament,
  onOpenRebuildModal,
  dashmatchAgent,
}: TournamentDetailHeaderProps) {
  const router = useRouter();

  const mainComps = competitors.filter((c) => c.payment_status !== "RESERVE");
  const reserveComps = competitors.filter(
    (c) => c.payment_status === "RESERVE"
  );
  const paidComps = mainComps.filter((c) => c.payment_status === "PAID");

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
  const share = tournament.club_share_pct || 0;

  const actualPool =
    tournament.prize_pool_mode === "fixed"
      ? parseFloat(String(tournament.fixed_prize_amount || 0))
      : Math.round(paidComps.length * feePerComp * (1 - share / 100));

  const maxParticipants = tournament.config?.maxParticipants || 16;
  const isDraftOrReg =
    tournament.status === "REGISTRATION" || tournament.status === "DRAFT";

  const getStatusBadge = () => {
    switch (tournament.status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 border border-red-200 text-xs font-black uppercase tracking-wider rounded-xl animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>● LIVE • Идет турнир</span>
          </span>
        );
      case "REGISTRATION":
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black uppercase tracking-wider rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Регистрация открыта</span>
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-black uppercase tracking-wider rounded-xl">
            <span>Завершен</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-black uppercase tracking-wider rounded-xl">
            <span>{tournament.status}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Card */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-sm">
        {/* Top bar with back and actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>К списку турниров</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {isDraftOrReg && (
              <button
                onClick={onStartTournament}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Запустить турнир</span>
              </button>
            )}

            {tournament.status === "ACTIVE" && (
              <button
                onClick={onOpenRebuildModal}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Пересобрать сетку турнира"
              >
                <RefreshCw className="w-3.5 h-3.5 text-orange-500" />
                <span>Пересобрать</span>
              </button>
            )}

            <button
              onClick={() =>
                router.push(
                  `/clubs/${clubId}/tournaments/create?editId=${tournament.id}`
                )
              }
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Редактировать</span>
            </button>

            <button
              onClick={onDelete}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Удалить</span>
            </button>
          </div>
        </div>

        {/* Tournament Title & Meta Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span className="text-orange-600 font-black">
                {tournament.discipline?.toUpperCase() || "CS2"}
              </span>
              <span>•</span>
              <span className="text-slate-700 font-bold">
                {formatTypeLabel(tournament.type)}
              </span>
              <span>•</span>
              <span>{(tournament.config?.matchFormat || "bo1").toUpperCase()}</span>
              <span>•</span>
              <span>
                {tournament.config?.bracketType === "double_elimination"
                  ? "Double Elimination"
                  : tournament.config?.bracketType === "round_robin"
                  ? "Round Robin"
                  : "Single Elimination"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-slate-900 leading-tight">
              {tournament.name}
            </h1>

            {tournament.starts_at && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-orange-500" />
                <span>
                  Старт:{" "}
                  <strong className="text-slate-800 font-bold">
                    {new Date(tournament.starts_at).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {getStatusBadge()}

            {tournament.discipline === "cs2" && (
              <button
                type="button"
                onClick={() => router.push(`/clubs/${clubId}/tournaments?tab=servers`)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border text-xs font-bold rounded-xl transition-all cursor-pointer",
                  dashmatchAgent?.is_online
                    ? "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    : "text-amber-700 border-amber-200 hover:bg-amber-50"
                )}
                title="Статус агента DashMatch на ПК клуба (кликните для перехода в настройки агента)"
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    dashmatchAgent?.is_online ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  )}
                />
                <span>
                  DashMatch: {dashmatchAgent?.is_online ? `LAN ${dashmatchAgent.lan_ip || "127.0.0.1"}` : "Не в сети на ПК"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Sleek Tab Navigation Bar */}
      <div className="flex bg-white p-2 rounded-2xl border border-slate-200 shadow-sm gap-2 overflow-x-auto">
        {[
          {
            id: "bracket",
            label: "Сетка и матчи",
            icon: Trophy,
            badge:
              matches.length > 0
                ? `${matches.length}`
                : isDraftOrReg
                ? "Ожидает старта"
                : null,
          },
          {
            id: "competitors",
            label: "Участники и взносы",
            icon: Users,
            badge: `${mainComps.length}/${maxParticipants}`,
          },
          {
            id: "prizes",
            label: "Призовой фонд",
            icon: Coins,
            badge: `${actualPool.toLocaleString("ru-RU")} ₽`,
          },
          {
            id: "info",
            label: "Регламент и инфо",
            icon: Settings,
            badge: null,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id as any)}
              className={cn(
                "flex-1 min-w-[170px] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap",
                isActive
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-400")} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={cn(
                    "text-[10px] font-mono px-2 py-0.5 rounded-md font-black",
                    isActive
                      ? "bg-black/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
