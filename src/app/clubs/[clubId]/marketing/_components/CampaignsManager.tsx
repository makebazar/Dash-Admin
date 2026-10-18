"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Send, 
  Share2, 
  CheckSquare, 
  TrendingUp, 
  Users, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Trash2, 
  ArrowUpRight 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClubAnalytics } from "./segmentation";
import type { MarketingCampaignRecord } from "./SmsCampaignModal";

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
  onOpenSms: () => void;
  onOpenVk: () => void;
}

export function CampaignsManager({ clubId, analytics, onOpenSms, onOpenVk }: Props) {
  const [campaigns, setCampaigns] = useState<MarketingCampaignRecord[]>([]);

  const storageKey = `marketing_campaigns_${clubId}`;

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setCampaigns(parsed);
        }
      } catch (err) {
        console.warn("Failed to load campaigns:", err);
      }
    }
  }, [storageKey]);

  const handleDeleteCampaign = (id: string) => {
    const updated = campaigns.filter((c) => c.id !== id);
    setCampaigns(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // Compute attribution stats for each campaign
  const computedCampaigns = useMemo(() => {
    if (!analytics || !analytics.profiles) return campaigns;

    const profileMap = new Map();
    for (const p of analytics.profiles) {
      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
      if (norm) profileMap.set(norm, p);
    }

    return campaigns.map((camp) => {
      const campDate = new Date(camp.createdAt);
      let returnedCount = 0;
      let returnedRevenue = 0;

      for (const phone of camp.targetPhones) {
        const p = profileMap.get(phone);
        if (p) {
          // If client visited after campaign created date or is active
          const lastVisit = p.lastAuth ? new Date(p.lastAuth) : null;
          if (lastVisit && lastVisit.getTime() >= campDate.getTime() - 86400000) {
            returnedCount++;
            returnedRevenue += p.totalSpent || 0;
          }
        }
      }

      return {
        ...camp,
        returnedCount,
        returnedRevenue,
      };
    });
  }, [campaigns, analytics]);

  const totalTargeted = computedCampaigns.reduce((sum, c) => sum + c.targetPhones.length, 0);
  const totalReturned = computedCampaigns.reduce((sum, c) => sum + (c.returnedCount || 0), 0);
  const totalRevenue = computedCampaigns.reduce((sum, c) => sum + (c.returnedRevenue || 0), 0);
  const avgConversion = totalTargeted > 0 ? Math.round((totalReturned / totalTargeted) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* Overview Scoreboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Запущено кампаний</span>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            {campaigns.length}
          </p>
          <span className="text-[11px] text-slate-400 mt-1">SMS, VK и задачи</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Охвачено клиентов</span>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            {totalTargeted.toLocaleString("ru")}
          </p>
          <span className="text-[11px] text-slate-400 mt-1">уникальных контактов</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Вернулось в клуб</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <p className="text-2xl font-bold tracking-tight text-emerald-600">
              {totalReturned.toLocaleString("ru")}
            </p>
            <span className="text-xs font-semibold text-emerald-700">({avgConversion}%)</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">конверсия возврата</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Принесли выручки</span>
          <p className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            {Math.round(totalRevenue).toLocaleString("ru")} ₽
          </p>
          <span className="text-[11px] text-slate-400 mt-1">LTV вернувшихся гостей</span>
        </div>
      </div>

      {/* Action Buttons & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">История кампаний и сквозной трекинг</h3>
          <p className="text-xs text-slate-400">Система автоматически сопоставляет списки рассылок с визитами гостей</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSms}
            className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Создать SMS-рассылку</span>
          </button>

          <button
            type="button"
            onClick={onOpenVk}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Экспорт для VK</span>
          </button>
        </div>
      </div>

      {/* Campaigns Table */}
      {computedCampaigns.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-800 text-sm">Нет запущенных кампаний</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Создайте первую SMS-рассылку или выгрузите аудиторию для VK Рекламы — кампания автоматически появится здесь для сквозного отслеживания.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-4">Кампания</th>
                <th className="py-3 px-4">Канал</th>
                <th className="py-3 px-4">Дата запуска</th>
                <th className="py-3 px-4 text-right">Охват (контактов)</th>
                <th className="py-3 px-4 text-right">Вернулось</th>
                <th className="py-3 px-4 text-right">Выручка</th>
                <th className="py-3 px-4 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {computedCampaigns.map((c) => {
                const conv = c.targetPhones.length > 0
                  ? Math.round(((c.returnedCount || 0) / c.targetPhones.length) * 1000) / 10
                  : 0;

                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {c.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase",
                        c.channel === "sms" ? "bg-violet-100 text-violet-800" :
                        c.channel === "vk" ? "bg-blue-100 text-blue-800" :
                        "bg-amber-100 text-amber-800"
                      )}>
                        {c.channel === "sms" ? <Send className="w-3 h-3" /> :
                         c.channel === "vk" ? <Share2 className="w-3 h-3" /> :
                         <CheckSquare className="w-3 h-3" />}
                        <span>{c.channel.toUpperCase()}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium">
                      {c.targetPhones.length.toLocaleString("ru")} чел.
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-emerald-600 font-mono">
                        {(c.returnedCount || 0).toLocaleString("ru")} чел.
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        ({conv}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                      {Math.round(c.returnedRevenue || 0).toLocaleString("ru")} ₽
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteCampaign(c.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Удалить кампанию"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
