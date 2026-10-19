"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  type ClientProfile,
  type ClubAnalytics,
  type DateFilter,
  type MonthOption,
  getAvailableMonths,
} from "./segmentation";
import type { MarketingCampaignRecord } from "./SmsCampaignModal";
import type { SegmentationFilter } from "./SmsTab";

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
  excludedPhones: string[];
  dateFilter?: DateFilter | null;
  onDateFilterChange?: (filter: DateFilter | null) => void;
}

export interface VkAdsConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  userName?: string;
}

const DEFAULT_SEGMENTATION: SegmentationFilter = {
  spentMin: "",
  spentMax: "",
  daysSinceMin: "",
  daysSinceMax: "",
  balanceMin: "",
  balanceMax: "",
  bonusMin: "",
  bonusMax: "",
  visitsMin: "",
  visitsMax: "",
  loyaltyMode: "all",
  dayType: "all",
  specificDay: "",
  preferredTime: "all",
  favoriteZone: "all",
};

const PRESETS = [
  {
    name: "Киты для Lookalike (LTV 2500+ ₽)",
    campaignName: "VK: Lookalike на VIP-клиентов клуба",
    strategy: "Поиск в радиусе 1.5–3 км вокруг заведения аудитории с похожим платежеспособным поведением",
    filter: { ...DEFAULT_SEGMENTATION, spentMin: 2500 },
    objective: "lookalike",
    geoRadius: "2.5 км от клуба",
    creativeAngle: "Мощное железо, мониторы 240+ Гц, закрытые буткампы для стаков и ночные катки",
    sampleText: "Катай на максималках в шаговой доступности! RTX 4080, 280Hz мониторы и закрытые буткампы в твоем районе. Забронируй свой привычный ПК через бота.",
  },
  {
    name: "Реактивация оттока (>30 дней без визита)",
    campaignName: "VK: Возврат ушедших гостей (Ретаргетинг)",
    strategy: "Прямой ретаргетинг на базу бывших постоянников с оффером на возвращение",
    filter: { ...DEFAULT_SEGMENTATION, daysSinceMin: 31, spentMin: 500 },
    objective: "retargeting",
    geoRadius: "Пользовательская аудитория (номера)",
    creativeAngle: "Промокод на возврат, начисление 200 бонусов на баланс, обновление софта и девайсов",
    sampleText: "Давно не виделись в клубе! Начислили 200 бонусов на твой аккаунт на 4 дня. Заходи заценить обновленные девайсы и софт.",
  },
  {
    name: "Ночники (Пакет Ночь)",
    campaignName: "VK: Анонс ночных пакетов перед выходными",
    strategy: "Таргетинг с ограничением расписания показа (17:00–22:00) в четверг, пятницу и субботу",
    filter: { ...DEFAULT_SEGMENTATION, preferredTime: "night" as const, spentMin: 500 },
    objective: "night_owl",
    geoRadius: "3 км от клуба",
    creativeAngle: "Выгодная цена ночного нон-стопа, бронь на компании, энергетики и атмосфера",
    sampleText: "Ночной марафон в клубе! Залетай с пати на пакет «Ночь» с 22:00 до 08:00 по спеццене. Забронируй ПК заранее, места на ночь разлетаются.",
  },
  {
    name: "Консольщики (PS Зона / FC25 / Mortal Kombat)",
    campaignName: "VK: Турниры и аренда диванов PS5",
    strategy: "Таргетинг на любителей консолей, файтингов и спортивных симуляторов для загрузки лаундж-зоны",
    filter: { ...DEFAULT_SEGMENTATION, favoriteZone: "PS Зона" },
    objective: "console",
    geoRadius: "4 км от клуба",
    creativeAngle: "PlayStation 5, 4K экраны, удобные диваны, кальяны/снеки и парные зарубы",
    sampleText: "Пятничные катки в FC25 и Mortal Kombat 1 на огромном экране! Арендуй диван с PS5 для своей компании в пару кликов.",
  },
  {
    name: "Игроки выходных (Трафик в будние дни)",
    campaignName: "VK: Загрузка будней для клиентов уикенда",
    strategy: "Специальный оффер со скидкой 30% или повышенным кешбэком во вторник–четверг",
    filter: { ...DEFAULT_SEGMENTATION, dayType: "weekend" as const, spentMin: 1000 },
    objective: "weekdays_boost",
    geoRadius: "2 км от клуба",
    creativeAngle: "Свободные топ-ПК без очередей, двойной кешбэк в дневное время в будни",
    sampleText: "Зачем ждать выходных? С понедельника по четверг до 17:00 в клубе действует специальный дневной тариф со скидкой 30%!",
  },
  {
    name: "Забытый депозит (Баланс > 100 ₽)",
    campaignName: "VK: Активация оставшихся денег на балансах",
    strategy: "Напоминание игрокам, у которых на счете уже лежат реальные рубли",
    filter: { ...DEFAULT_SEGMENTATION, balanceMin: 100, daysSinceMin: 14 },
    objective: "balance_reminder",
    geoRadius: "Пользовательская аудитория",
    creativeAngle: "Твои деньги не сгорают, твой любимый сетап свободен",
    sampleText: "На твоем игровом балансе в клубе всё ещё лежат средства! Заглядывай сегодня — твой привычный компьютер ждет.",
  },
];

