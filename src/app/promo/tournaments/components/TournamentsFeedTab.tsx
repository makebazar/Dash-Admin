"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Users,
  Swords,
  Coins,
  FileText,
  ExternalLink,
  ChevronRight,
  Shield,
  CheckCircle2,
  Clock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TournamentBracket } from "./TournamentBracket";
import { TournamentGroupStage } from "./TournamentGroupStage";
import { TournamentCompetitorsList } from "./TournamentCompetitorsList";
import { TournamentPrizePodium } from "./TournamentPrizePodium";
import {
  TournamentNotificationModal,
  TournamentNotificationData,
} from "./TournamentNotificationModal";

interface TournamentsFeedTabProps {
  player: any;
  tournaments: any[];
  activeTournament: any;
  setActiveTournament: (t: any) => void;
  competitors: any[];
  matches?: any[];
  teams: any[];
  clubId?: string;
  fetchTournamentDetails: (id: string) => Promise<void>;
  fetchTournaments: () => Promise<void>;
  onSelectPlayer?: (pId: string, pName: string) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function TournamentsFeedTab({
  player,
  tournaments,
  activeTournament,
  setActiveTournament,
  competitors,
  matches = [],
  teams,
  clubId = "",
  fetchTournamentDetails,
  fetchTournaments,
  onSelectPlayer,
}: TournamentsFeedTabProps) {
  const searchParams = useSearchParams();
  const urlDetailTab = searchParams.get("detailTab");

  // Search & Filter states for Feed List
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "registration" | "active" | "finished">("all");
  const [formatFilter, setFormatFilter] = useState<"all" | "team" | "solo">("all");
  const [disciplineFilter, setDisciplineFilter] = useState<"all" | "cs2" | "fifa" | "ufc">("all");
  const [onlyMyTournaments, setOnlyMyTournaments] = useState(false);

  // Inner navigation tabs in Tournament Detail view
  const [detailTab, setDetailTab] = useState<"bracket" | "competitors" | "prizes">(() => {
    if (urlDetailTab === "competitors" || urlDetailTab === "prizes" || urlDetailTab === "bracket") {
      return urlDetailTab;
    }
    return "bracket";
  });

  const [modalNotification, setModalNotification] = useState<TournamentNotificationData | null>(null);

  const updateUrlQuery = (params: Record<string, string | null>) => {
    if (typeof window === "undefined") return;
    const current = new URLSearchParams(window.location.search);
    Object.entries(params).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") {
        current.delete(k);
      } else {
        current.set(k, v);
      }
    });
    const qs = current.toString();
    const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  };

  const handleBackToList = () => {
    setActiveTournament(null);
    updateUrlQuery({ tournamentId: null, id: null, detailTab: null });
  };

  // Registration states
  const [regMode, setRegMode] = useState<"team" | "solo">("team");
  const [selectedRegTeamId, setSelectedRegTeamId] = useState<string>("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [registering, setRegistering] = useState(false);

  const formatTypeLabel = (tType: string) => {
    const mapping: Record<string, string> = {
      solo: "1vs1 Solo",
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

  const getCountFromLabel = (label: string): number => {
    if (!label) return 1;
    const rangeMatch = label.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      if (end >= start) return end - start + 1;
    }
    return 1;
  };

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

  const calcDynamicPrizePool = (t: any, count: number) => {
    const isTeam = t.type === "2vs2" || t.type === "5vs5";
    const tSize = t.type === "2vs2" || t.type === "mix_2vs2" ? 2 : t.type === "5vs5" || t.type === "mix_5vs5" ? 5 : 1;
    const feeType = t.config?.entryFeeType || "player";
    const mult = isTeam && feeType === "player" ? tSize : 1;
    const totalCollected = count * parseFloat(t.entry_fee || 0) * mult;
    const netPool = totalCollected * (1 - (t.club_share_pct || 0) / 100);
    return Math.max(0, Math.round(netPool));
  };

  const handleRegister = async (tId: string, customRegMode?: "team" | "solo") => {
    if (!consentChecked) return;
    setRegistering(true);
    const chosenMode = customRegMode || regMode;
    const captainTeams = teams.filter(
      (t) => t.isCaptain || t.captainPhone === player?.phoneNumber || t.captainPhone === player?.phone_number
    );
    const targetTeamId = chosenMode === "team" ? selectedRegTeamId || captainTeams[0]?.id || null : null;

    try {
      const res = await fetch("/api/promo/tournaments/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tId,
          teamId: targetTeamId,
          consent: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.paymentStatus === "PAID") {
          setModalNotification({
            type: "success",
            title: "Вы успешно зарегистрированы!",
            message: "Ваш слот в турнире подтвержден. Готовьтесь к началу матчей!",
            tournamentName: activeTournament?.name,
            entryFee: activeTournament?.entry_fee,
            actionText: "Отлично, к турниру",
          });
        } else if (data.paymentStatus === "RESERVE") {
          setModalNotification({
            type: "reserve",
            title: "Вы добавлены в резерв!",
            message: "Все основные слоты турнира заняты. Вы внесены в очередь ожидания и будете автоматически переведены в сетку, если освободится слот.",
            tournamentName: activeTournament?.name,
            actionText: "Понятно",
          });
        } else {
          setModalNotification({
            type: "pending_payment",
            title: "Заявка успешно принята!",
            message: "Ваша заявка зарегистрирована в системе. Оплатите взнос на ресепшене клуба для активации слота.",
            tournamentName: activeTournament?.name,
            entryFee: activeTournament?.entry_fee,
            actionText: "Понятно, оплачу на кассе",
          });
        }
        await fetchTournamentDetails(tId);
        await fetchTournaments();
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка регистрации",
          message:
            data.error ||
            "Не удалось зарегистрироваться на турнир. Попробуйте еще раз или обратитесь к администратору клуба.",
          actionText: "Закрыть",
        });
      }
    } catch (err) {
      console.error(err);
      setModalNotification({
        type: "error",
        title: "Ошибка сети",
        message: "Произошла ошибка при отправке заявки. Проверьте соединение с интернетом.",
        actionText: "Закрыть",
      });
    } finally {
      setRegistering(false);
    }
  };

  // 1. DETAIL VIEW
  if (activeTournament) {
    const { totalBonusPool: activeBonusPool, placements: activePlacements } = parsePrizeDistribution(
      activeTournament.prize_distribution
    );
    const isTeamFormat = activeTournament.type === "2vs2" || activeTournament.type === "5vs5";
    const teamSize =
      activeTournament.type === "2vs2" || activeTournament.type === "mix_2vs2"
        ? 2
        : activeTournament.type === "5vs5" || activeTournament.type === "mix_5vs5"
        ? 5
        : 1;

    const itemPool = activeTournament.config?.itemPool || [];
    const totalItemsValue = activePlacements.reduce((sum: number, p: any) => {
      const matched = itemPool.find((item: any) => item.id === p.itemId);
      if (matched) {
        const count = getCountFromLabel(p.label);
        const itemMultiplier = isTeamFormat && p.itemScope === "team" ? 1 : isTeamFormat ? teamSize : 1;
        return sum + matched.cost * count * itemMultiplier;
      }
      return sum;
    }, 0);

    const cashPrize =
      activeTournament.prize_pool_mode === "fixed"
        ? parseFloat(activeTournament.fixed_prize_amount)
        : calcDynamicPrizePool(activeTournament, competitors.filter((c) => c.payment_status === "PAID").length);
    const cashPrizePlanned =
      activeTournament.prize_pool_mode === "fixed"
        ? parseFloat(activeTournament.fixed_prize_amount)
        : calcDynamicPrizePool(activeTournament, activeTournament.config?.maxParticipants || 16);

    const totalCombinedPrize = cashPrize + activeBonusPool + totalItemsValue;
    const totalCombinedPrizePlanned = cashPrizePlanned + activeBonusPool + totalItemsValue;

    // Check if the current user is a participant in this tournament
    const userCompetitor = competitors.find((c) => {
      if (!player) return false;
      if (c.player_id && String(c.player_id) === String(player.id)) return true;
      if (c.promo_team_id && teams.some((t) => String(t.id) === String(c.promo_team_id))) return true;
      if (
        c.team_members &&
        c.team_members.some(
          (m: any) =>
            (m.id && String(m.id) === String(player.id)) ||
            (m.phoneNumber &&
              (m.phoneNumber === player.phoneNumber || m.phoneNumber === player.phone_number))
        )
      ) {
        return true;
      }
      return false;
    });

    const isRegistered = !!userCompetitor;

    // Find active / upcoming match for the current player
    const userActiveMatch = matches.find((m) => {
      if (!userCompetitor) return false;
      const isMyMatch =
        String(m.competitor_a_id) === String(userCompetitor.id) ||
        String(m.competitor_b_id) === String(userCompetitor.id);
      return isMyMatch && (m.status === "SCHEDULED" || m.status === "VETO" || m.status === "LIVE");
    });

    const hasGroupMatches = matches.some((m) => m.round === 0);
    const hasPlayoffMatches = matches.some((m) => m.round >= 1);

    return (
      <div className="mt-8 space-y-6 animate-fadeIn">
        {/* Back Link */}
        <button
          onClick={handleBackToList}
          className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
        >
          <span className="group-hover:-translate-x-1 transition-transform inline-block font-sans text-sm">←</span>
          К списку турниров
        </button>

        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0c0c0e]/95 border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Clean Typography & Meta Line */}
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex-wrap">
                <span className="text-orange-500 font-black">
                  {(activeTournament.discipline || "CS2").toUpperCase()}
                </span>
                <span className="text-gray-600">•</span>
                <span className="text-white font-bold">
                  {formatTypeLabel(activeTournament.type)}
                </span>
                <span className="text-gray-600">•</span>
                <span>{(activeTournament.config?.matchFormat || "bo1").toUpperCase()}</span>
                <span className="text-gray-600">•</span>
                <span>
                  {activeTournament.config?.bracketType === "double_elimination"
                    ? "Double Elimination"
                    : activeTournament.config?.bracketType === "round_robin"
                    ? "Группы (Round Robin)"
                    : "Олимпийская сетка"}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white leading-tight">
                {activeTournament.name}
              </h1>

              {activeTournament.starts_at && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                  <span>
                    Старт:{" "}
                    <strong className="text-white font-bold">
                      {new Date(activeTournament.starts_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })},{" "}
                      {new Date(activeTournament.starts_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* Right: Clean Status Typography without container clutter */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-2.5 shrink-0">
              {activeTournament.status === "ACTIVE" ? (
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span>LIVE • Идет турнир</span>
                </div>
              ) : activeTournament.status === "REGISTRATION" || activeTournament.status === "DRAFT" ? (
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Регистрация открыта</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-gray-500" />
                  <span>Завершен</span>
                </div>
              )}

              {isRegistered && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Вы участвуете ({userCompetitor?.display_name})</span>
                </div>
              )}
            </div>
          </div>

          {/* Player Active Match Hero Banner */}
          {userActiveMatch && (
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-r from-orange-500/20 via-[#1a1410] to-orange-500/10 border border-orange-500/40 rounded-2xl p-4 sm:p-5 shadow-[0_0_30px_rgba(249,115,22,0.15)] flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/30">
                  <Zap className="w-5 h-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">
                      Ваш матч активен
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                      • Матч #{userActiveMatch.id}
                    </span>
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-white mt-0.5 truncate">
                    Готовность к игре • Лобби матча
                  </h4>
                </div>
              </div>

              <Link
                href={`/promo/tournaments/match/${userActiveMatch.id}${clubId ? `?clubId=${clubId}` : ""}`}
                className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 shrink-0 active:scale-95"
              >
                <span>Войти в лобби матча</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </motion.div>
          )}

          {/* 3 Metric Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-white/5">
            {/* Prize Pool */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">
                Призовой фонд
              </span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-black font-mono text-yellow-400 leading-tight">
                  {formatCurrency(
                    activeTournament.prize_pool_mode === "dynamic" ? totalCombinedPrizePlanned : totalCombinedPrize
                  )}
                </span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">общий фонд</span>
              </div>
            </div>

            {/* Entry Fee */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">
                Взнос за участие
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-white block leading-tight">
                {activeTournament.entry_fee > 0 ? formatCurrency(activeTournament.entry_fee) : "Бесплатно"}
              </span>
            </div>

            {/* Participants */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">
                Участники
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-orange-400 block leading-tight">
                {competitors.length}{" "}
                {activeTournament.config?.maxParticipants ? `/ ${activeTournament.config.maxParticipants}` : ""}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Inner Tab Navigation */}
        <div className="flex gap-2 p-1.5 bg-[#0c0c0e] border border-white/5 rounded-2xl w-full sm:w-fit overflow-x-auto">
          <button
            onClick={() => {
              setDetailTab("bracket");
              updateUrlQuery({ detailTab: "bracket" });
            }}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0",
              detailTab === "bracket"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "text-gray-400 hover:text-white"
            )}
          >
            <span>Сетка и матчи</span>
          </button>

          <button
            onClick={() => {
              setDetailTab("competitors");
              updateUrlQuery({ detailTab: "competitors" });
            }}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0",
              detailTab === "competitors"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "text-gray-400 hover:text-white"
            )}
          >
            <span>Участники ({competitors.length})</span>
          </button>

          <button
            onClick={() => {
              setDetailTab("prizes");
              updateUrlQuery({ detailTab: "prizes" });
            }}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0",
              detailTab === "prizes"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "text-gray-400 hover:text-white"
            )}
          >
            <span>Призовой фонд и правила</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="space-y-8">
          {/* TAB 1: BRACKET & MATCHES */}
          {detailTab === "bracket" && (
            <div className="space-y-10">
              {/* Group Stage tables if tournament has groups */}
              {hasGroupMatches && (
                <TournamentGroupStage
                  tournament={activeTournament}
                  matches={matches}
                  competitors={competitors}
                  currentPlayer={player}
                  userTeams={teams}
                  clubId={clubId}
                />
              )}

              {/* Playoff Bracket */}
              <TournamentBracket
                tournament={activeTournament}
                matches={matches}
                competitors={competitors}
                currentPlayer={player}
                userTeams={teams}
                clubId={clubId}
                onSelectPlayer={onSelectPlayer}
              />
            </div>
          )}

          {/* TAB 2: COMPETITORS LIST */}
          {detailTab === "competitors" && (
            <TournamentCompetitorsList
              tournament={activeTournament}
              competitors={competitors}
              currentPlayer={player}
              userTeams={teams}
              onSelectPlayer={onSelectPlayer}
            />
          )}

          {/* TAB 3: PRIZES & RULES */}
          {detailTab === "prizes" && (
            <TournamentPrizePodium
              tournament={activeTournament}
              competitors={competitors}
              matches={matches}
            />
          )}
        </div>

        {/* REGISTRATION DRAWER (if in REGISTRATION or DRAFT mode) */}
        {(activeTournament.status === "REGISTRATION" || activeTournament.status === "DRAFT") && (
          <div className="bg-[#0c0c0e]/95 border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tight text-white">
                  Регистрация на турнир
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Подтвердите заявку на участие в турнире.
                </p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Слоты: {competitors.length} / {activeTournament.config?.maxParticipants || "16"}
              </span>
            </div>

            {isRegistered ? (
              <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <span className="font-black uppercase block">Вы уже зарегистрированы на этот турнир!</span>
                  <span className="text-gray-300 font-medium text-[11px]">
                    Ваша заявка: <strong>{userCompetitor?.display_name}</strong> (Статус:{" "}
                    {userCompetitor?.payment_status === "PAID"
                      ? "Подтвержден"
                      : userCompetitor?.payment_status === "RESERVE"
                      ? "Резерв"
                      : "Ожидает подтверждения на ресепшене"}
                    ).
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2 border-t border-white/5">
                {isTeamFormat && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                      Выберите команду для регистрации {activeTournament.type === "2vs2" ? "(Формат 2x2)" : "(Формат 5x5)"}
                    </label>
                    {teams.filter((t) => t.isCaptain || t.captainPhone === player?.phoneNumber).length === 0 ? (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-bold">
                        Вы не являетесь капитаном ни одной команды. Создайте команду во вкладке «Моя команда», чтобы зарегистрироваться на командный турнир.
                      </div>
                    ) : (
                      <select
                        value={
                          selectedRegTeamId ||
                          teams.filter((t) => t.isCaptain || t.captainPhone === player?.phoneNumber)[0]?.id ||
                          ""
                        }
                        onChange={(e) => setSelectedRegTeamId(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white focus:outline-none focus:border-orange-500 font-bold"
                      >
                        {teams
                          .filter((t) => t.isCaptain || t.captainPhone === player?.phoneNumber)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              [{t.formatType === "2vs2" ? "2x2" : "5x5"}] {t.name} (Состав: {t.members?.length || 0} игроков)
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                )}

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-1 accent-orange-500 w-4 h-4"
                  />
                  <span className="text-xs text-gray-400 group-hover:text-white transition-colors">
                    Я согласен с правилами турнира и готов внести взнос (если применимо) перед началом игр на ресепшене клуба.
                  </span>
                </label>

                <button
                  disabled={!consentChecked || registering}
                  onClick={() => handleRegister(activeTournament.id)}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-5 rounded-3xl font-black uppercase italic text-lg shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
                >
                  {registering ? "Регистрация..." : "Подтвердить участие в турнире"}
                </button>
              </div>
            )}
          </div>
        )}

        <TournamentNotificationModal
          data={modalNotification}
          onClose={() => setModalNotification(null)}
        />
      </div>
    );
  }

  // 2. TOURNAMENTS FEED LIST
  const filteredTournaments = tournaments.filter((t) => {
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== "all") {
      if (statusFilter === "registration") {
        if (t.status !== "REGISTRATION" && t.status !== "DRAFT") return false;
      } else {
        const statusMap: Record<string, string> = { active: "ACTIVE", finished: "FINISHED" };
        if (t.status !== statusMap[statusFilter]) return false;
      }
    }
    if (formatFilter !== "all") {
      const isTeam = t.type === "team" || t.type === "2vs2" || t.type === "5vs5";
      if (formatFilter === "team" && !isTeam) return false;
      if (formatFilter === "solo" && isTeam) return false;
    }
    if (disciplineFilter !== "all" && t.discipline !== disciplineFilter) return false;
    if (onlyMyTournaments && !t.is_joined) return false;
    return true;
  });

  const grouped: Record<string, any[]> = {};
  filteredTournaments.forEach((t) => {
    const dateKey = t.starts_at
      ? new Date(t.starts_at).toISOString().split("T")[0]
      : t.created_at
      ? new Date(t.created_at).toISOString().split("T")[0]
      : "no-date";
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(t);
  });

  const sortedDateKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "no-date") return 1;
    if (b === "no-date") return -1;
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const formatDateGroup = (dateStr: string) => {
    if (dateStr === "no-date") return "Без даты";
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

    const formatted = date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    if (isSameDay(date, today)) return `Сегодня, ${formatted}`;
    if (isSameDay(date, tomorrow)) return `Завтра, ${formatted}`;
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <div className="mt-8 space-y-6">
      {/* Search & Filters Controls */}
      <div className="bg-[#0c0c0e] border border-white/5 p-6 rounded-[2rem] space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <input
            type="text"
            placeholder="Поиск турнира по названию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
          />

          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 shrink-0 self-start lg:self-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Только мои турниры
            </span>
            <button
              type="button"
              onClick={() => setOnlyMyTournaments(!onlyMyTournaments)}
              className={cn(
                "w-10 h-6 rounded-full transition-colors relative shrink-0 border border-white/10",
                onlyMyTournaments ? "bg-orange-500" : "bg-black/40"
              )}
            >
              <span
                className={cn(
                  "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all",
                  onlyMyTournaments ? "left-5" : "left-0.5"
                )}
              />
            </button>
          </div>
        </div>

        {/* Discipline & Status Badges */}
        <div className="flex flex-wrap gap-6 pt-2 border-t border-white/5 text-xs">
          {/* Discipline */}
          <div className="space-y-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block">
              Дисциплина
            </span>
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              {[
                { id: "all", label: "Все", dot: null },
                { id: "cs2", label: "CS2", dot: "bg-orange-500" },
                { id: "fifa", label: "FIFA", dot: "bg-emerald-500" },
                { id: "ufc", label: "UFC", dot: "bg-red-500" },
              ].map((disp) => (
                <button
                  key={disp.id}
                  onClick={() => setDisciplineFilter(disp.id as any)}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5",
                    disciplineFilter === disp.id ? "bg-orange-500 text-white" : "text-gray-500 hover:text-white"
                  )}
                >
                  {disp.dot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", disp.dot)} />}
                  {disp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block">
              Статус
            </span>
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              {[
                { id: "all", label: "Все" },
                { id: "registration", label: "Регистрация" },
                { id: "active", label: "Идет игра" },
                { id: "finished", label: "Завершенные" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id as any)}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                    statusFilter === st.id ? "bg-orange-500 text-white" : "text-gray-500 hover:text-white"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid Timeline */}
      {filteredTournaments.length === 0 ? (
        <div className="bg-[#0c0c0e] border border-white/5 rounded-[2rem] p-16 text-center space-y-4">
          <div className="text-5xl font-black text-white/5 select-none tracking-tighter uppercase">
            [ — ]
          </div>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
            Турниры не найдены
          </p>
        </div>
      ) : (
        <div className="relative pl-0 md:pl-8 space-y-12">
          <div className="absolute left-6 md:left-10 top-3 bottom-3 w-[2px] bg-gradient-to-b from-orange-500/40 via-purple-500/20 to-white/5 hidden md:block" />

          {sortedDateKeys.map((dateKey) => {
            const groupTournaments = grouped[dateKey];
            return (
              <div key={dateKey} className="relative space-y-4">
                <div className="flex items-center gap-3 md:-ml-12 relative z-10">
                  <div className="w-4 h-4 rounded-full bg-orange-500 ring-4 ring-orange-500/20 border-2 border-[#070708] hidden md:block" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-orange-500 bg-[#0c0c0e] py-1.5 px-4 rounded-full border border-orange-500/20 shadow-lg shadow-orange-500/5">
                    {formatDateGroup(dateKey)}
                  </h4>
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-600 bg-[#0c0c0e] py-1 px-2.5 rounded-full border border-white/5">
                    {groupTournaments.length}
                  </span>
                </div>

                <div className="space-y-4 pl-0 md:pl-8">
                  {groupTournaments.map((t) => {
                    const maxParticipants = t.config?.maxParticipants ? parseInt(t.config.maxParticipants) : 16;
                    const slotsPercent = Math.min(100, Math.round(((t.competitors_count || 0) / maxParticipants) * 100));

                    return (
                      <motion.div
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={t.id}
                        onClick={() => {
                          updateUrlQuery({ tournamentId: String(t.id) });
                          fetchTournamentDetails(t.id);
                        }}
                        className="bg-[#0c0c0e]/95 border border-white/5 rounded-[2rem] p-5 cursor-pointer hover:bg-white/5 transition-all group shadow-xl flex flex-col md:flex-row gap-5 items-stretch md:items-center justify-between overflow-hidden relative"
                      >
                        {/* Game info */}
                        <div className="min-w-0 flex-1 md:flex-1 md:basis-0">
                          <h3 className="text-base font-black uppercase tracking-tight truncate group-hover:text-orange-500 transition-colors mb-1.5">
                            {t.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider mt-1.5">
                            <span className="text-orange-500 font-black">
                              {(t.discipline || "CS2").toUpperCase()}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="text-gray-300 font-bold">{formatTypeLabel(t.type)}</span>
                            {t.starts_at && (
                              <>
                                <span className="text-gray-600">•</span>
                                <span className="text-gray-400 font-medium">
                                  СТАРТ: {new Date(t.starts_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Slots */}
                        <div className="flex flex-col gap-1.5 w-full md:flex-1 md:basis-0 md:items-center justify-center shrink-0">
                          <div className="flex flex-col gap-1.5 w-full md:w-48 justify-center">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-gray-400">
                              <span>Слоты</span>
                              <span className="text-white font-black">{t.competitors_count || 0} / {maxParticipants}</span>
                            </div>
                            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  t.discipline === "cs2" ? "bg-orange-500" : t.discipline === "fifa" ? "bg-emerald-500" : "bg-red-500"
                                )}
                                style={{ width: `${slotsPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Status & Entry Fee */}
                        <div className="flex items-center justify-between md:justify-end gap-6 md:flex-1 md:basis-0 shrink-0">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">
                              Взнос
                            </span>
                            <span className="text-sm font-black text-white block leading-none">
                              {t.entry_fee > 0 ? formatCurrency(t.entry_fee) : "Бесплатно"}
                            </span>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {t.status === "ACTIVE" ? (
                              <span className="relative overflow-hidden text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border bg-red-500/10 text-red-400 border-red-500/20 block text-center">
                                <span className="relative z-10">● LIVE</span>
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border block text-center",
                                  t.status === "REGISTRATION" || t.status === "DRAFT"
                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                    : "bg-white/5 text-gray-400 border-white/10"
                                )}
                              >
                                {t.status === "REGISTRATION" || t.status === "DRAFT" ? "Регистрация" : "Завершен"}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TournamentNotificationModal
        data={modalNotification}
        onClose={() => setModalNotification(null)}
      />
    </div>
  );
}
