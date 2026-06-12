"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
  Target,
  CheckCircle2,
  ShoppingCart,
  Users,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import {
  QueueTab,
  type QueueItem,
} from "@/app/clubs/[clubId]/promo/_components/QueueTab";
import { HistoryTab } from "@/app/clubs/[clubId]/promo/_components/HistoryTab";
import { PlayersTab } from "@/app/clubs/[clubId]/promo/_components/PlayersTab";
import { GeneralTab } from "@/app/clubs/[clubId]/promo/_components/GeneralTab";
import { LevelsTab } from "@/app/clubs/[clubId]/promo/_components/LevelsTab";
import { QuestsTab } from "@/app/clubs/[clubId]/promo/_components/QuestsTab";
import { VerificationTab } from "@/app/clubs/[clubId]/promo/_components/VerificationTab";
import { BattlePassTab } from "@/app/clubs/[clubId]/promo/_components/BattlePassTab";
import { ServicesTab } from "@/app/clubs/[clubId]/promo/_components/ServicesTab";
import { AccrualTab } from "@/app/clubs/[clubId]/promo/_components/AccrualTab";
import { BarTab } from "@/app/clubs/[clubId]/promo/_components/BarTab";
import { ReferralsTab } from "@/app/clubs/[clubId]/promo/_components/ReferralsTab";
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
  const [activeTab, setActiveTab] = useState<
    | "queue"
    | "players"
    | "history"
    | "games"
    | "general"
    | "services"
    | "bar"
    | "levels"
    | "quests"
    | "verification"
    | "battlepass"
    | "accrual"
    | "referrals"
  >("queue");

  const [settings, setSettings] = useState<any>(null);
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
  const [selectedGame, setSelectedGame] = useState<string>("wheel");

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [clubId]);

  const fetchData = async () => {
    try {
      const [
        settingsRes,
        prizesRes,
        queueRes,
        logsRes,
        playersRes,
        productsRes,
      ] = await Promise.all([
        fetch(`/api/clubs/${clubId}`),
        fetch(`/api/promo/admin/prizes?clubId=${clubId}`),
        fetch(`/api/promo/admin/queue?clubId=${clubId}`),
        fetch(`/api/promo/admin/logs?clubId=${clubId}`),
        fetch(`/api/promo/admin/players?clubId=${clubId}`),
        fetch(`/api/promo/products?clubId=${clubId}&all=true`),
      ]);

      const settingsData = await settingsRes.json();
      const prizesData = await prizesRes.json();
      const queueData = await queueRes.json();
      const logsData = await logsRes.json();
      const playersData = await playersRes.json();
      const productsData = await productsRes.json();

      setSettings(settingsData.club?.promo_settings || {});
      setPrizes(prizesData.prizes || []);
      setQueue(queueData.queue || []);
      setLogs({
        issuance: logsData?.issuanceLogs || [],
        games: logsData?.gameLogs || [],
        stats: logsData?.stats || {},
      });
      setPlayers(playersData.players || []);
      setProducts(productsData.products || []);
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

  const serviceRules = settings?.service_rules || [];

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

  const handleClaim = async (id: string) => {
    try {
      await fetch(`/api/promo/admin/queue/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "claim" }),
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
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter italic uppercase">
              Promo <span className="text-orange-500">Engine</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
              Управление маркетингом и лояльностью
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "queue", label: "Очередь", icon: Trophy, color: "orange" },
              { id: "players", label: "Игроки", icon: User, color: "blue" },
              {
                id: "history",
                label: "История",
                icon: History,
                color: "emerald",
              },
              { id: "games", label: "Игры", icon: Gamepad2, color: "indigo" },
              { id: "levels", label: "Уровни", icon: Target, color: "purple" },
              { id: "quests", label: "Квесты", icon: Plus, color: "pink" },
              {
                id: "battlepass",
                label: "Battle Pass",
                icon: Disc,
                color: "yellow",
              },
              {
                id: "verification",
                label: "Верификация",
                icon: CheckCircle2,
                color: "emerald",
              },
              { id: "services", label: "Услуги", icon: Disc, color: "blue" },
              {
                id: "accrual",
                label: "Начисления",
                icon: Plus,
                color: "orange",
              },
              {
                id: "bar",
                label: "Маркет",
                icon: ShoppingCart,
                color: "emerald",
              },
              {
                id: "referrals",
                label: "Рефералы",
                icon: Users,
                color: "orange",
              },
              {
                id: "general",
                label: "Настройки",
                icon: Settings,
                color: "slate",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-2.5 rounded-2xl transition-all duration-300 font-black uppercase italic text-xs tracking-wider",
                  activeTab === tab.id
                    ? `bg-${tab.color}-500 text-white shadow-lg shadow-${tab.color}-500/20 scale-105`
                    : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200",
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "queue" && (
            <QueueTab
              queue={queue}
              handleClaim={handleClaim}
              handleCancel={handleCancel}
            />
          )}

          {activeTab === "history" && <HistoryTab logs={logs} />}

          {activeTab === "players" && (
            <PlayersTab
              clubId={clubId as string}
              players={players}
              onRefresh={fetchData}
            />
          )}

          {activeTab === "games" && (
            <motion.div
              key="games"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <GamesTab
                clubId={clubId as string}
                settings={settings}
                saveSettings={saveSettings}
                prizes={prizes}
                setPrizes={setPrizes}
              />
            </motion.div>
          )}

          {activeTab === "general" && (
            <GeneralTab
              settings={settings}
              saveSettings={saveSettings}
              clubId={clubId as string}
            />
          )}

          {activeTab === "levels" && <LevelsTab clubId={clubId as string} />}
          {activeTab === "quests" && (
            <QuestsTab
              clubId={clubId as string}
              products={products}
              categories={categories}
              serviceRules={serviceRules}
              settings={settings}
              saveSettings={saveSettings}
            />
          )}
          {activeTab === "verification" && (
            <VerificationTab clubId={clubId as string} />
          )}
          {activeTab === "battlepass" && (
            <BattlePassTab clubId={clubId as string} products={products} />
          )}
          {activeTab === "services" && (
            <ServicesTab settings={settings} saveSettings={saveSettings} />
          )}
          {activeTab === "accrual" && (
            <AccrualTab settings={settings} saveSettings={saveSettings} />
          )}
          {activeTab === "bar" && (
            <BarTab
              settings={settings}
              saveSettings={saveSettings}
              products={products}
              categories={categories}
            />
          )}
          {activeTab === "referrals" && (
            <ReferralsTab settings={settings} saveSettings={saveSettings} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
