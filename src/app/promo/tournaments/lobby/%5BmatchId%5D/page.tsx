"use client";

import React from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Tv,
  MessageSquare,
  Send,
  UserCheck,
  MapPin,
  Flame,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  sender_kind: string;
  sender_name: string;
  body: string;
  created_at: string;
}

export default function MatchLobby() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.matchId as string;
  const clubId = searchParams.get("clubId") || "";

  const [loading, setLoading] = React.useState(true);
  const [player, setPlayer] = React.useState<any>(null);
  const [match, setMatch] = React.useState<any>(null);
  const [checkins, setCheckins] = React.useState<any[]>([]);
  const [veto, setVeto] = React.useState<any>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  
  // Form states
  const [pcNumber, setPcNumber] = React.useState("");
  const [chatInput, setChatInput] = React.useState("");
  const [isSendingMsg, setIsSendingMsg] = React.useState(false);
  const [isSubmittingCheckin, setIsSubmittingCheckin] = React.useState(false);

  const fetchLobbyData = async () => {
    try {
      const res = await fetch(`/api/promo/matches/${matchId}`);
      if (!res.ok) throw new Error("Match not found");
      const data = await res.json();
      setMatch(data.match);
      setCheckins(data.checkins || []);
      setVeto(data.veto);
      setMessages(data.messages || []);
    } catch (err) {
      console.error(err);
      router.push(`/promo/tournaments?clubId=${clubId}`);
    }
  };

  const fetchPlayer = async () => {
    try {
      const res = await fetch("/api/promo/player");
      if (res.status === 401) {
        router.push(`/promo/login?clubId=${clubId}`);
        return;
      }
      const data = await res.json();
      setPlayer(data.player);
    } catch (err) {
      console.error(err);
    }
  };

  // Real-time SSE listener
  React.useEffect(() => {
    fetchPlayer();
    fetchLobbyData().then(() => setLoading(false));

    // Open SSE stream
    const eventSource = new EventSource(`/api/promo/matches/${matchId}/stream`);

    eventSource.addEventListener("update", () => {
      console.log("[Lobby SSE] Update received, refetching...");
      fetchLobbyData();
    });

    eventSource.addEventListener("ready", (e: any) => {
      console.log("[Lobby SSE] Ready status:", e.data);
    });

    return () => {
      eventSource.close();
    };
  }, [matchId]);

  // Actions
  const handleCheckin = async () => {
    if (!pcNumber.trim() || isSubmittingCheckin) return;
    setIsSubmittingCheckin(true);
    try {
      const res = await fetch(`/api/promo/matches/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin", pcNumber: pcNumber.trim() }),
      });
      if (res.ok) {
        setPcNumber("");
        await fetchLobbyData();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка подтверждения готовности");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingCheckin(false);
    }
  };

  const handleVetoBan = async (mapName: string) => {
    try {
      const res = await fetch(`/api/promo/matches/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "veto_ban", mapName }),
      });
      if (res.ok) {
        await fetchLobbyData();
      } else {
        const data = await res.json();
        alert(data.error || "Невозможно забанить карту");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingMsg) return;
    setIsSendingMsg(true);
    try {
      const res = await fetch(`/api/promo/matches/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_message", message: chatInput.trim() }),
      });
      if (res.ok) {
        setChatInput("");
        await fetchLobbyData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingMsg(false);
    }
  };

  if (loading || !match) {
    return (
      <div className="min-h-screen bg-[#070708] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Helper checks
  const isCheckedIn = checkins.some((c) => c.player_id === player?.id && c.is_ready);
  const myCheckin = checkins.find((c) => c.player_id === player?.id);

  const isMemberOfA = (pId: string) => {
    if (!match.competitorA) return false;
    if (match.competitorA.playerId === pId) return true;
    if (match.competitorA.roster && match.competitorA.roster.some((m: any) => m.id === pId)) return true;
    return false;
  };

  const isMemberOfB = (pId: string) => {
    if (!match.competitorB) return false;
    if (match.competitorB.playerId === pId) return true;
    if (match.competitorB.roster && match.competitorB.roster.some((m: any) => m.id === pId)) return true;
    return false;
  };

  // Veto turns
  const activeTurnComp = veto && (
    veto.current_turn_competitor_id === match.competitorA?.id 
      ? match.competitorA 
      : (veto.current_turn_competitor_id === match.competitorB?.id ? match.competitorB : null)
  );

  const isMyTurnToBan = !!(
    veto && 
    activeTurnComp && 
    (activeTurnComp.playerId === player?.id || activeTurnComp.captainId === player?.id)
  );

  return (
    <div className="min-h-screen bg-[#070708] text-white selection:bg-orange-500/20 pb-12">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Flame className="w-8 h-8 text-orange-500 animate-pulse" />
            <div>
              <h1 className="text-lg font-black uppercase italic tracking-tight">
                Lobby <span className="text-orange-500">CS2 Match</span>
              </h1>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                ID матча: match_{match.id}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/promo/tournaments?clubId=${clubId}`)}
            className="text-xs text-gray-400 hover:text-white font-black uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl transition-colors border border-white/5"
          >
            Выйти
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* LEFT SIDE: Team A */}
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[2rem] p-6 space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-orange-500 truncate">
                {match.competitorA?.name || "Команда А"}
              </h3>
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">
                Левая сторона
              </span>
            </div>

            {/* Checkins / seats */}
            <div className="space-y-4">
              {checkins
                .filter((c) => isMemberOfA(c.player_id))
                .slice(0, 5) // Show top members
                .map((c) => (
                  <div key={c.player_id} className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5">
                    <div>
                      <span className="text-xs font-bold block truncate">{c.full_name}</span>
                      <span className="text-[9px] text-gray-500">ПК: {c.pc_number || "выбирает..."}</span>
                    </div>
                    {c.is_ready ? (
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50" />
                    ) : (
                      <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* CENTER: Map Veto / Ban-Pick */}
          <div className="lg:col-span-2 space-y-6">
            {/* Veto Info Dashboard */}
            <div className="bg-white/5 border border-white/5 rounded-[2rem] p-8 space-y-6">
              {match.status === "scheduled" && (
                <div className="text-center space-y-6 py-4">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-3xl flex items-center justify-center mx-auto border border-orange-500/20">
                    <Monitor className="w-8 h-8 text-orange-500 animate-bounce" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase italic tracking-tight">
                      Подтверждение <span className="text-orange-500">Присутствия</span>
                    </h2>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed max-w-sm mx-auto">
                      Укажите номер вашего ПК в игровом зале клуба и нажмите «Я ГОТОВ», чтобы начать стадию выбора карт.
                    </p>
                  </div>

                  {!isCheckedIn ? (
                    <div className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
                      <input
                        type="text"
                        placeholder="Ваш ПК (например: 12)..."
                        value={pcNumber}
                        onChange={(e) => setPcNumber(e.target.value)}
                        className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-sm font-bold text-white focus:outline-none focus:border-orange-500 transition-colors"
                      />
                      <button
                        onClick={handleCheckin}
                        disabled={isSubmittingCheckin || !pcNumber.trim()}
                        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl transition-colors shadow-lg shadow-orange-500/20"
                      >
                        Я готов
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/20 px-4 py-2 rounded-2xl text-emerald-400 text-xs font-bold">
                      <UserCheck className="w-4 h-4" />
                      Вы готовы (ПК: {myCheckin?.pc_number})
                    </div>
                  )}
                </div>
              )}

              {/* VETO MAPS CARDS */}
              {match.status === "veto" && veto && (
                <div className="space-y-6">
                  <div className="text-center">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 block mb-1">
                      Стадия Выбора Карт
                    </span>
                    <h3 className="text-md font-black uppercase italic tracking-tight text-orange-500">
                      {isMyTurnToBan ? "ВАШ ХОД БАНИТЬ КАРТУ" : "ОЖИДАНИЕ ХОДА СОПЕРНИКА"}
                    </h3>
                  </div>

                  {/* Grid of maps */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {match.mapPool.map((map: string) => {
                      const isBanned = veto.banned_maps?.includes(map);
                      const isSelected = veto.selected_map === map;

                      return (
                        <div
                          key={map}
                          onClick={() => {
                            if (isMyTurnToBan && !isBanned && !veto.selected_map) {
                              handleVetoBan(map);
                            }
                          }}
                          className={cn(
                            "relative overflow-hidden rounded-2xl border aspect-video flex items-center justify-center cursor-pointer transition-all group",
                            isBanned
                              ? "border-white/5 grayscale opacity-20 pointer-events-none"
                              : isSelected
                              ? "border-emerald-500 ring-2 ring-emerald-500/20"
                              : isMyTurnToBan
                              ? "border-white/10 hover:border-orange-500 shadow-md hover:shadow-orange-500/5"
                              : "border-white/5 pointer-events-none"
                          )}
                        >
                          {/* Map Image Placeholder or Name */}
                          <div className="absolute inset-0 bg-[#121214] flex flex-col justify-center items-center p-4">
                            <span className="font-black text-xs uppercase tracking-widest group-hover:scale-105 transition-transform">
                              {map.replace("de_", "")}
                            </span>
                            {isBanned && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-red-500 mt-1">
                                Забанена
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 mt-1">
                                Выбрана
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LIVE SERVER READY */}
              {match.status === "live" && (
                <div className="text-center space-y-6 py-6">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20">
                    <Tv className="w-8 h-8 text-emerald-500 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase italic tracking-tight text-emerald-400">
                      Сервер Запущен!
                    </h2>
                    <p className="text-xs text-gray-400 font-medium max-w-xs mx-auto">
                      Карта: <strong className="text-white uppercase">{veto?.selected_map?.replace("de_", "")}</strong>. Нажмите кнопку подключения, чтобы войти в игру.
                    </p>
                  </div>

                  {/* Connect link */}
                  <a
                    href={`steam://connect/${match.cs2ServerIp || "127.0.0.1"}:${match.cs2ServerPort || 27015}`}
                    className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-widest px-8 py-5 rounded-3xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                  >
                    Зайти на сервер
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: Team B */}
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[2rem] p-6 space-y-6">
            <div className="border-b border-white/5 pb-4 text-right">
              <h3 className="text-sm font-black uppercase tracking-widest text-orange-500 truncate">
                {match.competitorB?.name || "Команда Б"}
              </h3>
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 text-right">
                Правая сторона
              </span>
            </div>

            {/* Checkins / seats */}
            <div className="space-y-4">
              {checkins
                .filter((c) => isMemberOfB(c.player_id))
                .slice(0, 5)
                .map((c) => (
                  <div key={c.player_id} className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5">
                    {c.is_ready ? (
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50" />
                    ) : (
                      <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                    )}
                    <div className="text-right">
                      <span className="text-xs font-bold block truncate">{c.full_name}</span>
                      <span className="text-[9px] text-gray-500">ПК: {c.pc_number || "выбирает..."}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Chat lobby */}
        <div className="bg-[#0c0c0e] border border-white/5 rounded-[2rem] p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-orange-500 px-1">
            <MessageSquare className="w-4 h-4" />
            Чат лобби
          </div>

          {/* Messages list */}
          <div className="h-48 overflow-y-auto bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3 custom-scrollbar flex flex-col-reverse">
            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className="text-xs">
                  <strong className="text-orange-500 font-bold mr-1.5">{m.sender_name}:</strong>
                  <span className="text-gray-300">{m.body}</span>
                  <span className="text-[8px] text-gray-600 ml-2">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-gray-600 text-center py-12">Нет сообщений. Поприветствуйте соперников!</p>
              )}
            </div>
          </div>

          {/* Message form */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              placeholder="Введите сообщение в чат матча..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold text-white focus:outline-none focus:border-orange-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isSendingMsg || !chatInput.trim()}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 p-4 rounded-2xl text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
