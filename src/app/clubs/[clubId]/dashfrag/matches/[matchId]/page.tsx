"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAP_THEMES: Record<string, { bg: string; text: string; badge: string }> = {
  de_mirage: {
    bg: "from-amber-600/90 via-orange-600/80 to-purple-900/90",
    text: "text-amber-300",
    badge: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  },
  de_dust2: {
    bg: "from-amber-700/90 via-yellow-600/80 to-stone-900/90",
    text: "text-amber-200",
    badge: "bg-amber-500/20 text-amber-200 border-amber-400/30",
  },
  de_inferno: {
    bg: "from-red-700/90 via-rose-600/80 to-neutral-900/90",
    text: "text-rose-200",
    badge: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  },
  de_nuke: {
    bg: "from-cyan-700/90 via-blue-600/80 to-slate-900/90",
    text: "text-cyan-200",
    badge: "bg-cyan-500/20 text-cyan-200 border-cyan-400/30",
  },
  de_ancient: {
    bg: "from-emerald-800/90 via-teal-700/80 to-slate-950/90",
    text: "text-emerald-200",
    badge: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  },
  de_anubis: {
    bg: "from-yellow-700/90 via-amber-600/80 to-stone-900/90",
    text: "text-yellow-200",
    badge: "bg-yellow-500/20 text-yellow-200 border-yellow-400/30",
  },
  de_overpass: {
    bg: "from-teal-700/90 via-emerald-600/80 to-slate-900/90",
    text: "text-teal-200",
    badge: "bg-teal-500/20 text-teal-200 border-teal-400/30",
  },
  default: {
    bg: "from-indigo-700/90 via-purple-700/80 to-slate-900/90",
    text: "text-indigo-200",
    badge: "bg-indigo-500/20 text-indigo-200 border-indigo-400/30",
  },
};

