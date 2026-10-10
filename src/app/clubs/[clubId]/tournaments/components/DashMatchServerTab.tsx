"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DashMatchAgentInfo, ActiveCs2MatchInfo } from "../types";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  Trash2,
  Globe,
  Sparkles,
  RefreshCw,
  Search,
  Link as LinkIcon,
  Image as ImageIcon,
  Shield,
  Swords,
  Layers,
  Loader2,
} from "lucide-react";

interface CustomMapRecord {
  id: number;
  club_id: number;
  map_id: string;
  name: string;
  description: string;
  match_format: string;
  image_url?: string | null;
  is_active?: boolean;
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

  // Custom maps state & Validator
  const [customMaps, setCustomMaps] = useState<CustomMapRecord[]>([]);
  const [isAddMapOpen, setIsAddMapOpen] = useState(false);
  const [workshopInput, setWorkshopInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validatedItem, setValidatedItem] = useState<{
    map_id: string;
    name: string;
    description: string;
    image_url: string | null;
    is_cs2: boolean;
    workshop_url: string;
    suggested_format: "1v1" | "2v2" | "5v5" | "all";
  } | null>(null);

  const [newMapName, setNewMapName] = useState("");
  const [newMapId, setNewMapId] = useState("");
  const [newMapDesc, setNewMapDesc] = useState("");
  const [newMapFormat, setNewMapFormat] = useState("all");
  const [newMapImage, setNewMapImage] = useState("");
  const [isSavingCustomMap, setIsSavingCustomMap] = useState(false);

  // Maps filter & search
  const [mapCategoryFilter, setMapCategoryFilter] = useState<"all" | "1v1" | "2v2" | "5v5">("all");
  const [mapSearchQuery, setMapSearchQuery] = useState("");

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

  // Validate Steam Workshop link or ID
  const handleValidateWorkshopLink = async (inputStr?: string) => {
    const raw = (inputStr !== undefined ? inputStr : workshopInput).trim();
    if (!raw) return;

    setValidationError(null);
    setValidatedItem(null);
    setIsValidating(true);

    try {
      const res = await fetch(
        `/api/clubs/${clubId}/cs2/custom-maps/validate?url=${encodeURIComponent(raw)}`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setValidatedItem(data);
        setNewMapName(data.name || "");
        setNewMapId(data.map_id || "");
        setNewMapDesc(data.description || "");
        setNewMapFormat(data.suggested_format || "all");
        setNewMapImage(data.image_url || "");
      } else {
        setValidationError(data.error || "Не удалось проверить карту в Steam");
      }
    } catch (err: any) {
      console.error(err);
      setValidationError("Ошибка сети при проверке Steam Workshop");
    } finally {
      setIsValidating(false);
    }
  };

