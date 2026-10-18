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
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  onPublish?: () => void;
  onRevertToDraft?: () => void;
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
  onPublish,
  onRevertToDraft,
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
    const s = String(tournament.status || "").toUpperCase();
    switch (s) {
      case "ACTIVE":
      case "LIVE":
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>LIVE • Идет турнир</span>
          </span>
        );
      case "REGISTRATION":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Регистрация открыта</span>
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Черновик</span>
          </span>
        );
      case "COMPLETED":
      case "FINISHED":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Завершен</span>
          </span>
        );
      case "CANCELLED":
      case "CANCELED":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Отменен</span>
          </span>
        );
      case "PENDING":
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Ожидает начала</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>{tournament.status}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header (matches /clubs/1/tournaments design code) */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer group mb-3"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>К списку турниров</span>
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
              {tournament.name}
            </h1>

            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 font-medium mt-2.5">
              {getStatusBadge()}
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-900">
                {tournament.discipline?.toLowerCase() === "dota2"
                  ? "Dota 2"
                  : tournament.discipline?.toUpperCase() || "CS2"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-700">
                {formatTypeLabel(tournament.type)}
              </span>
              <span className="text-slate-300">•</span>
              <span className="uppercase font-mono text-[11px] font-semibold text-slate-600">
                {tournament.config?.matchFormat || "BO1"}
              </span>
              <span className="text-slate-300">•</span>
              <span>
                {tournament.config?.bracketType === "double_elimination"
                  ? "Double Elimination"
                  : tournament.config?.bracketType === "round_robin"
                  ? "Круговая сетка"
                  : "Single Elimination"}
              </span>
              {tournament.starts_at && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {new Date(tournament.starts_at).toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {(tournament.discipline === "cs2" ||
              tournament.discipline === "dota2") && (
              <button
                type="button"
                onClick={() =>
                  router.push(`/clubs/${clubId}/tournaments?tab=servers`)
                }
                className="h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer shrink-0"
                title="Статус агента DashMatch на ПК клуба (кликните для перехода в настройки)"
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    dashmatchAgent?.is_online
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-amber-500"
                  )}
                />
                <span className="font-medium whitespace-nowrap">
                  DashMatch:{" "}
                  {dashmatchAgent?.is_online
                    ? `LAN ${dashmatchAgent.lan_ip || "127.0.0.1"}`
                    : "Не в сети"}
                </span>
              </button>
            )}

            {tournament.status === "DRAFT" && onPublish && (
              <Button
                onClick={onPublish}
                className="h-10 rounded-xl px-5 bg-black hover:bg-slate-800 text-white font-medium text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center cursor-pointer shrink-0"
              >
                <span>Открыть регистрацию</span>
              </Button>
            )}

            {tournament.status === "REGISTRATION" && (
              <Button
                onClick={onStartTournament}
                className="h-10 rounded-xl px-5 bg-black hover:bg-slate-800 text-white font-medium text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center cursor-pointer shrink-0"
              >
                <span>Запустить турнир</span>
              </Button>
            )}

            {tournament.status === "REGISTRATION" && onRevertToDraft && (
              <Button
                variant="outline"
                size="icon"
                onClick={onRevertToDraft}
                className="h-10 w-10 rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shrink-0 cursor-pointer"
                title="Вернуть в статус черновика"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}

            {tournament.status === "ACTIVE" && (
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenRebuildModal}
                className="h-10 w-10 rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shrink-0 cursor-pointer"
                title="Пересобрать сетку турнира"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                router.push(
                  `/clubs/${clubId}/tournaments/create?editId=${tournament.id}`
                )
              }
              className="h-10 w-10 rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shrink-0 cursor-pointer"
              title="Редактировать турнир"
            >
              <Edit className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={onDelete}
              className="h-10 w-10 rounded-xl border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 transition-all shrink-0 cursor-pointer"
              title="Удалить турнир"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Sub-Tabs Strip (matches root tabs in /clubs/1/tournaments) */}
      <div className="flex bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200 shadow-xs gap-1 sm:gap-2 overflow-x-auto">
        {[
          {
            id: "bracket",
            label: "Сетка и матчи",
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
            badge: `${mainComps.length}/${maxParticipants}`,
          },
          {
            id: "prizes",
            label: "Призовой фонд",
            badge: `${actualPool.toLocaleString("ru-RU")} ₽`,
          },
          {
            id: "info",
            label: "Регламент и инфо",
            badge: null,
          },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id as any)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer flex items-center gap-2 whitespace-nowrap",
                isActive
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={cn(
                    "text-[10px] font-mono px-2 py-0.5 rounded-md font-bold",
                    isActive
                      ? "bg-white/20 text-white"
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
