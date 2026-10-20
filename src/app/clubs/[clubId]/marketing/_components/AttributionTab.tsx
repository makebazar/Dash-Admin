"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  CheckCircle2, 
  Trash2 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClubAnalytics, ClientProfile } from "./segmentation";
import type { MarketingCampaignRecord } from "./SmsCampaignModal";

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
  onNavigateToSms: () => void;
  onNavigateToVk: () => void;
}

export function AttributionTab({ clubId, analytics, onNavigateToSms, onNavigateToVk }: Props) {
  const [campaigns, setCampaigns] = useState<MarketingCampaignRecord[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const storageKey = `marketing_campaigns_${clubId}`;

  // Load registered campaigns
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setCampaigns(parsed);
            if (parsed.length > 0 && !selectedCampaignId) {
              setSelectedCampaignId(parsed[0].id);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load campaigns:", err);
      }
    }
  }, [storageKey]);

  const handleDeleteCampaign = (id: string) => {
    if (!confirm("Удалить эту кампанию из аналитики?")) return;
    const updated = campaigns.filter((c) => c.id !== id);
    setCampaigns(updated);
    if (selectedCampaignId === id) {
      setSelectedCampaignId(updated[0]?.id || null);
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // Build profile lookup map
  const profileMap = useMemo(() => {
    const map = new Map<string, ClientProfile>();
    if (!analytics || !analytics.profiles) return map;
    for (const p of analytics.profiles) {
      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
      if (norm) map.set(norm, p);
    }
    return map;
  }, [analytics]);

  // Attribution calculations
  const computedCampaigns = useMemo(() => {
    return campaigns.map((camp) => {
      const campDate = new Date(camp.createdAt);
      let returnedCount = 0;
      let returnedRevenue = 0;
      const returnedProfiles: ClientProfile[] = [];

      for (const phone of camp.targetPhones) {
        const p = profileMap.get(phone);
        if (p) {
          const lastVisit = p.lastAuth ? new Date(p.lastAuth) : null;
          // Return criteria: visited or spent money
          if ((lastVisit && lastVisit.getTime() >= campDate.getTime() - 86400000) || p.totalSpent > 0) {
            returnedCount++;
            returnedRevenue += p.totalSpent || 0;
            returnedProfiles.push(p);
          }
        }
      }

      return {
        ...camp,
        returnedCount,
        returnedRevenue,
        returnedProfiles,
      };
    });
  }, [campaigns, profileMap]);

  const totalTargeted = computedCampaigns.reduce((sum, c) => sum + c.targetPhones.length, 0);
  const totalReturned = computedCampaigns.reduce((sum, c) => sum + (c.returnedCount || 0), 0);
  const totalRevenue = computedCampaigns.reduce((sum, c) => sum + (c.returnedRevenue || 0), 0);
  const avgConversion = totalTargeted > 0 ? Math.round((totalReturned / totalTargeted) * 1000) / 10 : 0;

  const activeCampaign = computedCampaigns.find((c) => c.id === selectedCampaignId) || computedCampaigns[0] || null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Сквозная аналитика маркетинга и доходимость</h2>
          <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
            Автоматическое сопоставление запущенных SMS-рассылок, таргета VK и задач администраторов с отчетами клуба. Показывает, сколько клиентов реально вернулись и сколько выручки принесли.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={onNavigateToSms}
            className="px-4 py-2 bg-black hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
          >
            + SMS-рассылка
          </button>

          <button
            type="button"
            onClick={onNavigateToVk}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
          >
            + Аудитория VK
          </button>
        </div>
      </div>

      {/* KPI Overview Scoreboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Запущено кампаний</span>
          <p className="text-3xl font-bold tracking-tight text-slate-900 mt-2">
            {campaigns.length}
          </p>
          <span className="text-[11px] text-slate-400 mt-1">SMS, VK и задачи смене</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Охвачено клиентов</span>
          <p className="text-3xl font-bold tracking-tight text-slate-900 mt-2">
            {totalTargeted.toLocaleString("ru")}
          </p>
          <span className="text-[11px] text-slate-400 mt-1">уникальных номеров в базе</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Вернулось в клуб</span>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-bold tracking-tight text-emerald-600">
              {totalReturned.toLocaleString("ru")}
            </p>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {avgConversion}%
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">средняя конверсия возврата</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Принесли выручки</span>
          <p className="text-3xl font-bold tracking-tight text-violet-600 mt-2 tabular-nums">
            {Math.round(totalRevenue).toLocaleString("ru")} ₽
          </p>
          <span className="text-[11px] text-slate-400 mt-1">атрибутированный доход</span>
        </div>
      </div>

      {/* Campaigns List and Drilldown */}
      {computedCampaigns.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-xs">
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">Пока не запущено ни одной кампании</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Создайте SMS-рассылку во вкладке <b>«SMS»</b> или экспортируйте аудиторию в <b>«VK»</b>. Они автоматически появятся здесь, и при загрузке новых отчетов система посчитает реальный возврат гостей.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onNavigateToSms}
              className="px-4 py-2 bg-black hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Перейти в SMS
            </button>
            <button
              type="button"
              onClick={onNavigateToVk}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-xs transition-colors cursor-pointer"
            >
              Перейти в VK
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Campaigns List */}
          <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Запущенные кампании ({computedCampaigns.length})
              </h3>
              <span className="text-[11px] text-slate-400">Кликните для деталей</span>
            </div>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {computedCampaigns.map((camp) => {
                const isSelected = selectedCampaignId === camp.id;
                const conv = camp.targetPhones.length > 0 
                  ? Math.round(((camp.returnedCount || 0) / camp.targetPhones.length) * 1000) / 10 
                  : 0;

                return (
                  <div
                    key={camp.id}
                    onClick={() => setSelectedCampaignId(camp.id)}
                    className={cn(
                      "p-3.5 rounded-xl border text-left cursor-pointer transition-all",
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-md"
                        : "bg-slate-50/60 hover:bg-slate-100/80 border-slate-200 text-slate-800"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                            camp.channel === "sms" 
                              ? "bg-violet-100 text-violet-700" 
                              : camp.channel === "vk" 
                                ? "bg-blue-100 text-blue-700" 
                                : "bg-emerald-100 text-emerald-700"
                          )}>
                            {camp.channel.toUpperCase()}
                          </span>
                          <span className={cn(
                            "text-[10px]",
                            isSelected ? "text-slate-400" : "text-slate-400"
                          )}>
                            {new Date(camp.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <p className="text-xs font-bold leading-tight line-clamp-1">{camp.name}</p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCampaign(camp.id);
                        }}
                        className={cn(
                          "p-1 rounded-lg transition-colors",
                          isSelected ? "text-slate-400 hover:text-rose-400" : "text-slate-400 hover:text-rose-600"
                        )}
                        title="Удалить кампанию"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-slate-200/40 text-[11px]">
                      <div>
                        <span className={isSelected ? "text-slate-400" : "text-slate-400"}>Охват</span>
                        <p className="font-bold tabular-nums">{camp.targetPhones.length}</p>
                      </div>
                      <div>
                        <span className={isSelected ? "text-slate-400" : "text-slate-400"}>Вернулись</span>
                        <p className={cn("font-bold tabular-nums", isSelected ? "text-emerald-400" : "text-emerald-600")}>
                          {camp.returnedCount} ({conv}%)
                        </p>
                      </div>
                      <div>
                        <span className={isSelected ? "text-slate-400" : "text-slate-400"}>Выручка</span>
                        <p className={cn("font-bold tabular-nums", isSelected ? "text-violet-300" : "text-slate-900")}>
                          {Math.round(camp.returnedRevenue || 0).toLocaleString()} ₽
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Drilldown of Returning Guests */}
          <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
            {activeCampaign ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">
                        {activeCampaign.channel.toUpperCase()} кампания
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-400">
                        {new Date(activeCampaign.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">{activeCampaign.name}</h3>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">Атрибутированная выручка</span>
                    <p className="text-lg font-bold text-emerald-600 tabular-nums">
                      {Math.round(activeCampaign.returnedRevenue || 0).toLocaleString("ru")} ₽
                    </p>
                  </div>
                </div>

                {activeCampaign.templateText && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed italic">
                    «{activeCampaign.templateText}»
                  </div>
                )}

                {/* Returned Guests Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Гости, вернувшиеся после кампании ({(activeCampaign.returnedProfiles || []).length})
                    </h4>
                    <span className="text-[11px] text-emerald-600 font-semibold">
                      Конверсия: {activeCampaign.targetPhones.length > 0 
                        ? (Math.round(((activeCampaign.returnedCount || 0) / activeCampaign.targetPhones.length) * 1000) / 10) 
                        : 0}%
                    </span>
                  </div>

                  {(activeCampaign.returnedProfiles || []).length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Пока ни один клиент из списка не зафиксирован в загруженном срезе.
                      <br />
                      Загрузите отчет следующей недели/месяца для сверки визитов.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                          <tr className="text-slate-500">
                            <th className="py-2.5 px-3 font-semibold">Гость</th>
                            <th className="py-2.5 px-3 font-semibold">Телефон</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Потрачено</th>
                            <th className="py-2.5 px-3 font-semibold">Любимый ПК</th>
                            <th className="py-2.5 px-3 font-semibold">Любимый день</th>
                            <th className="py-2.5 px-3 font-semibold">Статус</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {(activeCampaign.returnedProfiles || []).map((p, idx) => (
                            <tr key={p.phone + idx} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2 px-3 font-semibold text-slate-900">{p.name || "Гость"}</td>
                              <td className="py-2 px-3 font-mono text-slate-600">{p.phone}</td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-600 tabular-nums">
                                {Math.round(p.totalSpent || 0).toLocaleString()} ₽
                              </td>
                              <td className="py-2 px-3 text-slate-600">{p.favoriteSeat || "—"}</td>
                              <td className="py-2 px-3 text-slate-600">{p.favoriteDay || "—"}</td>
                              <td className="py-2 px-3">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Вернулся</span>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
