"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Clock,
  Award,
  BookOpen,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PromoHeader } from "../../components/PromoHeader";
import { BottomNav } from "../../components/BottomNav";

interface Tournament {
  id: number;
  title: string;
  game: "CS2" | "Dota2" | "ALL";
  start_date: string;
  end_date: string;
  min_matches: number;
  prizes: { place: number; reward?: any; text_prize?: string; description?: string }[];
  status: "active" | "completed";
  myStats?: {
    rank: number | null;
    points: number;
    matches_count: number;
    wins: number;
    losses: number;
    qualified: boolean;
  };
  leaderboard: any[];
  fullLeaderboardCount: number;
  description?: string;
}

export default function PlayerTournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [player, setPlayer] = useState<any>(null);
  const [showRules, setShowRules] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch player details
      const playerRes = await fetch("/api/promo/player");
      if (playerRes.ok) {
        const playerData = await playerRes.json();
        setPlayer(playerData.player);
      }

      // 2. Fetch tournaments
      const res = await fetch("/api/promo/tournaments");
      if (res.ok) {
        const data = await res.json();
        const list: Tournament[] = data.tournaments || [];
        setTournaments(list);
        
        // Default to active tournament, or first in list
        if (list.length > 0) {
          const active = list.find((t) => t.status === "active");
          setActiveTournament(active || list[0]);
          setSelectedTournamentId(active ? active.id : list[0].id);
        }
      }
    } catch (e) {
      console.error("Error loading tournament details:", e);
    } finally {
      // Set loading to false only after initial load finishes
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle switching selected tournament details view (e.g. looking at past completed ones)
  const handleSelectTournament = (id: number) => {
    const t = tournaments.find((x) => x.id === id);
    if (t) {
      setActiveTournament(t);
      setSelectedTournamentId(id);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const activeSeasons = tournaments.filter(t => t.status === "active");
  const pastSeasons = tournaments.filter(t => t.status === "completed");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* HEADER */}
      <PromoHeader initialPlayer={player} title="Турниры" />

      <div className="max-w-xl lg:max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {tournaments.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] border border-white/5 rounded-3xl p-6">
            <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="font-black uppercase italic text-sm text-gray-400">Сезоны не найдены</h3>
            <p className="text-xs text-gray-500 mt-1">Администрация еще не запускала рейтинговых кубков.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6">
              {/* TOURNAMENT SELECTOR DROPDOWN (if multiple exist) */}
              {tournaments.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-1">Выберите сезон</label>
                  <select
                    value={selectedTournamentId || ""}
                    onChange={(e) => handleSelectTournament(parseInt(e.target.value))}
                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-5 py-3.5 font-bold text-xs text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                  >
                    {activeSeasons.length > 0 && (
                      <optgroup label="Активные сезоны" className="bg-[#121214]">
                        {activeSeasons.map((t) => (
                          <option key={t.id} value={t.id}>{t.title} (Активен)</option>
                        ))}
                      </optgroup>
                    )}
                    {pastSeasons.length > 0 && (
                      <optgroup label="Завершенные сезоны" className="bg-[#121214]">
                        {pastSeasons.map((t) => (
                          <option key={t.id} value={t.id}>{t.title} (Архив)</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              {/* DETAILED ACTIVE VIEW */}
              {activeTournament && (
                <>
                  {/* TOURNAMENT MAIN CARD */}
                  <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/20 via-slate-900/60 to-purple-950/20 border border-indigo-500/20 rounded-[2rem] p-6 shadow-[0_0_30px_rgba(99,102,241,0.03)] space-y-4">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="flex justify-between items-start gap-2 relative z-10">
                      <div className="space-y-1.5">
                        <span className={cn(
                          "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider",
                          activeTournament.game === "CS2" ? "bg-orange-500/10 text-orange-400" : activeTournament.game === "Dota2" ? "bg-red-500/10 text-red-400" : "bg-purple-500/10 text-purple-400"
                        )}>
                          {activeTournament.game === "ALL" ? "CS2 + Dota2" : activeTournament.game}
                        </span>
                        <h2 className="text-lg font-black uppercase italic leading-tight text-white">{activeTournament.title}</h2>
                        {activeTournament.description && (
                          <p className="text-[10px] text-gray-400 font-medium leading-relaxed mt-1 max-w-[280px]">
                            {activeTournament.description}
                          </p>
                        )}
                        <div className="text-[10px] text-gray-500 flex items-center gap-1.5 font-bold">
                          <Clock className="w-3.5 h-3.5 text-gray-600" />
                          <span>{formatDate(activeTournament.start_date)} — {formatDate(activeTournament.end_date)}</span>
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-2xl px-3 py-1.5 text-center shrink-0">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Статус</span>
                        <div className={cn(
                          "text-[10px] font-black uppercase mt-0.5",
                          activeTournament.status === "active" ? "text-emerald-400" : "text-gray-500"
                        )}>
                          {activeTournament.status === "active" ? "Активен" : "Завершен"}
                        </div>
                      </div>
                    </div>

                    {/* Personal Rating details */}
                    <div className="grid grid-cols-3 gap-3 bg-white/[0.01] border border-white/5 p-4 rounded-2xl relative z-10 text-center">
                      <div>
                        <div className="text-[8px] uppercase tracking-wider text-gray-500 font-bold">Очки (PTS)</div>
                        <div className="text-base font-black text-indigo-400 mt-0.5">
                          {activeTournament.myStats?.points ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] uppercase tracking-wider text-gray-500 font-bold">Место в клубе</div>
                        <div className="text-base font-black text-white mt-0.5">
                          {activeTournament.myStats?.rank ? `#${activeTournament.myStats.rank}` : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] uppercase tracking-wider text-gray-500 font-bold">Квалификация</div>
                        <div className={cn(
                          "text-[10px] font-black uppercase mt-1.5",
                          activeTournament.myStats?.qualified ? "text-green-400" : "text-orange-400"
                        )}>
                          {activeTournament.myStats?.qualified ? "Пройдена" : `${activeTournament.myStats?.matches_count ?? 0}/${activeTournament.min_matches} игр`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 text-xs text-gray-400 pt-2 border-t border-white/5 relative z-10">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-gray-500" />
                        <span>Участвуют все игроки автоматически</span>
                      </span>
                      <button
                        onClick={() => setShowRules(!showRules)}
                        className="text-[10px] font-black uppercase italic tracking-wider text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        {showRules ? "Скрыть формулу" : "Как копить PTS"}
                      </button>
                    </div>
                  </div>

                  {/* RULES / FORMULA EXPLAINER */}
                  <AnimatePresence>
                    {showRules && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-[#121214] border border-white/5 p-5 rounded-3xl space-y-4 text-xs text-gray-400"
                      >
                        <h4 className="font-black uppercase italic text-white flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-indigo-500" /> Как рассчитываются PTS рейтинга?
                        </h4>
                        <p className="leading-relaxed">
                          PTS (очки турнира) начисляются за каждый сыгранный матч во время сезона. Формула учитывает результат матча и личные показатели:
                        </p>

                        <div className="space-y-4 pt-2 border-t border-white/5">
                          {/* CS2 Formula Details */}
                          {(activeTournament.game === "CS2" || activeTournament.game === "ALL") && (
                            <div className="space-y-2">
                              <div className="text-[10px] font-black text-orange-400 uppercase tracking-wider">Counter-Strike 2</div>
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                                <div>Победа: <strong className="text-white">+15 PTS</strong></div>
                                <div>Поражение: <strong className="text-white">+3 PTS</strong></div>
                                <div>Килл (убийство): <strong className="text-white">+1.0 PTS</strong></div>
                                <div>Ассист (помощь): <strong className="text-white">+0.5 PTS</strong></div>
                                <div>Хедшот (HS): <strong className="text-white">+0.5 PTS</strong></div>
                                <div>Смерть: <strong className="text-red-400">-0.5 PTS</strong></div>
                                <div>Звезда MVP: <strong className="text-white">+2.0 PTS</strong></div>
                                <div>Убийство ножом: <strong className="text-white">+5.0 PTS</strong></div>
                                <div>Убийство с Zeus: <strong className="text-white">+3.0 PTS</strong></div>
                                <div>Ace (минус 5): <strong className="text-white">+10.0 PTS</strong></div>
                              </div>
                            </div>
                          )}

                          {/* Dota 2 Formula Details */}
                          {(activeTournament.game === "Dota2" || activeTournament.game === "ALL") && (
                            <div className="space-y-2 pt-2 border-t border-white/5 last:border-0">
                              <div className="text-[10px] font-black text-red-400 uppercase tracking-wider">Dota 2</div>
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                                <div>Победа: <strong className="text-white">+15 PTS</strong></div>
                                <div>Поражение: <strong className="text-white">+3 PTS</strong></div>
                                <div>Убийство героя: <strong className="text-white">+1.5 PTS</strong></div>
                                <div>Ассист: <strong className="text-white">+0.75 PTS</strong></div>
                                <div>Смерть: <strong className="text-red-400">-0.75 PTS</strong></div>
                                <div>Каждые 10 крипов: <strong className="text-white">+0.5 PTS</strong></div>
                                <div>Денай (крипы): <strong className="text-white">+0.1 PTS</strong></div>
                                <div>Неворт (1k золота): <strong className="text-white">+0.2 PTS</strong></div>
                                <div>Серия Godlike: <strong className="text-white">+10.0 PTS</strong></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* PRIZES LIST */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 px-1">
                      Призовой фонд сезона
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {activeTournament.prizes?.map((p: any) => {
                        const reward = parseFloat(p.reward) || 0;
                        const textPrize = p.text_prize || "";
                        const desc = p.description || "";

                        return (
                          <div
                            key={p.place}
                            className={cn(
                              "bg-white/[0.015] border rounded-2xl p-4 text-center space-y-1.5 relative flex flex-col justify-between min-h-[110px]",
                              p.place === 1 ? "border-amber-500/30" : p.place === 2 ? "border-slate-400/20" : "border-amber-700/20"
                            )}
                          >
                            <Award className={cn(
                              "w-6 h-6 mx-auto",
                              p.place === 1 ? "text-amber-500" : p.place === 2 ? "text-slate-400" : "text-amber-700"
                            )} />
                            <div>
                              <div className="text-[8px] text-gray-500 font-bold uppercase">{p.place} место</div>
                              <div className="text-xs font-black text-white leading-tight mt-0.5">
                                {reward > 0 && textPrize ? (
                                  <span>{reward} ₽ + {textPrize}</span>
                                ) : reward > 0 ? (
                                  <span>{reward} ₽</span>
                                ) : textPrize ? (
                                  <span>{textPrize}</span>
                                ) : (
                                  <span>—</span>
                                )}
                              </div>
                              {desc && (
                                <div className="text-[8px] text-gray-400 mt-1 leading-normal italic font-medium">
                                  {desc}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right Column */}
            <div className="lg:col-span-5 space-y-6">
              {/* COUNTDOWN / DATES FOR ACTIVE */}
              {activeTournament && activeTournament.status === "active" && (
                <div className="flex items-center justify-between px-5 py-4 bg-white/[0.015] border border-white/5 rounded-2xl text-xs text-gray-400">
                  <span>Матчи учитываются до:</span>
                  <span className="font-bold text-white">{formatDate(activeTournament.end_date)} 23:59</span>
                </div>
              )}

              {/* LEADERBOARD TABLE */}
              {activeTournament && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">
                      Рейтинг лидеров клуба
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">
                      Участников: {activeTournament.fullLeaderboardCount}
                    </span>
                  </div>

                  <div className="divide-y divide-white/5 border border-white/5 rounded-3xl bg-white/[0.01] overflow-hidden">
                    {activeTournament.leaderboard.length === 0 ? (
                      <div className="text-center py-12 text-xs text-gray-600 font-bold uppercase tracking-wider">
                        Результаты отсутствуют
                      </div>
                    ) : (
                      activeTournament.leaderboard.map((item: any) => {
                        const isCurrentUser = item.player_id === player?.id;
                        const maskedName = item.full_name
                          ? item.full_name.split(" ").map((n: string, i: number) => i === 0 ? n : `${n[0]}.`).join(" ")
                          : "Игрок";

                        return (
                          <div
                            key={item.player_id}
                            className={cn(
                              "flex items-center justify-between px-5 py-4 text-xs transition-colors",
                              isCurrentUser ? "bg-indigo-500/5 border-y border-indigo-500/25" : "hover:bg-white/[0.005]"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <span className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px]",
                                item.rank === 1 ? "bg-amber-500/20 text-amber-400" :
                                item.rank === 2 ? "bg-slate-400/20 text-slate-300" :
                                item.rank === 3 ? "bg-amber-700/20 text-amber-600" : "text-gray-500 bg-white/5"
                              )}>
                                {item.rank || "—"}
                              </span>
                              <div>
                                <div className={cn(
                                  "font-bold",
                                  isCurrentUser ? "text-indigo-400" : "text-gray-200"
                                )}>
                                  {isCurrentUser ? `${item.full_name} (Вы)` : maskedName}
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5 font-bold">
                                  {item.qualified ? (
                                    <span className="text-green-500">Квалифицирован</span>
                                  ) : (
                                    <span className="text-orange-500/80">Не квалифицирован ({item.matches_count}/{activeTournament.min_matches})</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right font-black flex flex-col items-end justify-center">
                              <div className="text-white font-black text-sm">{item.points} PTS</div>
                              <div className="text-[10px] text-gray-600 font-bold mt-0.5">{item.wins}W / {item.losses}L</div>
                              {(() => {
                                const prizesList = activeTournament.prizes || [];
                                const playerPrize = item.qualified ? prizesList.find((pz: any) => parseInt(pz.place) === item.rank) : null;
                                if (!playerPrize) return null;
                                const reward = parseFloat(playerPrize.reward) || 0;
                                const textPrize = playerPrize.text_prize || "";

                                return (
                                  <div className="text-[9px] text-emerald-400 font-bold uppercase mt-1">
                                    {reward > 0 && textPrize ? (
                                      <span>+{reward} ₽ + {textPrize}</span>
                                    ) : reward > 0 ? (
                                      <span>+{reward} ₽</span>
                                    ) : textPrize ? (
                                      <span>{textPrize}</span>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
