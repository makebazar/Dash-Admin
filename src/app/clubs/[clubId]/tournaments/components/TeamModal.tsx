"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PromoTeam, TournamentParticipant } from "../types";

interface ModalMember {
  phone: string;
  fullName?: string;
  nickname?: string;
}

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: number;
    name: string;
    tag?: string;
    formatType: string;
    captainPhone: string;
    members: string[];
  }) => Promise<void>;
  onDelete?: (id: number) => void;
  onRequestRename?: (teamId: number, reason?: string) => Promise<void>;
  onCancelRename?: (teamId: number) => Promise<void>;
  team?: PromoTeam | null;
  participants?: TournamentParticipant[];
}

export function TeamModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onRequestRename,
  onCancelRename,
  team,
  participants = [],
}: TeamModalProps) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [formatType, setFormatType] = useState("5vs5");
  const [captainPhone, setCaptainPhone] = useState("");
  const [members, setMembers] = useState<ModalMember[]>([]);
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rename request state
  const [showRenameBox, setShowRenameBox] = useState(false);
  const [renameReason, setRenameReason] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (team) {
      setName(team.name || "");
      setTag(team.tag || "");
      setFormatType(team.format_type || "5vs5");
      const capPhone = team.captain_phone || "";
      setCaptainPhone(capPhone);

      const memList: ModalMember[] = [];
      const seen = new Set<string>();

      // If team members provided
      (team.members || []).forEach((m) => {
        if (!seen.has(m.phone)) {
          seen.add(m.phone);
          const matched = participants.find((p) => p.phone_number === m.phone);
          memList.push({
            phone: m.phone,
            fullName: m.fullName || matched?.full_name || "",
            nickname: m.nickname || matched?.nickname || "",
          });
        }
      });

      // If captain wasn't in members, add captain
      if (capPhone && !seen.has(capPhone)) {
        const matched = participants.find((p) => p.phone_number === capPhone);
        memList.unshift({
          phone: capPhone,
          fullName: team.captain_name || matched?.full_name || "",
          nickname: team.captain_nickname || matched?.nickname || "",
        });
      }

      setMembers(memList);
    } else {
      setName("");
      setTag("");
      setFormatType("5vs5");
      setCaptainPhone("");
      setMembers([]);
    }
    setNewMemberPhone("");
    setShowRenameBox(false);
    setRenameReason("");
  }, [team, isOpen, participants]);

  if (!isOpen) return null;

  const handleAddMember = () => {
    const clean = newMemberPhone.replace(/[^0-9+]/g, "").trim();
    if (!clean) return;
    if (members.some((m) => m.phone === clean)) {
      alert("Игрок с таким номером уже есть в составе команды");
      return;
    }

    const matched = participants.find((p) => p.phone_number === clean);
    const newEntry: ModalMember = {
      phone: clean,
      fullName: matched?.full_name || "",
      nickname: matched?.nickname || "",
    };

    // If there's no captain yet, first added player becomes captain
    if (!captainPhone) {
      setCaptainPhone(clean);
    }

    setMembers([...members, newEntry]);
    setNewMemberPhone("");
  };

  const handleRemoveMember = (phone: string) => {
    if (phone === captainPhone) {
      alert("Нельзя удалить капитана. Сначала назначьте другого игрока капитаном.");
      return;
    }
    setMembers(members.filter((m) => m.phone !== phone));
  };

  const handleMakeCaptain = (phone: string) => {
    setCaptainPhone(phone);
  };

  const handleSendRenameRequest = async () => {
    if (!team?.id || !onRequestRename) return;
    setIsRenaming(true);
    try {
      await onRequestRename(team.id, renameReason.trim() || undefined);
      setShowRenameBox(false);
      setRenameReason("");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleCancelRenameRequest = async () => {
    if (!team?.id || !onCancelRename) return;
    setIsRenaming(true);
    try {
      await onCancelRename(team.id);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Укажите название команды");
      return;
    }
    const cleanCap = captainPhone.replace(/[^0-9+]/g, "").trim();
    if (!cleanCap) {
      alert("Укажите или выберите капитана команды");
      return;
    }

    const otherMemberPhones = members
      .filter((m) => m.phone !== cleanCap)
      .map((m) => m.phone);

    setIsSubmitting(true);
    try {
      await onSave({
        id: team?.id,
        name: name.trim(),
        tag: tag.trim().toUpperCase() || undefined,
        formatType,
        captainPhone: cleanCap,
        members: otherMemberPhones,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Ошибка при сохранении команды");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {team ? "Редактировать команду" : "Новая команда"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Управление составом, капитаном и данными команды клуба
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-base font-bold"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Rename Request Banner (if pending) */}
          {team && team.rename_requested && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <span>⚠️</span>
                    <span>Запрошена смена названия у капитана</span>
                  </div>
                  <p className="text-[11px] text-amber-700 mt-1">
                    {team.rename_reason
                      ? `Причина: «${team.rename_reason}»`
                      : "Окно для ввода нового названия появится капитану команды при входе на сайт."}
                  </p>
                </div>
                {onCancelRename && (
                  <button
                    type="button"
                    disabled={isRenaming}
                    onClick={handleCancelRenameRequest}
                    className="text-[11px] text-amber-900 underline hover:text-black font-semibold shrink-0 cursor-pointer"
                  >
                    {isRenaming ? "Отмена..." : "Отменить запрос"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Team Name and Tag */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Название команды <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Cyber Sharks"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Клан-тег
              </label>
              <input
                type="text"
                placeholder="CS"
                maxLength={8}
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-mono uppercase focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>
          </div>

          {/* Rename request button / box (if not already requested) */}
          {team && !team.rename_requested && onRequestRename && (
            <div className="pt-0.5">
              {!showRenameBox ? (
                <button
                  type="button"
                  onClick={() => setShowRenameBox(true)}
                  className="text-xs text-amber-600 hover:text-amber-700 font-semibold underline transition-colors cursor-pointer"
                >
                  Запросить смену названия команды у капитана
                </button>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                  <div className="text-xs font-bold text-amber-900">
                    Запрос капитану на смену названия
                  </div>
                  <input
                    type="text"
                    placeholder="Причина запроса (например: некорректное название команды)"
                    value={renameReason}
                    onChange={(e) => setRenameReason(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-amber-200 bg-white text-xs font-medium focus:outline-none focus:border-amber-600 transition-colors"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isRenaming}
                      onClick={handleSendRenameRequest}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                    >
                      {isRenaming ? "Отправка..." : "Отправить запрос капитану"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRenameBox(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Format selection */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Формат команды
            </label>
            <select
              value={formatType}
              onChange={(e) => setFormatType(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-slate-900 transition-colors bg-white cursor-pointer"
            >
              <option value="5vs5">5vs5 (5 игроков)</option>
              <option value="2vs2">2vs2 (2 игрока)</option>
              <option value="solo">1vs1 (Solo)</option>
            </select>
          </div>

          {/* Members / Roster Section */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">
                Состав команды ({members.length} игроков)
              </label>
              <span className="text-[11px] text-slate-400">
                Любого игрока можно назначить капитаном
              </span>
            </div>

            {/* Members List */}
            {members.length > 0 ? (
              <div className="space-y-2 mb-3">
                {members.map((m) => {
                  const isCap = m.phone === captainPhone;

                  return (
                    <div
                      key={m.phone}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                        isCap
                          ? "bg-blue-50/50 border-blue-200/80"
                          : "bg-slate-50/70 border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      {/* Left: Info */}
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                            {m.fullName || "Без имени"}
                          </span>
                          {m.nickname && (
                            <span className="text-xs font-mono text-slate-500 font-medium truncate">
                              @{m.nickname}
                            </span>
                          )}
                          {isCap ? (
                            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-semibold text-[10px] tracking-wide uppercase">
                              Капитан
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 font-medium text-[10px]">
                              Игрок
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-600 mt-0.5">
                          {m.phone}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isCap ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleMakeCaptain(m.phone)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100/60 transition-colors cursor-pointer"
                              title="Сделать игрока капитаном этой команды"
                            >
                              ★ Сделать капитаном
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.phone)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Удалить из команды"
                            >
                              Удалить
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] font-semibold text-blue-600 pr-1">
                            Лидер команды
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500 mb-3">
                В составе команды пока нет игроков. Добавьте капитана и участников ниже.
              </div>
            )}

            {/* Add Member Row */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="+7 (999) 000-00-00 (телефон игрока)"
                value={newMemberPhone}
                onChange={(e) => setNewMemberPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddMember();
                  }
                }}
                className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono focus:outline-none focus:border-slate-900 transition-colors"
              />
              <button
                type="button"
                onClick={handleAddMember}
                className="h-11 px-4 rounded-xl border border-slate-300 hover:border-slate-800 text-slate-700 hover:text-black font-medium text-xs transition-colors cursor-pointer shrink-0"
              >
                + Добавить игрока
              </button>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {team && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(team.id);
                  onClose();
                }}
                className="text-xs font-semibold text-rose-500 hover:text-rose-700 hover:underline transition-colors cursor-pointer py-2"
              >
                Удалить команду
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-11 rounded-xl px-5 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 rounded-xl px-6 bg-black text-white hover:bg-slate-800 font-medium shadow-sm cursor-pointer"
              >
                {isSubmitting
                  ? "Сохранение..."
                  : team
                  ? "Сохранить изменения"
                  : "Создать команду"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
