"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DashMatchAgentInfo, ActiveCs2MatchInfo } from "../types";

interface CustomMapRecord {
  id: number;
  club_id: number;
  map_id: string;
  name: string;
  description: string;
  match_format: string;
  created_at: string;
}

interface DashMatchServerTabProps {
  clubId: string;
}

export function DashMatchServerTab({ clubId }: DashMatchServerTabProps) {
  const [subTab, setSubTab] = useState<"setup" | "servers" | "maps">("setup");
  const [agent, setAgent] = useState<DashMatchAgentInfo | null>(null);
  const [activeMatches, setActiveMatches] = useState<ActiveCs2MatchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Match filter state in "servers" subtab
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Pairing code state
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Custom maps state
  const [customMaps, setCustomMaps] = useState<CustomMapRecord[]>([]);
  const [isAddMapOpen, setIsAddMapOpen] = useState(false);
  const [newMapName, setNewMapName] = useState("");
  const [newMapId, setNewMapId] = useState("");
  const [newMapDesc, setNewMapDesc] = useState("");
  const [newMapFormat, setNewMapFormat] = useState("all");
  const [isSavingCustomMap, setIsSavingCustomMap] = useState(false);
  const [customMapError, setCustomMapError] = useState<string | null>(null);

  // Connect command copied states
  const [copiedConnectId, setCopiedConnectId] = useState<string | null>(null);

  // Fetch status
  const fetchStatus = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/status`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data.agent || null);
        setActiveMatches(data.matches || []);
      }
    } catch (err) {
      console.error("Error fetching DashMatch status:", err);
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [clubId]);

  // Fetch custom maps
  const fetchCustomMaps = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/custom-maps`);
      if (res.ok) {
        const data = await res.json();
        setCustomMaps(data.maps || []);
      }
    } catch (err) {
      console.error("Error fetching custom maps:", err);
    }
  }, [clubId]);

  useEffect(() => {
    fetchStatus();
    fetchCustomMaps();

    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchCustomMaps]);

  // Generate pair code
  const handleGeneratePairCode = async () => {
    setIsGeneratingCode(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/pair-code`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.code) {
        setPairCode(data.code);
      } else {
        alert(data.error || "Не удалось сгенерировать код привязки");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Save custom map
  const handleSaveCustomMap = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomMapError(null);
    const cleanId = newMapId.trim().replace(/[^0-9]/g, "");
    if (!newMapName.trim() || !cleanId) {
      setCustomMapError("Укажите название и числовой ID карты из Steam Workshop");
      return;
    }
    setIsSavingCustomMap(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/custom-maps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          map_id: cleanId,
          name: newMapName.trim(),
          description: newMapDesc.trim(),
          match_format: newMapFormat,
        }),
      });
      if (res.ok) {
        setNewMapName("");
        setNewMapId("");
        setNewMapDesc("");
        setIsAddMapOpen(false);
        await fetchCustomMaps();
      } else {
        const data = await res.json();
        setCustomMapError(data.error || "Ошибка сохранения карты");
      }
    } catch (err) {
      console.error(err);
      setCustomMapError("Ошибка сети");
    } finally {
      setIsSavingCustomMap(false);
    }
  };

  // Delete custom map
  const handleDeleteCustomMap = async (id: number) => {
    if (!confirm("Удалить эту карту из каталога клуба?")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/custom-maps?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchCustomMaps();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Stop active match server
  const handleStopMatch = async (matchId: string) => {
    if (!confirm("Остановить сервер CS2 для этого матча и освободить ресурсы ПК?")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/matches/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      if (res.ok) {
        await fetchStatus(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isAgentOnline = agent?.is_online ?? false;
  const liveMatches = activeMatches.filter(
    (m) => m.status === "live" || m.status === "starting" || m.status === "warmup"
  );
  const displayedMatches = filterActiveOnly ? liveMatches : activeMatches;

  return (
    <div className="space-y-6 text-slate-900">
      {/* 1. Header Status Bar */}
      <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">
              Серверный агент <span className="text-orange-500">DashMatch</span>
            </h2>
            <span
              className={cn(
                "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                isAgentOnline
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              )}
            >
              {isAgentOnline ? "В сети" : "Не подключен"}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {isAgentOnline
              ? `Локальный IP: ${agent?.lan_ip || "127.0.0.1"} • Пул портов: ${agent?.base_port || 27015}..${
                  (agent?.base_port || 27015) + (agent?.max_instances || 4) - 1
                } • Доступно слотов: ${agent?.max_instances || 4}`
              : "Запустите dashmatch.exe на выделенном компьютере клуба для старта турнирных серверов CS2"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchStatus(true)}
          disabled={isRefreshing}
          className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
        >
          {isRefreshing ? "Проверка связи..." : "Обновить статус"}
        </button>
      </div>

      {/* 2. Sub-Tab Navigation Bar */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab("setup")}
          className={cn(
            "flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center cursor-pointer",
            subTab === "setup"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          Подключение ПК
        </button>

        <button
          type="button"
          onClick={() => setSubTab("servers")}
          className={cn(
            "flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer",
            subTab === "servers"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <span>Серверы CS2</span>
          {liveMatches.length > 0 && (
            <span
              className={cn(
                "text-[10px] font-mono px-2 py-0.5 rounded-md font-black",
                subTab === "servers" ? "bg-black/20 text-white" : "bg-emerald-100 text-emerald-700"
              )}
            >
              {liveMatches.length} Live
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab("maps")}
          className={cn(
            "flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer",
            subTab === "maps"
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <span>Карты Workshop</span>
          {customMaps.length > 0 && (
            <span
              className={cn(
                "text-[10px] font-mono px-2 py-0.5 rounded-md font-black",
                subTab === "maps" ? "bg-black/20 text-white" : "bg-slate-100 text-slate-600"
              )}
            >
              {customMaps.length}
            </span>
          )}
        </button>
      </div>

      {/* 3. SUB-TAB 1: SETUP */}
      {subTab === "setup" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* PIN Card */}
          <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-[2rem] p-6 sm:p-8 shadow-xs space-y-6 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Безопасная привязка
              </span>
              <h3 className="text-lg font-black uppercase italic text-slate-900">
                Привязка компьютера клуба
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed pt-1">
                Сгенерируйте 6-значный PIN-код и укажите его в консоли{" "}
                <code className="font-mono font-bold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded">
                  dashmatch.exe
                </code>{" "}
                на выделенном ПК клуба. Привязка выполняется один раз.
              </p>
            </div>

            {pairCode ? (
              <div className="p-6 rounded-2xl bg-orange-50/60 border border-orange-200 text-center space-y-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700 block">
                  Одноразовый PIN-код:
                </span>
                <div className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-slate-900 select-all">
                  {pairCode.slice(0, 3)} {pairCode.slice(3)}
                </div>
                <div className="text-[11px] text-slate-500">
                  Действует 30 минут
                </div>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(pairCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-orange-300 text-xs font-bold text-orange-700 transition-all shadow-xs cursor-pointer"
                  >
                    {copiedCode ? "Скопировано!" : "Скопировать PIN"}
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePairCode}
                    disabled={isGeneratingCode}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Новый код
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGeneratePairCode}
                  disabled={isGeneratingCode}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider py-4 rounded-xl transition-all shadow-md shadow-orange-500/15 text-center cursor-pointer"
                >
                  {isGeneratingCode ? "Генерация кода..." : "Сгенерировать PIN-код"}
                </button>
              </div>
            )}
          </div>

          {/* 3 Steps */}
          <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-[2rem] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Инструкция
              </span>
              <h3 className="text-lg font-black uppercase italic text-slate-900">
                Порядок запуска за 3 шага
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="font-mono font-black text-sm text-orange-500 shrink-0 mt-0.5">
                  01
                </span>
                <div className="text-xs text-slate-600 leading-relaxed">
                  <strong className="font-bold text-slate-900 block mb-0.5">
                    Запустите dashmatch.exe
                  </strong>
                  Откройте исполняемый файл на компьютере, выделенном под игровые серверы в локальной сети клуба.
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="font-mono font-black text-sm text-orange-500 shrink-0 mt-0.5">
                  02
                </span>
                <div className="text-xs text-slate-600 leading-relaxed">
                  <strong className="font-bold text-slate-900 block mb-0.5">
                    Укажите PIN-код привязки
                  </strong>
                  В консоли выберите пункт <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-900">[1]</code> и введите 6-значный код.
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="font-mono font-black text-sm text-emerald-600 shrink-0 mt-0.5">
                  03
                </span>
                <div className="text-xs text-slate-600 leading-relaxed">
                  <strong className="font-bold text-slate-900 block mb-0.5">
                    Сервер готов к матчам
                  </strong>
                  Выберите пункт <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-900">[2]</code>. Статус агента перейдет в «В сети». Серверы CS2 будут подниматься автоматически при старте матчей в сетке!
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 4. SUB-TAB 2: SERVERS TABLE */}
      {subTab === "servers" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Матчи на серверах CS2: {activeMatches.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterActiveOnly(false)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  !filterActiveOnly
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Все ({activeMatches.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterActiveOnly(true)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  filterActiveOnly
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Только Live ({liveMatches.length})
              </button>
            </div>
          </div>

          {displayedMatches.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-[2rem] p-12 text-center space-y-2 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                {filterActiveOnly ? "Нет запущенных Live-матчей" : "Нет активных серверов CS2"}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Сервер CS2 автоматически запускается на клубном ПК, когда администратор нажимает{" "}
                <strong className="text-slate-700 font-bold">«Запустить сервер»</strong> внутри карточки матча в сетке турнира.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-[2rem] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-6">Матч / Команды</th>
                      <th className="py-3.5 px-4">Счёт</th>
                      <th className="py-3.5 px-4">Карта</th>
                      <th className="py-3.5 px-4">Порт</th>
                      <th className="py-3.5 px-4">Статус</th>
                      <th className="py-3.5 px-4">Подключение (LAN)</th>
                      <th className="py-3.5 px-6 text-right">Управление</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedMatches.map((m) => {
                      const connectCmd = `connect ${m.server_ip || agent?.lan_ip || "127.0.0.1"}:${m.port || 27015}`;
                      const steamConnect = `steam://connect/${m.server_ip || agent?.lan_ip || "127.0.0.1"}:${m.port || 27015}`;
                      const isLive = m.status === "live" || m.status === "starting" || m.status === "warmup";

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Match Teams */}
                          <td className="py-4 px-6">
                            <div className="font-black text-sm text-slate-900">
                              {m.team1_name}{" "}
                              <span className="text-slate-400 font-normal">vs</span>{" "}
                              {m.team2_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              ID: {m.id}
                            </div>
                          </td>

                          {/* Score */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 font-mono font-black text-xs">
                              {m.score1} : {m.score2}
                            </span>
                          </td>

                          {/* Map */}
                          <td className="py-4 px-4 font-bold text-slate-700 uppercase font-mono">
                            {m.map_name}
                          </td>

                          {/* Port */}
                          <td className="py-4 px-4 font-mono font-bold text-slate-500">
                            {m.port}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span
                              className={cn(
                                "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                                m.game_state === "paused"
                                  ? "bg-amber-100 text-amber-700 border-amber-200 animate-pulse"
                                  : isLive
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              )}
                            >
                              {m.game_state === "paused" ? "Пауза" : isLive ? "Live" : m.status}
                            </span>
                          </td>

                          {/* Connect command */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-slate-700 font-semibold bg-slate-100 px-2.5 py-1 rounded-lg select-all">
                                {connectCmd}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(connectCmd);
                                  setCopiedConnectId(m.id);
                                  setTimeout(() => setCopiedConnectId(null), 2000);
                                }}
                                className="px-2.5 py-1 text-[10px] rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition-colors cursor-pointer shrink-0"
                              >
                                {copiedConnectId === m.id ? "Скопировано" : "Копировать"}
                              </button>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            {m.status !== "stopped" ? (
                              <button
                                type="button"
                                onClick={() => handleStopMatch(m.id)}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                              >
                                Остановить
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">
                                Завершен
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. SUB-TAB 3: MAPS TABLE */}
      {subTab === "maps" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Каталог карт Workshop: {customMaps.length}
            </span>
            <button
              type="button"
              onClick={() => setIsAddMapOpen(!isAddMapOpen)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              Добавить карту
            </button>
          </div>

          {/* Add Custom Map Form */}
          {isAddMapOpen && (
            <form
              onSubmit={handleSaveCustomMap}
              className="bg-white border border-orange-200 rounded-[2rem] p-6 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-black uppercase italic text-slate-900">
                  Добавить карту из Steam Workshop
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddMapOpen(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
                >
                  Закрыть
                </button>
              </div>

              {customMapError && (
                <div className="text-xs text-rose-600 font-bold">{customMapError}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Название карты:
                  </label>
                  <input
                    type="text"
                    placeholder="Например: AWP Lego 2"
                    value={newMapName}
                    onChange={(e) => setNewMapName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Steam Workshop ID:
                  </label>
                  <input
                    type="text"
                    placeholder="Например: 3810240726"
                    value={newMapId}
                    onChange={(e) => setNewMapId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Описание (опционально):
                  </label>
                  <input
                    type="text"
                    placeholder="Например: Дуэль 1х1 на снайперских винтовках"
                    value={newMapDesc}
                    onChange={(e) => setNewMapDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Формат матча:
                  </label>
                  <select
                    value={newMapFormat}
                    onChange={(e) => setNewMapFormat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="all">Для всех форматов</option>
                    <option value="1v1">1х1 (Aim / Duel)</option>
                    <option value="2v2">2х2 (Wingman / Напарники)</option>
                    <option value="5v5">5х5 (Соревновательный)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddMapOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomMap}
                  className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  {isSavingCustomMap ? "Сохранение..." : "Сохранить карту"}
                </button>
              </div>
            </form>
          )}

          {/* Maps Table */}
          {customMaps.length === 0 && !isAddMapOpen ? (
            <div className="bg-white border border-slate-200/80 rounded-[2rem] p-12 text-center space-y-2 shadow-xs">
              <p className="text-xs text-slate-400">
                Кастомных карт пока нет. Вы можете добавить любую карту из Steam Workshop по её числовому ID.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-[2rem] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-6">Название карты</th>
                      <th className="py-3.5 px-4">Workshop ID</th>
                      <th className="py-3.5 px-4">Формат</th>
                      <th className="py-3.5 px-4">Описание</th>
                      <th className="py-3.5 px-4">Мастерская</th>
                      <th className="py-3.5 px-6 text-right">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customMaps.map((cm) => (
                      <tr key={cm.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-900">
                          {cm.name}
                        </td>
                        <td className="py-4 px-4 font-mono text-slate-600 font-semibold">
                          {cm.map_id}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                            {cm.match_format === "all" ? "Все форматы" : cm.match_format}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-slate-500 max-w-xs truncate">
                          {cm.description || "—"}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <a
                            href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${cm.map_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-slate-600 hover:text-orange-600 transition-colors"
                          >
                            Steam Workshop →
                          </a>
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomMap(cm.id)}
                            className="font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