  // Save custom map from validated data or form
  const handleSaveCustomMap = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const cleanId = newMapId.trim().replace(/[^0-9]/g, "");
    if (!newMapName.trim() || !cleanId) {
      setValidationError("Укажите название и числовой ID карты из Steam Workshop");
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
          image_url: newMapImage || null,
        }),
      });
      if (res.ok) {
        setWorkshopInput("");
        setValidatedItem(null);
        setNewMapName("");
        setNewMapId("");
        setNewMapDesc("");
        setNewMapImage("");
        setIsAddMapOpen(false);
        await fetchCustomMaps();
      } else {
        const data = await res.json();
        setValidationError(data.error || "Ошибка сохранения карты");
      }
    } catch (err) {
      console.error(err);
      setValidationError("Ошибка сети");
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

  // Filtered custom maps
  const filteredCustomMaps = customMaps.filter((cm) => {
    const matchesCategory =
      mapCategoryFilter === "all" ||
      cm.match_format === "all" ||
      cm.match_format === mapCategoryFilter;
    const matchesSearch =
      !mapSearchQuery.trim() ||
      cm.name.toLowerCase().includes(mapSearchQuery.toLowerCase()) ||
      cm.map_id.includes(mapSearchQuery.trim()) ||
      (cm.description || "").toLowerCase().includes(mapSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
          className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer self-start sm:self-auto shrink-0 flex items-center gap-2"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
          <span>{isRefreshing ? "Проверка связи..." : "Обновить статус"}</span>
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
                      const isLive = m.status === "live" || m.status === "starting" || m.status === "warmup";

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
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

                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 font-mono font-black text-xs">
                              {m.score1} : {m.score2}
                            </span>
                          </td>

                          <td className="py-4 px-4 font-bold text-slate-700 uppercase font-mono">
                            {m.map_name}
                          </td>

                          <td className="py-4 px-4 font-mono font-bold text-slate-500">
                            {m.port}
                          </td>

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

      {/* 5. SUB-TAB 3: MAPS & WORKSHOP VALIDATOR */}
      {subTab === "maps" && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-black uppercase italic text-slate-900">
                  Каталог карт Steam Workshop
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Добавляйте проверенные карты мастерской для дуэлей 1x1, напарников 2x2 и матчей 5x5.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsAddMapOpen(!isAddMapOpen);
                setValidationError(null);
                setValidatedItem(null);
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-md shadow-orange-500/15 cursor-pointer flex items-center gap-2 self-start md:self-auto shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddMapOpen ? "Скрыть форму" : "Добавить карту по ссылке"}</span>
            </button>
          </div>

          {/* Steam Workshop Validator Panel */}
          {isAddMapOpen && (
            <div className="bg-white border-2 border-orange-400/40 rounded-[2.5rem] p-6 sm:p-7 shadow-lg space-y-5 animate-in fade-in slide-in-from-top-3 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  <h4 className="text-sm font-black uppercase text-slate-900 tracking-wide">
                    Валидатор ссылок Steam Workshop
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddMapOpen(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  Закрыть
                </button>
              </div>

              {/* URL Input Form */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Вставьте ссылку на карту из Мастерской Steam или ID:
                </label>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <div className="relative flex-1">
                    <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=3070549948"
                      value={workshopInput}
                      onChange={(e) => {
                        setWorkshopInput(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleValidateWorkshopLink();
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-900 font-mono focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleValidateWorkshopLink()}
                    disabled={isValidating || !workshopInput.trim()}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider px-6 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                        <span>Проверка...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Проверить карту</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Поддерживаются полные ссылки Steam Community, ссылки мастерской и числовые ID карт.
                </p>
              </div>

              {/* Validation Error */}
              {validationError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Validated Map Preview Card */}
              {validatedItem && (
                <form
                  onSubmit={handleSaveCustomMap}
                  className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Результат проверки в Steam
                    </span>
                    {validatedItem.is_cs2 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Совместима с Counter-Strike 2
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        Не удалось подтвердить тег CS2
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                    {/* Map Preview Image */}
                    <div className="md:col-span-4 rounded-xl overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-200 relative group">
                      {newMapImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={newMapImage}
                          alt={newMapName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
                          <ImageIcon className="w-6 h-6" />
                          <span>Нет превью</span>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-white font-mono text-[9px] font-bold backdrop-blur-xs">
                        ID: {newMapId}
                      </div>
                    </div>

                    {/* Editable fields */}
                    <div className="md:col-span-8 space-y-3 text-xs">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                          Название карты в турнирах:
                        </label>
                        <input
                          type="text"
                          value={newMapName}
                          onChange={(e) => setNewMapName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                            Назначение / Формат:
                          </label>
                          <select
                            value={newMapFormat}
                            onChange={(e) => setNewMapFormat(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500 cursor-pointer"
                          >
                            <option value="all">Для всех форматов</option>
                            <option value="1v1">1х1 (Aim / AWP / Duels)</option>
                            <option value="2v2">2х2 (Wingman / Напарники)</option>
                            <option value="5v5">5х5 (Competitive / Retake)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                            Steam Workshop Ссылка:
                          </label>
                          <a
                            href={validatedItem.workshop_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 py-2"
                          >
                            <span>Открыть страницу в Steam</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                          Описание (опционально):
                        </label>
                        <input
                          type="text"
                          value={newMapDesc}
                          onChange={(e) => setNewMapDesc(e.target.value)}
                          placeholder="Описание карты или особенности геймплея"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setValidatedItem(null);
                        setWorkshopInput("");
                      }}
                      className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-bold cursor-pointer"
                    >
                      Сбросить
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCustomMap}
                      className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-orange-500/15 cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isSavingCustomMap ? "Сохранение..." : "Добавить карту в клуб"}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setMapCategoryFilter("all")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                  mapCategoryFilter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Все карты ({customMaps.length})
              </button>
              <button
                type="button"
                onClick={() => setMapCategoryFilter("1v1")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5",
                  mapCategoryFilter === "1v1"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Swords className="w-3.5 h-3.5 text-orange-500" />
                <span>1х1 Aim / Duels</span>
              </button>
              <button
                type="button"
                onClick={() => setMapCategoryFilter("2v2")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5",
                  mapCategoryFilter === "2v2"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Shield className="w-3.5 h-3.5 text-blue-500" />
                <span>2х2 Wingman</span>
              </button>
              <button
                type="button"
                onClick={() => setMapCategoryFilter("5v5")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5",
                  mapCategoryFilter === "5v5"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                <span>5х5 Competitive</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Поиск по картам..."
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Cards Gallery */}
          {filteredCustomMaps.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-[2rem] p-12 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-orange-500 mx-auto flex items-center justify-center">
                <Globe className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black uppercase tracking-wide text-slate-900">
                {customMaps.length === 0 ? "Кастомных карт пока нет" : "Карты не найдены"}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Вставьте ссылку на карту из Steam Workshop, чтобы добавить её в клуб и использовать в турнирах.
              </p>
              {!isAddMapOpen && (
                <button
                  type="button"
                  onClick={() => setIsAddMapOpen(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить первую карту</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredCustomMaps.map((cm) => {
                const formatBadge = {
                  "1v1": { label: "1x1 Aim / Duel", bg: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
                  "2v2": { label: "2x2 Wingman", bg: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
                  "5v5": { label: "5x5 Competitive", bg: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
                  all: { label: "Все форматы", bg: "bg-slate-100 text-slate-700 border-slate-200" },
                }[cm.match_format || "all"] || { label: cm.match_format, bg: "bg-slate-100 text-slate-700 border-slate-200" };

                return (
                  <div
                    key={cm.id}
                    className="bg-white border border-slate-200/80 rounded-[2rem] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    {/* Image Poster */}
                    <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden">
                      {cm.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cm.image_url}
                          alt={cm.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                          <ImageIcon className="w-8 h-8 opacity-40 mb-1" />
                          <span>Workshop Map</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1">
                        <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-md border backdrop-blur-xs", formatBadge.bg)}>
                          {formatBadge.label}
                        </span>
                        <span className="text-[9px] font-mono font-bold bg-black/60 text-white/90 px-2 py-0.5 rounded-md backdrop-blur-xs">
                          ID: {cm.map_id}
                        </span>
                      </div>

                      {/* Map Name over poster */}
                      <div className="absolute bottom-3 left-3 right-3">
                        <h4 className="text-sm font-black uppercase tracking-wide text-white drop-shadow truncate">
                          {cm.name}
                        </h4>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {cm.description || "Карта из мастерской Steam Workshop"}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <a
                          href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${cm.map_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-slate-600 hover:text-orange-600 flex items-center gap-1 transition-colors"
                        >
                          <span>В мастерской</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDeleteCustomMap(cm.id)}
                          className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Удалить</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
