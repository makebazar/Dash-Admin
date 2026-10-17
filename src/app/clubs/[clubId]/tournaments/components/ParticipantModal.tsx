"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TournamentParticipant } from "../types";

interface ParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    fullName: string;
    nickname?: string;
    phoneNumber: string;
    steamId?: string;
    faceitElo?: string;
    dotaMmr?: string;
    faceitLink?: string;
  }) => Promise<void>;
  onDelete?: (id: string) => void;
  participant?: TournamentParticipant | null;
}

export function ParticipantModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  participant,
}: ParticipantModalProps) {
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [steamId, setSteamId] = useState("");
  const [faceitElo, setFaceitElo] = useState("");
  const [dotaMmr, setDotaMmr] = useState("");
  const [faceitLink, setFaceitLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (participant) {
      setFullName(participant.full_name || "");
      setNickname(participant.nickname || "");
      setPhoneNumber(participant.phone_number || "");
      setSteamId(participant.steam_id || "");
      setFaceitElo(participant.faceit_elo ? String(participant.faceit_elo) : "");
      setDotaMmr(participant.dota_mmr ? String(participant.dota_mmr) : "");
      setFaceitLink(participant.faceit_link || "");
    } else {
      setFullName("");
      setNickname("");
      setPhoneNumber("");
      setSteamId("");
      setFaceitElo("");
      setDotaMmr("");
      setFaceitLink("");
    }
  }, [participant, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      alert("Укажите номер телефона участника");
      return;
    }
    setIsSubmitting(true);
    try {
      const cleanFaceitLink = faceitLink.trim();
      await onSave({
        id: participant?.id,
        fullName: fullName.trim(),
        nickname: nickname.trim(),
        phoneNumber: phoneNumber.trim(),
        steamId: steamId.trim(),
        faceitElo: cleanFaceitLink ? faceitElo.trim() : "",
        dotaMmr: dotaMmr.trim(),
        faceitLink: cleanFaceitLink,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Ошибка при сохранении участника");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header (No icons) */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {participant ? "Редактировать участника" : "Новый участник турниров"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Данные игрока для участия в турнирах клуба
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Имя и Фамилия
              </label>
              <input
                type="text"
                placeholder="Иван Иванов"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Игровой никнейм
              </label>
              <input
                type="text"
                placeholder="s1mple, Miracle-..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Номер телефона <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="+7 (999) 000-00-00"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Steam ID (17 цифр) или ссылка на профиль
            </label>
            <input
              type="text"
              placeholder="76561198000000000 или https://steamcommunity.com/id/..."
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-slate-900 transition-colors"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Необходим для инвайтов в лобби Dota 2 и подключения к CS2
            </p>
          </div>

          {/* Faceit Link */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Ссылка на профиль Faceit
            </label>
            <input
              type="url"
              placeholder="https://www.faceit.com/ru/players/..."
              value={faceitLink}
              onChange={(e) => {
                const val = e.target.value;
                setFaceitLink(val);
                if (!val.trim()) {
                  setFaceitElo("");
                }
              }}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-slate-900 transition-colors"
            />
            {!faceitLink.trim() && participant?.faceit_link && (
              <p className="text-[11px] text-amber-600 mt-1 font-medium">
                Ссылка очищена — Faceit будет отвязан при сохранении
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                CS2: Faceit ELO
              </label>
              <input
                type="number"
                placeholder="1000"
                value={faceitElo}
                onChange={(e) => setFaceitElo(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Dota 2: MMR
              </label>
              <input
                type="number"
                placeholder="3000"
                value={dotaMmr}
                onChange={(e) => setDotaMmr(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {participant && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(participant.id);
                  onClose();
                }}
                className="text-xs font-semibold text-rose-500 hover:text-rose-700 hover:underline transition-colors cursor-pointer py-2"
              >
                Отвязать от клуба
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
                  : participant
                  ? "Сохранить изменения"
                  : "Добавить участника"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
