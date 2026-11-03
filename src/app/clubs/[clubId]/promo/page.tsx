"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Settings,
  Plus,
  Loader2,
  History,
  User,
  Disc,
  Gamepad2,
  Package,
  Award,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import {
  QueueTab,
  type QueueItem,
} from "@/app/clubs/[clubId]/promo/_components/QueueTab";
import { HistoryTab } from "@/app/clubs/[clubId]/promo/_components/HistoryTab";
import { PlayersTab } from "@/app/clubs/[clubId]/promo/_components/PlayersTab";
import { GeneralTab } from "@/app/clubs/[clubId]/promo/_components/GeneralTab";
import { LoyaltyTab } from "@/app/clubs/[clubId]/promo/_components/LoyaltyTab";
import { ServicesTab } from "@/app/clubs/[clubId]/promo/_components/ServicesTab";
import { AccrualTab } from "@/app/clubs/[clubId]/promo/_components/AccrualTab";
import { CasesTab } from "@/app/clubs/[clubId]/promo/_components/CasesTab";
import {
  GamesTab,
  type Prize,
  GAMES,
} from "@/app/clubs/[clubId]/promo/_components/GamesTab";

/**
 * ПАНЕЛЬ УПРАВЛЕНИЯ АКЦИЯМИ (ДЛЯ ВЛАДЕЛЬЦА / УПРАВА)
 */