const DAYS_OF_WEEK = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

export function VkTab({ clubId, analytics, excludedPhones, dateFilter, onDateFilterChange }: Props) {
  const storageKey = `marketing_campaigns_${clubId}`;
  const vkConfigKey = `marketing_vk_config_${clubId}`;

  // Date / Period handling
  const datasetFrom = analytics?.datasetDateFrom || analytics?.reportDateFrom;
  const datasetTo = analytics?.datasetDateTo || analytics?.reportDateTo;

  const availableMonths = useMemo(() => {
    if (!datasetFrom || !datasetTo) return [];
    return getAvailableMonths(datasetFrom, datasetTo);
  }, [datasetFrom, datasetTo]);

  const totalDatasetDays = useMemo(() => {
    if (!datasetFrom || !datasetTo) return analytics?.reportDays || 0;
    return Math.max(1, Math.round(Math.abs(datasetTo.getTime() - datasetFrom.getTime()) / 86_400_000));
  }, [datasetFrom, datasetTo, analytics?.reportDays]);

  const periodLabel = useMemo(() => {
    if (dateFilter?.monthKey) {
      const found = availableMonths.find((m) => m.key === dateFilter.monthKey);
      if (found) return found.label;
    }
    if (dateFilter?.startDate && dateFilter?.endDate) {
      return `${dateFilter.startDate.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} – ${dateFilter.endDate.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })} (${analytics?.reportDays || 0} дн.)`;
    }
    if (analytics?.reportDateFrom && analytics?.reportDateTo) {
      return `Весь период: ${analytics.reportDateFrom.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} – ${analytics.reportDateTo.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })} (${analytics.reportDays || totalDatasetDays} дн.)`;
    }
    return `Весь период (${totalDatasetDays} дн.)`;
  }, [dateFilter, availableMonths, analytics?.reportDateFrom, analytics?.reportDateTo, analytics?.reportDays, totalDatasetDays]);

  // View Modes: "hub" (список кампаний), "wizard" (пошаговый мастер), "detail" (просмотр)
  const [viewMode, setViewMode] = useState<"hub" | "wizard" | "detail">("hub");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Campaigns stored
  const [campaigns, setCampaigns] = useState<MarketingCampaignRecord[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // VK Ads API Configuration
  const [clientId, setClientId] = useState("X3aiv6IIlQxTMLta");
  const [clientSecret, setClientSecret] = useState(
    "nxLVn9KmGxcGXVVzB1d5W04AkMiA1tbLguJm5qxYM59495CMUsCSCP0qmavcD1DGL2jw9wtNnQwtJLY3qBU5iC0P7PMut2sPnl3lVzQDjCoQfrc7eZ5QdytHsYtzanZIvShlMXV4fTQoLxootwa8XLgWwC00LBSVSuPP7bh9azSgHJcwxp4aMhpd8f9HRzdPJR22ZFk2PvJbBtaDbqSI3k9tz5qjYMdRebx5FFq962M6DVtxM7T"
  );
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ ok: boolean; message: string; user?: any } | null>(null);

  // Wizard fields
  const [campaignName, setCampaignName] = useState("VK: Lookalike на VIP-клиентов клуба");
  const [filters, setFilters] = useState<SegmentationFilter>(PRESETS[0].filter);
  const [targetAudienceStrategy, setTargetAudienceStrategy] = useState(PRESETS[0].strategy);
  const [creativeAngle, setCreativeAngle] = useState(PRESETS[0].creativeAngle);
  const [offerText, setOfferText] = useState(PRESETS[0].sampleText);
  const [recommendedGeo, setRecommendedGeo] = useState(PRESETS[0].geoRadius);
  const [isExportingApi, setIsExportingApi] = useState(false);
  const [apiExportResult, setApiExportResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Available zones from dataset
  const availableZones = useMemo(() => {
    if (!analytics || !analytics.profiles) return [];
    const set = new Set<string>();
    for (const p of analytics.profiles) {
      if (p.favoriteZone && p.favoriteZone !== "—") set.add(p.favoriteZone);
    }
    return Array.from(set).sort();
  }, [analytics]);

  // Load configuration & campaigns on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedCamps = localStorage.getItem(storageKey);
      if (savedCamps) {
        const list = JSON.parse(savedCamps);
        if (Array.isArray(list)) {
          setCampaigns(list.filter((c: MarketingCampaignRecord) => c.channel === "vk"));
        }
      }
      const savedConfig = localStorage.getItem(vkConfigKey);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.clientId) setClientId(parsed.clientId);
        if (parsed.clientSecret) setClientSecret(parsed.clientSecret);
      }
    } catch (e) {
      console.warn("Failed to load VK settings:", e);
    }
  }, [storageKey, vkConfigKey]);

  // Auto-check auth on mount with preset credentials
  useEffect(() => {
    if (clientId && clientSecret) {
      handleCheckAuth(clientId, clientSecret);
    }
  }, []);

  useEffect(() => {
    const handleVkConfigUpdated = () => {
      try {
        const savedConfig = localStorage.getItem(vkConfigKey);
        if (savedConfig) {
          const parsed = JSON.parse(savedConfig);
          if (parsed.clientId) setClientId(parsed.clientId);
          if (parsed.clientSecret) setClientSecret(parsed.clientSecret);
          if (parsed.clientId && parsed.clientSecret) {
            handleCheckAuth(parsed.clientId, parsed.clientSecret);
          }
        }
      } catch (e) {
        console.warn("Failed to update VK config:", e);
      }
    };
    window.addEventListener("marketing_vk_config_updated", handleVkConfigUpdated);
    return () => window.removeEventListener("marketing_vk_config_updated", handleVkConfigUpdated);
  }, [vkConfigKey]);

  const handleSaveCredentials = (newClientId: string, newClientSecret: string) => {
    setClientId(newClientId);
    setClientSecret(newClientSecret);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          vkConfigKey,
          JSON.stringify({
            clientId: newClientId.trim(),
            clientSecret: newClientSecret.trim(),
          })
        );
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const handleCheckAuth = async (cId = clientId, cSecret = clientSecret) => {
    if (!cId.trim() || !cSecret.trim()) {
      setAuthStatus({ ok: false, message: "Заполните Client ID и Client Secret кабинета ads.vk.com" });
      return;
    }
    setIsCheckingAuth(true);
    setAuthStatus(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/marketing/vk-ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_auth",
          clientId: cId.trim(),
          clientSecret: cSecret.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAuthStatus({
          ok: true,
          message: data.message || "Подключение к VK Рекламе успешно установлено",
          user: data.user,
        });
      } else {
        setAuthStatus({ ok: false, message: data.error || "Ошибка авторизации в VK Рекламе" });
      }
    } catch (e: any) {
      setAuthStatus({ ok: false, message: "Ошибка связи с сервером: " + (e.message || String(e)) });
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Filter cohort
  const filteredClients = useMemo(() => {
    if (!analytics || !analytics.profiles) return [];

    return analytics.profiles.filter((p) => {
      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
      if (excludedPhones.includes(norm) || norm.length < 10) return false;

      // Spent range
      if (filters.spentMin !== "" && (p.totalSpent || 0) < Number(filters.spentMin)) return false;
      if (filters.spentMax !== "" && (p.totalSpent || 0) > Number(filters.spentMax)) return false;

      // Days since
      if (filters.daysSinceMin !== "" && (p.daysSince ?? 0) < Number(filters.daysSinceMin)) return false;
      if (filters.daysSinceMax !== "" && (p.daysSince ?? 0) > Number(filters.daysSinceMax)) return false;

      // Balance
      if (filters.balanceMin !== "" && (p.balance || 0) < Number(filters.balanceMin)) return false;
      if (filters.balanceMax !== "" && (p.balance || 0) > Number(filters.balanceMax)) return false;

      // Bonus balance
      if (filters.bonusMin !== "" && (p.bonusBalance || 0) < Number(filters.bonusMin)) return false;
      if (filters.bonusMax !== "" && (p.bonusBalance || 0) > Number(filters.bonusMax)) return false;

      // Visits
      if (filters.visitsMin !== "" && (p.visits ?? 0) < Number(filters.visitsMin)) return false;
      if (filters.visitsMax !== "" && (p.visits ?? 0) > Number(filters.visitsMax)) return false;

      // Day pattern
      if (filters.dayType === "weekday" && p.dayPattern !== "weekday") return false;
      if (filters.dayType === "weekend" && p.dayPattern !== "weekend") return false;
      if (filters.dayType === "specific" && filters.specificDay && p.favoriteDay !== filters.specificDay) return false;

      // Preferred time
      if (filters.preferredTime !== "all" && p.preferredTime !== filters.preferredTime) return false;

      // Favorite Zone
      if (filters.favoriteZone !== "all" && p.favoriteZone !== filters.favoriteZone) return false;

      // Loyalty filter
      if (filters.loyaltyMode === "no_bonus_hunters") {
        if (p.valueCategory === "bonus_heavy") return false;
        if ((p.totalSpent || 0) === 0 && ((p.bonusAccrued || 0) > 0 || (p.bonusBalance || 0) > 0)) return false;
        const ratio = p.bonusGivenRatio ?? ((p.totalSpent || 0) > 0 ? ((p.bonusAccrued || 0) / p.totalSpent) * 100 : 0);
        if (ratio >= 40 && (p.bonusAccrued || 0) >= 150) return false;
      } else if (filters.loyaltyMode === "loyal_only") {
        if ((p.totalSpent || 0) <= 0) return false;
        if (p.valueCategory === "bonus_heavy") return false;
        const ratio = p.bonusGivenRatio ?? ((p.totalSpent || 0) > 0 ? ((p.bonusAccrued || 0) / p.totalSpent) * 100 : 0);
        if (ratio > 25) return false;
      }

      return true;
    });
  }, [analytics, filters, excludedPhones]);

  // Cohort statistics
  const cohortStats = useMemo(() => {
    const count = filteredClients.length;
    const totalSpent = filteredClients.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const totalBalance = filteredClients.reduce((sum, c) => sum + (c.balance || 0), 0);
    const totalBonusBalance = filteredClients.reduce((sum, c) => sum + (c.bonusBalance || 0), 0);
    const totalVisits = filteredClients.reduce((sum, c) => sum + (c.visits ?? c.txCount ?? (c.totalSpent > 0 ? 1 : 0)), 0);
    const avgSpentPerGuest = count > 0 ? Math.round(totalSpent / count) : 0;
    const avgCheckPerVisit = totalVisits > 0 ? Math.round(totalSpent / totalVisits) : 0;

    return {
      count,
      totalSpent,
      totalBalance,
      totalBonusBalance,
      totalVisits,
      avgSpentPerGuest,
      avgCheckPerVisit,
    };
  }, [filteredClients]);

  // Clean phone list (+79XXXXXXXXX)
  const getCleanPhoneList = (clients: ClientProfile[]) => {
    return clients
      .map((p) => {
        const raw = (p.phone || "").replace(/\D/g, "");
        if (raw.length === 11 && raw.startsWith("8")) return "+7" + raw.slice(1);
        if (raw.length === 11 && raw.startsWith("7")) return "+" + raw;
        if (raw.length === 10) return "+7" + raw;
        return "";
      })
      .filter(Boolean);
  };

  // Actions
  const handleStartWizard = () => {
    setWizardStep(1);
    setApiExportResult(null);
    setViewMode("wizard");
  };

  const handleApplyPreset = (p: typeof PRESETS[0]) => {
    setFilters(p.filter);
    setCampaignName(p.campaignName);
    setTargetAudienceStrategy(p.strategy);
    setCreativeAngle(p.creativeAngle);
    setOfferText(p.sampleText);
    setRecommendedGeo(p.geoRadius);
  };

  const handleSaveAndRegisterCampaign = () => {
    const record: MarketingCampaignRecord = {
      id: `vk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clubId,
      name: campaignName.trim() || "Новая VK-кампания",
      channel: "vk",
      templateText: offerText.trim() || targetAudienceStrategy,
      targetPhones: filteredClients.map((c) => (c.phone || "").replace(/\D/g, "").slice(-10)),
      createdAt: new Date().toISOString(),
      periodLabel: `${targetAudienceStrategy} • Гео: ${recommendedGeo}`,
    };

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        const list: MarketingCampaignRecord[] = saved ? JSON.parse(saved) : [];
        list.unshift(record);
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch (e) {
        console.warn("Failed to save campaign:", e);
      }
    }

    setCampaigns((prev) => [record, ...prev]);
    setActiveCampaignId(record.id);
    setViewMode("detail");
  };

  const handleExportTxt = (clients: ClientProfile[], name: string) => {
    const list = getCleanPhoneList(clients);
    if (list.length === 0) return;

    const content = list.join("\r\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${name.toLowerCase().replace(/[^\w\dа-яёА-ЯЁ]+/g, "_")}_${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleCopyPhones = (clients: ClientProfile[]) => {
    const list = getCleanPhoneList(clients);
    if (list.length === 0) return;
    navigator.clipboard.writeText(list.join("\n"));
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const handleDeleteCampaign = (id: string) => {
    if (!confirm("Удалить эту кампанию из истории?")) return;
    const updated = campaigns.filter((c) => c.id !== id);
    setCampaigns(updated);
    if (activeCampaignId === id) {
      setActiveCampaignId(null);
      setViewMode("hub");
    }
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        const list: MarketingCampaignRecord[] = saved ? JSON.parse(saved) : [];
        const filtered = list.filter((c) => c.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // Active campaign in detail view
  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId) || null;

  const activeCampaignClients = useMemo(() => {
    if (!activeCampaign || !analytics || !analytics.profiles) return [];
    const phoneSet = new Set(activeCampaign.targetPhones);
    return analytics.profiles.filter((p) => {
      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
      return phoneSet.has(norm);
    });
  }, [activeCampaign, analytics]);

  // -------------------------------------------------------------
  // VIEW 1: HUB (ГЛАВНЫЙ ЭКРАН VK РЕКЛАМЫ)
  // -------------------------------------------------------------
  if (viewMode === "hub") {
    const totalTargeted = campaigns.reduce((sum, c) => sum + (c.targetPhones?.length || 0), 0);

    return (
      <div className="space-y-8">
        {/* Hub Header */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              VK Реклама
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Сегментация аудитории компьютерного клуба, экспорт списков и управление кампаниями в ads.vk.com
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartWizard}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm self-start sm:self-auto"
          >
            + Создать кампанию
          </button>
        </div>

        {/* Hub Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-slate-200 pb-6">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Всего кампаний
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {campaigns.length}
            </p>
          </div>

          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Охвачено клиентов
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {totalTargeted.toLocaleString("ru")}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">по всем выгрузкам VK</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Доступно в базе
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {(analytics?.profiles?.length || 0).toLocaleString("ru")}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">без учета исключений</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Статус API VK
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {authStatus?.ok ? "Подключен" : "Ожидает"}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
              {authStatus?.user ? authStatus.user.name || authStatus.user.email : "OAuth 2.0 ads.vk.com"}
            </span>
          </div>
        </div>



        {/* Campaigns List or Empty State */}
        {campaigns.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Пока нет созданных кампаний VK
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Запустите мастер: отберите сегмент гостей компьютерного клуба, зафиксируйте оффер и экспортируйте аудиторию для таргета.
            </p>
            <button
              type="button"
              onClick={handleStartWizard}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm inline-block"
            >
              + Создать первую кампанию
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              Список кампаний ({campaigns.length})
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4 font-semibold">Название кампании</th>
                    <th className="py-3 px-4 font-semibold text-right">Охват аудитории</th>
                    <th className="py-3 px-4 font-semibold">Дата создания</th>
                    <th className="py-3 px-4 font-semibold text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCampaignId(camp.id);
                            setViewMode("detail");
                          }}
                          className="hover:underline text-left block"
                        >
                          {camp.name}
                        </button>
                        <p className="text-[11px] text-slate-500 font-normal line-clamp-1 mt-0.5 font-mono">
                          {camp.templateText}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {(camp.targetPhones?.length || 0).toLocaleString("ru")} чел.
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(camp.createdAt).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-3">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCampaignId(camp.id);
                            setViewMode("detail");
                          }}
                          className="font-semibold text-slate-900 hover:underline"
                        >
                          Открыть
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(camp.id)}
                          className="text-slate-400 hover:text-rose-600 transition-colors"
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
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: WIZARD (ПОШАГОВЫЙ МАСТЕР СОЗДАНИЯ КАМПАНИИ)
  // -------------------------------------------------------------
  if (viewMode === "wizard") {
    return (
      <div className="w-full py-4 space-y-8">
        {/* Wizard Header Bar */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Мастер создания • Шаг {wizardStep} из 3
            </span>
            <button
              type="button"
              onClick={() => setViewMode("hub")}
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
            >
              ← Отмена и назад к списку
            </button>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            {wizardStep === 1 && "1. Выбор аудитории и сегментация"}
            {wizardStep === 2 && "2. Оффер, гео-таргетинг и креатив"}
            {wizardStep === 3 && "3. Проверка и экспорт в VK Рекламу"}
          </h2>
        </div>

        {/* STEP 1: SEGMENTATION */}
        {wizardStep === 1 && (
          <div className="space-y-8">
            {/* Campaign Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Название кампании
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Например: VK: Lookalike на VIP-клиентов клуба"
                className="w-full text-base font-semibold py-2.5 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>

            {/* Quick Presets Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Готовые стратегии для компьютерного клуба
                </span>
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_SEGMENTATION)}
                  className="text-xs text-slate-400 hover:text-slate-800 transition-colors"
                >
                  Сбросить все фильтры
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="p-3 text-left border border-slate-200 hover:border-slate-400 rounded-xl transition-colors bg-white space-y-1"
                  >
                    <span className="text-xs font-bold text-slate-900 block">{p.name}</span>
                    <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{p.strategy}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Period Selection Section */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Период сегментации аудитории:
                  </span>
                  <span className="text-xs font-semibold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    {periodLabel}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => onDateFilterChange?.(null)}
                  className={cn(
                    "text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all",
                    !dateFilter
                      ? "bg-slate-900 text-white font-semibold"
                      : "bg-white hover:bg-slate-200/70 text-slate-700 border border-slate-200"
                  )}
                >
                  Весь период ({totalDatasetDays} дн.)
                </button>

                {availableMonths.map((m) => {
                  const isSelected = dateFilter?.monthKey === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => {
                        onDateFilterChange?.({
                          startDate: m.startDate,
                          endDate: m.endDate,
                          monthKey: m.key,
                        });
                      }}
                      className={cn(
                        "text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all",
                        isSelected
                          ? "bg-slate-900 text-white font-semibold"
                          : "bg-white hover:bg-slate-200/70 text-slate-700 border border-slate-200"
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Траты (LTV), число сессий и отсиженные часы пересчитываются строго за выбранный период.
              </p>
            </div>

            {/* Detailed Configurable Ranges */}
            <div className="space-y-5 border-t border-slate-200 pt-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Диапазоны фильтрации
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. LTV / Spent */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Траты клиента за период (₽)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="От (₽)"
                      value={filters.spentMin}
                      onChange={(e) => setFilters({ ...filters, spentMin: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                    <input
                      type="number"
                      placeholder="До (₽)"
                      value={filters.spentMax}
                      onChange={(e) => setFilters({ ...filters, spentMax: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                {/* 2. Days Since */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Не был в клубе (дней)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="От (дней)"
                      value={filters.daysSinceMin}
                      onChange={(e) => setFilters({ ...filters, daysSinceMin: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                    <input
                      type="number"
                      placeholder="До (дней)"
                      value={filters.daysSinceMax}
                      onChange={(e) => setFilters({ ...filters, daysSinceMax: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                {/* 3. Deposit Balance */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Остаток на балансе (рубли)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="От (₽)"
                      value={filters.balanceMin}
                      onChange={(e) => setFilters({ ...filters, balanceMin: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                    <input
                      type="number"
                      placeholder="До (₽)"
                      value={filters.balanceMax}
                      onChange={(e) => setFilters({ ...filters, balanceMax: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                {/* 4. Bonus Balance */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Бонусный баланс (баллы)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="От (бонусов)"
                      value={filters.bonusMin}
                      onChange={(e) => setFilters({ ...filters, bonusMin: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                    <input
                      type="number"
                      placeholder="До (бонусов)"
                      value={filters.bonusMax}
                      onChange={(e) => setFilters({ ...filters, bonusMax: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                {/* 5. Visits count */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Количество визитов / сессий
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="От (визитов)"
                      value={filters.visitsMin}
                      onChange={(e) => setFilters({ ...filters, visitsMin: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                    <input
                      type="number"
                      placeholder="До (визитов)"
                      value={filters.visitsMax}
                      onChange={(e) => setFilters({ ...filters, visitsMax: e.target.value === "" ? "" : Number(e.target.value) })}
                      className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                {/* 6. Favorite Zone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Любимая зона клуба
                  </label>
                  <select
                    value={filters.favoriteZone}
                    onChange={(e) => setFilters({ ...filters, favoriteZone: e.target.value })}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                  >
                    <option value="all">Все зоны клуба</option>
                    {availableZones.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Loyalty Filter (Anti-Bonus Hunter) */}
              <div className="pt-3 border-t border-slate-200">
                <div className="space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <label className="text-xs font-bold text-slate-900 block">
                      Фильтр лояльности (защита от халявщиков)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Отсечение гостей, приходящих только за бесплатными бонусами
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {[
                      {
                        id: "all",
                        label: "Все клиенты",
                        desc: "Без ограничений по бонусам",
                      },
                      {
                        id: "no_bonus_hunters",
                        label: "Без бонусоедов",
                        desc: "Исключить тех, у кого доля бонусов >40% или 0 ₽ трат",
                      },
                      {
                        id: "loyal_only",
                        label: "Только лояльные",
                        desc: "Только гости с реальными деньгами (бонусы ≤25%)",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFilters({ ...filters, loyaltyMode: opt.id as any })}
                        className={cn(
                          "p-2.5 rounded-lg text-left border transition-colors flex flex-col justify-between",
                          (filters.loyaltyMode || "all") === opt.id
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-bold block",
                          (filters.loyaltyMode || "all") === opt.id ? "text-white" : "text-slate-900"
                        )}>
                          {opt.label}
                        </span>
                        <span className={cn(
                          "text-[10px] mt-0.5 block leading-normal",
                          (filters.loyaltyMode || "all") === opt.id ? "text-slate-300" : "text-slate-500"
                        )}>
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Behavioral Filters: Days and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3">
                {/* Day of Week */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Привычные дни посещений
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "all", label: "Все дни" },
                      { id: "weekday", label: "Будни" },
                      { id: "weekend", label: "Выходные" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFilters({ ...filters, dayType: opt.id as any })}
                        className={cn(
                          "py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors",
                          filters.dayType === opt.id
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-1.5">
                    <select
                      value={filters.dayType === "specific" ? filters.specificDay : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          setFilters({ ...filters, dayType: "specific", specificDay: e.target.value });
                        } else {
                          setFilters({ ...filters, dayType: "all", specificDay: "" });
                        }
                      }}
                      className="w-full py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    >
                      <option value="">Либо конкретный день недели...</option>
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Time of Day */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Время посещений
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "all", label: "Любое" },
                      { id: "night", label: "Ночь" },
                      { id: "evening", label: "Вечер" },
                      { id: "day", label: "День" },
                      { id: "morning", label: "Утро" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFilters({ ...filters, preferredTime: opt.id as any })}
                        className={cn(
                          "py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors",
                          filters.preferredTime === opt.id
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Filter Scoreboard */}
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">
                    Результат фильтрации
                  </span>
                  <p className="text-2xl font-bold text-slate-900 font-mono mt-0.5">
                    {cohortStats.count.toLocaleString("ru")} <span className="text-sm font-normal text-slate-500">гостей отобрано</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-left">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Принесли в клуб (LTV)</span>
                    <span className="font-bold text-slate-900 font-mono text-xs">{Math.round(cohortStats.totalSpent).toLocaleString("ru")} ₽</span>
                  </div>

                  <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-left">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Остаток на балансах</span>
                    <span className="font-bold text-slate-900 font-mono text-xs">{Math.round(cohortStats.totalBalance).toLocaleString("ru")} ₽</span>
                  </div>

                  <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-left">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Траты на 1 гостя</span>
                    <span className="font-bold text-slate-900 font-mono text-xs">{cohortStats.avgSpentPerGuest.toLocaleString("ru")} ₽</span>
                  </div>

                  {cohortStats.avgCheckPerVisit > 0 && (
                    <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-left">
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Чек за 1 визит</span>
                      <span className="font-bold text-slate-900 font-mono text-xs">{cohortStats.avgCheckPerVisit.toLocaleString("ru")} ₽</span>
                    </div>
                  )}
                </div>
              </div>

              {cohortStats.count === 0 && (
                <p className="text-xs text-rose-600 font-medium">
                  По заданным критериям не найдено ни одного клиента. Ослабьте диапазоны, чтобы расширить выборку.
                </p>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("hub")}
                className="text-xs text-slate-500 hover:text-slate-900 font-medium"
              >
                ← Вернуться в список
              </button>
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                disabled={cohortStats.count === 0}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors"
              >
                Продолжить к офферу и креативу →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CREATIVE & STRATEGY */}
        {wizardStep === 2 && (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Стратегия таргетинга / Цель кампании
              </label>
              <input
                type="text"
                value={targetAudienceStrategy}
                onChange={(e) => setTargetAudienceStrategy(e.target.value)}
                placeholder="Например: Lookalike на VIP-клиентов клуба"
                className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Рекомендуемый радиус гео-таргетинга
                </label>
                <input
                  type="text"
                  value={recommendedGeo}
                  onChange={(e) => setRecommendedGeo(e.target.value)}
                  placeholder="2.5 км вокруг клуба"
                  className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
                <span className="text-[10px] text-slate-400 block">
                  Компьютерные клубы — локальный бизнес. Оптимальный радиус для поиска Lookalike в VK — 1.5–3 км.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Акцент креатива / УТП
                </label>
                <input
                  type="text"
                  value={creativeAngle}
                  onChange={(e) => setCreativeAngle(e.target.value)}
                  placeholder="RTX 4080, 280Hz, буткампы..."
                  className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
                <span className="text-[10px] text-slate-400 block">
                  Ключевая ценность для этой когорты игроков.
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 block">
                  Рекламный текст объявления (для записи в ленте / клипов)
                </label>
                <span className="text-[11px] text-slate-400">
                  {offerText.length} символов
                </span>
              </div>
              <textarea
                rows={4}
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
                placeholder="Текст рекламной записи..."
                className="w-full text-sm p-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
              <span className="text-[11px] text-slate-400 block">
                Текст сохраняется в карточке кампании для контроля сквозной атрибуции и оценки окупаемости оффера.
              </span>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                ← Назад к аудитории
              </button>
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                disabled={!offerText.trim()}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors"
              >
                Проверить и экспортировать →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIRM & EXPORT */}
        {wizardStep === 3 && (
          <div className="space-y-6">
            <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Название кампании
                </span>
                <p className="text-base font-bold text-slate-900 mt-0.5">{campaignName}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
                <div>
                  <span className="text-xs text-slate-400 block">Получателей</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                    {filteredClients.length.toLocaleString("ru")}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">LTV сегмента</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                    {Math.round(cohortStats.totalSpent).toLocaleString("ru")} ₽
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Гео-радиус</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">
                    {recommendedGeo}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Акцент оффера</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5 truncate">
                    {creativeAngle}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-1">
                <span className="text-xs text-slate-400 block">Текст рекламного объявления</span>
                <p className="text-xs text-slate-800 font-mono bg-slate-50 p-3 rounded-lg leading-relaxed">
                  {offerText}
                </p>
              </div>
            </div>

            {/* Launch / Export Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Manual TXT Export */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-900">
                    Экспорт списка номеров (.TXT)
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Формат один номер на строку (+79XXXXXXXXX). Загружается в кабинет ads.vk.com → «Аудитории» → «Загрузить список» для поиска похожих (Lookalike) или ретаргетинга.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleExportTxt(filteredClients, campaignName)}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors"
                  >
                    {downloadSuccess ? "Файл скачан!" : "Скачать .TXT для VK"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyPhones(filteredClients)}
                    className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
                  >
                    {copiedSuccess ? "Скопировано!" : "Копировать"}
                  </button>
                </div>
              </div>

              {/* VK API Status Card */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-900">
                    Кабинет VK Реклама (ads.vk.com)
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {authStatus?.ok
                      ? `Подключен аккаунт: ${authStatus.user?.name || authStatus.user?.email} (${authStatus.user?.id}). Выгрузка аудиторий регистрируется в сквозной аналитике клуба.`
                      : "Для прямой загрузки аудиторий в кабинет VK проверьте подключение в настройках."}
                  </p>
                </div>

                <div className="pt-2">
                  <span className={cn(
                    "text-xs font-semibold px-3 py-2 rounded-lg block text-center",
                    authStatus?.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-600"
                  )}>
                    {authStatus?.ok ? "✓ Подключение к ads.vk.com проверено" : "Режим ручной выгрузки"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                ← Назад к офферу
              </button>
              <button
                type="button"
                onClick={handleSaveAndRegisterCampaign}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
              >
                Сохранить кампанию в историю
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: DETAIL (КАРТОЧКА СОЗДАННОЙ КАМПАНИИ)
  // -------------------------------------------------------------
  if (viewMode === "detail" && activeCampaign) {
    return (
      <div className="space-y-8">
        {/* Detail Header Bar */}
        <div className="border-b border-slate-200 pb-5 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMode("hub")}
              className="text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors"
            >
              ← Ко всем кампаниям VK
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleStartWizard}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs rounded-lg transition-colors"
              >
                + Новая кампания
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCampaign(activeCampaign.id)}
                className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
              >
                Удалить кампанию
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  VK-кампания
                </span>
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Готова к открутке
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {activeCampaign.name}
              </h2>
              <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                <span>
                  Создана {new Date(activeCampaign.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                {activeCampaign.periodLabel && (
                  <>
                    <span>•</span>
                    <span className="text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {activeCampaign.periodLabel}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleExportTxt(activeCampaignClients, activeCampaign.name)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shadow-xs"
              >
                {downloadSuccess ? "Файл скачан!" : `Скачать .TXT (${activeCampaignClients.length})`}
              </button>
              <button
                type="button"
                onClick={() => handleCopyPhones(activeCampaignClients)}
                className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
              >
                {copiedSuccess ? "Скопировано!" : "Копировать"}
              </button>
            </div>
          </div>
        </div>

        {/* Structured Metrics Block */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-slate-200 pb-6">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Аудитория
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {activeCampaignClients.length.toLocaleString("ru")}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">уникальных гостей</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              LTV когорты
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {Math.round(activeCampaignClients.reduce((sum, c) => sum + (c.totalSpent || 0), 0)).toLocaleString("ru")} ₽
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">суммарные траты в клубе</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Остаток депозитов
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {Math.round(activeCampaignClients.reduce((sum, c) => sum + (c.balance || 0), 0)).toLocaleString("ru")} ₽
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">на игровых счетах</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Канал доставки
            </span>
            <p className="text-base font-bold text-slate-900 mt-2">
              VK Ads (ads.vk.com)
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Lookalike & ретаргетинг</span>
          </div>
        </div>

        {/* Offer text */}
        <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-2">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
            Зафиксированный оффер и рекламный посыл
          </span>
          <p className="text-xs text-slate-800 leading-relaxed font-medium">
            {activeCampaign.templateText || "Оффер не указан"}
          </p>
        </div>

        {/* Contacts Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Список контактов аудитории ({activeCampaignClients.length})
            </h3>
            <span className="text-xs text-slate-400 font-mono">Формат: +7 (XXX) XXX-XX-XX</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold w-12">№</th>
                  <th className="py-2.5 px-3 font-semibold">Имя гостя</th>
                  <th className="py-2.5 px-3 font-semibold font-mono">Телефон</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Сумма трат</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Баланс (₽)</th>
                  <th className="py-2.5 px-3 font-semibold">Любимая зона</th>
                  <th className="py-2.5 px-3 font-semibold">Любимый день</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {activeCampaignClients.slice(0, 100).map((c, idx) => (
                  <tr key={c.phone + idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{c.name || "Гость"}</td>
                    <td className="py-2 px-3 font-mono text-slate-700">{c.phone}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {Math.round(c.totalSpent || 0).toLocaleString()} ₽
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {Math.round(c.balance || 0).toLocaleString()} ₽
                    </td>
                    <td className="py-2 px-3 text-slate-600">{c.favoriteZone || "—"}</td>
                    <td className="py-2 px-3 text-slate-600">{c.favoriteDay || c.dayPattern || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activeCampaignClients.length > 100 && (
            <p className="text-xs text-slate-400 text-center">
              Показаны первые 100 из {activeCampaignClients.length.toLocaleString("ru")} контактов. В выгрузку попадают все номера.
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
