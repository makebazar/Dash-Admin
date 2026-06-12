"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Users,
  User,
  Coins,
  ShieldAlert,
  Loader2,
  ChevronRight,
  Plus,
  LogOut,
  Trash2,
  Check,
  Calendar,
  Gamepad2,
  BookOpen,
  X,
  Settings,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function TournamentsPortal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlClubId = searchParams.get("clubId") || "";
  const [clubId, setClubId] = React.useState<string>(urlClubId);

  React.useEffect(() => {
    if (urlClubId) {
      setClubId(urlClubId);
    }
  }, [urlClubId]);

  const [activeTab, setActiveTab] = React.useState<"feed" | "profile" | "team" | "leaderboard">("feed");
  const [loading, setLoading] = React.useState(true);
  const [player, setPlayer] = React.useState<any>(null);
  const [tournaments, setTournaments] = React.useState<any[]>([]);
  const [activeTournament, setActiveTournament] = React.useState<any>(null);
  const [competitors, setCompetitors] = React.useState<any[]>([]);
  const [matches, setMatches] = React.useState<any[]>([]);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "registration" | "active" | "finished">("all");
  const [formatFilter, setFormatFilter] = React.useState<"all" | "team" | "solo">("all");
  const [disciplineFilter, setDisciplineFilter] = React.useState<"all" | "cs2" | "fifa" | "ufc">("all");
  const [onlyMyTournaments, setOnlyMyTournaments] = React.useState(false);

  // Team states
  const [teams, setTeams] = React.useState<any[]>([]);
  const [activeTeamId, setActiveTeamId] = React.useState<string | null>(null);
  const [showCreateJoin, setShowCreateJoin] = React.useState(false);
  const [newTeamName, setNewTeamName] = React.useState("");
  const [joinInviteCode, setJoinInviteCode] = React.useState("");
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editTeamName, setEditTeamName] = React.useState("");
  const [editTeamLogoUrl, setEditTeamLogoUrl] = React.useState("");
  const [uploadingLogo, setUploadingLogo] = React.useState(false);

  // Leaderboard states
  const [leaderboardDiscipline, setLeaderboardDiscipline] = React.useState("cs2");
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);

  // Registration states
  const [consentChecked, setConsentChecked] = React.useState(false);
  const [registering, setRegistering] = React.useState(false);

  const formatTypeLabel = (tType: string) => {
    const mapping: Record<string, string> = {
      "solo": "1vs1",
      "team": "Team 5x5",
      "mix": "Mix ELO",
      "1vs1": "1vs1",
      "2vs2": "2vs2 Team",
      "5vs5": "5vs5 Team",
      "mix_2vs2": "Mix 2vs2",
      "mix_5vs5": "Mix 5vs5",
    };
    return mapping[tType] || tType;
  };

  const renderGameEmblem = (discipline: string, isLive: boolean) => {
    const normalized = (discipline || "").toLowerCase();
    
    let emblemContent;
    if (normalized === "cs2") {
      emblemContent = (
        <div className="w-28 h-14 rounded-2xl bg-orange-500/5 border border-orange-500/20 flex items-center justify-center relative overflow-hidden group-hover:border-orange-500/40 transition-colors shadow-[0_0_15px_rgba(249,115,22,0.05)]">
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,#f97316_0%,transparent_70%)]" />
          <img src="/cs2_logo.svg" alt="CS2" className="w-24 h-auto object-contain relative z-10" />
        </div>
      );
    } else if (normalized === "fifa") {
      emblemContent = (
        <div className="w-28 h-14 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center relative overflow-hidden group-hover:border-emerald-500/40 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.05)]">
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,#10b981_0%,transparent_70%)]" />
          <img src="/fifa_logo.svg" alt="FIFA" className="w-20 h-auto object-contain relative z-10" />
        </div>
      );
    } else if (normalized === "ufc") {
      emblemContent = (
        <div className="w-28 h-14 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-center justify-center relative overflow-hidden group-hover:border-red-500/40 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.05)]">
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_center,#ef4444_0%,transparent_70%)]" />
          <img src="/ufc_logo.svg" alt="UFC" className="w-20 h-auto object-contain relative z-10" />
        </div>
      );
    } else {
      emblemContent = (
        <div className="w-28 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative group-hover:border-white/20 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.02)]">
          <Gamepad2 className="w-7 h-7 text-gray-400 group-hover:text-white transition-colors" />
        </div>
      );
    }

    return (
      <div className="relative shrink-0 group-hover:scale-102 transition-transform">
        {emblemContent}
        {isLive && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
          </span>
        )}
      </div>
    );
  };

  const fetchPlayerAndTeam = async (overrideActiveId?: string, currentClubId = clubId) => {
    try {
      const pRes = await fetch("/api/promo/player");
      if (pRes.status === 401) {
        router.push(`/promo/login?clubId=${currentClubId}`);
        return null;
      }
      const pData = await pRes.json();
      setPlayer(pData.player);

      // Fetch teams
      const tRes = await fetch("/api/promo/teams");
      const tData = await tRes.json();
      const fetchedTeams = tData.teams || [];
      setTeams(fetchedTeams);
      
      if (fetchedTeams.length > 0) {
        if (overrideActiveId && fetchedTeams.some((t: any) => t.id === overrideActiveId)) {
          setActiveTeamId(overrideActiveId);
        } else {
          setActiveTeamId(prev => {
            if (prev && fetchedTeams.some((t: any) => t.id === prev)) {
              return prev;
            }
            return fetchedTeams[0].id;
          });
        }

        // Pre-select first captained team for registration
        const captained = fetchedTeams.filter((t: any) => t.captainId === pData.player.id);
        if (captained.length > 0) {
          setSelectedRegTeamId(prev => {
            if (overrideActiveId && captained.some((t: any) => t.id === overrideActiveId)) {
              return overrideActiveId;
            }
            if (prev && captained.some((t: any) => t.id === prev)) {
              return prev;
            }
            return captained[0].id;
          });
        }
      } else {
        setActiveTeamId(null);
      }

      const resolvedClubId = currentClubId || (pData.player.clubId ? String(pData.player.clubId) : "");
      if (resolvedClubId && resolvedClubId !== clubId) {
        setClubId(resolvedClubId);
      }
      return resolvedClubId;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const fetchTournaments = async (targetClubId = clubId) => {
    if (!targetClubId) return;
    try {
      const res = await fetch(`/api/clubs/${targetClubId}/tournaments`);
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTournamentDetails = async (id: string, targetClubId = clubId) => {
    if (!targetClubId) return;
    try {
      const res = await fetch(`/api/clubs/${targetClubId}/tournaments?id=${id}`);
      const data = await res.json();
      setActiveTournament(data.tournament);
      setCompetitors(data.competitors || []);
      setMatches(data.matches || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaderboard = async (discipline: string, targetClubId = clubId) => {
    try {
      if (!targetClubId) return;
      const boardRes = await fetch(`/api/promo/public/board-data?discipline=${discipline}&clubId=${targetClubId}`);
      const boardData = await boardRes.json();
      setLeaderboard(boardData.leaderboard || []);
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    async function init() {
      setLoading(true);
      const resolvedClubId = await fetchPlayerAndTeam(undefined, urlClubId);
      if (resolvedClubId) {
        await fetchTournaments(resolvedClubId);
      }
      setLoading(false);
    }
    init();
  }, [urlClubId]);

  React.useEffect(() => {
    if (activeTab === "leaderboard") {
      fetchLeaderboard(leaderboardDiscipline);
    }
  }, [activeTab, leaderboardDiscipline]);

  React.useEffect(() => {
    if (!activeTournament || !player) return;
    const isTeamTourney = activeTournament.type === "team" || activeTournament.type === "2vs2" || activeTournament.type === "5vs5";
    if (isTeamTourney) {
      const myCaptainedTeams = teams.filter(t => t.captainId === player.id);
      const requiredSize = activeTournament.type === "2vs2" ? 2 : 5;
      const eligibleTeams = myCaptainedTeams.filter(t => t.members?.length === requiredSize);
      if (eligibleTeams.length > 0) {
        setRegMode("team");
        setSelectedRegTeamId(eligibleTeams[0].id);
      } else {
        setRegMode("solo");
      }
    } else {
      setRegMode("solo");
    }
  }, [activeTournament, teams, player]);

  // Team Actions
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: newTeamName }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewTeamName("");
        setShowCreateJoin(false);
        await fetchPlayerAndTeam(data.teamId);
      } else {
        alert(data.error || "Ошибка создания команды");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoinTeam = async () => {
    if (!joinInviteCode.trim()) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", inviteCode: joinInviteCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setJoinInviteCode("");
        setShowCreateJoin(false);
        await fetchPlayerAndTeam(data.teamId);
      } else {
        alert(data.error || "Неверный код приглашения или вы уже состоите в команде");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveTeam = async () => {
    if (!activeTeamId) return;
    if (!confirm("Вы уверены, что хотите покинуть команду?")) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", teamId: activeTeamId }),
      });
      if (res.ok) {
        await fetchPlayerAndTeam();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisbandTeam = async () => {
    if (!activeTeamId) return;
    if (!confirm("Вы уверены, что хотите распустить команду? Это действие необратимо.")) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disband", teamId: activeTeamId }),
      });
      if (res.ok) {
        await fetchPlayerAndTeam();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleKickMember = async (targetPlayerId: string) => {
    if (!activeTeamId) return;
    if (!confirm("Исключить игрока из команды?")) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kick", teamId: activeTeamId, playerIdToKick: targetPlayerId }),
      });
      if (res.ok) {
        await fetchPlayerAndTeam();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEditModal = (t: any) => {
    setEditTeamName(t.name);
    setEditTeamLogoUrl(t.logoUrl || "");
    setShowEditModal(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setEditTeamLogoUrl(data.url);
      } else {
        alert(data.error || "Ошибка при загрузке логотипа");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка при загрузке логотипа");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveTeamEdits = async () => {
    if (!editTeamName.trim()) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          teamId: activeTeamId,
          name: editTeamName,
          logoUrl: editTeamLogoUrl || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowEditModal(false);
        await fetchPlayerAndTeam(activeTeamId || undefined);
      } else {
        alert(data.error || "Ошибка при обновлении команды");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка при обновлении команды");
    }
  };

  // Tournament Registration
  const [regMode, setRegMode] = React.useState<"team" | "solo">("team");
  const [selectedRegTeamId, setSelectedRegTeamId] = React.useState<string>("");

  const handleRegister = async (tId: string, customRegMode?: "team" | "solo") => {
    if (!consentChecked) return;
    setRegistering(true);
    const chosenMode = customRegMode || regMode;
    const targetTeamId = chosenMode === "team" 
      ? (selectedRegTeamId || teams.filter(t => t.captainId === player?.id)[0]?.id || null)
      : null;
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
        alert(
          data.paymentStatus === "PAID"
            ? "Вы успешно зарегистрированы!"
            : data.paymentStatus === "RESERVE"
            ? "Вы добавлены в очередь ожидания (резерв)!"
            : "Заявка принята! Оплатите взнос на ресепшене клуба."
        );
        fetchTournamentDetails(tId);
        fetchTournaments();
      } else {
        alert(data.error || "Ошибка регистрации");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070708] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const getCountFromLabel = (label: string): number => {
    if (!label) return 1;
    const rangeMatch = label.match(/(\d+)\s*-\s*(\d+)/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      if (end >= start) {
        return (end - start) + 1;
      }
    }
    return 1;
  };

  const parsePrizeDistribution = (data: any) => {
    if (!data) {
      return {
        totalBonusPool: 0,
        placements: []
      };
    }
    if (Array.isArray(data.placements)) {
      return {
        totalBonusPool: data.totalBonusPool || 0,
        placements: data.placements.map((p: any) => ({
          ...p,
          cashPct: p.cashPct <= 1 ? Math.round(p.cashPct * 100) : p.cashPct,
          itemId: p.itemId || "",
          item: p.item || "",
          itemScope: p.itemScope || "player"
        }))
      };
    }
    const placements: any[] = [];
    const keys = Object.keys(data).filter(k => k !== "_meta");
    keys.sort((a, b) => parseInt(a) - parseInt(b));
    keys.forEach(key => {
      const item = data[key];
      placements.push({
        id: key,
        label: `${key} Место`,
        cashPct: Math.round((item.cashPct || 0) * 100),
        bonus: item.bonus || 0,
        item: item.item || "",
        itemId: item.itemId || "",
        itemScope: item.itemScope || "player"
      });
    });
    return {
      totalBonusPool: data._meta?.totalBonusPool || 0,
      placements
    };
  };

  // Calculate dynamic prize pool if activeTournament selected
  const calcDynamicPrizePool = (t: any, count: number) => {
    const isTeam = t.type === "2vs2" || t.type === "5vs5";
    const tSize = t.type === "2vs2" || t.type === "mix_2vs2" ? 2 : (t.type === "5vs5" || t.type === "mix_5vs5" ? 5 : 1);
    const feeType = t.config?.entryFeeType || "player";
    const mult = (isTeam && feeType === "player") ? tSize : 1;
    
    const totalCollected = count * parseFloat(t.entry_fee || 0) * mult;
    const netPool = totalCollected * (1 - (t.club_share_pct || 0) / 100);
    return Math.max(0, Math.round(netPool));
  };

  return (
    <div className="min-h-screen bg-[#070708] text-white selection:bg-orange-500/20 selection:text-orange-400 pb-20">
      {/* Navigation Header */}
      <header className="border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-orange-500" />
            <div>
              <h1 className="text-xl font-black uppercase italic tracking-tight">
                Tournament <span className="text-orange-500">Portal</span>
              </h1>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                {player?.clubName || "Игровой клуб"}
              </p>
            </div>
          </div>

          {/* ELO Badges */}
          <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
            <div className="text-center">
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block">
                CS2 Rating
              </span>
              <span className="text-sm font-black text-orange-500 italic">
                {player?.elo_cs2 || 1000} ELO
              </span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="text-center">
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block">
                Баланс
              </span>
              <span className="text-sm font-black text-yellow-500 italic">
                {player?.bonusBalance || 0} ₽
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Menu */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 max-w-xl">
          <button
            onClick={() => {
              setActiveTab("feed");
              setActiveTournament(null);
            }}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
              activeTab === "feed"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "text-gray-500 hover:text-white"
            )}
          >
            Турниры
          </button>
          <button
            onClick={() => {
              setActiveTab("team");
              setActiveTournament(null);
            }}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
              activeTab === "team"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "text-gray-500 hover:text-white"
            )}
          >
            Моя Команда
          </button>
          <button
            onClick={() => {
              setActiveTab("profile");
              setActiveTournament(null);
            }}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
              activeTab === "profile"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "text-gray-500 hover:text-white"
            )}
          >
            Профиль
          </button>
          <button
            onClick={() => {
              setActiveTab("leaderboard");
              setActiveTournament(null);
            }}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
              activeTab === "leaderboard"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "text-gray-500 hover:text-white"
            )}
          >
            Лидерборд
          </button>
        </div>

        {/* FEED TAB */}
        {activeTab === "feed" && !activeTournament && (
          <div className="mt-8 space-y-6">
            {/* Search & Filters Controls */}
            <div className="bg-[#0c0c0e] border border-white/5 p-6 rounded-[2rem] space-y-4">
              <div className="flex flex-col lg:flex-row gap-4 justify-between">
                {/* Search Input */}
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Поиск турнира по названию..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                {/* My Tournaments Toggle Switch */}
                <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 shrink-0 self-start lg:self-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Только мои турниры
                  </span>
                  <button
                    type="button"
                    onClick={() => setOnlyMyTournaments(!onlyMyTournaments)}
                    className={cn(
                      "w-10 h-6 rounded-full transition-colors relative shrink-0 focus:outline-none border border-white/10",
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

              {/* Badges Filters */}
              <div className="flex flex-wrap gap-6 pt-2 border-t border-white/5 text-xs">
                {/* Discipline Filter */}
                <div className="space-y-1.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block">
                    Дисциплина
                  </span>
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                    {[
                      { id: "all", label: "Все" },
                      { id: "cs2", label: "CS2" },
                      { id: "fifa", label: "FIFA" },
                      { id: "ufc", label: "UFC" },
                    ].map((disp) => (
                      <button
                        key={disp.id}
                        onClick={() => setDisciplineFilter(disp.id as any)}
                        className={cn(
                          "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                          disciplineFilter === disp.id ? "bg-orange-500 text-white" : "text-gray-500 hover:text-white"
                        )}
                      >
                        {disp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
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

                {/* Format Filter */}
                <div className="space-y-1.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block">
                    Формат
                  </span>
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                    {[
                      { id: "all", label: "Все" },
                      { id: "team", label: "Командный" },
                      { id: "solo", label: "Соло / Микс" },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        onClick={() => setFormatFilter(fmt.id as any)}
                        className={cn(
                          "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                          formatFilter === fmt.id ? "bg-orange-500 text-white" : "text-gray-500 hover:text-white"
                        )}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Tournaments Grid */}
            {(() => {
              const filteredTournaments = tournaments.filter((t) => {
                if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                  return false;
                }
                if (statusFilter !== "all") {
                  if (statusFilter === "registration") {
                    if (t.status !== "REGISTRATION" && t.status !== "DRAFT") {
                      return false;
                    }
                  } else {
                    const statusMap: Record<string, string> = {
                      active: "ACTIVE",
                      finished: "FINISHED",
                    };
                    if (t.status !== statusMap[statusFilter]) {
                      return false;
                    }
                  }
                }
                if (formatFilter !== "all") {
                  const isTeamFormat = t.type === "team" || t.type === "2vs2" || t.type === "5vs5";
                  if (formatFilter === "team" && !isTeamFormat) return false;
                  if (formatFilter === "solo" && isTeamFormat) return false;
                }
                if (disciplineFilter !== "all" && t.discipline !== disciplineFilter) {
                  return false;
                }
                if (onlyMyTournaments && !t.is_joined) {
                  return false;
                }
                return true;
              });

              if (filteredTournaments.length === 0) {
                return (
                  <div className="bg-[#0c0c0e] border border-white/5 rounded-[2rem] p-12 text-center text-gray-500">
                    Турниры по выбранным фильтрам не найдены.
                  </div>
                );
              }

              // Group by date
              const grouped: Record<string, any[]> = {};
              filteredTournaments.forEach((t) => {
                const dateKey = t.starts_at 
                  ? new Date(t.starts_at).toISOString().split('T')[0] 
                  : (t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : "no-date");
                if (!grouped[dateKey]) {
                  grouped[dateKey] = [];
                }
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
                const yesterday = new Date();
                yesterday.setDate(today.getDate() - 1);

                const isSameDay = (d1: Date, d2: Date) =>
                  d1.getFullYear() === d2.getFullYear() &&
                  d1.getMonth() === d2.getMonth() &&
                  d1.getDate() === d2.getDate();

                const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
                const formatted = date.toLocaleDateString('ru-RU', options);
                
                if (isSameDay(date, today)) {
                  return `Сегодня, ${formatted}`;
                } else if (isSameDay(date, tomorrow)) {
                  return `Завтра, ${formatted}`;
                } else if (isSameDay(date, yesterday)) {
                  return `Вчера, ${formatted}`;
                } else {
                  const yearOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
                  return date.toLocaleDateString('ru-RU', yearOptions);
                }
              };

              return (
                <div className="relative pl-0 md:pl-8 space-y-12">
                  {/* Timeline vertical line */}
                  <div className="absolute left-6 md:left-10 top-3 bottom-3 w-[2px] bg-gradient-to-b from-orange-500/40 via-purple-500/20 to-white/5 hidden md:block" />

                  {sortedDateKeys.map((dateKey) => {
                    const groupTournaments = grouped[dateKey];
                    return (
                      <div key={dateKey} className="relative space-y-4">
                        {/* Timeline Node & Date Header */}
                        <div className="flex items-center gap-3 md:-ml-12 relative z-10">
                          {/* Node circle */}
                          <div className="w-4 h-4 rounded-full bg-orange-500 ring-4 ring-orange-500/20 border-2 border-[#070708] hidden md:block" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-orange-500 bg-[#0c0c0e] py-1.5 px-4 rounded-full border border-orange-500/20 shadow-lg shadow-orange-500/5">
                            {formatDateGroup(dateKey)}
                          </h4>
                        </div>

                        {/* Grouped tournaments vertical stack */}
                        <div className="space-y-4 pl-0 md:pl-8">
                          {groupTournaments.map((t) => {
                            const maxParticipants = t.config?.maxParticipants ? parseInt(t.config.maxParticipants) : 16;
                            const slotsPercent = Math.min(100, Math.round(((t.competitors_count || 0) / maxParticipants) * 100));

                            const isTeam = t.type === "2vs2" || t.type === "5vs5";
                            const tSize = t.type === "2vs2" || t.type === "mix_2vs2" ? 2 : (t.type === "5vs5" || t.type === "mix_5vs5" ? 5 : 1);
                            const feeType = t.config?.entryFeeType || "player";
                            const mult = (isTeam && feeType === "player") ? tSize : 1;
                            const entryFee = parseFloat(t.entry_fee || 0);

                            const cashPrize = t.prize_pool_mode === "fixed"
                              ? parseFloat(t.fixed_prize_amount || 0)
                              : maxParticipants * entryFee * mult * (1 - (t.club_share_pct || 0) / 100);

                            const { totalBonusPool: activeBonusPool, placements: activePlacements } = parsePrizeDistribution(t.prize_distribution);

                            const itemPool = t.config?.itemPool || [];
                            const totalItemsValue = activePlacements.reduce((sum: number, p: any) => {
                              const matched = itemPool.find((item: any) => item.id === p.itemId);
                              if (matched) {
                                const count = getCountFromLabel(p.label);
                                const itemMultiplier = isTeam && p.itemScope === "team" ? 1 : (isTeam ? tSize : 1);
                                return sum + (matched.cost * count * itemMultiplier);
                              }
                              return sum;
                            }, 0);

                            const totalPrizeCombined = Math.round(cashPrize + activeBonusPool + totalItemsValue);

                            const disciplineColor = t.discipline === "cs2"
                              ? "hover:border-orange-500/30 shadow-orange-500/5 hover:shadow-orange-500/10"
                              : t.discipline === "fifa"
                              ? "hover:border-emerald-500/30 shadow-emerald-500/5 hover:shadow-emerald-500/10"
                              : "hover:border-red-500/30 shadow-red-500/5 hover:shadow-red-500/10";

                            const badgeGlow = t.discipline === "cs2"
                              ? "bg-orange-500"
                              : t.discipline === "fifa"
                              ? "bg-emerald-500"
                              : "bg-red-500";

                            const textGlow = t.discipline === "cs2"
                              ? "text-orange-500"
                              : t.discipline === "fifa"
                              ? "text-emerald-500"
                              : "text-red-500";

                            return (
                              <motion.div
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                key={t.id}
                                onClick={() => fetchTournamentDetails(t.id)}
                                className={cn(
                                  "bg-[#0c0c0e]/95 border border-white/5 rounded-[2rem] p-5 cursor-pointer hover:bg-white/5 transition-all group shadow-xl flex flex-col md:flex-row gap-5 items-stretch md:items-center justify-between",
                                  disciplineColor
                                )}
                              >
                                {/* Left Section: Game Icon & Tournament Info */}
                                <div className="flex items-center gap-4 flex-1 md:flex-1 md:basis-0 min-w-0">
                                  {/* Game Icon */}
                                  {renderGameEmblem(t.discipline, t.status === "ACTIVE")}

                                  {/* Info */}
                                  <div className="min-w-0 flex-1">
                                    <h3 className="text-base font-black uppercase italic tracking-tight truncate group-hover:text-orange-500 transition-colors mb-1.5">
                                      {t.name}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold uppercase tracking-wider mt-1.5">
                                      <span className="text-gray-300 font-black">
                                        {formatTypeLabel(t.type)}
                                      </span>
                                      {t.starts_at && (
                                        <>
                                          <span className="text-gray-700 font-normal">|</span>
                                          <span className="text-orange-500 font-black flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5 text-orange-500 stroke-[2.5]" />
                                            СТАРТ: {new Date(t.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Middle Section: Slots Occupancy (Centered) */}
                                <div className="flex flex-col gap-1.5 w-full md:flex-1 md:basis-0 md:items-center justify-center shrink-0">
                                  <div className="flex flex-col gap-1.5 w-full md:w-48 justify-center">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-gray-400">
                                      <span>Слоты</span>
                                      <span className="text-white font-black">{t.competitors_count || 0} / {maxParticipants}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                      <div
                                        className={cn("h-full rounded-full transition-all duration-500", badgeGlow)}
                                        style={{ width: `${slotsPercent}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Right Section: Money Details & Status Badges */}
                                <div className="flex items-center justify-between md:justify-end gap-6 md:flex-1 md:basis-0 shrink-0">
                                  {/* Prize and Entry Fee */}
                                  <div className="flex gap-6">
                                    <div>
                                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">
                                        Фонд
                                      </span>
                                      <span className="text-base font-black text-yellow-500 italic block leading-none">
                                        {formatCurrency(totalPrizeCombined)}
                                      </span>
                                    </div>
                                    <div className="w-px h-8 bg-white/10 self-center" />
                                    <div>
                                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">
                                        Взнос
                                      </span>
                                      <span className="text-sm font-black text-white block leading-none">
                                        {t.entry_fee > 0 ? formatCurrency(t.entry_fee) : "Бесплатно"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Badges / CTA */}
                                  <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                      <span
                                        className={cn(
                                          "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border block text-center",
                                          t.status === "ACTIVE"
                                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                                            : (t.status === "REGISTRATION" || t.status === "DRAFT")
                                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                            : "bg-white/5 text-gray-400 border-white/10"
                                        )}
                                      >
                                        {t.status === "ACTIVE" ? "LIVE" : (t.status === "REGISTRATION" || t.status === "DRAFT") ? "Регистрация" : "Завершен"}
                                      </span>

                                      {t.is_joined && (
                                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 block text-center animate-pulse">
                                          Участвую
                                        </span>
                                      )}
                                    </div>

                                    {/* Action chevron */}
                                    <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-0.5 transition-all hidden md:block" />
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
              );
            })()}
          </div>
        )}

        {/* FEED DETAIL VIEW */}
        {activeTab === "feed" && activeTournament && (
          <div className="mt-8 space-y-6 animate-fadeIn">
            {/* Back Link */}
            <button
              onClick={() => setActiveTournament(null)}
              className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              К списку турниров
            </button>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#0c0c0e]/95 border border-white/5 rounded-[2.5rem] p-8 space-y-8 shadow-2xl"
            >
              {/* Header info */}
              <div className="flex items-center gap-5">
                {renderGameEmblem(activeTournament.discipline, activeTournament.status === "ACTIVE")}
                <div>
                  <h2 className="text-3xl font-black uppercase italic tracking-tight text-white leading-none">
                    {activeTournament.name}
                  </h2>
                  <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider mt-2.5 text-gray-400">
                    <span className="text-gray-300 font-black">
                      {formatTypeLabel(activeTournament.type)}
                    </span>
                    {activeTournament.starts_at && (
                      <>
                        <span className="text-gray-700 font-normal">|</span>
                        <span className="text-orange-500 font-black flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-orange-500 stroke-[2.5]" />
                          СТАРТ: {new Date(activeTournament.starts_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).toUpperCase()}, {new Date(activeTournament.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Prize Info and Fee Dashboard (Grid of Cards) */}
              {(() => {
                const { totalBonusPool: activeBonusPool, placements: activePlacements } = parsePrizeDistribution(activeTournament.prize_distribution);
                const isTeamFormat = activeTournament.type === "2vs2" || activeTournament.type === "5vs5";
                const teamSize = activeTournament.type === "2vs2" || activeTournament.type === "mix_2vs2" ? 2 : (activeTournament.type === "5vs5" || activeTournament.type === "mix_5vs5" ? 5 : 1);
                
                const itemPool = activeTournament.config?.itemPool || [];
                const totalItemsValue = activePlacements.reduce((sum: number, p: any) => {
                  const matched = itemPool.find((item: any) => item.id === p.itemId);
                  if (matched) {
                    const count = getCountFromLabel(p.label);
                    const isTeam = activeTournament.type === "2vs2" || activeTournament.type === "5vs5";
                    const tSize = activeTournament.type === "2vs2" || activeTournament.type === "mix_2vs2" ? 2 : (activeTournament.type === "5vs5" || activeTournament.type === "mix_5vs5" ? 5 : 1);
                    const itemMultiplier = isTeam && p.itemScope === "team" ? 1 : (isTeam ? tSize : 1);
                    return sum + (matched.cost * count * itemMultiplier);
                  }
                  return sum;
                }, 0);

                const cashPrize = activeTournament.prize_pool_mode === "fixed"
                  ? parseFloat(activeTournament.fixed_prize_amount)
                  : calcDynamicPrizePool(activeTournament, competitors.filter(c => c.payment_status === "PAID").length);
                const cashPrizePlanned = activeTournament.prize_pool_mode === "fixed"
                  ? parseFloat(activeTournament.fixed_prize_amount)
                  : calcDynamicPrizePool(activeTournament, activeTournament.config?.maxParticipants || 16);
                
                const totalCombinedPrize = cashPrize + activeBonusPool + totalItemsValue;
                const totalCombinedPrizePlanned = cashPrizePlanned + activeBonusPool + totalItemsValue;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Card 1: Prize Pool */}
                    <div className="bg-white/5 border border-white/5 p-5 rounded-3xl flex items-center gap-4 shadow-inner">
                      <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center shrink-0 border border-yellow-500/10">
                        <Trophy className="w-6 h-6 text-yellow-500" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">
                          Призовой фонд
                        </span>
                        
                        {/* Combined Total Headline */}
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-lg font-black text-yellow-500 italic leading-none">
                            {formatCurrency(activeTournament.prize_pool_mode === "dynamic" ? totalCombinedPrizePlanned : totalCombinedPrize)}
                          </span>
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">общий фонд</span>
                        </div>
                        
                        {activeTournament.prize_pool_mode === "dynamic" && (
                          <span className="text-[8px] text-gray-500 font-bold block uppercase tracking-wider mt-0.5">
                            *динамический (зависит от участников, текущий: {formatCurrency(totalCombinedPrize)})
                          </span>
                        )}

                        {/* Breakdown */}
                        <div className="pt-2 border-t border-white/5 space-y-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                          <div className="flex justify-between items-center">
                            <span>Наличные:</span>
                            <span className="text-emerald-400 font-black">
                              {formatCurrency(activeTournament.prize_pool_mode === "dynamic" ? cashPrizePlanned : cashPrize)}
                              {activeTournament.prize_pool_mode === "dynamic" && (
                                <span className="text-[8px] text-gray-500 font-bold ml-1.5 normal-case">
                                  (текущий: {formatCurrency(cashPrize)})
                                </span>
                              )}
                            </span>
                          </div>
                          {activeBonusPool > 0 && (
                            <div className="flex justify-between items-center">
                              <span>Бонусы:</span>
                              <span className="text-blue-400 font-black">{activeBonusPool} Б</span>
                            </div>
                          )}
                          {totalItemsValue > 0 && (
                            <div className="flex justify-between items-center">
                              <span>Предметы:</span>
                              <span className="text-amber-400 font-black">{formatCurrency(totalItemsValue)}</span>
                            </div>
                          )}
                          {activeTournament.prize_pool_mode === "dynamic" && (
                            <div className="flex justify-between items-center text-gray-500 pt-1 border-t border-white/5 text-[9px] font-semibold">
                              <span>Организационный сбор:</span>
                              <span>{activeTournament.club_share_pct || 0}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Entry Fee */}
                    <div className="bg-white/5 border border-white/5 p-5 rounded-3xl flex items-center gap-4 shadow-inner">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/10">
                        <Coins className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">
                          Взнос за участие
                        </span>
                        
                        {activeTournament.entry_fee > 0 ? (
                          <div className="space-y-0.5">
                            <span className="text-md font-black text-white block leading-tight">
                              {isTeamFormat ? (
                                activeTournament.config?.entryFeeType === "team" ? (
                                  `${formatCurrency(activeTournament.entry_fee)} с команды`
                                ) : (
                                  `${formatCurrency(activeTournament.entry_fee)} с игрока`
                                )
                              ) : (
                                `${formatCurrency(activeTournament.entry_fee)} с игрока`
                              )}
                            </span>
                            {isTeamFormat && activeTournament.config?.entryFeeType === "player" && (
                              <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">
                                ({formatCurrency(parseFloat(activeTournament.entry_fee) * teamSize)} с команды)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-lg font-black text-emerald-400 block leading-tight">
                            Бесплатно
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card 3: Competitors */}
                    <div className="bg-white/5 border border-white/5 p-5 rounded-3xl flex items-center gap-4 shadow-inner">
                      <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/10">
                        <Users className="w-6 h-6 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">
                          Участники
                        </span>
                        <span className="text-lg font-black text-orange-500 block leading-tight">
                          {competitors.length} {activeTournament.config?.maxParticipants ? `/ ${activeTournament.config.maxParticipants}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Prize Distribution Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-500">
                  <Trophy className="w-4 h-4" />
                  Призовые места
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(() => {
                    const { totalBonusPool: activeBonusPool, placements: activePlacements } = parsePrizeDistribution(activeTournament.prize_distribution);
                    
                    if (activePlacements.length === 0) {
                      return (
                        <p className="text-gray-400 text-xs py-2 col-span-full">
                          Призовые места не настроены.
                        </p>
                      );
                    }

                    const entryFee = parseFloat(activeTournament.entry_fee || 0);
                    const paidCount = competitors.filter(x => x.payment_status === "PAID").length;
                    const maxSlots = activeTournament.config?.maxParticipants || 16;
                    
                    const isTeam = activeTournament.type === "2vs2" || activeTournament.type === "5vs5";
                    const tSize = activeTournament.type === "2vs2" || activeTournament.type === "mix_2vs2" ? 2 : (activeTournament.type === "5vs5" || activeTournament.type === "mix_5vs5" ? 5 : 1);
                    const feeType = activeTournament.config?.entryFeeType || "player";
                    const mult = (isTeam && feeType === "player") ? tSize : 1;
                    const feePerComp = entryFee * mult;

                    const actualPool = activeTournament.prize_pool_mode === "fixed"
                      ? parseFloat(activeTournament.fixed_prize_amount || 0)
                      : (paidCount * feePerComp) * (1 - (activeTournament.club_share_pct || 0) / 100);

                    const plannedPool = activeTournament.prize_pool_mode === "fixed"
                      ? parseFloat(activeTournament.fixed_prize_amount || 0)
                      : (maxSlots * feePerComp) * (1 - (activeTournament.club_share_pct || 0) / 100);

                    return activePlacements.map((p: any, idx: number) => {
                      const count = getCountFromLabel(p.label);
                      const isRange = count > 1;
                      
                      const cashPctFraction = p.cashPct > 1 ? p.cashPct / 100 : p.cashPct;
                      const actualCash = Math.round(actualPool * cashPctFraction);
                      const plannedCash = Math.round(plannedPool * cashPctFraction);

                      if (actualCash === 0 && plannedCash === 0 && p.bonus === 0 && !p.item) return null;

                      let emoji = "🎗️";
                      let ringColor = "border-white/5";
                      let glowColor = "shadow-[0_0_15px_rgba(255,255,255,0.01)]";
                      if (p.label.includes("1")) {
                        emoji = "🏆";
                        ringColor = "border-yellow-500/20";
                        glowColor = "shadow-[0_0_15px_rgba(234,179,8,0.03)]";
                      } else if (p.label.includes("2")) {
                        emoji = "🥈";
                        ringColor = "border-slate-300/20";
                        glowColor = "shadow-[0_0_15px_rgba(203,213,225,0.03)]";
                      } else if (p.label.includes("3")) {
                        emoji = "🥉";
                        ringColor = "border-amber-700/20";
                        glowColor = "shadow-[0_0_15px_rgba(180,83,9,0.03)]";
                      }

                      return (
                        <div key={p.id || idx} className={cn("bg-white/5 border p-5 rounded-3xl space-y-3 shadow-lg transition-colors", ringColor, glowColor)}>
                          <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-wider border-b border-white/5 pb-2">
                            <span className="text-lg">{emoji}</span>
                            <span>{p.label}</span>
                            {isRange && <span className="text-[9px] text-gray-500 font-normal lowercase">(по {count} чел)</span>}
                          </div>
                          <div className="text-[11px] space-y-1.5 text-gray-400 font-bold uppercase tracking-wide">
                            {(actualCash > 0 || plannedCash > 0) && (
                              <div className="text-emerald-400 font-black flex flex-col">
                                <span>
                                  Нал: {isRange && "по "}{formatCurrency(activeTournament.prize_pool_mode === "dynamic" ? plannedCash : actualCash)}
                                </span> 
                                {activeTournament.prize_pool_mode === "dynamic" && (
                                  <span className="text-[8px] text-gray-500 font-bold mt-0.5 tracking-wider lowercase">
                                    *текущий: {formatCurrency(actualCash)} (зависит от участников)
                                  </span>
                                )}
                              </div>
                            )}
                            {p.bonus > 0 && (
                              <div className="text-blue-400 font-black">
                                Бонусы: {isRange && "по "}{formatCurrency(p.bonus)}
                              </div>
                            )}
                            {p.item && (() => {
                              const matchedItem = activeTournament.config?.itemPool?.find((i: any) => i.id === p.itemId);
                              const isTeam = activeTournament.type === "2vs2" || activeTournament.type === "5vs5";
                              const scopeString = isTeam 
                                ? (p.itemScope === "team" ? "на команду, " : "каждому игроку, ") 
                                : "";
                              const costValue = matchedItem ? matchedItem.cost : 0;
                              return (
                                <div className="text-amber-400 font-black">
                                  Предмет: {isRange && "по "}{p.item} <span className="text-[9px] text-gray-400 font-normal">({scopeString}ценность {costValue} ₽)</span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Rules Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-500">
                  <BookOpen className="w-4 h-4" />
                  Правила турнира
                </div>
                <div className="text-sm text-gray-300 bg-black/40 p-6 rounded-3xl border border-white/5 max-h-60 overflow-y-auto leading-relaxed font-medium">
                  {activeTournament.rules || "Правила не указаны."}
                </div>
              </div>

              {/* Registration Widget */}
              {(activeTournament.status === "REGISTRATION" || activeTournament.status === "DRAFT") && (
                <div className="pt-4 border-t border-white/5 space-y-4">
                  {(() => {
                    const myCompetitorEntry = competitors.find(c => {
                      if (c.player_id === player?.id) return true;
                      if (c.team_members?.some((m: any) => m.id === player?.id)) return true;
                      return false;
                    });

                    if (myCompetitorEntry) {
                      return (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                              <Check className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black uppercase text-emerald-400">Вы зарегистрированы</h4>
                              <p className="text-[11px] text-gray-400 mt-0.5 font-bold">
                                {myCompetitorEntry.type === "TEAM" 
                                  ? `В составе команды "${myCompetitorEntry.display_name}"`
                                  : "В качестве Свободного Агента"}
                              </p>
                            </div>
                          </div>
                          
                          <div className="bg-black/20 p-4 rounded-2xl flex flex-col gap-2.5 text-xs border border-white/5">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Статус участия:</span>
                              {(() => {
                                if (myCompetitorEntry.payment_status === "RESERVE") {
                                  const reserveIndex = competitors
                                    .filter(c => c.payment_status === "RESERVE")
                                    .findIndex(c => c.id === myCompetitorEntry.id) + 1;
                                  return (
                                    <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-black uppercase tracking-wider text-[10px]">
                                      В резерве #{reserveIndex}
                                    </span>
                                  );
                                } else if (myCompetitorEntry.payment_status === "PAID") {
                                  return (
                                    <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-black uppercase tracking-wider text-[10px]">
                                      В сетке (Оплачено)
                                    </span>
                                  );
                                } else if (myCompetitorEntry.type === "TEAM" && Array.isArray(myCompetitorEntry.meta?.paidPlayerIds) && myCompetitorEntry.meta.paidPlayerIds.length > 0) {
                                  const paidCount = myCompetitorEntry.meta.paidPlayerIds.length;
                                  const totalCount = myCompetitorEntry.team_members?.length || 0;
                                  return (
                                    <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-black uppercase tracking-wider text-[10px]">
                                      Оплачено {paidCount} из {totalCount}
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-black uppercase tracking-wider text-[10px]">
                                      Ожидает оплаты ({formatCurrency(activeTournament.entry_fee)})
                                    </span>
                                  );
                                }
                              })()}
                            </div>
                            {myCompetitorEntry.type === "TEAM" && (
                              <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[10px] font-bold">
                                <span className="text-gray-400 uppercase tracking-wider">Ваш личный статус:</span>
                                {Array.isArray(myCompetitorEntry.meta?.paidPlayerIds) && myCompetitorEntry.meta.paidPlayerIds.includes(player?.id) ? (
                                  <span className="text-emerald-400 font-bold uppercase">Взнос оплачен</span>
                                ) : (
                                  <span className="text-orange-400 font-bold uppercase">Взнос не оплачен</span>
                                )}
                              </div>
                            )}
                          </div>
                          {myCompetitorEntry.payment_status === "PENDING_PAYMENT" && (
                            <p className="text-[10px] text-gray-400 leading-normal italic text-center font-medium">
                              *Пожалуйста, оплатите взнос на ресепшене клуба Colizeum для подтверждения участия.
                            </p>
                          )}
                        </div>
                      );
                    }

                    const isTeamTourney = activeTournament.type === "team" || activeTournament.type === "2vs2" || activeTournament.type === "5vs5";
                    
                    const activeCompetitors = competitors.filter((c: any) => c.payment_status !== "RESERVE");
                    const competitorsCount = activeCompetitors.length;
                    const maxParticipants = activeTournament.config?.maxParticipants ? parseInt(activeTournament.config.maxParticipants) : null;
                    const isFull = maxParticipants ? competitorsCount >= maxParticipants : false;

                    if (isTeamTourney) {
                      const myCaptainedTeams = teams.filter(t => t.captainId === player?.id);
                      const selectedRegTeam = myCaptainedTeams.find(t => t.id === selectedRegTeamId) || myCaptainedTeams[0] || null;
                      
                      const requiredSize = activeTournament.type === "2vs2" ? 2 : 5;
                      const eligibleTeams = myCaptainedTeams.filter(t => t.members?.length === requiredSize);
                      const hasEligibleTeam = eligibleTeams.length > 0;

                      return (
                        <div className="space-y-4">
                          {teams.length > 0 ? (
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                                Выбор формата регистрации
                              </span>
                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  type="button"
                                  onClick={() => setRegMode("team")}
                                  disabled={myCaptainedTeams.length === 0}
                                  className={cn(
                                    "py-3 px-4 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-center relative overflow-hidden",
                                    regMode === "team" && myCaptainedTeams.length > 0
                                      ? "bg-orange-500 text-white border-orange-500 shadow-md"
                                      : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 disabled:opacity-50"
                                  )}
                                  title={myCaptainedTeams.length === 0 ? "Вы должны быть капитаном команды для регистрации" : ""}
                                >
                                  Командой
                                  {hasEligibleTeam && (
                                    <span className="absolute top-1 right-1 flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRegMode("solo")}
                                  className={cn(
                                    "py-3 px-4 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-center relative overflow-hidden",
                                    regMode === "solo" || myCaptainedTeams.length === 0
                                      ? "bg-orange-500 text-white border-orange-500 shadow-md"
                                      : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10"
                                  )}
                                >
                                  Соло (Свободный Агент)
                                  {!hasEligibleTeam && (
                                    <span className="absolute top-1 right-1 flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                  )}
                                </button>
                              </div>

                              <p className="text-[10px] text-gray-400 leading-normal mt-1 flex items-center gap-1.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                                <span className="text-emerald-400 font-bold uppercase shrink-0">Рекомендуется:</span>
                                {hasEligibleTeam ? (
                                  <span>
                                    Регистрация готовой командой (у вас есть подходящая команда {eligibleTeams[0].name} из {requiredSize} игроков).
                                  </span>
                                ) : (
                                  <span>
                                    Свободный Агент (Соло), так как у вас нет готовой капитанской команды из {requiredSize} игроков. Вы сможете найти тиммейтов позже.
                                  </span>
                                )}
                              </p>

                              {regMode === "team" && myCaptainedTeams.length > 0 && (
                                <div className="space-y-3 pt-1">
                                  <div className="flex items-center gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                                      {selectedRegTeam?.logoUrl ? (
                                        <img src={selectedRegTeam.logoUrl} alt={selectedRegTeam.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-sm font-black text-gray-500">
                                          {selectedRegTeam?.name.substring(0, 1).toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-xs font-bold block">{selectedRegTeam?.name}</span>
                                      <span className="text-[10px] text-gray-500 font-bold uppercase">Состав: {selectedRegTeam?.members?.length || 0}/5</span>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-black uppercase text-gray-500 block">Выберите команду</label>
                                    <select
                                      value={selectedRegTeamId || myCaptainedTeams[0]?.id || ""}
                                      onChange={(e) => setSelectedRegTeamId(e.target.value)}
                                      className="w-full bg-[#0c0c0e] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                                    >
                                      {myCaptainedTeams.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-orange-500/10 p-4 rounded-2xl border border-orange-500/20 space-y-2">
                              <p className="text-xs text-orange-400 font-bold uppercase tracking-widest">
                                Командный формат
                              </p>
                              <p className="text-xs text-gray-400 leading-relaxed">
                                Вы не состоите в команде. Вы можете зарегистрироваться в качестве <strong>Свободного Агента (Соло)</strong>, и администрация клуба поможет вам найти команду. Или сначала создайте свою команду во вкладке «Моя Команда».
                              </p>
                            </div>
                          )}

                          {isFull && (
                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-xs space-y-1 text-amber-400">
                              <span className="font-black uppercase tracking-wider block">⚠️ Все места заняты:</span>
                              <span>
                                Регистрация продолжается в <strong>резервный список (очередь ожидания)</strong>. В случае, если кто-то из основных участников откажется или не оплатит взнос, вы будете претендовать на участие по приоритету очереди.
                              </span>
                            </div>
                          )}

                          {activeTournament.entry_fee > 0 && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-xs space-y-1 text-emerald-400">
                              <span className="font-black uppercase tracking-wider block">Стоимость участия:</span>
                              {(() => {
                                const fee = parseFloat(activeTournament.entry_fee);
                                const isTeam = activeTournament.type === "2vs2" || activeTournament.type === "5vs5";
                                const tSize = activeTournament.type === "2vs2" ? 2 : (activeTournament.type === "5vs5" ? 5 : 1);
                                const feeType = activeTournament.config?.entryFeeType || "player";
                                
                                if (regMode === "team") {
                                  if (feeType === "player") {
                                    return (
                                      <span>
                                        Взнос за команду составляет <strong className="text-white">{formatCurrency(fee * tSize)}</strong> (по {formatCurrency(fee)} с каждого из {tSize} игроков).
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span>
                                        Взнос за команду составляет <strong className="text-white">{formatCurrency(fee)}</strong> за всю команду.
                                      </span>
                                    );
                                  }
                                } else {
                                  // Solo / free agent
                                  return (
                                    <span>
                                      Индивидуальный взнос составляет <strong className="text-white">{formatCurrency(fee)}</strong>.
                                    </span>
                                  );
                                }
                              })()}
                            </div>
                          )}

                          <label className="flex items-start gap-3 cursor-pointer group mt-2">
                            <input
                              type="checkbox"
                              checked={consentChecked}
                              onChange={(e) => setConsentChecked(e.target.checked)}
                              className="mt-1 accent-orange-500 w-4 h-4"
                            />
                            <span className="text-xs text-gray-400 group-hover:text-white transition-colors">
                              Я согласен с правилами турнира и готов внести взнос (если применимо) перед началом игр.
                            </span>
                          </label>

                          <button
                            disabled={!consentChecked || registering || (regMode === "team" && !selectedRegTeam)}
                            onClick={() => handleRegister(activeTournament.id, selectedRegTeam ? regMode : "solo")}
                            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:grayscale text-white py-5 rounded-3xl font-black uppercase italic text-lg shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            {registering ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : isFull ? (
                              `Записаться в резерв (${(!selectedRegTeam || regMode === "solo") ? "Соло" : "Всей командой"})`
                            ) : (
                              `Подтвердить участие (${(!selectedRegTeam || regMode === "solo") ? "Соло / Свободный агент" : "Всей командой"})`
                            )}
                          </button>
                        </div>
                      );
                    } else {
                      // Solo tournament
                      return (
                        <div className="space-y-4">
                          {isFull && (
                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-xs space-y-1 text-amber-400">
                              <span className="font-black uppercase tracking-wider block">⚠️ Все места заняты:</span>
                              <span>
                                Регистрация продолжается в <strong>резервный список (очередь ожидания)</strong>. В случае, если кто-то из основных участников откажется или не оплатит взнос, вы будете претендовать на участие по приоритету очереди.
                              </span>
                            </div>
                          )}

                          {activeTournament.entry_fee > 0 && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-xs space-y-1 text-emerald-400">
                              <span className="font-black uppercase tracking-wider block">Стоимость участия:</span>
                              <span>
                                Взнос за участие составляет <strong className="text-white">{formatCurrency(activeTournament.entry_fee)}</strong> с игрока.
                              </span>
                            </div>
                          )}

                          <label className="flex items-start gap-3 cursor-pointer group mt-2">
                            <input
                              type="checkbox"
                              checked={consentChecked}
                              onChange={(e) => setConsentChecked(e.target.checked)}
                              className="mt-1 accent-orange-500 w-4 h-4"
                            />
                            <span className="text-xs text-gray-400 group-hover:text-white transition-colors">
                              Я согласен с правилами турнира и готов внести взнос (если применимо) перед началом игр.
                            </span>
                          </label>

                          <button
                            disabled={!consentChecked || registering}
                            onClick={() => handleRegister(activeTournament.id, "solo")}
                            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:grayscale text-white py-5 rounded-3xl font-black uppercase italic text-lg shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                          >
                            {registering ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : isFull ? (
                              "Записаться в резерв (Соло)"
                            ) : (
                              "Подтвердить участие (Соло)"
                            )}
                          </button>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
            </motion.div>

            {/* Bracket / Match list visualizer */}
            {activeTournament.status === "ACTIVE" && (
              <div className="space-y-8">
                <h3 className="text-xl font-black uppercase italic tracking-tight px-1">
                  Сетка матчей / Результаты
                </h3>
                
                {/* 1. Group Stage */}
                {(() => {
                  const groupStageMatches = matches.filter(m => m.round === 0);
                  const groupsMap: Record<string, any[]> = {};
                  groupStageMatches.forEach(m => {
                    const groupLabel = m.result?.group || "A";
                    if (!groupsMap[groupLabel]) groupsMap[groupLabel] = [];
                    groupsMap[groupLabel].push(m);
                  });

                  if (Object.keys(groupsMap).length === 0) return null;

                  return (
                    <div className="space-y-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block px-1">
                        Групповой этап
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.keys(groupsMap).sort().map((groupLabel) => {
                          const groupMatches = groupsMap[groupLabel];
                          return (
                            <div key={groupLabel} className="bg-white/5 border border-white/5 p-6 rounded-[2rem] space-y-4">
                              <div className="font-black uppercase text-xs text-orange-500 tracking-wider">
                                Группа {groupLabel}
                              </div>
                              <div className="space-y-3">
                                {groupMatches.map((m) => {
                                  const compA = competitors.find(c => c.id === m.competitor_a_id);
                                  const compB = competitors.find(c => c.id === m.competitor_b_id);
                                  const statusLower = m.status?.toLowerCase();
                                  const showLobbyBtn = statusLower === "scheduled" || statusLower === "veto" || statusLower === "live";

                                  return (
                                    <div key={m.id} className="flex justify-between items-center gap-3 bg-black/30 p-3 rounded-2xl text-xs">
                                      <div className="flex-1 grid grid-cols-2 gap-2 font-bold">
                                        <div className="flex justify-between items-center bg-black/20 p-2 rounded-xl">
                                          <span className="truncate pr-1">{compA?.display_name || "Ожидает..."}</span>
                                          <span className="font-black text-orange-500">{m.score1}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-black/20 p-2 rounded-xl">
                                          <span className="truncate pr-1">{compB?.display_name || "Ожидает..."}</span>
                                          <span className="font-black text-orange-500">{m.score2}</span>
                                        </div>
                                      </div>
                                      {showLobbyBtn && (
                                        <Link
                                          href={`/promo/tournaments/lobby/${m.id}?clubId=${clubId}`}
                                          className="bg-orange-500 hover:bg-orange-600 px-3.5 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest text-white transition-colors"
                                        >
                                          Лобби
                                        </Link>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Playoff Bracket (Horizontal scrollable columns) */}
                {(() => {
                  const playoffMatches = matches.filter(m => m.round >= 1);
                  const roundsMap: Record<number, any[]> = {};
                  playoffMatches.forEach(m => {
                    if (!roundsMap[m.round]) roundsMap[m.round] = [];
                    roundsMap[m.round].push(m);
                  });
                  const sortedRounds = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

                  if (sortedRounds.length === 0) return null;

                  return (
                    <div className="space-y-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block px-1">
                        Сетка плей-офф
                      </span>
                      <div className="overflow-x-auto py-6 flex gap-8 select-none custom-scrollbar">
                        {sortedRounds.map((roundNum) => {
                          const roundMatches = roundsMap[roundNum];
                          const maxR = Math.max(...sortedRounds);
                          let roundTitle = `Раунд ${roundNum}`;
                          if (roundNum === maxR) roundTitle = "Финал";
                          else if (roundNum === maxR - 1) roundTitle = "Полуфинал";
                          else if (roundNum === maxR - 2) roundTitle = "1/4 финала";
                          else if (roundNum === maxR - 3) roundTitle = "1/8 финала";

                          return (
                            <div key={roundNum} className="flex flex-col gap-6 min-w-[280px] w-[300px] shrink-0">
                              <div className="text-center font-black uppercase text-[10px] tracking-wider text-orange-500 bg-white/5 border border-white/5 py-2.5 rounded-xl">
                                {roundTitle}
                              </div>
                              <div className="flex flex-col justify-around flex-grow gap-6">
                                {roundMatches.map((m) => {
                                  const compA = competitors.find(c => c.id === m.competitor_a_id);
                                  const compB = competitors.find(c => c.id === m.competitor_b_id);
                                  const statusLower = m.status?.toLowerCase();
                                  const showLobbyBtn = statusLower === "scheduled" || statusLower === "veto" || statusLower === "live";

                                  return (
                                    <div
                                      key={m.id}
                                      className={cn(
                                        "bg-[#0c0c0e] border p-4.5 rounded-[2rem] space-y-3.5 shadow-lg relative transition-all",
                                        statusLower === "finished" 
                                          ? "border-white/5 opacity-70" 
                                          : (statusLower === "live" ? "border-red-500/30 shadow-red-500/5 animate-pulse" : "border-white/10 hover:border-orange-500/20")
                                      )}
                                    >
                                      <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-gray-500">
                                        <span>Матч #{m.id}</span>
                                        <span className={cn(
                                          statusLower === "finished" ? "text-gray-400" : (statusLower === "live" ? "text-red-500" : "text-blue-400")
                                        )}>
                                          {statusLower === "scheduled" ? "ожидание" : (statusLower === "live" ? "в игре" : statusLower)}
                                        </span>
                                      </div>

                                      <div className="space-y-2">
                                        <div className={cn(
                                          "flex justify-between items-center p-2.5 rounded-xl text-xs font-bold transition-colors",
                                          m.winner_competitor_id === m.competitor_a_id ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-black/20 text-gray-300"
                                        )}>
                                          <span className="truncate flex-1 pr-2">
                                            {compA?.display_name || "Ожидает пару..."}
                                          </span>
                                          <span className="font-black text-sm">{m.score1}</span>
                                        </div>

                                        <div className={cn(
                                          "flex justify-between items-center p-2.5 rounded-xl text-xs font-bold transition-colors",
                                          m.winner_competitor_id === m.competitor_b_id ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-black/20 text-gray-300"
                                        )}>
                                          <span className="truncate flex-1 pr-2">
                                            {compB?.display_name || "Ожидает пару..."}
                                          </span>
                                          <span className="font-black text-sm">{m.score2}</span>
                                        </div>
                                      </div>

                                      {showLobbyBtn && (
                                        <Link
                                          href={`/promo/tournaments/lobby/${m.id}?clubId=${clubId}`}
                                          className="block w-full bg-orange-500 hover:bg-orange-600 py-3 rounded-2xl text-center font-black text-[10px] uppercase tracking-widest text-white transition-colors"
                                        >
                                          В лобби матча
                                        </Link>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Competitors Section (Moved below details) */}
            <div className="bg-[#0c0c0e]/95 border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
              <div className="flex items-center gap-2.5 text-md font-black uppercase italic tracking-tight text-white border-b border-white/5 pb-3">
                <Users className="w-5 h-5 text-orange-500" />
                <h4>Список участников</h4>
              </div>
              <div className="space-y-6">
                {/* Main List */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block px-1">
                    Основной состав ({competitors.filter(c => c.payment_status !== "RESERVE").length} / {activeTournament.config?.maxParticipants || "∞"})
                  </span>
                  {competitors.filter(c => c.payment_status !== "RESERVE").length === 0 ? (
                    <p className="text-gray-500 text-xs text-center py-6 border border-dashed border-white/5 rounded-2xl">
                      Основной состав пока пуст
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {competitors.filter(c => c.payment_status !== "RESERVE").map((c) => (
                        <div
                          key={c.id}
                          className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 text-[10px] font-black shrink-0">
                              {c.display_name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-xs text-gray-200 truncate">{c.display_name}</span>
                          </div>
                          <span
                            className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                              c.payment_status === "PAID"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : c.type === "TEAM" && Array.isArray(c.meta?.paidPlayerIds) && c.meta.paidPlayerIds.length > 0
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                            )}
                          >
                            {(() => {
                              if (c.payment_status === "PAID") {
                                return "Оплачено";
                              }
                              if (c.type === "TEAM" && Array.isArray(c.meta?.paidPlayerIds) && c.meta.paidPlayerIds.length > 0) {
                                return `Оплачено ${c.meta.paidPlayerIds.length}/${c.team_members?.length || 0}`;
                              }
                              return "Не оплачен";
                            })()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reserve List */}
                {competitors.filter(c => c.payment_status === "RESERVE").length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 block px-1">
                      Очередь ожидания (Резерв) ({competitors.filter(c => c.payment_status === "RESERVE").length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {competitors.filter(c => c.payment_status === "RESERVE").map((c, index) => (
                        <div
                          key={c.id}
                          className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-amber-500/10 hover:border-amber-500/20 transition-colors relative overflow-hidden"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-[10px] font-black shrink-0">
                              #{index + 1}
                            </div>
                            <span className="font-bold text-xs text-gray-200 truncate">{c.display_name}</span>
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-amber-500/10 text-amber-400 border-amber-500/20">
                            Резерв
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div className="mt-8 max-w-xl mx-auto">
            {/* Solo Player stats */}
            <div className="bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
              <h3 className="text-2xl font-black uppercase italic tracking-tight">
                Моя статистика ELO
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                  <span className="text-xs font-bold text-gray-400">CS2 ELO</span>
                  <span className="text-base font-black text-orange-500 italic">
                    {player?.elo_cs2 || 1000} ELO
                  </span>
                </div>
                {/* SteamID entry */}
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">
                    Привязанный SteamID64
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled
                      value={player?.steam_id || "Не привязан (Обратитесь к администратору)"}
                      className="flex-1 bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-xs font-bold text-gray-400 focus:outline-none"
                    />
                  </div>
                  <span className="text-[9px] text-gray-500 font-bold block leading-relaxed mt-1">
                    SteamID необходим для автоматической авторизации и whitelisting на игровых серверах CS2 в лобби.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TEAM TAB */}
        {activeTab === "team" && (
          <div className="mt-8 space-y-6">
            {/* Teams Selector Tab Bar */}
            {teams.length > 0 && (
              <div className="flex justify-between items-center bg-[#0c0c0e]/60 p-4 rounded-[2rem] border border-white/5 flex-wrap gap-4">
                <div className="flex gap-2 items-center overflow-x-auto py-1 max-w-full custom-scrollbar">
                  {teams.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTeamId(t.id);
                        setShowCreateJoin(false);
                      }}
                      className={cn(
                        "px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all border shrink-0 flex items-center gap-2",
                        activeTeamId === t.id && !showCreateJoin
                          ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                          : "bg-white/5 text-gray-400 border-transparent hover:bg-white/10"
                      )}
                    >
                      {t.logoUrl ? (
                        <img src={t.logoUrl} alt={t.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-gray-400 shrink-0">
                          {t.name.substring(0, 1).toUpperCase()}
                        </span>
                      )}
                      {t.name}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setShowCreateJoin(prev => !prev)}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 border shrink-0",
                    showCreateJoin
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border-orange-500/20"
                  )}
                >
                  {showCreateJoin ? "К списку команд" : "+ Создать / Вступить"}
                </button>
              </div>
            )}

            {(() => {
              const activeTeam = teams.find(t => t.id === activeTeamId) || teams[0] || null;
              const hasTeams = teams.length > 0;
              const displayCreateJoin = !hasTeams || showCreateJoin;

              if (displayCreateJoin) {
                return (
                  // Player has NO teams or explicitly wants to add one: render side-by-side create/join cards
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Card 1: Create team */}
                    <div className="bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-8 space-y-6 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                          <Plus className="w-6 h-6 text-orange-500" />
                        </div>
                        <h3 className="text-2xl font-black uppercase italic tracking-tight">
                          Создать команду
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Создайте собственную команду, пригласите друзей по коду и участвуйте в командных турнирах клуба.
                        </p>
                      </div>
                      
                      <div className="space-y-4 pt-4">
                        <input
                          type="text"
                          placeholder="Название команды..."
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500 transition-colors"
                        />
                        <button
                          onClick={handleCreateTeam}
                          className="w-full bg-orange-500 hover:bg-orange-600 py-4 rounded-2xl text-white font-black text-xs uppercase tracking-widest transition-colors shadow-lg shadow-orange-500/10"
                        >
                          Создать Команду
                        </button>
                      </div>
                    </div>

                    {/* Card 2: Join team */}
                    <div className="bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-8 space-y-6 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                          <Users className="w-6 h-6 text-orange-500" />
                        </div>
                        <h3 className="text-2xl font-black uppercase italic tracking-tight">
                          Вступить по коду
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Получите 6-значный код приглашения у капитана вашей команды и введите его ниже, чтобы присоединиться к составу.
                        </p>
                      </div>

                      <div className="space-y-4 pt-4">
                        <input
                          type="text"
                          placeholder="Вставьте код приглашения..."
                          value={joinInviteCode}
                          onChange={(e) => setJoinInviteCode(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500 transition-colors uppercase tracking-widest text-center"
                        />
                        <button
                          onClick={handleJoinTeam}
                          className="w-full bg-orange-500 hover:bg-orange-600 py-4 rounded-2xl text-white font-black text-xs uppercase tracking-widest transition-colors shadow-lg shadow-orange-500/10"
                        >
                          Вступить в Команду
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Else show active team details
              const activeMembers = activeTeam ? (activeTeam.members || []) : [];

              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Column 1: Team Info */}
                  <div className="md:col-span-1 bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-8 space-y-6 flex flex-col justify-between">
                    <div className="space-y-6">
                      {/* Team Logo Big Display */}
                      <div className="flex flex-col items-center py-6 bg-white/5 rounded-3xl border border-white/5">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-orange-500/30 bg-black/40 flex items-center justify-center">
                          {activeTeam.logoUrl ? (
                            <img src={activeTeam.logoUrl} alt={activeTeam.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl font-black text-gray-600">
                              {activeTeam.name.substring(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative pr-8">
                        <h3 className="text-2xl font-black uppercase italic tracking-tight truncate">
                          Команда: <span className="text-orange-500">{activeTeam.name}</span>
                        </h3>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                          Капитан: {activeTeam.captainId === player?.id ? "ВЫ" : "Другой игрок"}
                        </p>

                        {activeTeam.captainId === player?.id && (
                          <button
                            onClick={() => handleOpenEditModal(activeTeam)}
                            className="absolute right-0 top-0 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors border border-white/5"
                            title="Редактировать команду"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Invite Code widget */}
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-0.5">
                            Код для вступления
                          </span>
                          <span className="text-sm font-black text-orange-500 uppercase tracking-widest">
                            {activeTeam.inviteCode}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(activeTeam.inviteCode);
                            alert("Код скопирован в буфер обмена!");
                          }}
                          className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors border border-white/5"
                        >
                          Копировать
                        </button>
                      </div>

                      {/* Team Statistics Grid */}
                      <div className="bg-white/5 p-4 rounded-3xl border border-white/5 space-y-4">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 block">
                          Статистика команды
                        </span>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-black/20 p-3 rounded-2xl border border-white/5 text-center">
                            <span className="text-[8px] font-black uppercase text-gray-500 block">
                              Средний ELO
                            </span>
                            <span className="text-base font-black text-orange-500 italic block mt-0.5">
                              {activeTeam.stats?.averageElo || 1000}
                            </span>
                          </div>
                          <div className="bg-black/20 p-3 rounded-2xl border border-white/5 text-center">
                            <span className="text-[8px] font-black uppercase text-gray-500 block">
                              Win Rate
                            </span>
                            <span className="text-base font-black text-emerald-400 italic block mt-0.5">
                              {activeTeam.stats?.totalMatches > 0 
                                ? `${Math.round((activeTeam.stats.matchesWon / activeTeam.stats.totalMatches) * 100)}%`
                                : "0%"}
                            </span>
                          </div>
                          <div className="bg-black/20 p-3 rounded-2xl border border-white/5 text-center">
                            <span className="text-[8px] font-black uppercase text-gray-500 block">
                              Турниры
                            </span>
                            <span className="text-sm font-black text-gray-300 block mt-0.5">
                              {activeTeam.stats?.totalTournaments || 0}
                            </span>
                          </div>
                          <div className="bg-black/20 p-3 rounded-2xl border border-white/5 text-center">
                            <span className="text-[8px] font-black uppercase text-gray-500 block">
                              Призовые
                            </span>
                            <span className="text-sm font-black text-yellow-500 italic block mt-0.5">
                              {activeTeam.stats?.totalPrizes || 0} ₽
                            </span>
                          </div>
                        </div>

                        <div className="text-center text-[9px] text-gray-500 font-bold uppercase pt-1 border-t border-white/5">
                          Матчей: {activeTeam.stats?.totalMatches || 0} (Побед: {activeTeam.stats?.matchesWon || 0})
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/5">
                      {activeTeam.captainId === player?.id ? (
                        <button
                          onClick={handleDisbandTeam}
                          className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black text-xs uppercase tracking-widest rounded-2xl border border-red-500/20 hover:border-red-500/40 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4.5 h-4.5" /> Распустить команду
                        </button>
                      ) : (
                        <button
                          onClick={handleLeaveTeam}
                          className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-black text-xs uppercase tracking-widest rounded-2xl border border-white/5 transition-colors flex items-center justify-center gap-2"
                        >
                          <LogOut className="w-4.5 h-4.5" /> Покинуть команду
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Column 2: Roster */}
                  <div className="md:col-span-2 bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
                    <div className="space-y-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">
                        Состав команды ({activeMembers.length} / 5)
                      </span>
                      <div className="space-y-3">
                        {activeMembers.map((m: any) => (
                          <div
                            key={m.id}
                            className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-orange-500">
                                {m.id === activeTeam.captainId ? "👑" : <User className="w-5 h-5 text-gray-400" />}
                              </div>
                              <div>
                                <span className="text-sm font-bold block">{m.fullName}</span>
                                <span className="text-xs text-gray-500">
                                  {m.phoneNumber} • <span className="text-orange-500 font-black italic">{m.elo} ELO</span>
                                </span>
                              </div>
                            </div>
                            {activeTeam.captainId === player?.id && m.id !== player?.id && (
                              <button
                                onClick={() => handleKickMember(m.id)}
                                className="text-red-500 hover:bg-red-500/10 p-2.5 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
                                title="Исключить"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tournament History */}
                    <div className="space-y-4 pt-6 border-t border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">
                        История турниров команды
                      </span>
                      
                      {activeTeam.tournamentsHistory && activeTeam.tournamentsHistory.length > 0 ? (
                        <div className="space-y-3">
                          {activeTeam.tournamentsHistory.map((th: any) => (
                            <div
                              key={th.id}
                              className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5"
                            >
                              <div>
                                <span className="text-sm font-bold block">{th.name}</span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase block mt-0.5">
                                  {th.discipline.toUpperCase()} • {formatTypeLabel(th.type)} • Регистрация: {new Date(th.registeredAt).toLocaleDateString('ru-RU')}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                {th.prizeWon > 0 && (
                                  <span className="text-xs font-black text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-lg">
                                    +{th.prizeWon} ₽
                                  </span>
                                )}
                                <span
                                  className={cn(
                                    "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                                    th.status === "FINISHED"
                                      ? "bg-white/5 text-gray-400 border-white/10"
                                      : th.status === "ACTIVE"
                                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse"
                                      : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                  )}
                                >
                                  {th.status === "FINISHED" ? "Завершен" : th.status === "ACTIVE" ? "В игре" : "Ожидание"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-xs text-center py-6 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                          Команда еще не участвовала в турнирах. Зарегистрируйтесь на первый турнир во вкладке «Турниры»!
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === "leaderboard" && (
          <div className="mt-8 bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h3 className="text-2xl font-black uppercase italic tracking-tight">
                Рейтинг игроков клуба
              </h3>
              {/* Discipline Switcher */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 max-w-[200px]">
                <button
                  onClick={() => setLeaderboardDiscipline("cs2")}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                    leaderboardDiscipline === "cs2" ? "bg-orange-500 text-white" : "text-gray-500 hover:text-white"
                  )}
                >
                  CS2
                </button>
                <button
                  onClick={() => setLeaderboardDiscipline("fifa")}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                    leaderboardDiscipline === "fifa" ? "bg-orange-500 text-white" : "text-gray-500 hover:text-white"
                  )}
                >
                  FIFA
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">
                    <th className="py-4 px-4">Место</th>
                    <th className="py-4 px-4">Игрок</th>
                    <th className="py-4 px-4">ELO Рейтинг</th>
                    <th className="py-4 px-4 text-right">Игр сыграно</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {leaderboard.map((user: any, idx) => (
                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 font-black italic text-orange-500">
                        #{idx + 1}
                      </td>
                      <td className="py-4 px-4 font-bold">
                        {user.full_name}
                      </td>
                      <td className="py-4 px-4 font-black italic text-yellow-500">
                        {user.elo || 1000}
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-gray-400">
                        {user.matches_played || 0}
                      </td>
                    </tr>
                  ))}
                  {leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500 text-xs">
                        Рейтинги пустые для этой дисциплины. Сыграйте первый матч!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Team Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0c0c0e] border border-white/5 w-full max-w-md rounded-[2.5rem] p-8 space-y-6 relative shadow-2xl"
            >
              <button
                onClick={() => setShowEditModal(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight">
                  Настройки команды
                </h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                  Редактирование профиля команды
                </p>
              </div>

              {/* Logo preview and upload */}
              <div className="flex flex-col items-center gap-4 py-4 bg-white/5 rounded-3xl border border-white/5 relative overflow-hidden">
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-orange-500/50 bg-black/40 flex items-center justify-center group">
                  {editTeamLogoUrl ? (
                    <img src={editTeamLogoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-gray-600">
                      {editTeamName.substring(0, 1).toUpperCase() || "T"}
                    </span>
                  )}
                  {uploadingLogo && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                    </div>
                  )}
                </div>

                <label className="cursor-pointer bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">
                  {uploadingLogo ? "Загрузка..." : "Загрузить фото"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Team Name Input */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-500 block">Название команды</label>
                <input
                  type="text"
                  placeholder="Название..."
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors border border-white/5"
                >
                  Отмена
                </button>
                <button
                  disabled={uploadingLogo || !editTeamName.trim()}
                  onClick={handleSaveTeamEdits}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
