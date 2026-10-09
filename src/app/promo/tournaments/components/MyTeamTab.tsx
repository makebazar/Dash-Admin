"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  TournamentNotificationModal,
  TournamentNotificationData,
} from "./TournamentNotificationModal";

interface MyTeamTabProps {
  player: any;
  teams: any[];
  incomingInvites?: any[];
  outgoingInvites?: any[];
  lftPlayers?: any[];
  activeTeamId: string | null;
  setActiveTeamId: (id: string | null) => void;
  onRefreshTeams: (newTeamId?: string | number) => Promise<any>;
  onSelectPlayer: (playerId: string, playerName: string) => void;
}

export function MyTeamTab({
  player,
  teams,
  incomingInvites = [],
  outgoingInvites = [],
  lftPlayers = [],
  activeTeamId,
  setActiveTeamId,
  onRefreshTeams,
  onSelectPlayer,
}: MyTeamTabProps) {
  const [showCreateJoin, setShowCreateJoin] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamTag, setNewTeamTag] = useState("");
  const [newTeamFormat, setNewTeamFormat] = useState<"5vs5" | "2vs2">("5vs5");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit Team Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamTag, setEditTeamTag] = useState("");
  const [editTeamFormat, setEditTeamFormat] = useState<"5vs5" | "2vs2">("5vs5");
  const [editTeamLogoUrl, setEditTeamLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Invitations and Free Agents states
  const [invitingPlayerId, setInvitingPlayerId] = useState<string | null>(null);
  const [processingInviteId, setProcessingInviteId] = useState<number | null>(null);

  // Copy join link state
  const [copiedLink, setCopiedLink] = useState(false);
  const [modalNotification, setModalNotification] = useState<TournamentNotificationData | null>(null);

  const activeTeam = teams.find((t) => String(t.id) === String(activeTeamId)) || teams[0] || null;

  const isDuo = activeTeam?.formatType === "2vs2";
  const maxMain = isDuo ? 2 : 5;
  const maxSub = isDuo ? 1 : 2;
  const maxTotalSlots = isDuo ? 3 : 7;

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: newTeamName.trim(),
          tag: newTeamTag.trim() || null,
          formatType: newTeamFormat,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewTeamName("");
        setNewTeamTag("");
        setNewTeamFormat("5vs5");
        setShowCreateJoin(false);
        await onRefreshTeams(data.teamId);
        setModalNotification({
          type: "success",
          title: "Команда создана!",
          message: `Команда «${data.name || newTeamName}» успешно зарегистрирована!`,
          actionText: "Отлично",
        });
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка создания",
          message: data.error || "Не удалось создать команду. Попробуйте другое название.",
          actionText: "Понятно",
        });
      }
    } catch (err) {
      console.error(err);
      setModalNotification({
        type: "error",
        title: "Ошибка сети",
        message: "Не удалось связаться с сервером.",
        actionText: "Закрыть",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!joinInviteCode.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", joinCode: joinInviteCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setJoinInviteCode("");
        setShowCreateJoin(false);
        await onRefreshTeams(data.teamId);
        setModalNotification({
          type: "success",
          title: "Вы в команде!",
          message: "Вы успешно присоединились к команде по коду приглашения!",
          actionText: "Отлично",
        });
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка вступления",
          message: data.error || "Неверный код приглашения или вы уже состоите в команде.",
          actionText: "Понятно",
        });
      }
    } catch (err) {
      console.error(err);
      setModalNotification({
        type: "error",
        title: "Ошибка сети",
        message: "Не удалось отправить запрос на вступление.",
        actionText: "Закрыть",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Accept incoming invite
  const handleAcceptInvite = async (inviteId: number) => {
    setProcessingInviteId(inviteId);
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_invite", inviteId }),
      });
      const data = await res.json();
      if (res.ok) {
        setModalNotification({
          type: "success",
          title: "Приглашение принято!",
          message: data.message || "Вы успешно вступили в команду!",
          actionText: "Отлично",
        });
        await onRefreshTeams(data.teamId);
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка",
          message: data.error || "Ошибка при принятии приглашения.",
          actionText: "Закрыть",
        });
      }
    } catch (err) {
      console.error(err);
      setModalNotification({
        type: "error",
        title: "Ошибка сети",
        message: "Не удалось обработать приглашение.",
        actionText: "Закрыть",
      });
    } finally {
      setProcessingInviteId(null);
    }
  };

  // Decline incoming invite
  const handleDeclineInvite = async (inviteId: number) => {
    setProcessingInviteId(inviteId);
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline_invite", inviteId }),
      });
      const data = await res.json();
      if (res.ok) {
        await onRefreshTeams(activeTeam?.id);
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка",
          message: data.error || "Ошибка при отклонении приглашения.",
          actionText: "Закрыть",
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingInviteId(null);
    }
  };

  // Cancel outgoing invite (Captain)
  const handleCancelInvite = async (inviteId: number) => {
    if (!activeTeam) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_invite", inviteId, teamId: activeTeam.id }),
      });
      const data = await res.json();
      if (res.ok) {
        await onRefreshTeams(activeTeam.id);
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка",
          message: data.error || "Ошибка при отзыве приглашения.",
          actionText: "Закрыть",
        });
      }
    } catch (err) {
      console.error(err);
      setModalNotification({
        type: "error",
        title: "Ошибка сети",
        message: "Не удалось отозвать приглашение.",
        actionText: "Закрыть",
      });
    }
  };

  const handleLeaveTeam = async () => {
    if (!activeTeam) return;
    if (!confirm("Вы уверены, что хотите покинуть команду?")) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", teamId: activeTeam.id }),
      });
      if (res.ok) {
        await onRefreshTeams();
        setModalNotification({
          type: "info",
          title: "Вы вышли из команды",
          message: "Вы успешно покинули команду.",
          actionText: "Понятно",
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisbandTeam = async () => {
    if (!activeTeam) return;
    if (!confirm("Вы уверены, что хотите распустить команду? Это действие необратимо.")) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disband", teamId: activeTeam.id }),
      });
      if (res.ok) {
        await onRefreshTeams();
        setModalNotification({
          type: "info",
          title: "Команда распущена",
          message: "Команда была успешно распущена.",
          actionText: "Понятно",
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Captain kicks member from team
  const handleKickMember = async (targetPlayerId: string, memberName: string) => {
    if (!activeTeam) return;
    if (!confirm(`Исключить игрока "${memberName}" из состава команды?`)) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kick", teamId: activeTeam.id, targetPlayerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setModalNotification({
          type: "info",
          title: "Состав изменен",
          message: data.message || `Игрок ${memberName} исключен из команды.`,
          actionText: "Понятно",
        });
        await onRefreshTeams(activeTeam.id);
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка",
          message: data.error || "Ошибка при исключении игрока.",
          actionText: "Закрыть",
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransferCaptain = async (targetPlayerId: string, memberName: string) => {
    if (!activeTeam) return;
    if (!confirm(`Передать права капитана игроку "${memberName}"?`)) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transfer_captain", teamId: activeTeam.id, targetPlayerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setModalNotification({
          type: "success",
          title: "Капитан назначен",
          message: data.message || `Права капитана успешно переданы игроку ${memberName}.`,
          actionText: "Отлично",
        });
        await onRefreshTeams(activeTeam.id);
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка",
          message: data.error || "Ошибка передачи прав капитана.",
          actionText: "Закрыть",
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Move member between main and sub rosters
  const handleSetRole = async (targetPlayerId: string, newRole: "player" | "sub") => {
    if (!activeTeam || !targetPlayerId) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_role", teamId: activeTeam.id, targetPlayerId, newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        await onRefreshTeams(activeTeam.id);
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка",
          message: data.error || "Ошибка при перемещении игрока.",
          actionText: "Закрыть",
        });
      }
    } catch (err) {
      console.error(err);
      setModalNotification({
        type: "error",
        title: "Ошибка сети",
        message: "Не удалось связаться с сервером.",
        actionText: "Закрыть",
      });
    }
  };

  // Invite LFT player (creates pending invitation)
  const handleInviteLftPlayer = async (targetPlayerId: string) => {
    if (!activeTeam) return;
    setInvitingPlayerId(targetPlayerId);
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite_player", teamId: activeTeam.id, targetPlayerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setModalNotification({
          type: "success",
          title: "Инвайт отправлен",
          message: data.message || "Приглашение в команду успешно отправлено игроку!",
          actionText: "Отлично",
        });
        await onRefreshTeams(activeTeam.id);
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка",
          message: data.error || "Не удалось отправить приглашение игроку.",
          actionText: "Закрыть",
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInvitingPlayerId(null);
    }
  };

  const handleOpenEditModal = () => {
    if (!activeTeam) return;
    setEditTeamName(activeTeam.name);
    setEditTeamTag(activeTeam.tag || "");
    setEditTeamFormat(activeTeam.formatType === "2vs2" ? "2vs2" : "5vs5");
    setEditTeamLogoUrl(activeTeam.logoUrl || "");
    setShowEditModal(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setEditTeamLogoUrl(data.url);
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка загрузки",
          message: data.error || "Ошибка при загрузке логотипа.",
          actionText: "Закрыть",
        });
      }
    } catch (err) {
      console.error(err);
      setModalNotification({
        type: "error",
        title: "Ошибка загрузки",
        message: "Не удалось загрузить изображение логотипа.",
        actionText: "Закрыть",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveTeamEdits = async () => {
    if (!activeTeam || !editTeamName.trim()) return;
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          teamId: activeTeam.id,
          name: editTeamName.trim(),
          tag: editTeamTag.trim() || null,
          formatType: editTeamFormat,
          logoUrl: editTeamLogoUrl || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowEditModal(false);
        await onRefreshTeams(activeTeam.id);
        setModalNotification({
          type: "success",
          title: "Данные сохранены",
          message: "Настройки команды успешно обновлены.",
          actionText: "Отлично",
        });
      } else {
        setModalNotification({
          type: "error",
          title: "Ошибка сохранения",
          message: data.error || "Ошибка при обновлении команды.",
          actionText: "Закрыть",
        });
      }
    } catch (err) {
      console.error(err);
      setModalNotification({
        type: "error",
        title: "Ошибка сети",
        message: "Не удалось обновить настройки команды.",
        actionText: "Закрыть",
      });
    }
  };

  const handleCopyInviteLink = () => {
    if (!activeTeam?.joinCode || typeof window === "undefined") return;
    const url = `${window.location.origin}/promo/tournaments?join=${activeTeam.joinCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const isCaptain = Boolean(
    activeTeam?.isCaptain ??
    (activeTeam?.captainPhone && player?.phoneNumber && activeTeam.captainPhone === player.phoneNumber) ??
    (activeTeam?.captainPhone && player?.phone_number && activeTeam.captainPhone === player.phone_number)
  );

  const members = activeTeam?.members || [];
  const mainRoster = members.filter((m: any) => m.role !== "sub");
  const subRoster = members.filter((m: any) => m.role === "sub");

  // Outgoing pending invites for the active team
  const activeTeamOutgoingInvites = outgoingInvites.filter((inv) => inv.teamId === activeTeam?.id);

  return (
    <div className="mt-8 space-y-6 animate-fadeIn">
      {/* 1. INCOMING INVITATIONS BANNER */}
      {incomingInvites.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-950/40 via-[#0e0e12] to-amber-950/30 border border-orange-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-4 mb-4 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
              <span className="text-xs font-black uppercase tracking-widest text-orange-400">
                Входящие приглашения в команду ({incomingInvites.length})
              </span>
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden sm:inline">
              Требуется ваше подтверждение
            </span>
          </div>

          <div className="space-y-3">
            {incomingInvites.map((inv) => {
              const isProcessing = processingInviteId === inv.id;
              const invIsDuo = inv.formatType === "2vs2";
              return (
                <div
                  key={inv.id}
                  className="bg-black/60 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 font-black text-sm shrink-0 overflow-hidden">
                      {inv.teamLogoUrl ? (
                        <img src={inv.teamLogoUrl} alt={inv.teamName} className="w-full h-full object-cover" />
                      ) : (
                        inv.teamName.substring(0, 1).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black uppercase text-white">{inv.teamName}</span>
                        {inv.teamTag && (
                          <span className="text-[10px] font-mono font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                            [{inv.teamTag}]
                          </span>
                        )}
                        <span className={cn(
                          "text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded",
                          invIsDuo ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                        )}>
                          {invIsDuo ? "2x2" : "5x5"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                        <span>Капитан: {inv.captainName}</span>
                        <span>•</span>
                        <span className="text-orange-400">~{inv.avgElo} ELO</span>
                        <span>•</span>
                        <span>{inv.membersCount} / {inv.maxSlots || (invIsDuo ? 3 : 7)} игроков</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleAcceptInvite(inv.id)}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-initial bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                    >
                      {isProcessing ? "..." : "✓ Принять"}
                    </button>
                    <button
                      onClick={() => handleDeclineInvite(inv.id)}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-initial bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 font-black text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all"
                    >
                      ✕ Отклонить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Team Tabs / Selector bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {teams.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {teams.map((t) => {
              const isT2x2 = t.formatType === "2vs2";
              const isTActive = String(activeTeamId) === String(t.id) || (!activeTeamId && activeTeam?.id === t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTeamId(String(t.id))}
                  className={cn(
                    "px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border whitespace-nowrap flex items-center gap-1.5",
                    isTActive
                      ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                      : "bg-[#0c0c0e] text-gray-400 border-white/5 hover:text-white hover:border-white/10"
                  )}
                >
                  <span className={cn(
                    "text-[9px] font-mono px-1 py-0.2 rounded font-black",
                    isTActive ? "bg-black/30 text-white" : isT2x2 ? "text-blue-400 bg-blue-500/10" : "text-orange-400 bg-orange-500/10"
                  )}>
                    {isT2x2 ? "2x2" : "5x5"}
                  </span>
                  <span>{t.tag ? `[${t.tag}] ${t.name}` : t.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={() => setShowCreateJoin(!showCreateJoin)}
          className="text-xs font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-2xl transition-colors shrink-0"
        >
          {showCreateJoin ? "✕ Закрыть" : "+ Создать / Вступить"}
        </button>
      </div>

      {/* Create / Join Form Drawer */}
      <AnimatePresence>
        {showCreateJoin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0c0c0e] p-6 rounded-3xl border border-white/5">
              {/* Create Team Form */}
              <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 block">
                  Создать новую команду или дуэт
                </span>

                {/* Format switcher (5x5 / 2x2) */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setNewTeamFormat("5vs5")}
                    className={cn(
                      "py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                      newTeamFormat === "5vs5"
                        ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    5x5 Команда
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTeamFormat("2vs2")}
                    className={cn(
                      "py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                      newTeamFormat === "2vs2"
                        ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    2x2 Дуэт
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Название..."
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="col-span-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                  />
                  <input
                    type="text"
                    placeholder="Тег [TAG]..."
                    maxLength={8}
                    value={newTeamTag}
                    onChange={(e) => setNewTeamTag(e.target.value.toUpperCase())}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-orange-500"
                  />
                </div>
                <button
                  onClick={handleCreateTeam}
                  disabled={submitting || !newTeamName.trim()}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
                >
                  {submitting ? "Создание..." : `Создать ${newTeamFormat === "2vs2" ? "дуэт (2x2)" : "команду (5x5)"}`}
                </button>
              </div>

              {/* Join Team Form */}
              <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 block mb-2">
                    Вступить по инвайт-коду
                  </span>
                  <input
                    type="text"
                    placeholder="Код приглашения (например: ABCD12)..."
                    value={joinInviteCode}
                    onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500 uppercase"
                  />
                </div>
                <button
                  onClick={handleJoinTeam}
                  disabled={submitting || !joinInviteCode.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-colors mt-2"
                >
                  {submitting ? "Вступление..." : "Вступить по коду"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Team Card View */}
      {teams.length === 0 ? (
        <div className="bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-12 text-center space-y-4">
          <div className="text-4xl font-black text-white/5 select-none">[ — ]</div>
          <h3 className="text-lg font-black uppercase italic tracking-tight text-white">
            Вы пока не состоите в команде
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            Создайте свою команду 5x5 или дуэт 2x2 для участия в турнирах, либо вступите по инвайт-коду.
          </p>
          <button
            onClick={() => setShowCreateJoin(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl transition-colors shadow-lg shadow-orange-500/20"
          >
            + Создать команду
          </button>
        </div>
      ) : activeTeam && (
        <div className="space-y-6">
          {/* Top Team Dashboard (Stats & Actions) */}
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Identity */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                  {activeTeam.logoUrl ? (
                    <img src={activeTeam.logoUrl} alt={activeTeam.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-black text-orange-500">
                      {activeTeam.name.substring(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-2xl font-black uppercase italic tracking-tight text-white truncate">
                      {activeTeam.name}
                    </h3>
                    {activeTeam.tag && (
                      <span className="text-xs font-mono font-black text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-lg">
                        [{activeTeam.tag}]
                      </span>
                    )}
                    <span className={cn(
                      "text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-lg border",
                      isDuo ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                    )}>
                      {isDuo ? "2x2 DUO" : "5x5 TEAM"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                    <span>Состав: {members.length} / {maxTotalSlots} игроков</span>
                    <span>•</span>
                    <span className="text-orange-400 font-black">Средний ELO: ~{activeTeam.avgElo} ELO</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {isCaptain ? (
                  <>
                    <button
                      onClick={handleOpenEditModal}
                      className="text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3.5 py-2.5 rounded-xl transition-colors"
                    >
                      Настройки
                    </button>
                    <button
                      onClick={handleDisbandTeam}
                      className="text-[10px] font-black uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3.5 py-2.5 rounded-xl transition-colors"
                    >
                      Распустить
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleLeaveTeam}
                    className="text-[10px] font-black uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3.5 py-2.5 rounded-xl transition-colors"
                  >
                    Покинуть команду
                  </button>
                )}
              </div>
            </div>

            {/* Quick Invite Box */}
            {activeTeam.joinCode && (
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-0.5">
                    Инвайт-код для прямого вступления
                  </span>
                  <span className="text-sm font-mono font-black text-amber-400 tracking-wider">
                    {activeTeam.joinCode}
                  </span>
                </div>

                <button
                  onClick={handleCopyInviteLink}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-3.5 py-2 rounded-xl transition-all border",
                    copiedLink
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white/10 hover:bg-white/20 text-white border-white/10"
                  )}
                >
                  {copiedLink ? "✓ Ссылка скопирована" : "Скопировать ссылку-инвайт"}
                </button>
              </div>
            )}
          </div>

          {/* Rosters (Main + Reserve) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* MAIN ROSTER */}
            <div className="bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-6 sm:p-8 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-xs font-black uppercase tracking-widest text-orange-500">
                  Основной состав ({mainRoster.length} / {maxMain})
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                  {isDuo ? "Стартовый дуэт" : "Стартовая пятерка"}
                </span>
              </div>

              <div className="space-y-3">
                {mainRoster.map((m: any, idx: number) => {
                  const isMemCaptain = Boolean(
                    m.isCaptain || (activeTeam?.captainPhone && m.phone === activeTeam.captainPhone)
                  );
                  const memberDisplayName = m.nickname || m.fullName;

                  return (
                    <div
                      key={m.playerId || m.id || idx}
                      className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-4 group hover:border-white/15 transition-all"
                    >
                      {/* Left: Nickname + Stats */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => onSelectPlayer(m.playerId || m.id, memberDisplayName)}
                            className="text-sm font-bold text-white hover:text-orange-400 transition-colors inline-flex items-center gap-1 text-left truncate"
                          >
                            <span className="truncate">{memberDisplayName}</span>
                            <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">↗</span>
                          </button>
                          {isMemCaptain && (
                            <span className="text-[11px] font-mono font-black uppercase tracking-wider text-orange-400">
                              капитан
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 font-semibold uppercase tracking-wider mt-1 whitespace-nowrap">
                          <span className={m.faceitElo ? "text-orange-400 font-bold" : "text-gray-500"}>
                            {m.faceitElo ? `${m.faceitElo} ELO` : "1000 ELO"}
                          </span>
                          <span className="text-gray-600">•</span>
                          <span className={m.hasSteam ? "text-emerald-400" : "text-amber-500"}>
                            {m.hasSteam ? "Steam OK" : "Нет Steam"}
                          </span>
                        </div>
                      </div>

                      {/* Right: Captain controls */}
                      {isCaptain && !isMemCaptain && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleSetRole(m.playerId || m.id, "sub")}
                            className="text-[10px] font-black uppercase tracking-wider text-blue-400 hover:text-white hover:bg-blue-600/30 bg-blue-500/10 px-2.5 py-1.5 rounded-xl transition-all border border-blue-500/20 whitespace-nowrap"
                            title="Перевести в запасные"
                          >
                            В запас
                          </button>
                          <button
                            onClick={() => handleTransferCaptain(m.playerId || m.id, memberDisplayName)}
                            className="text-[10px] font-black uppercase tracking-wider text-amber-400 hover:text-white hover:bg-amber-600/30 bg-amber-500/10 px-2.5 py-1.5 rounded-xl transition-all border border-amber-500/20 whitespace-nowrap"
                            title="Сделать капитаном"
                          >
                            Капитан
                          </button>
                          <button
                            onClick={() => handleKickMember(m.playerId || m.id, memberDisplayName)}
                            className="text-[10px] font-black uppercase tracking-wider text-red-400 hover:text-white hover:bg-red-600/40 bg-red-500/10 px-2.5 py-1.5 rounded-xl transition-all border border-red-500/30 whitespace-nowrap"
                            title="Удалить из команды"
                          >
                            ✕ Удалить
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RESERVE / SUB ROSTER */}
            <div className="bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-6 sm:p-8 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-xs font-black uppercase tracking-widest text-blue-400">
                  {isDuo ? `Запасной игрок (${subRoster.length} / ${maxSub})` : `Запасные игроки (${subRoster.length} / ${maxSub})`}
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                  Stand-in слоты
                </span>
              </div>

              {subRoster.length === 0 ? (
                <div className="bg-black/30 border border-white/5 rounded-2xl p-6 text-center text-gray-500 text-xs font-medium">
                  В запасе пока нет игроков. Вы можете переводить игроков из основы кнопкой «В запас» или приглашать свободных агентов.
                </div>
              ) : (
                <div className="space-y-3">
                  {subRoster.map((m: any, idx: number) => {
                    const isMemCaptain = Boolean(
                      m.isCaptain || (activeTeam?.captainPhone && m.phone === activeTeam.captainPhone)
                    );
                    const memberDisplayName = m.nickname || m.fullName;

                    return (
                      <div
                        key={m.playerId || m.id || idx}
                        className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-4 group hover:border-white/15 transition-all"
                      >
                        {/* Left: Nickname + Stats */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => onSelectPlayer(m.playerId || m.id, memberDisplayName)}
                              className="text-sm font-bold text-white hover:text-orange-400 transition-colors inline-flex items-center gap-1 text-left truncate"
                            >
                              <span className="truncate">{memberDisplayName}</span>
                              <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">↗</span>
                            </button>
                            <span className="text-[11px] font-mono font-black uppercase tracking-wider text-blue-400">
                              запас
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-400 font-semibold uppercase tracking-wider mt-1 whitespace-nowrap">
                            <span className={m.faceitElo ? "text-orange-400 font-bold" : "text-gray-500"}>
                              {m.faceitElo ? `${m.faceitElo} ELO` : "1000 ELO"}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className={m.hasSteam ? "text-emerald-400" : "text-amber-500"}>
                              {m.hasSteam ? "Steam OK" : "Нет Steam"}
                            </span>
                          </div>
                        </div>

                        {/* Right: Captain controls */}
                        {isCaptain && !isMemCaptain && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {mainRoster.length < maxMain && (
                              <button
                                onClick={() => handleSetRole(m.playerId || m.id, "player")}
                                className="text-[10px] font-black uppercase tracking-wider text-emerald-400 hover:text-white hover:bg-emerald-600/30 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl transition-all border border-emerald-500/20 whitespace-nowrap"
                                title="Перевести в основу"
                              >
                                В основу
                              </button>
                            )}
                            <button
                              onClick={() => handleTransferCaptain(m.playerId || m.id, memberDisplayName)}
                              className="text-[10px] font-black uppercase tracking-wider text-amber-400 hover:text-white hover:bg-amber-600/30 bg-amber-500/10 px-2.5 py-1.5 rounded-xl transition-all border border-amber-500/20 whitespace-nowrap"
                              title="Сделать капитаном"
                            >
                              Капитан
                            </button>
                            <button
                              onClick={() => handleKickMember(m.playerId || m.id, memberDisplayName)}
                              className="text-[10px] font-black uppercase tracking-wider text-red-400 hover:text-white hover:bg-red-600/40 bg-red-500/10 px-2.5 py-1.5 rounded-xl transition-all border border-red-500/30 whitespace-nowrap"
                              title="Удалить из команды"
                            >
                              ✕ Удалить
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3. OUTGOING PENDING INVITATIONS (Visible to Captain) */}
          {isCaptain && activeTeamOutgoingInvites.length > 0 && (
            <div className="bg-[#0c0c0e] border border-amber-500/20 rounded-[2.5rem] p-6 sm:p-8 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Ожидающие приглашения ({activeTeamOutgoingInvites.length})
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                  Игроки еще не подтвердили участие
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeTeamOutgoingInvites.map((inv) => {
                  const targetDisplayName = inv.nickname || inv.fullName;
                  return (
                    <div
                      key={inv.id}
                      className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between gap-3 group hover:border-white/10 transition-all"
                    >
                      <div className="min-w-0">
                        <button
                          onClick={() => onSelectPlayer(inv.playerId, targetDisplayName)}
                          className="text-xs font-bold text-white hover:text-orange-400 transition-colors block truncate text-left"
                        >
                          {targetDisplayName}
                        </button>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                          <span className="text-orange-400">{inv.faceitElo} ELO</span>
                          <span>•</span>
                          <span className="text-amber-400 font-medium">Ожидает ответа</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCancelInvite(inv.id)}
                        className="text-[9px] font-black uppercase tracking-wider bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 px-3 py-1.5 rounded-xl transition-all shrink-0"
                      >
                        Отозвать
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. FREE AGENTS / LFT MARKET */}
          {members.length < maxTotalSlots && lftPlayers.length > 0 && (
            <div className="bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-6 sm:p-8 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                  Свободные агенты клуба (Ищут команду LFT)
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                  Свободно слотов: {maxTotalSlots - members.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {lftPlayers.map((lft) => {
                  const lftDisplayName = lft.nickname || lft.fullName;
                  const isInviting = invitingPlayerId === lft.id;
                  const alreadyInvited = lft.hasPendingInvite;

                  return (
                    <div
                      key={lft.id}
                      className="bg-white/5 p-3.5 rounded-2xl border border-white/5 flex items-center justify-between gap-3 group hover:border-white/15 transition-all"
                    >
                      <div className="min-w-0">
                        <button
                          onClick={() => onSelectPlayer(lft.id, lftDisplayName)}
                          className="text-xs font-bold text-white hover:text-orange-400 transition-colors block truncate text-left"
                        >
                          {lftDisplayName}
                        </button>
                        <span className="text-[9px] font-black uppercase text-orange-400 block mt-0.5">
                          {lft.faceitElo} ELO
                        </span>
                      </div>

                      {isCaptain && (
                        alreadyInvited ? (
                          <span className="text-[9px] font-black uppercase tracking-wider text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg shrink-0">
                            Отправлено
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInviteLftPlayer(lft.id)}
                            disabled={isInviting}
                            className="text-[9px] font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-xl transition-colors shrink-0 shadow-sm"
                          >
                            {isInviting ? "..." : "+ Пригласить"}
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Team Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0c0c0e] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h3 className="text-base font-black uppercase italic tracking-tight text-white">
                  Настройки команды
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-500 hover:text-white text-xs font-black uppercase"
                >
                  ✕
                </button>
              </div>

              {/* Format Switcher */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                  Формат дисциплины
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setEditTeamFormat("5vs5")}
                    className={cn(
                      "py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                      editTeamFormat === "5vs5"
                        ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    5x5 Команда
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTeamFormat("2vs2")}
                    className={cn(
                      "py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                      editTeamFormat === "2vs2"
                        ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    2x2 Дуэт
                  </button>
                </div>
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                  Логотип команды
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                    {editTeamLogoUrl ? (
                      <img src={editTeamLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-black text-orange-500">
                        {editTeamName.substring(0, 1).toUpperCase() || "T"}
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {uploadingLogo ? "Загрузка..." : "Загрузить лого"}
                  </button>
                </div>
              </div>

              {/* Team Name & Tag */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                    Название команды
                  </label>
                  <input
                    type="text"
                    value={editTeamName}
                    onChange={(e) => setEditTeamName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-bold focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                    Тег команды [TAG]
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="Например: NAVI, VP..."
                    value={editTeamTag}
                    onChange={(e) => setEditTeamTag(e.target.value.toUpperCase())}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-black uppercase text-xs tracking-widest py-3 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveTeamEdits}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-xs tracking-widest py-3 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
                >
                  Сохранить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <TournamentNotificationModal
        data={modalNotification}
        onClose={() => setModalNotification(null)}
      />
    </div>
  );
}
