"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomNav } from "../components/BottomNav";

export default function TeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Forms state
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Current user's phone is needed to identify if they are captain
  const [currentUserPhone, setCurrentUserPhone] = useState("");

  const router = useRouter();

  const fetchTeams = async () => {
    try {
      const playerRes = await fetch("/api/promo/player");
      if (playerRes.status === 401) {
        router.push("/promo/login");
        return;
      }
      const playerData = await playerRes.json();
      setCurrentUserPhone(playerData.player.phoneNumber);

      const res = await fetch("/api/promo/teams");
      const data = await res.json();
      if (data.teams) {
        setTeams(data.teams);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createName.length < 2) return;
    setIsSubmitting(true);
    setError("");
    
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: createName })
      });
      const data = await res.json();
      if (data.success) {
        setCreateName("");
        await fetchTeams();
      } else {
        setError(data.error || "Ошибка при создании");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode) return;
    setIsSubmitting(true);
    setError("");
    
    try {
      const res = await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", joinCode })
      });
      const data = await res.json();
      if (data.success) {
        setJoinCode("");
        await fetchTeams();
      } else {
        setError(data.error || "Ошибка при вступлении");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeave = async (teamId: string) => {
    if (!confirm("Выйти из команды?")) return;
    setIsSubmitting(true);
    try {
      await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave", teamId })
      });
      await fetchTeams();
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisband = async (teamId: string) => {
    if (!confirm("Распустить команду? Это действие необратимо.")) return;
    setIsSubmitting(true);
    try {
      await fetch("/api/promo/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disband", teamId })
      });
      await fetchTeams();
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white text-sm uppercase tracking-widest animate-pulse">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 pb-32 font-sans selection:bg-amber-500/30">
      <div className="max-w-xl mx-auto space-y-12">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter text-white mb-2">
            Команды
          </h1>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">
            Управление составом
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-none text-xs font-bold uppercase tracking-wider text-center">
            {error}
          </div>
        )}

        {teams.length === 0 ? (
          <div className="space-y-10">
            <div className="border border-white/10 p-6 sm:p-8 space-y-6">
              <div className="text-sm font-black uppercase tracking-wider text-white">
                Создать команду
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <input
                  type="text"
                  placeholder="Название команды"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors uppercase tracking-widest"
                  maxLength={30}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || createName.length < 2}
                  className="w-full bg-white text-black font-black uppercase tracking-widest text-xs py-4 hover:bg-amber-400 transition-colors disabled:opacity-50"
                >
                  Создать
                </button>
              </form>
            </div>

            <div className="border border-white/10 p-6 sm:p-8 space-y-6">
              <div className="text-sm font-black uppercase tracking-wider text-white">
                Вступить по коду
              </div>
              <form onSubmit={handleJoin} className="space-y-4">
                <input
                  type="text"
                  placeholder="Код приглашения"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors uppercase tracking-widest text-center font-mono"
                  maxLength={10}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !joinCode}
                  className="w-full border border-white/20 text-white font-black uppercase tracking-widest text-xs py-4 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Вступить
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {teams.map((team) => {
              const isCaptain = team.captainPhone === currentUserPhone;
              return (
                <div key={team.id} className="border border-white/10 p-6 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-2xl font-black uppercase tracking-tighter text-amber-400">
                        {team.name}
                      </div>
                      {isCaptain && (
                        <div className="mt-2 text-xs font-mono text-gray-400 uppercase tracking-widest">
                          Код приглашения: <span className="text-white font-bold">{team.joinCode}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 mt-6 border-t border-white/10 pt-4">
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">
                      Состав ({team.members.length}/5)
                    </div>
                    {team.members.map((m: any, i: number) => (
                      <div key={i} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0 group">
                        {m.playerId ? (
                          <Link
                            href={`/promo/player/${m.playerId}`}
                            className="text-sm font-bold uppercase tracking-wider text-white hover:text-amber-400 transition-colors flex items-center gap-1.5"
                          >
                            <span>{m.fullName}</span>
                            <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                          </Link>
                        ) : (
                          <div className="text-sm font-bold uppercase tracking-wider text-white">
                            {m.fullName}
                          </div>
                        )}
                        <div className={`text-[10px] uppercase tracking-widest ${m.role === 'captain' ? 'text-amber-500 font-black' : 'text-gray-500'}`}>
                          {m.role === 'captain' ? 'Капитан' : 'Игрок'}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-white/10 flex justify-end">
                    {isCaptain ? (
                      <button
                        onClick={() => handleDisband(team.id)}
                        disabled={isSubmitting}
                        className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors"
                      >
                        Распустить команду
                      </button>
                    ) : (
                      <button
                        onClick={() => handleLeave(team.id)}
                        disabled={isSubmitting}
                        className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
                      >
                        Покинуть команду
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
