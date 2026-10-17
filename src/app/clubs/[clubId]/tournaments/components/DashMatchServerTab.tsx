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
  Download,
  Edit,
  X,
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

  // Edit map state
  const [editingMap, setEditingMap] = useState<CustomMapRecord | null>(null);
  const [editMapId, setEditMapId] = useState("");
  const [editMapName, setEditMapName] = useState("");
  const [editMapDesc, setEditMapDesc] = useState("");
  const [editMapFormat, setEditMapFormat] = useState("all");
  const [editMapImage, setEditMapImage] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSyncingSteam, setIsSyncingSteam] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  // Open edit modal for custom map
  const handleOpenEditMap = (cm: CustomMapRecord) => {
    setEditingMap(cm);
    setEditMapId(cm.map_id);
    setEditMapName(cm.name);
    setEditMapDesc(cm.description || "");
    setEditMapFormat(cm.match_format || "all");
    setEditMapImage(cm.image_url || "");
    setEditError(null);
  };

  // Sync details from Steam Workshop for the current editMapId
  const handleSyncEditWithSteam = async () => {
    const rawId = editMapId.trim().replace(/[^0-9]/g, "");
    if (!rawId) {
      setEditError("Укажите числовой ID карты из Steam Workshop");
      return;
    }
    setIsSyncingSteam(true);
    setEditError(null);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/cs2/custom-maps/validate?url=${encodeURIComponent(rawId)}`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.name) setEditMapName(data.name);
        if (data.description) setEditMapDesc(data.description);
        if (data.image_url) setEditMapImage(data.image_url);
        if (data.suggested_format) setEditMapFormat(data.suggested_format);
      } else {
        setEditError(data.error || "Не удалось получить данные карты из Steam");
      }
    } catch (err) {
      console.error(err);
      setEditError("Ошибка сети при обращении к Steam");
    } finally {
      setIsSyncingSteam(false);
    }
  };

  // Save updated custom map
  const handleUpdateCustomMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMap) return;
    if (!editMapName.trim()) {
      setEditError("Название карты обязательно");
      return;
    }
    const cleanMapId = editMapId.trim().replace(/[^0-9]/g, "");
    if (!cleanMapId) {
      setEditError("ID карты обязателен (только цифры)");
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/custom-maps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingMap.id,
          map_id: cleanMapId,
          name: editMapName.trim(),
          description: editMapDesc.trim(),
          match_format: editMapFormat,
          image_url: editMapImage.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingMap(null);
        await fetchCustomMaps();
      } else {
        const data = await res.json();
        setEditError(data.error || "Ошибка сохранения карты");
      }
    } catch (err) {
      console.error(err);
      setEditError("Ошибка сети");
    } finally {
      setIsSavingEdit(false);
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
    <div className="space-y-6 text-slate-900 font-sans">
      {/* 1. Header Status Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              DashMatch
            </h2>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  isAgentOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                )}
              />
              <span>{isAgentOnline ? "В сети" : "Не подключен"}</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {isAgentOnline
              ? `Локальный IP: ${agent?.lan_ip || "127.0.0.1"} • Порты: ${agent?.base_port || 27015}..${
                  (agent?.base_port || 27015) + (agent?.max_instances || 4) - 1
                } • Слотов доступно: ${agent?.max_instances || 4}`
              : "Запустите dashmatch.exe на выделенном ПК клуба для автоматического старта серверов CS2"}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => alert("Загрузка агента dashmatch.exe будет доступна в ближайшем обновлении")}
            className="bg-black hover:bg-slate-800 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Скачать</span>
          </button>

          <button
            type="button"
            onClick={() => fetchStatus(true)}
            disabled={isRefreshing}
            title="Обновить статус"
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* 2. Sub-Tab Navigation Bar */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab("setup")}
          className={cn(
            "flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-medium transition-all text-center cursor-pointer whitespace-nowrap",
            subTab === "setup"
              ? "bg-slate-900 text-white shadow-xs font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          Подключение ПК
        </button>

        <button
          type="button"
          onClick={() => setSubTab("servers")}
          className={cn(
            "flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap",
            subTab === "servers"
              ? "bg-slate-900 text-white shadow-xs font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <span>Серверы</span>
          {liveMatches.length > 0 && (
            <span
              className={cn(
                "text-[10px] font-mono px-2 py-0.5 rounded-md font-bold",
                subTab === "servers" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
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
            "flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap",
            subTab === "maps"
              ? "bg-slate-900 text-white shadow-xs font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          )}
        >
          <span>Мастерская</span>
          {customMaps.length > 0 && (
            <span
              className={cn(
                "text-[10px] font-mono px-2 py-0.5 rounded-md font-bold",
                subTab === "maps" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
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
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 flex flex-col justify-between">

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Привязка компьютера клуба
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed pt-1">
                Сгенерируйте 6-значный PIN-код и укажите его в консоли{" "}
                <code className="font-mono font-semibold bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded">
                  dashmatch.exe
                </code>{" "}
                на выделенном ПК клуба. Привязка выполняется один раз.
              </p>
            </div>

            {pairCode ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
                <span className="text-xs font-medium text-slate-500 block">
                  Одноразовый PIN-код привязки:
                </span>
                <div className="text-4xl sm:text-5xl font-mono font-bold tracking-widest text-slate-900 select-all">
                  {pairCode.slice(0, 3)} {pairCode.slice(3)}
                </div>
                <div className="text-xs text-slate-400">
                  Код действителен 30 минут
                </div>
                <div className="flex justify-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(pairCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 transition-all shadow-xs cursor-pointer"
                  >
                    {copiedCode ? "Скопировано!" : "Скопировать PIN"}
                  </button>
                  <button
                    type="button"
                    onClick={handleGeneratePairCode}
                    disabled={isGeneratingCode}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
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
                  className="w-full bg-black hover:bg-slate-800 disabled:opacity-50 text-white font-medium text-sm py-3.5 rounded-xl transition-all shadow-sm text-center cursor-pointer"
                >
                  {isGeneratingCode ? "Генерация кода..." : "Сгенерировать PIN-код"}
                </button>
              </div>
            )}
          </div>

          {/* 3 Steps */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Инструкция
              </span>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Порядок запуска за 3 шага
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-mono font-bold text-sm bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg shrink-0 mt-0.5">
                  01
                </span>
                <div className="text-xs text-slate-600 leading-relaxed">
                  <strong className="font-semibold text-slate-900 block mb-0.5">
                    Запустите dashmatch.exe
                  </strong>
                  Откройте исполняемый файл на компьютере, выделенном под игровые серверы в локальной сети клуба.
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-mono font-bold text-sm bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg shrink-0 mt-0.5">
                  02
                </span>
                <div className="text-xs text-slate-600 leading-relaxed">
                  <strong className="font-semibold text-slate-900 block mb-0.5">
                    Укажите PIN-код привязки
                  </strong>
                  В консоли выберите пункт <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-900">[1]</code> и введите 6-значный код.
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-mono font-bold text-sm bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg shrink-0 mt-0.5">
                  03
                </span>
                <div className="text-xs text-slate-600 leading-relaxed">
                  <strong className="font-semibold text-slate-900 block mb-0.5">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
            <span className="text-xs font-semibold text-slate-500">
              Матчи на серверах CS2: <strong className="text-slate-900">{activeMatches.length}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterActiveOnly(false)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer",
                  !filterActiveOnly
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Все ({activeMatches.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterActiveOnly(true)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer",
                  filterActiveOnly
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Только Live ({liveMatches.length})
              </button>
            </div>
          </div>

          {displayedMatches.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2 shadow-xs">
              <h4 className="text-sm font-semibold text-slate-900">
                {filterActiveOnly ? "Нет запущенных Live-матчей" : "Нет активных серверов CS2"}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Сервер CS2 автоматически запускается на клубном ПК, когда администратор нажимает{" "}
                <strong className="text-slate-800 font-semibold">«Запустить сервер»</strong> внутри карточки матча в сетке турнира.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500">
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
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-6">
                            <div className="font-semibold text-sm text-slate-900">
                              {m.team1_name}{" "}
                              <span className="text-slate-400 font-normal">vs</span>{" "}
                              {m.team2_name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              ID: {m.id}
                            </div>
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 font-mono font-bold text-xs">
                              {m.score1} : {m.score2}
                            </span>
                          </td>

                          <td className="py-4 px-4 font-semibold text-slate-700 uppercase font-mono">
                            {m.map_name}
                          </td>

                          <td className="py-4 px-4 font-mono font-medium text-slate-600">
                            {m.port}
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <span
                              className={cn(
                                "text-xs font-medium px-2.5 py-0.5 rounded-full border",
                                m.game_state === "paused"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
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
                              <span className="font-mono text-xs text-slate-700 font-medium bg-slate-100 px-2.5 py-1 rounded-lg select-all">
                                {connectCmd}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(connectCmd);
                                  setCopiedConnectId(m.id);
                                  setTimeout(() => setCopiedConnectId(null), 2000);
                                }}
                                className="px-2.5 py-1 text-xs rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition-colors cursor-pointer shrink-0"
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
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-medium transition-colors cursor-pointer"
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
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-slate-700" />
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
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
              className="bg-black hover:bg-slate-800 text-white font-medium text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-2 self-start sm:self-auto shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddMapOpen ? "Скрыть форму" : "Добавить карту по ссылке"}</span>
            </button>
          </div>

          {/* Steam Workshop Validator Panel */}
          {isAddMapOpen && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-lg space-y-5 animate-in fade-in slide-in-from-top-3 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-slate-700" />
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                    Валидатор ссылок Steam Workshop
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddMapOpen(false)}
                  className="text-xs font-medium text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  Закрыть
                </button>
              </div>

              {/* URL Input Form */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-700 block">
                  Вставьте ссылку на карту из Мастерской Steam или ID:
                </label>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <div className="relative flex-1">
                    <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
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
                      className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleValidateWorkshopLink()}
                    disabled={isValidating || !workshopInput.trim()}
                    className="bg-black hover:bg-slate-800 disabled:opacity-40 text-white text-xs sm:text-sm font-medium px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-sm"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
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
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-start gap-2.5">
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
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Результат проверки в Steam
                    </span>
                    {validatedItem.is_cs2 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Совместима с Counter-Strike 2
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
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
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white font-mono text-[10px] font-medium backdrop-blur-xs">
                        ID: {newMapId}
                      </div>
                    </div>

                    {/* Editable fields */}
                    <div className="md:col-span-8 space-y-3 text-xs">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Название карты в турнирах:
                        </label>
                        <input
                          type="text"
                          value={newMapName}
                          onChange={(e) => setNewMapName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Назначение / Формат:
                          </label>
                          <select
                            value={newMapFormat}
                            onChange={(e) => setNewMapFormat(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                          >
                            <option value="all">Для всех форматов</option>
                            <option value="1v1">1х1 (Aim / AWP / Duels)</option>
                            <option value="2v2">2х2 (Wingman / Напарники)</option>
                            <option value="5v5">5х5 (Competitive / Retake)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Steam Workshop:
                          </label>
                          <a
                            href={validatedItem.workshop_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-black py-2"
                          >
                            <span>Открыть страницу в Steam</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          Описание (опционально):
                        </label>
                        <input
                          type="text"
                          value={newMapDesc}
                          onChange={(e) => setNewMapDesc(e.target.value)}
                          placeholder="Описание карты или особенности геймплея"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
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
                      className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-medium cursor-pointer"
                    >
                      Сбросить
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCustomMap}
                      className="px-5 py-2.5 rounded-xl bg-black hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-2.5 sm:p-3 rounded-2xl shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setMapCategoryFilter("all")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer shrink-0",
                  mapCategoryFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Все карты ({customMaps.length})
              </button>
              <button
                type="button"
                onClick={() => setMapCategoryFilter("1v1")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5",
                  mapCategoryFilter === "1v1"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Swords className="w-3.5 h-3.5" />
                <span>1х1 Aim / Duels</span>
              </button>
              <button
                type="button"
                onClick={() => setMapCategoryFilter("2v2")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5",
                  mapCategoryFilter === "2v2"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>2х2 Wingman</span>
              </button>
              <button
                type="button"
                onClick={() => setMapCategoryFilter("5v5")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5",
                  mapCategoryFilter === "5v5"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Cards Gallery */}
          {filteredCustomMaps.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Globe className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">
                {customMaps.length === 0 ? "Кастомных карт пока нет" : "Карты не найдены"}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Вставьте ссылку на карту из Steam Workshop, чтобы добавить её в клуб и использовать в турнирах.
              </p>
              {!isAddMapOpen && (
                <button
                  type="button"
                  onClick={() => setIsAddMapOpen(true)}
                  className="px-4 py-2 bg-black hover:bg-slate-800 text-white text-xs font-medium rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить первую карту</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {filteredCustomMaps.map((cm) => {
                const formatBadge = {
                  "1v1": { label: "1x1 Aim / Duel", bg: "bg-slate-900/80 text-white" },
                  "2v2": { label: "2x2 Wingman", bg: "bg-slate-900/80 text-white" },
                  "5v5": { label: "5x5 Competitive", bg: "bg-slate-900/80 text-white" },
                  all: { label: "Все форматы", bg: "bg-slate-900/80 text-white" },
                }[cm.match_format || "all"] || { label: cm.match_format, bg: "bg-slate-900/80 text-white" };

                return (
                  <div
                    key={cm.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group"
                  >
                    {/* Image Poster */}
                    <div 
                      onClick={() => handleOpenEditMap(cm)}
                      className="relative aspect-[16/10] bg-slate-900 overflow-hidden cursor-pointer"
                      title="Нажмите, чтобы редактировать карту"
                    >
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
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs", formatBadge.bg)}>
                          {formatBadge.label}
                        </span>
                        <span className="text-[10px] font-mono font-medium bg-black/60 text-white/90 px-2 py-0.5 rounded-md backdrop-blur-xs">
                          ID: {cm.map_id}
                        </span>
                      </div>

                      {/* Map Name over poster */}
                      <div className="absolute bottom-2.5 left-2.5 right-2.5">
                        <h4 className="text-sm font-semibold text-white drop-shadow truncate group-hover:text-slate-100 transition-colors">
                          {cm.name}
                        </h4>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {cm.description || "Карта из мастерской Steam Workshop"}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <a
                          href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${cm.map_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors"
                        >
                          <span>В мастерской</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleOpenEditMap(cm)}
                          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                          title="Редактировать карту"
                        >
                          <Edit className="w-3.5 h-3.5" />
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

      {/* 6. EDIT MAP MODAL */}
      {editingMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in-0">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xl space-y-5 text-slate-900 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Редактировать карту
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <span>Steam Workshop:</span>
                  <a
                    href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${editMapId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono font-medium text-slate-700 hover:text-black inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    #{editMapId || editingMap.map_id}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMap(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomMap} className="space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Preview banner if image exists */}
              {editMapImage && (
                <div className="relative aspect-[16/8] rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editMapImage}
                    alt={editMapName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 text-white text-xs font-semibold drop-shadow truncate">
                    {editMapName || "Предпросмотр карты"}
                  </div>
                </div>
              )}

              {/* Workshop ID with Sync button */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  ID карты в Steam Workshop
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={editMapId}
                    onChange={(e) => setEditMapId(e.target.value)}
                    placeholder="Например: 3070923343"
                    className="flex-1 bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleSyncEditWithSteam}
                    disabled={isSyncingSteam || !editMapId.trim()}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                    title="Заново запросить название, постер и описание из мастерской Steam"
                  >
                    {isSyncingSteam ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Из Steam</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Кнопка «Из Steam» обновит название, описание и постер по указанному ID
                </p>
              </div>

              {/* Map Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Название карты в турнирах
                </label>
                <input
                  type="text"
                  required
                  value={editMapName}
                  onChange={(e) => setEditMapName(e.target.value)}
                  className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                />
              </div>

              {/* Match Format */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Назначение / Формат
                </label>
                <select
                  value={editMapFormat}
                  onChange={(e) => setEditMapFormat(e.target.value)}
                  className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium transition-all cursor-pointer"
                >
                  <option value="all">Для всех форматов</option>
                  <option value="1v1">1х1 (Aim / AWP / Duels)</option>
                  <option value="2v2">2х2 (Wingman / Напарники)</option>
                  <option value="5v5">5х5 (Competitive / Retake)</option>
                </select>
              </div>

              {/* Image URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Ссылка на изображение (постер)
                </label>
                <input
                  type="text"
                  value={editMapImage}
                  onChange={(e) => setEditMapImage(e.target.value)}
                  placeholder="https://... или оставьте пустым"
                  className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Описание карты
                </label>
                <textarea
                  value={editMapDesc}
                  onChange={(e) => setEditMapDesc(e.target.value)}
                  rows={3}
                  placeholder="Особенности карты, примечания для игроков..."
                  className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={async () => {
                    if (editingMap) {
                      await handleDeleteCustomMap(editingMap.id);
                      setEditingMap(null);
                    }
                  }}
                  className="h-10 sm:h-11 rounded-xl px-3 sm:px-4 border border-rose-200 text-rose-600 hover:bg-rose-50 font-medium transition-all text-xs sm:text-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Удалить карту</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMap(null)}
                    className="h-10 sm:h-11 rounded-xl px-4 sm:px-5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-all text-xs sm:text-sm cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit || !editMapName.trim()}
                    className="h-10 sm:h-11 rounded-xl px-5 sm:px-6 bg-black text-white hover:bg-slate-800 font-medium transition-all shadow-sm text-xs sm:text-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSavingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Сохранить</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


