"use client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface CaptainRenameModalProps {
  isOpen: boolean;
  team: {
    id: number | string;
    name: string;
    tag?: string | null;
    reason?: string | null;
  } | null;
  onClose?: () => void;
  onSuccess: () => Promise<void>;
}

export function CaptainRenameModal({
  isOpen,
  team,
  onClose,
  onSuccess,
}: CaptainRenameModalProps) {
  const [newName, setNewName] = useState(team?.name || "");
  const [newTag, setNewTag] = useState(team?.tag || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !team) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName.trim().length < 2) {
      setError("Укажите новое название команды (не менее 2 символов)");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename_team",
          teamId: team.id,
          newName: newName.trim(),
          newTag: newTag.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось изменить название команды");
      }
      await onSuccess();
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || "Ошибка при сохранении названия");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#121620] border border-amber-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl text-white">
        {/* Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/15 blur-3xl pointer-events-none rounded-full" />

        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/90 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-2">
            Запрос от администрации клуба
          </span>
          <h3 className="text-xl font-bold tracking-tight text-white">
            Смена названия команды
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Администрация клуба запросила изменить текущее название вашей команды{" "}
            <span className="font-semibold text-white">«{team.name}»</span>.
          </p>
        </div>

        {/* Reason Box */}
        {team.reason && (
          <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs">
            <span className="text-slate-400 block text-[11px] mb-0.5 font-medium">
              Причина запроса:
            </span>
            <span className="text-amber-200 font-medium">
              «{team.reason}»
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Новое название команды <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Введите новое название"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Новый клан-тег
            </label>
            <input
              type="text"
              maxLength={8}
              placeholder="TAG"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm font-mono uppercase text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Сохранение..." : "Сохранить новое название"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