export default function PromotionsPage() {
  const { clubId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const initialTab = (tabParam as any) || "queue";
  const [activeTab, setActiveTab] = useState<
    | "queue"
    | "players"
    | "history"
    | "games"
    | "general"
    | "services"
    | "loyalty"
    | "accrual"
    | "cases"
  >(initialTab);

  const [mountedTabs, setMountedTabs] = useState<Record<string, boolean>>(() => ({
    [initialTab]: true,
  }));

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as any);
    setMountedTabs((prev) => (prev[tabId] ? prev : { ...prev, [tabId]: true }));
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", tabId);
      if (tabId !== "players") {
        params.delete("playerId");
      }
      const qs = params.toString();
      const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      window.history.replaceState(null, "", newUrl);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search).get("tab") || "queue";
      setActiveTab(p as any);
      setMountedTabs((prev) => (prev[p] ? prev : { ...prev, [p]: true }));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [settings, setSettings] = useState<any>(null);
  const [isSmartShellEnabled, setIsSmartShellEnabled] = useState(false);
  const [isSyncingSmartShell, setIsSyncingSmartShell] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<{
    issuance: any[];
    games: any[];
    stats: any;
  }>({ issuance: [], games: [], stats: {} });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Data State
  const [players, setPlayers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>("wheel");

  const handleSyncSmartShell = async () => {
    if (isSyncingSmartShell) return;
    setIsSyncingSmartShell(true);
    setSyncStatusMessage(null);
    try {
      const res = await fetch(`/api/promo/admin/sync-smartshell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncStatusMessage({
          text: `Синхронизировано: ${data.processedCount || 0} платежей (+${data.totalTicketsAwarded || 0} билетов), ${data.visitsProcessed || 0} визитов`,
          type: "success",
        });
        fetchData();
      } else {
        setSyncStatusMessage({
          text: data.error || data.message || "Ошибка синхронизации со SmartShell",
          type: "error",
        });
      }
    } catch (e: any) {
      setSyncStatusMessage({
        text: e.message || "Сетевая ошибка при синхронизации",
        type: "error",
      });
    } finally {
      setIsSyncingSmartShell(false);
      setTimeout(() => setSyncStatusMessage(null), 6000);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clubId]);

  useEffect(() => {
    if (!clubId || activeTab !== "queue") return;

    // Подключаемся к SSE-потоку для обновления очереди в реальном времени
    const eventSource = new EventSource(
      `/api/promo/admin/queue/stream?clubId=${clubId}`
    );

    const handleUpdate = () => {
      fetchQueueOnly();
    };

    eventSource.addEventListener("update", handleUpdate);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "update" || event.type === "update") {
          fetchQueueOnly();
        }
      } catch (e) {}
    };

    return () => {
      eventSource.close();
    };
  }, [clubId, activeTab]);

  const fetchQueueOnly = async () => {
    try {
      const res = await fetch(`/api/promo/admin/queue?clubId=${clubId}`);
      const data = await res.json();
      setQueue(data.queue || []);
    } catch (error) {
      console.error("Fetch Queue Error:", error);
    }
  };

  const fetchData = async () => {
    try {
      const [
        settingsRes,
        prizesRes,
        queueRes,
        logsRes,
        playersRes,
        productsRes,
        tariffsRes,
      ] = await Promise.all([
        fetch(`/api/clubs/${clubId}`),
        fetch(`/api/promo/admin/prizes?clubId=${clubId}`),
        fetch(`/api/promo/admin/queue?clubId=${clubId}`),
        fetch(`/api/promo/admin/logs?clubId=${clubId}`),
        fetch(`/api/promo/admin/players?clubId=${clubId}`),
        fetch(`/api/promo/products?clubId=${clubId}&all=true`),
        fetch(`/api/clubs/${clubId}/tariffs`),
      ]);

      const settingsData = await settingsRes.json();
      const prizesData = await prizesRes.json();
      const queueData = await queueRes.json();
      const logsData = await logsRes.json();
      const playersData = await playersRes.json();
      const productsData = await productsRes.json();
      const tariffsData = await tariffsRes.json();

      const club = settingsData.club || {};
      setSettings(club.promo_settings || {});
      setIsSmartShellEnabled(Boolean(club.is_smartshell_enabled));
      setPrizes(prizesData.prizes || []);
      setQueue(queueData.queue || []);
      setLogs({
        issuance: logsData?.issuanceLogs || [],
        games: logsData?.gameLogs || [],
        stats: logsData?.stats || {},
      });
      setPlayers(playersData.players || []);
      setProducts(productsData.products || []);
      setTariffs(tariffsData.tariffs || []);
      setZones(tariffsData.zones || []);
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = React.useMemo(() => {
    const cats: any[] = [];
    const seen = new Set();
    products.forEach((p) => {
      if (p.category_id && !seen.has(p.category_id)) {
        seen.add(p.category_id);
        cats.push({
          id: p.category_id,
          name: p.category_name || "Без категории",
        });
      }
    });
    return cats;
  }, [products]);

  const serviceRules = tariffs.length > 0 ? tariffs : (settings?.service_rules || []);

  const saveSettings = async (newSettings: any) => {
    setIsSaving(true);
    try {
      await fetch(`/api/clubs/${clubId}/promo-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
      });
      setSettings(newSettings);
    } catch (error) {
      console.error("Save Settings Error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClaim = async (id: string, customAmount?: number) => {
    try {
      await fetch(`/api/promo/admin/queue/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "claim", customAmount }),
      });
      fetchData();
    } catch (error) {
      console.error("Claim Prize Error:", error);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await fetch(`/api/promo/admin/queue/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancel" }),
      });
      fetchData();
    } catch (error) {
      console.error("Cancel Prize Error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] flex-col font-sans text-slate-900 selection:bg-black/10">
      <main className="mx-auto max-w-6xl w-full flex-1 px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
              Промо-система
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Управление маркетингом, лояльностью, билетами и выдачей призов
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isSmartShellEnabled && (
              <button
                onClick={handleSyncSmartShell}
                disabled={isSyncingSmartShell}
                className="inline-flex items-center gap-2 h-10 sm:h-11 rounded-xl px-3.5 sm:px-4 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium text-xs sm:text-sm transition-all shadow-xs cursor-pointer disabled:opacity-60"
                title="Синхронизировать платежи, сессии и тарифы SmartShell"
              >
                <RefreshCw
                  className={cn(
                    "w-3.5 h-3.5 text-slate-400",
                    isSyncingSmartShell && "animate-spin text-blue-600"
                  )}
                />
                <span>
                  {isSyncingSmartShell ? "Синхронизация..." : "Синхронизация SmartShell"}
                </span>
              </button>
            )}

            <a
              href={`/promo?clubId=${clubId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 sm:h-11 rounded-xl px-4 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium text-xs sm:text-sm transition-all shadow-xs"
            >
              <span>Приложение гостя</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        {syncStatusMessage && (
          <div
            className={cn(
              "mb-4 p-3 sm:p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between gap-3 border shadow-xs animate-in fade-in duration-200",
              syncStatusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            )}
          >
            <div className="flex items-center gap-2">
              {syncStatusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{syncStatusMessage.text}</span>
            </div>
            <button
              onClick={() => setSyncStatusMessage(null)}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Root Tabs */}
        <div className="flex items-center bg-white p-1 sm:p-1.5 rounded-xl border border-slate-200 shadow-xs gap-1 mb-6 overflow-x-auto scrollbar-hide">
          {[
            { id: "queue", label: "Очередь", count: queue.length },
            { id: "players", label: "Игроки", count: players.length },
            { id: "history", label: "История" },
            { id: "loyalty", label: "Лояльность" },
            { id: "games", label: "Игры" },
            { id: "cases", label: "Кейсы" },
            { id: "services", label: "Услуги" },
            { id: "accrual", label: "Начисления" },
            { id: "general", label: "Настройки" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
                  tab.id === "general" && "ml-auto",
                  isActive
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <span>{tab.label}</span>
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span
                    className={cn(
                      "text-[10px] font-mono px-1.5 py-0.2 rounded-md font-bold",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div>
          {mountedTabs["queue"] && (
            <div className={activeTab === "queue" ? "block" : "hidden"}>
              <QueueTab
                queue={queue}
                handleClaim={handleClaim}
                handleCancel={handleCancel}
              />
            </div>
          )}

          {mountedTabs["history"] && (
            <div className={activeTab === "history" ? "block" : "hidden"}>
              <HistoryTab logs={logs} clubId={clubId as string} />
            </div>
          )}

          {mountedTabs["players"] && (
            <div className={activeTab === "players" ? "block" : "hidden"}>
              <PlayersTab
                clubId={clubId as string}
                players={players}
                onRefresh={fetchData}
                settings={settings}
              />
            </div>
          )}

          {mountedTabs["loyalty"] && (
            <div className={activeTab === "loyalty" ? "block" : "hidden"}>
              <LoyaltyTab
                clubId={clubId as string}
                tariffs={tariffs}
                zones={zones}
                settings={settings}
                saveSettings={saveSettings}
                isSmartShellEnabled={isSmartShellEnabled}
              />
            </div>
          )}

          {mountedTabs["games"] && (
            <div className={activeTab === "games" ? "block" : "hidden"}>
              <GamesTab
                clubId={clubId as string}
                settings={settings}
                saveSettings={saveSettings}
                prizes={prizes}
                setPrizes={setPrizes}
              />
            </div>
          )}

          {mountedTabs["general"] && (
            <div className={activeTab === "general" ? "block" : "hidden"}>
              <GeneralTab
                settings={settings}
                saveSettings={saveSettings}
                clubId={clubId as string}
                zones={zones}
                onZonesUpdated={fetchData}
              />
            </div>
          )}

          {mountedTabs["cases"] && (
            <div className={activeTab === "cases" ? "block" : "hidden"}>
              <CasesTab clubId={clubId as string} products={products} serviceRules={serviceRules} categories={categories} />
            </div>
          )}

          {mountedTabs["services"] && (
            <div className={activeTab === "services" ? "block" : "hidden"}>
              <ServicesTab
                settings={settings}
                saveSettings={saveSettings}
                tariffs={tariffs}
                zones={zones}
                isSmartShellEnabled={isSmartShellEnabled}
              />
            </div>
          )}

          {mountedTabs["accrual"] && (
            <div className={activeTab === "accrual" ? "block" : "hidden"}>
              <AccrualTab settings={settings} saveSettings={saveSettings} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