export default function MatchBreakdownPage() {
  const { clubId, matchId } = useParams();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (clubId && matchId) {
      fetch(`/api/clubs/${clubId}/dashfrag/matches/${matchId}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Match not found");
        })
        .then((json) => setData(json))
        .catch((err) => console.error("Fetch Match Error:", err))
        .finally(() => setIsLoading(false));
    }
  }, [clubId, matchId]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC] text-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!data || !data.match) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#F8FAFC] text-slate-900 space-y-4">
        <p className="text-xl font-bold">Информация о матче не найдена</p>
        <button
          onClick={() => router.back()}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold uppercase text-xs shadow-lg shadow-indigo-500/20"
        >
          Вернуться назад
        </button>
      </div>
    );
  }

  const { match, stats, roundByRound, eventsTimeline } = data;
  const mapKey = (match.map || "").toLowerCase();
  const theme = MAP_THEMES[mapKey] || MAP_THEMES.default;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-black uppercase tracking-wider transition-all shadow-sm max-w-fit"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            Назад к истории
          </button>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
            <span>Match ID: {match.id}</span>
            <span>•</span>
            <span>
              {match.playedAt
                ? new Date(match.playedAt).toLocaleString("ru-RU")
                : "Дата не указана"}
            </span>
          </div>
        </div>

        {/* Hero CS2 Map Banner */}
        <div className={cn("relative rounded-[2.5rem] p-8 md:p-12 text-white shadow-xl overflow-hidden bg-gradient-to-r", theme.bg)}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)] pointer-events-none" />

          <div className="relative z-10 space-y-8">
            {/* Top Info Bar */}
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="bg-white text-slate-950 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider italic shadow-md">
                  {match.game}
                </span>
                <span className={cn("border px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md", theme.badge)}>
                  {stats.platformTag}
                </span>
                {stats.isWin ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider backdrop-blur-md">
                    Победа в матче
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-red-500/20 border border-red-400/40 text-red-300 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider backdrop-blur-md">
                    Поражение
                  </span>
                )}
              </div>

              {/* Earned Bonus Badge */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 px-5 py-2 rounded-2xl flex items-center gap-3">
                <span className="text-xs uppercase font-bold text-white/70">Награда:</span>
                <span className="text-xl font-black text-emerald-300 font-mono">
                  +{stats.earnedBonus.toFixed(2)} ₽
                </span>
              </div>
            </div>

            {/* Score & Player Quick Card */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest font-black text-white/70">
                  Соревновательный счёт • {match.map}
                </div>
                <div className="flex items-baseline gap-6">
                  <span className="text-5xl md:text-7xl font-black italic tracking-tight font-mono text-white">
                    {match.score}
                  </span>
                  <span className={cn("text-2xl md:text-4xl font-black uppercase italic tracking-wider", theme.text)}>
                    {match.map}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-5 bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-3xl shrink-0">
                <div className="w-14 h-14 bg-white text-slate-950 font-black rounded-2xl flex items-center justify-center text-2xl shadow-lg italic shrink-0">
                  {match.playerName ? match.playerName.charAt(0).toUpperCase() : "P"}
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/60">
                    Киберспортсмен
                  </div>
                  <div className="text-lg font-black text-white">
                    {match.playerName}
                  </div>
                  <div className="text-xs text-white/70 font-mono">
                    {match.playerPhone}
                  </div>
                </div>
                {match.playerId && (
                  <Link
                    href={`/clubs/${clubId}/players/${match.playerId}`}
                    className="ml-3 bg-white text-slate-950 hover:bg-slate-100 font-black text-xs uppercase px-4 py-3 rounded-2xl shadow-md transition-all shrink-0"
                  >
                    Профиль ➔
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Combat Performance & HLTV Rating Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border border-indigo-800/50 p-6 rounded-3xl shadow-lg space-y-3 relative overflow-hidden">
            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
              HLTV Rating 2.0
            </div>
            <div className="text-4xl font-black italic font-mono text-white">
              {stats.hltvRating}
            </div>
            <div className="inline-block bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-black uppercase px-3 py-1 rounded-full">
              {stats.impactRatingTitle}
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              K / D / A
            </div>
            <div className="text-3xl font-black text-slate-900 italic font-mono">
              {stats.kills} / {stats.deaths} / {stats.assists}
            </div>
            <div className="text-xs text-indigo-600 font-bold">Фраги / Смерти / Ассисты</div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              K/D Ratio
            </div>
            <div className="text-3xl font-black text-indigo-600 italic">
              {stats.kdRatio}
            </div>
            <div className="text-xs text-slate-500 font-mono">Эффективность в бою</div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              % Headshots
            </div>
            <div className="text-3xl font-black text-amber-600 italic">
              {stats.headshotsPercent}%
            </div>
            <div className="text-xs text-slate-500 font-bold">{stats.headshots} хедшотов</div>
          </div>
          
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              ADR / Total Damage
            </div>
            <div className="text-3xl font-black text-rose-600 italic">
              {stats.adr || "—"}
            </div>
            <div className="text-xs text-slate-500 font-bold">{stats.totalDamage || 0} урона за {stats.roundsPlayed || 0} раундов</div>
          </div>
        </div>

        {/* Real Chronological "Ход матча" (Match Timeline) */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm space-y-8">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-6">
            <div>
              <h3 className="text-xl font-black uppercase italic text-slate-900">
                Ход матча (Хронологическая лента)
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Точная хронология событий по таймкодам от первого фрага до победы
              </p>
            </div>
          </div>

          {/* Round Progression Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>Счёт по раундам ({match.score})</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-3 h-3 bg-emerald-500 rounded-md" /> Победа
                </span>
                <span className="flex items-center gap-1.5 text-red-600">
                  <span className="w-3 h-3 bg-red-500 rounded-md" /> Поражение
                </span>
              </div>
            </div>

            <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-24 gap-2">
              {roundByRound && roundByRound.length > 0 ? (
                roundByRound.map((r: any) => (
                  <div
                    key={r.roundNum}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-xl border text-center font-mono font-bold text-xs h-12",
                      r.won
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-red-50 border-red-200 text-red-900"
                    )}
                    title={`Раунд ${r.roundNum}: ${r.won ? "Победа" : "Поражение"}`}
                  >
                    <span className="text-[10px] text-slate-400">#{r.roundNum}</span>
                    <span className="text-xs font-black">{r.won ? "W" : "L"}</span>
                  </div>
                ))
              ) : null}
            </div>
          </div>

          {/* Real Events List */}
          <div className="space-y-3 pt-2">
            {eventsTimeline && eventsTimeline.length > 0 ? (
              eventsTimeline.map((item: any, idx: number) => {
                const { timestamp, text, rewardText, eventType } = item;

                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border text-xs font-bold transition-colors",
                      eventType === "win"
                        ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 font-black shadow-xs"
                        : eventType === "mvp"
                        ? "bg-amber-50/70 border-amber-200 text-amber-900"
                        : eventType === "knife"
                        ? "bg-orange-50/70 border-orange-200 text-orange-900"
                        : eventType === "zeus"
                        ? "bg-yellow-50/70 border-yellow-200 text-yellow-900"
                        : eventType === "headshot"
                        ? "bg-indigo-50/50 border-indigo-100 text-slate-900"
                        : "bg-slate-50 border-slate-100 text-slate-700"
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      {timestamp && (
                        <span className="font-mono text-slate-500 text-[11px] bg-white px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs font-bold">
                          {timestamp}
                        </span>
                      )}
                      <span className="text-xs font-bold">{text}</span>
                    </div>

                    {rewardText && (
                      <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 shrink-0">
                        {rewardText}
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400 font-bold uppercase tracking-wider text-xs">
                Подробные события катки отсутствуют
              </div>
            )}
          </div>
        </div>

        {/* Detailed Weapon & Frag Arsenal Breakdown */}
        <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
          <div>
            <h3 className="text-xl font-black uppercase italic text-slate-900">
              Арсенал оружия и типы фрагментаций
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Подробный расклад попаданий по типам вооружения
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                Headshots
              </div>
              <div className="text-2xl font-black text-slate-900 italic font-mono">{stats.headshots}</div>
              <div className="text-[10px] font-bold text-slate-400">{stats.headshotsPercent}% от всех фрагов</div>
            </div>

            <div className="bg-orange-50/50 border border-orange-100 p-5 rounded-2xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                Ножи (Knife)
              </div>
              <div className="text-2xl font-black text-slate-900 italic font-mono">{stats.knifeKills}</div>
              <div className="text-[10px] font-bold text-slate-400">Убийства в ближнем бою</div>
            </div>

            <div className="bg-yellow-50/50 border border-yellow-100 p-5 rounded-2xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                Zeus (Taser)
              </div>
              <div className="text-2xl font-black text-slate-900 italic font-mono">{stats.zeusKills}</div>
              <div className="text-[10px] font-bold text-slate-400">Электрошокер</div>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                Основное оружие
              </div>
              <div className="text-2xl font-black text-slate-900 italic font-mono">{stats.regularRifleKills}</div>
              <div className="text-[10px] font-bold text-slate-400">Обычные фраги</div>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-2xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                MVP Звёзды
              </div>
              <div className="text-2xl font-black text-slate-900 italic font-mono">{stats.mvpCount}</div>
              <div className="text-[10px] font-bold text-slate-400">Лучший в раунде</div>
            </div>

            <div className="bg-purple-50/50 border border-purple-100 p-5 rounded-2xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-purple-600">
                Мульти-киллы
              </div>
              <div className="text-2xl font-black text-slate-900 italic font-mono">
                {stats.doubleKills + stats.tripleKills + stats.quadKills + stats.acesCount}
              </div>
              <div className="text-[10px] font-bold text-slate-400">2K / 3K / 4K / Ace</div>
            </div>

            <div className="bg-rose-50/50 border border-rose-100 p-5 rounded-2xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                Clutch Kills
              </div>
              <div className="text-2xl font-black text-slate-900 italic font-mono">{stats.clutchKills || 0}</div>
              <div className="text-[10px] font-bold text-slate-400">Фраги при &lt; 20 HP</div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                Бомбы (C4)
              </div>
              <div className="text-2xl font-black text-slate-900 italic font-mono">
                {stats.bombsPlanted || 0} / {stats.bombsDefused || 0}
              </div>
              <div className="text-[10px] font-bold text-slate-400">Поставлено / Разминировано</div>
            </div>

            <div className="bg-cyan-50/50 border border-cyan-100 p-5 rounded-2xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-cyan-600">
                Спец. фраги
              </div>
              <div className="text-2xl font-black text-slate-900 italic font-mono">
                {(stats.flashKills || 0) + (stats.smokeKills || 0)}
              </div>
              <div className="text-[10px] font-bold text-slate-400">Ослеплен / В дыму</div>
            </div>

            <div className="bg-green-50/50 border border-green-100 p-5 rounded-2xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-green-600">
                Эко-фраги
              </div>
              <div className="text-2xl font-black text-slate-900 italic font-mono">{stats.ecoKills || 0}</div>
              <div className="text-[10px] font-bold text-slate-400">Снаряжение &lt; 1500$</div>
            </div>
          </div>
        </div>

        {/* Weapons Breakdown */}
        {stats.weaponKills && Object.keys(stats.weaponKills).length > 0 && (
          <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
            <div>
              <h3 className="text-xl font-black uppercase italic text-slate-900">
                Оружейная статистика
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Количество фрагов с каждого вида оружия
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Object.entries(stats.weaponKills)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([weapon, count]) => (
                <div key={weapon} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-wider text-slate-700">{weapon.replace('weapon_', '')}</span>
                  <span className="text-lg font-black font-mono text-indigo-600">{count as number}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
