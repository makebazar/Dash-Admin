"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMatchPointBreakdown } from "@/lib/promo-frag-utils";

const formatPrizeText = (prize: any) => {
  if (!prize) return '—';
  const parts: string[] = [];
  if (prize.reward > 0) parts.push(`${prize.reward} ₽`);
  if (prize.textPrize) parts.push(prize.textPrize);
  return parts.length > 0 ? parts.join(' + ') : '—';
};

export default function TournamentDetailPage() {
  const { clubId, playerId, tournamentId } = useParams();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/clubs/${clubId}/players/${playerId}/esports`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          const found = json.dashfragTournaments?.find((t: any) => String(t.id) === String(tournamentId));
          setTournament(found || null);
        }
      } catch (err) {
        console.error("Error loading tournament details:", err);
      } finally {
        setIsLoading(false);
      }
    }
    if (clubId && playerId && tournamentId) {
      fetchData();
    }
  }, [clubId, playerId, tournamentId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] text-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] p-8 text-slate-900 space-y-4">
        <p className="text-lg font-semibold text-slate-900">
          Турнир не найден или у игрока нет матчей в данном турнире.
        </p>
        <button
          onClick={() => router.push(`/clubs/${clubId}/players/${playerId}`)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-colors shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Назад в профиль
        </button>
      </div>
    );
  }

  const stats = tournament.stats;
  const isFinished = tournament.status !== 'active' || new Date() > new Date(tournament.end_date);
  const isQualified = stats.matchesCount >= tournament.min_matches;

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] flex-col font-sans text-slate-900 selection:bg-black/10">
      <main className="mx-auto max-w-6xl w-full flex-1 px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16 space-y-6">
        {/* Back button */}
        <div>
          <button
            onClick={() => router.push(`/clubs/${clubId}/players/${playerId}`)}
            className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium text-xs transition-colors bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Назад в профиль игрока</span>
          </button>
        </div>

        {/* Main Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
          <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-100 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  "text-[11px] font-semibold px-2.5 py-0.5 rounded-md",
                  isFinished ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                )}>
                  {isFinished ? 'Завершен' : 'Активен'}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {tournament.game === 'ALL' ? 'Мульти-дисциплина' : tournament.game}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {tournament.title}
              </h1>
              <div className="text-xs text-slate-500 font-medium mt-1">
                Период: {new Date(tournament.start_date).toLocaleDateString()} — {new Date(tournament.end_date).toLocaleDateString()}
              </div>
            </div>

            {/* TP Badge */}
            <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 text-center min-w-[130px]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Итого TP</div>
              <div className="text-3xl font-bold leading-none">{stats.points}</div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Место в рейтинге</div>
              <div className="text-xl font-bold text-slate-900">
                {tournament.rank ? `#${tournament.rank} из ${tournament.totalPlayers}` : '—'}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Приз</div>
              <div className="text-xl font-bold text-slate-900">
                {formatPrizeText(tournament.myPrize)}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Квалификация</div>
              <div className="text-sm font-bold text-slate-900">
                {isQualified ? `Пройдена (${stats.matchesCount}/${tournament.min_matches})` : `Осталось ${tournament.min_matches - stats.matchesCount} каток`}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Статистика</div>
              <div className="text-sm font-bold text-slate-900">
                {stats.wins}W - {stats.losses}L ({stats.totalKills}/{stats.totalDeaths}/{stats.totalAssists})
              </div>
            </div>
          </div>
        </div>

        {/* Top 15 Matches Section */}
        <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Топ-15 лучших матчей
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Список матчей, вошедших в итоговый зачёт очков турнира.
            </p>
          </div>

          <div className="space-y-4">
            {stats.bestMatches?.length > 0 ? (
              stats.bestMatches.map((mInfo: any, index: number) => {
                const m = mInfo.match;
                const pts = mInfo.points;
                const dateStr = new Date(m.played_at).toLocaleDateString();
                const timeStr = new Date(m.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const breakdown = getMatchPointBreakdown(m);

                return (
                  <div
                    key={m.id || index}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 hover:border-slate-300 transition-colors shadow-xs"
                  >
                    {/* Top Line */}
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                          #{index + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">
                            {m.game} {m.map ? `• ${m.map}` : ''}
                          </div>
                          <div className="text-xs text-slate-500 font-medium">
                            {dateStr} в {timeStr}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-[10px] font-semibold uppercase text-slate-400">Счёт</div>
                          <div className="text-sm font-semibold text-slate-900">{m.score || '—'}</div>
                        </div>

                        <div className="text-center">
                          <div className="text-[10px] font-semibold uppercase text-slate-400">K / D / A</div>
                          <div className="text-sm font-mono font-semibold text-slate-900">
                            {m.kills || 0} / {m.deaths || 0} / {m.assists || 0}
                          </div>
                        </div>

                        <div className="bg-slate-900 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shrink-0">
                          +{pts} TP
                        </div>
                      </div>
                    </div>

                    {/* Complete Points Breakdown Grid */}
                    {breakdown.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Детализация всех очков (PTS):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {breakdown.map((item: any, idx: number) => {
                            const ptsText = item.points > 0 ? `+${item.points} TP` : `${item.points} TP`;
                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800"
                              >
                                <span className="truncate mr-2">{item.title}</span>
                                <span className={cn(
                                  "font-bold shrink-0",
                                  item.points < 0 ? "text-slate-500" : "text-slate-900"
                                )}>
                                  {ptsText}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-400 font-medium">
                Нет матчей в зачёте.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
