"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "@/app/promo/components/BottomNav";
import { cn } from "@/lib/utils";

interface PublicPlayerProfile {
  id: string;
  fullName: string;
  nickname: string | null;
  avatarUrl: string | null;
  lftStatus: "lft" | "in_team" | "none" | string;
  clubName: string | null;
  clubId: number | null;
  steamLink: string | null;
  steamId: string | null;
  faceitLink: string | null;
  faceitNickname: string | null;
  faceitLvl: number | null;
  faceitElo: number | null;
  faceitKd: number | null;
  faceitWinrate: number | null;
  faceitMatches: number | null;
  createdAt: string;
}

interface PlayerStats {
  matchesCount: number;
  wins: number;
  kills: number;
  deaths: number;
  headshots: number;
  kdRatio: number;
  cs2Rating: number;
}

interface PlayerTeam {
  id: number;
  name: string;
  isCaptain: boolean;
  role: string;
  membersCount: number;
  createdAt: string;
}

interface RecentTournament {
  id: number;
  title: string;
  status: string;
  created_at: string;
}

interface ViewerCaptainedTeam {
  id: number;
  name: string;
  membersCount: number;
  alreadyInTeam: boolean;
  canInvite: boolean;
}

export default function PublicPlayerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<PublicPlayerProfile | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [teams, setTeams] = useState<PlayerTeam[]>([]);
  const [tournaments, setTournaments] = useState<RecentTournament[]>([]);
  const [viewerTeams, setViewerTeams] = useState<ViewerCaptainedTeam[]>([]);
  const [isSelf, setIsSelf] = useState(false);

  // Copy states
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSteamId, setCopiedSteamId] = useState(false);

  // Edit Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editLftStatus, setEditLftStatus] = useState("none");
  const [editSteamLink, setEditSteamLink] = useState("");
  const [editFaceitLink, setEditFaceitLink] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [syncingFaceit, setSyncingFaceit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Invite Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedInviteTeamId, setSelectedInviteTeamId] = useState<number | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);

  const loadProfile = async () => {
    if (!playerId) return;
    setError(null);
    try {
      const res = await fetch(`/api/promo/player/${playerId}/public`);
      if (res.status === 404) {
        setError("Игрок не найден");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load profile");
      }
      const data = await res.json();
      setPlayer(data.player);
      setStats(data.stats);
      setTeams(data.teams || []);
      setTournaments(data.recentTournaments || []);
      setViewerTeams(data.viewerCaptainedTeams || []);
      setIsSelf(Boolean(data.isSelf));

      if (data.player) {
        setEditNickname(data.player.nickname || "");
        setEditAvatarUrl(data.player.avatarUrl || "");
        setEditLftStatus(data.player.lftStatus || "none");
        setEditSteamLink(data.player.steamLink || "");
        setEditFaceitLink(data.player.faceitLink || "");
      }
    } catch (err: any) {
      console.error("Profile load error:", err);
      setError("Не удалось загрузить данные профиля");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [playerId]);

  const handleCopyProfileLink = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopySteamId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedSteamId(true);
      setTimeout(() => setCopiedSteamId(false), 2000);
    });
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setEditAvatarUrl(data.url);
      } else {
        alert(data.error || "Ошибка загрузки фото");
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      alert("Ошибка загрузки фото");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (syncFaceit = false) => {
    setSavingProfile(true);
    if (syncFaceit) setSyncingFaceit(true);

    try {
      const res = await fetch("/api/promo/player/tournament-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: editNickname || null,
          avatarUrl: editAvatarUrl || null,
          lftStatus: editLftStatus,
          steamLink: editSteamLink,
          faceitLink: editFaceitLink,
          syncFaceitNow: syncFaceit,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        await loadProfile();
        if (!syncFaceit) {
          setShowEditModal(false);
        } else {
          alert(data.faceitSynced ? "Faceit профиль успешно синхронизирован!" : "Данные Faceit сохранены.");
        }
      } else {
        alert(data.error || "Ошибка сохранения профиля");
      }
    } catch (err) {
      console.error("Save profile error:", err);
      alert("Ошибка сети");
    } finally {
      setSavingProfile(false);
      setSyncingFaceit(false);
    }
  };

  const handleInvitePlayer = async () => {
    if (!selectedInviteTeamId || !player) return;
    setSendingInvite(true);
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite_player",
          teamId: selectedInviteTeamId,
          targetPlayerId: player.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Приглашение успешно отправлено игроку!");
        setShowInviteModal(false);
        await loadProfile();
      } else {
        alert(data.error || "Не удалось отправить приглашение");
      }
    } catch (err) {
      console.error("Invite error:", err);
      alert("Ошибка отправки приглашения");
    } finally {
      setSendingInvite(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070708] text-white flex items-center justify-center">
        <p className="text-xs font-black uppercase tracking-widest text-gray-500 animate-pulse">
          Загрузка профиля...
        </p>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-[#070708] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0c0c0e] border border-white/5 rounded-3xl p-8 text-center space-y-6">
          <div className="text-4xl font-black text-white/10 select-none">[ — ]</div>
          <h2 className="text-xl font-black uppercase italic tracking-tight text-white">
            {error || "Игрок не найден"}
          </h2>
          <button
            onClick={() => router.back()}
            className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition-colors"
          >
            ← Вернуться назад
          </button>
        </div>
      </div>
    );
  }

  const displayName = player.nickname || player.fullName || "Игрок";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const getFaceitLevelColor = (lvl: number | null) => {
    if (!lvl) return "bg-gray-700 text-white border-gray-600";
    if (lvl === 10) return "bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.3)]";
    if (lvl >= 8) return "bg-orange-500 text-white border-orange-400";
    if (lvl >= 4) return "bg-yellow-500 text-black border-yellow-400";
    if (lvl >= 2) return "bg-emerald-500 text-white border-emerald-400";
    return "bg-gray-500 text-white border-gray-400";
  };

  const eligibleInviteTeams = viewerTeams.filter((t) => t.canInvite);

  return (
    <div className="min-h-screen bg-[#070708] text-white selection:bg-orange-500/20 selection:text-orange-400 pb-36 font-sans">
      {/* Top Header */}
      <header className="border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
          <button
            onClick={() => router.back()}
            className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
          >
            <span className="group-hover:-translate-x-1 transition-transform inline-block">←</span>
            Назад
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyProfileLink}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest px-3.5 py-2 rounded-xl transition-all border flex items-center gap-1.5",
                copiedLink
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10"
              )}
            >
              {copiedLink ? "✓ Скопировано" : "Поделиться"}
            </button>

            {isSelf ? (
              <button
                onClick={() => setShowEditModal(true)}
                className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-colors shadow-lg shadow-orange-500/20"
              >
                Редактировать
              </button>
            ) : (
              eligibleInviteTeams.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedInviteTeamId(eligibleInviteTeams[0].id);
                    setShowInviteModal(true);
                  }}
                  className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors shadow-lg shadow-emerald-500/20"
                >
                  + В команду
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Player Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0c0c0e] border border-white/5 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden shadow-2xl"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-orange-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar Badge (NO LVL) */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-black/60 border border-white/15 overflow-hidden flex items-center justify-center shadow-2xl relative group">
                {player.avatarUrl ? (
                  <img src={player.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-black uppercase italic tracking-tight text-orange-500 select-none">
                    {initials || "P"}
                  </span>
                )}

                {isSelf && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-white text-center p-2"
                  >
                    Изменить
                  </button>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-white truncate">
                  {displayName}
                </h1>
                {isSelf && (
                  <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    Это вы
                  </span>
                )}
              </div>

              {player.nickname && player.fullName && player.nickname !== player.fullName && (
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">
                  {player.fullName}
                </span>
              )}

              {/* LFT Status Badge */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {player.lftStatus === "lft" ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Ищу команду (LFT)
                  </span>
                ) : player.lftStatus === "in_team" ? (
                  <span className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    В составе команды
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-gray-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                    Не ищу команду
                  </span>
                )}

                {player.clubName && (
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                    Клуб: {player.clubName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Esports Accounts Section (Faceit & Steam) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Faceit Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Faceit CS2
              </span>
            <div className="flex items-center gap-2">
              {isSelf && player.faceitLink && (
                <button
                  type="button"
                  onClick={() => handleSaveProfile(true)}
                  disabled={syncingFaceit}
                  className="text-[9px] font-black uppercase tracking-wider text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-full border border-white/10"
                >
                  {syncingFaceit ? "Загрузка..." : "↻ Обновить"}
                </button>
              )}
              <span
                className={cn(
                  "text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                  player.faceitLink
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-white/5 text-gray-500 border-white/5"
                )}
              >
                {player.faceitLink ? "Привязан" : "Не привязан"}
              </span>
            </div>
          </div>

            {player.faceitLink ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-2xl border flex items-center justify-center font-black text-base shadow-md",
                        getFaceitLevelColor(player.faceitLvl)
                      )}
                    >
                      {player.faceitLvl || "—"}
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block">
                        Faceit Уровень
                      </span>
                      <span className="text-sm font-black text-white uppercase italic">
                        {player.faceitNickname || "Профиль"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block">
                      Faceit ELO
                    </span>
                    <span className="text-base font-black text-orange-500 italic">
                      {player.faceitElo ? `${player.faceitElo} ELO` : "—"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-0.5">
                      K/D Ratio
                    </span>
                    <span className="text-xs font-black text-white">
                      {player.faceitKd ? player.faceitKd : "—"}
                    </span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-0.5">
                      Winrate
                    </span>
                    <span className="text-xs font-black text-emerald-400">
                      {player.faceitWinrate ? `${player.faceitWinrate}%` : "—"}
                    </span>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block mb-0.5">
                      Матчи
                    </span>
                    <span className="text-xs font-black text-white">
                      {player.faceitMatches ? player.faceitMatches : "—"}
                    </span>
                  </div>
                </div>

                <a
                  href={player.faceitLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 text-xs font-black uppercase tracking-widest py-3 rounded-2xl transition-colors"
                >
                  Открыть Faceit профиль ↗
                </a>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <p className="text-xs text-gray-500 font-medium">
                  Faceit профиль еще не привязан.
                </p>
                {isSelf && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="text-xs font-bold uppercase tracking-wider text-orange-400 hover:text-orange-300"
                  >
                    + Привязать Faceit
                  </button>
                )}
              </div>
            )}
          </motion.div>

          {/* Steam Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Steam профиль
              </span>
              <span
                className={cn(
                  "text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                  player.steamLink
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-white/5 text-gray-500 border-white/5"
                )}
              >
                {player.steamLink ? "Привязан" : "Не привязан"}
              </span>
            </div>

            {player.steamLink ? (
              <div className="space-y-4">
                {player.steamId && (
                  <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 block">
                        SteamID64
                      </span>
                      <span className="text-xs font-mono font-bold text-gray-200">
                        {player.steamId}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopySteamId(player.steamId!)}
                      className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
                    >
                      {copiedSteamId ? "✓ Скопирован" : "Копировать"}
                    </button>
                  </div>
                )}

                <a
                  href={player.steamLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-widest py-3 rounded-2xl transition-colors"
                >
                  Открыть Steam ↗
                </a>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <p className="text-xs text-gray-500 font-medium">
                  Steam профиль еще не привязан.
                </p>
                {isSelf && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300"
                  >
                    + Привязать Steam
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* Combat Stats Dashboard */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-sm font-black uppercase italic tracking-tight text-white">
                Турнирный рейтинг и статистика матчей
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                  CS2 Рейтинг
                </span>
                <span className="text-xl font-black text-orange-500 italic block">
                  {stats.cs2Rating} ELO
                </span>
              </div>

              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                  Сыграно матчей
                </span>
                <span className="text-xl font-black text-white block">
                  {stats.matchesCount}
                </span>
              </div>

              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                  K/D Ratio
                </span>
                <span
                  className={cn(
                    "text-xl font-black block",
                    stats.kdRatio >= 1.0 ? "text-emerald-400" : "text-amber-400"
                  )}
                >
                  {stats.kdRatio}
                </span>
              </div>

              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                  Фраги / Хедшоты
                </span>
                <span className="text-xl font-black text-white block">
                  {stats.kills} <span className="text-xs text-gray-500 font-bold">({stats.headshots} HS)</span>
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Teams Section */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h3 className="text-sm font-black uppercase italic tracking-tight text-white">
              Команды игрока ({teams.length})
            </h3>
          </div>

          {teams.length === 0 ? (
            <div className="bg-black/30 border border-white/5 rounded-2xl p-6 text-center text-gray-500 text-xs font-medium">
              Игрок пока не состоит ни в одной зарегистрированной команде.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {teams.map((t) => (
                <div
                  key={t.id}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:border-white/20 transition-all"
                >
                  <div className="space-y-1">
                    <div className="text-base font-black uppercase tracking-tight text-white group-hover:text-orange-400 transition-colors">
                      {t.name}
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      Состав: {t.membersCount} участников
                    </div>
                  </div>

                  <span
                    className={cn(
                      "text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border",
                      t.isCaptain
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-white/5 text-gray-400 border-white/10"
                    )}
                  >
                    {t.isCaptain ? "Капитан" : "Игрок"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Tournaments History */}
        {tournaments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-sm font-black uppercase italic tracking-tight text-white">
                Участие в турнирах
              </h3>
            </div>

            <div className="space-y-3">
              {tournaments.map((t) => (
                <div
                  key={t.id}
                  className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="text-sm font-black uppercase italic tracking-tight text-white block">
                      {t.title}
                    </span>
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                      {new Date(t.created_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                  </div>

                  <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">
                    {t.status === "ACTIVE" ? "LIVE" : t.status === "REGISTRATION" ? "Регистрация" : "Завершен"}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      {/* Edit Tournament Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0c0c0e] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h2 className="text-lg font-black uppercase italic tracking-tight text-white">
                  Редактировать турнирный профиль
                </h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-500 hover:text-white text-xs font-black uppercase tracking-widest px-2 py-1"
                >
                  ✕
                </button>
              </div>

              {/* Nickname Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                  Игровой никнейм (Nickname)
                </label>
                <input
                  type="text"
                  placeholder="Например: s1mple, NiKo..."
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white font-bold focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Avatar Upload */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                  Аватарка игрока
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                    {editAvatarUrl ? (
                      <img src={editAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-black text-orange-500">{initials}</span>
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="bg-white/10 hover:bg-white/20 border border-white/15 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {uploadingAvatar ? "Загрузка..." : "Загрузить фото"}
                      </button>
                      {editAvatarUrl && (
                        <button
                          type="button"
                          onClick={() => setEditAvatarUrl("")}
                          className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 px-3 py-2.5 transition-colors"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* LFT Status Switcher */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                  Статус поиска команды (LFT)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "lft", label: "Ищу команду" },
                    { id: "in_team", label: "В команде" },
                    { id: "none", label: "Не ищу" },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setEditLftStatus(st.id)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all text-center",
                        editLftStatus === st.id
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-white/5 text-gray-400 border-white/5 hover:text-white"
                      )}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Steam Link */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                  Steam профиль
                </label>
                <input
                  type="text"
                  placeholder="https://steamcommunity.com/id/..."
                  value={editSteamLink}
                  onChange={(e) => setEditSteamLink(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Faceit Link Section (NO MANUAL STATS) */}
              <div className="space-y-3 bg-black/30 p-4 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                    Faceit CS2 профиль
                  </label>
                  {editFaceitLink && (
                    <button
                      type="button"
                      onClick={() => handleSaveProfile(true)}
                      disabled={syncingFaceit}
                      className="text-[9px] font-black uppercase tracking-wider text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50"
                    >
                      {syncingFaceit ? "Синхронизация..." : "↻ Обновить по API"}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="https://www.faceit.com/ru/players/..."
                  value={editFaceitLink}
                  onChange={(e) => setEditFaceitLink(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
                <p className="text-[9px] text-gray-500 font-medium leading-relaxed">
                  Статистика ELO, LVL, K/D, процент побед и количество матчей загружаются автоматически через Faceit API.
                </p>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-white/5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-black uppercase text-xs tracking-widest py-3.5 rounded-2xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveProfile(false)}
                  disabled={savingProfile}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black uppercase text-xs tracking-widest py-3.5 rounded-2xl transition-colors shadow-lg shadow-orange-500/20"
                >
                  {savingProfile ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Captain Invite to Team Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#0c0c0e] border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl"
            >
              <div className="space-y-1">
                <h3 className="text-base font-black uppercase italic tracking-tight text-white">
                  Пригласить в команду
                </h3>
                <p className="text-xs text-gray-400">
                  Добавить игрока <strong className="text-white">{displayName}</strong> в состав вашей команды.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">
                  Выберите вашу команду
                </label>
                <select
                  value={selectedInviteTeamId || ""}
                  onChange={(e) => setSelectedInviteTeamId(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  {eligibleInviteTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.membersCount}/7 игроков)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-black uppercase text-xs tracking-widest py-3 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleInvitePlayer}
                  disabled={sendingInvite || !selectedInviteTeamId}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black uppercase text-xs tracking-widest py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
                >
                  {sendingInvite ? "Отправка..." : "Отправить инвайт"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
