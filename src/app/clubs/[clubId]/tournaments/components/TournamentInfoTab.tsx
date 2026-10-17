"use client";
import React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Settings,
  Edit,
  Trash2,
  Trophy,
  Users,
  Shield,
  Clock,
  Coins,
  MapPin,
  Layers,
} from "lucide-react";
import { Tournament, formatTypeLabel } from "../types";
import { Button } from "@/components/ui/button";
import { formatDotaGameMode } from "@/lib/dota/utils";

interface TournamentInfoTabProps {
  clubId: string;
  tournament: Tournament;
  onDelete: () => void;
}

export function TournamentInfoTab({
  clubId,
  tournament,
  onDelete,
}: TournamentInfoTabProps) {
  const router = useRouter();

  const isTeam = tournament.type === "2vs2" || tournament.type === "5vs5";
  const feeType = tournament.config?.entryFeeType || "player";
  const mapPool = tournament.config?.mapPool || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Main Parameters Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Параметры и настройки турнира
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Техническая конфигурация дисциплины
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Discipline */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-1 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Дисциплина
            </span>
            <span className="text-sm font-black uppercase text-slate-900 block">
              {tournament.discipline?.toLowerCase() === "dota2"
                ? "Dota 2"
                : tournament.discipline?.toUpperCase() || "CS2"}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Киберспортивный режим
            </span>
          </div>

          {/* Format */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-1 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Формат состава
            </span>
            <span className="text-sm font-black uppercase text-slate-900 block">
              {formatTypeLabel(tournament.type)}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {isTeam ? "Командное участие" : "Одиночный зачет"}
            </span>
          </div>

          {/* Bracket Type */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-1 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Формат турнирной сетки
            </span>
            <span className="text-sm font-black uppercase text-slate-900 block">
              {tournament.config?.bracketType === "double_elimination"
                ? "Double Elimination"
                : tournament.config?.bracketType === "round_robin"
                ? "Round Robin (Группы)"
                : "Single Elimination"}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Олимпийская сетка
            </span>
          </div>

          {/* Match Format (bo1 / bo3) */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-1 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Режим матчей
            </span>
            <span className="text-sm font-black uppercase text-slate-900 block">
              {(tournament.config?.matchFormat || "bo1").toUpperCase()}
              {tournament.config?.semiFinalFormat &&
                tournament.config?.semiFinalFormat !==
                  tournament.config?.matchFormat && (
                  <span className="text-xs font-normal text-slate-500 ml-1">
                    (1/2: {tournament.config.semiFinalFormat.toUpperCase()})
                  </span>
                )}
              {tournament.config?.grandFinalFormat &&
                tournament.config?.grandFinalFormat !==
                  tournament.config?.matchFormat && (
                  <span className="text-xs font-normal text-slate-500 ml-1">
                    (Финал: {tournament.config.grandFinalFormat.toUpperCase()})
                  </span>
                )}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Количество карт в серии
            </span>
          </div>

          {/* Entry Fee */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-1 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Взнос за участие
            </span>
            <span className="text-sm font-black uppercase text-slate-900 block">
              {parseFloat(String(tournament.entry_fee || 0)) > 0
                ? `${tournament.entry_fee} ₽`
                : "Бесплатно"}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {isTeam
                ? feeType === "team"
                  ? "С команды целиком"
                  : "С каждого игрока"
                : "С одного участника"}
            </span>
          </div>

          {/* Club Share */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-1 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Комиссия клуба
            </span>
            <span className="text-sm font-black uppercase text-orange-600 block">
              {tournament.club_share_pct || 0}%
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Удержание с взносов
            </span>
          </div>

          {/* Max Participants */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-1 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Лимит участников
            </span>
            <span className="text-sm font-black uppercase text-slate-900 block">
              {tournament.config?.maxParticipants || "16"} слотов
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Размер турнирной сетки
            </span>
          </div>

          {/* Start Date */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-1 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Дата и время старта
            </span>
            <span className="text-sm font-black text-slate-900 block truncate">
              {tournament.starts_at
                ? new Date(tournament.starts_at).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Не указана"}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Время запуска первого раунда
            </span>
          </div>
        </div>

        {/* Map Pool if CS2 */}
        {tournament.discipline === "cs2" && mapPool.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Пул соревновательных карт (Map Pool)
            </span>
            <div className="flex flex-wrap gap-2">
              {mapPool.map((mapName: string) => (
                <span
                  key={mapName}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono font-bold rounded-xl uppercase"
                >
                  {mapName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Dota 2 Lobby Parameters */}
        {tournament.discipline === "dota2" && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Параметры лобби Dota 2
            </span>
            <div className="flex flex-wrap gap-2.5">
              <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                <span className="text-slate-400 mr-1.5">Режим:</span>
                <span className="font-semibold text-slate-900">
                  {formatDotaGameMode(tournament.config?.gameMode, tournament.type, tournament.config)}
                </span>
              </div>
              <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                <span className="text-slate-400 mr-1.5">Сервер:</span>
                <span className="font-semibold text-slate-900">
                  {tournament.config?.serverRegion === "STOCKHOLM"
                    ? "Стокгольм (Stockholm)"
                    : tournament.config?.serverRegion || "Автоматически"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Tournament Rules Block */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Регламент и правила турнира
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Публичный регламент для участников клуба
            </p>
          </div>
        </div>

        {tournament.rules ? (
          <div className="bg-white border border-slate-200 p-6 rounded-2xl text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap font-sans">
            {tournament.rules}
          </div>
        ) : (
          <div className="bg-white border border-dashed border-slate-200 p-8 rounded-2xl text-center text-xs text-slate-400">
            Текст регламента не указан. Вы можете добавить правила турнира через кнопку «Редактировать».
          </div>
        )}
      </div>
    </div>
  );
}
