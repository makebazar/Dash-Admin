"use client";

import { useState, useMemo, useEffect } from "react";
import { Send, Key, RefreshCw, CheckCircle2, ShieldAlert, X, Calculator, Calendar, AlertTriangle, Plus, Trash2, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ClientProfile, type ClubAnalytics, type DateFilter, type MonthOption, getAvailableMonths } from "./segmentation";
import type { MarketingCampaignRecord, BonusTier } from "./SmsCampaignModal";

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
  excludedPhones: string[];
  dateFilter?: DateFilter | null;
  onDateFilterChange?: (filter: DateFilter | null) => void;
}

export const DEFAULT_BONUS_TIERS: BonusTier[] = [
  { minSpent: 0, bonus: 100 },
  { minSpent: 1000, bonus: 200 },
  { minSpent: 3000, bonus: 300 },
  { minSpent: 5000, bonus: 500 },
  { minSpent: 10000, bonus: 1000 },
];

export function calculateClientGiftBonus(spent: number, tiers: BonusTier[], enabled: boolean = true): number {
  if (!enabled || !tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.minSpent - a.minSpent);
  for (const tier of sorted) {
    if (spent >= tier.minSpent) {
      return tier.bonus;
    }
  }
  return 0;
}

export type LoyaltyFilterMode = "all" | "no_bonus_hunters" | "loyal_only";

export interface SegmentationFilter {
  spentMin: number | "";
  spentMax: number | "";
  daysSinceMin: number | "";
  daysSinceMax: number | "";
  balanceMin: number | "";
  balanceMax: number | "";
  bonusMin: number | "";
  bonusMax: number | "";
  visitsMin: number | "";
  visitsMax: number | "";
  loyaltyMode?: LoyaltyFilterMode;
  dayType: "all" | "weekday" | "weekend" | "specific";
  specificDay: string;
  preferredTime: "all" | "night" | "morning" | "day" | "evening";
  favoriteZone: "all" | string;
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

const TEMPLATE_TAGS = [
  { tag: "{Имя}", desc: "Имя клиента" },
  { tag: "{Баланс_Руб}", desc: "Баланс в рублях" },
  { tag: "{Баланс_Бонус}", desc: "Бонусный баланс" },
  { tag: "{Бонус_В_Подарок}", desc: "Сумма бонуса по шкале трат" },
  { tag: "{Любимый_ПК}", desc: "Любимый компьютер" },
  { tag: "{Любимый_День}", desc: "Любимый день недели" },
  { tag: "{День_Отправки}", desc: "Назначенный день недели отправки" },
  { tag: "{Время_Отправки}", desc: "Время отправки по привычке гостя (напр. 17:00)" },
  { tag: "{Дата_Отправки}", desc: "Календарная дата отправки (напр. 23.10.2026)" },
  { tag: "{Любимая_Зона}", desc: "Любимая зона" },
  { tag: "{Любимый_Тариф}", desc: "Любимый тариф" },
];

const PRESETS = [
  {
    name: "Все клиенты клуба",
    filter: { ...DEFAULT_SEGMENTATION, spentMin: 1 },
    campaignName: "Рассылка всей базе клиентов",
    text: "{Имя}, ждем тебя в клубе! Твой любимый {Любимый_ПК} готов к каткам.",
  },
  {
    name: "Забытый баланс на счете",
    filter: { ...DEFAULT_SEGMENTATION, balanceMin: 100, daysSinceMin: 7 },
    campaignName: "Напоминание о забытом балансе",
    text: "{Имя}, на твоем балансе {Баланс_Руб} ₽ в клубе! {Любимый_ПК} свободен, залетай!",
  },
  {
    name: "VIP-киты (Whales)",
    filter: { ...DEFAULT_SEGMENTATION, spentMin: 2500 },
    campaignName: "VIP-бронь для постоянных гостей",
    text: "{Имя}, скоро {Любимый_День}! Твой привычный {Любимый_ПК} свободен. Бронь?",
  },
  {
    name: "Только лояльные (без бонусоедов)",
    filter: { ...DEFAULT_SEGMENTATION, loyaltyMode: "loyal_only" as const, spentMin: 500 },
    campaignName: "Подарок постоянным и лояльным гостям",
    text: "{Имя}, спасибо за преданность клубу! Дарим тебе {Бонус_В_Подарок} бонусов на баланс.",
  },
  {
    name: "Остывающие постоянники",
    filter: { ...DEFAULT_SEGMENTATION, daysSinceMin: 20, daysSinceMax: 45, spentMin: 1000 },
    campaignName: "Удержание остывающих гостей",
    text: "{Имя}, соскучились в клубе! Твой {Любимый_ПК} ждет в {Любимый_День}.",
  },
  {
    name: "Клиенты в оттоке (>30 дней)",
    filter: { ...DEFAULT_SEGMENTATION, daysSinceMin: 31, spentMin: 500 },
    campaignName: "Возврат ушедших клиентов",
    text: "{Имя}, дарим 200 бонусов на 4 дня! Заходи затестить новый ПК в клубе.",
  },
  {
    name: "Новички (1 визит)",
    filter: { ...DEFAULT_SEGMENTATION, visitsMin: 1, visitsMax: 1, daysSinceMax: 14 },
    campaignName: "Приветственная рассылка новичкам",
    text: "{Имя}, как первая катка в клубе? Дарим 150 бонусов на следующий визит!",
  },
  {
    name: "Ночные игроки (Пакет Ночь)",
    filter: { ...DEFAULT_SEGMENTATION, preferredTime: "night" as const, spentMin: 500 },
    campaignName: "Спецпредложение на ночные пакеты",
    text: "{Имя}, готов к ночному марафону? Твой {Любимый_ПК} ждет на эту ночь!",
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

export type ScheduleMode = "smart_day_eve" | "smart_day" | "even" | "instant";

const PREV_DAY_MAP: Record<string, string> = {
  "Понедельник": "Воскресенье",
  "Вторник": "Понедельник",
  "Среда": "Вторник",
  "Четверг": "Среда",
  "Пятница": "Четверг",
  "Суббота": "Пятница",
  "Воскресенье": "Суббота",
};

export function getScheduledDay(
  client: ClientProfile,
  mode: ScheduleMode,
  index: number
): string {
  if (mode === "instant") return "Сразу";

  if (mode === "even") {
    return DAYS_OF_WEEK[index % DAYS_OF_WEEK.length];
  }

  let day = client.favoriteDay;
  if (!day || !DAYS_OF_WEEK.includes(day)) {
    if (client.dayPattern === "weekend") {
      day = index % 2 === 0 ? "Суббота" : "Воскресенье";
    } else if (client.dayPattern === "weekday") {
      const weekdays = ["Вторник", "Среда", "Четверг"];
      day = weekdays[index % weekdays.length];
    } else {
      day = DAYS_OF_WEEK[index % DAYS_OF_WEEK.length];
    }
  }

  if (mode === "smart_day_eve") {
    return PREV_DAY_MAP[day] || day;
  }

  return day;
}

const DAY_INDEX_MAP: Record<string, number> = {
  "Воскресенье": 0,
  "Понедельник": 1,
  "Вторник": 2,
  "Среда": 3,
  "Четверг": 4,
  "Пятница": 5,
  "Суббота": 6,
};

export function getScheduledDate(dayName: string, baseDate: Date = new Date()): string {
  if (!dayName || dayName === "Сразу") {
    const dd = String(baseDate.getDate()).padStart(2, "0");
    const mm = String(baseDate.getMonth() + 1).padStart(2, "0");
    const yyyy = baseDate.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }

  const targetDay = DAY_INDEX_MAP[dayName];
  if (targetDay === undefined) {
    const dd = String(baseDate.getDate()).padStart(2, "0");
    const mm = String(baseDate.getMonth() + 1).padStart(2, "0");
    const yyyy = baseDate.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }

  const currentDay = baseDate.getDay();
  let diff = targetDay - currentDay;
  if (diff < 0) diff += 7;
  const d = new Date(baseDate.getTime() + diff * 86400000);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function getScheduledTime(client: ClientProfile): string {
  switch (client.preferredTime) {
    case "morning":
      return "10:30";
    case "day":
      return "13:30";
    case "evening":
      return "17:00";
    case "night":
      return "19:30";
    default:
      return "14:00";
  }
}

export function getScheduledTimeLabel(client: ClientProfile): string {
  switch (client.preferredTime) {
    case "morning":
      return "Утро (10:30)";
    case "day":
      return "День (13:30)";
    case "evening":
      return "Вечер (17:00)";
    case "night":
      return "Ночник (19:30)";
    default:
      return "День (14:00)";
  }
}

export type CsvFormatMode = "standard" | "ru_date" | "sms_ru" | "ru_day";

export function SmsTab({ clubId, analytics, excludedPhones, dateFilter, onDateFilterChange }: Props) {
  const storageKey = `marketing_campaigns_${clubId}`;

  // Period / Date bounds & options
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

  const datasetStartIso = useMemo(() => {
    if (!datasetFrom || isNaN(datasetFrom.getTime())) return "";
    return datasetFrom.toISOString().slice(0, 10);
  }, [datasetFrom]);

  const datasetEndIso = useMemo(() => {
    if (!datasetTo || isNaN(datasetTo.getTime())) return "";
    return datasetTo.toISOString().slice(0, 10);
  }, [datasetTo]);

  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomRange, setShowCustomRange] = useState(false);

  useEffect(() => {
    if (dateFilter?.startDate && dateFilter?.endDate) {
      setCustomStart(dateFilter.startDate.toISOString().slice(0, 10));
      setCustomEnd(dateFilter.endDate.toISOString().slice(0, 10));
    } else if (analytics?.reportDateFrom && analytics?.reportDateTo) {
      setCustomStart(analytics.reportDateFrom.toISOString().slice(0, 10));
      setCustomEnd(analytics.reportDateTo.toISOString().slice(0, 10));
    }
  }, [dateFilter, analytics?.reportDateFrom, analytics?.reportDateTo]);

  const periodLabel = useMemo(() => {
    if (dateFilter?.monthKey) {
      const found = availableMonths.find((m) => m.key === dateFilter.monthKey);
      if (found) return found.label;
    }
    if (dateFilter?.startDate && dateFilter?.endDate) {
      return `${dateFilter.startDate.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} – ${dateFilter.endDate.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })} (${analytics?.reportDays || 0} дн.)`;
    }
    if (analytics?.reportDateFrom && analytics?.reportDateTo) {
      return `Весь период выгрузки: ${analytics.reportDateFrom.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} – ${analytics.reportDateTo.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })} (${analytics.reportDays || totalDatasetDays} дн.)`;
    }
    return "Весь период выгрузки";
  }, [dateFilter, availableMonths, analytics?.reportDateFrom, analytics?.reportDateTo, analytics?.reportDays, totalDatasetDays]);

  // Mode: "hub" (список кампаний), "wizard" (квест создания), "detail" (просмотр конкретной кампании)
  const [viewMode, setViewMode] = useState<"hub" | "wizard" | "detail">("hub");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Campaigns stored
  const [campaigns, setCampaigns] = useState<MarketingCampaignRecord[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // Wizard fields
  const [campaignName, setCampaignName] = useState("Рассылка постоянным гостям");
  const [filters, setFilters] = useState<SegmentationFilter>(PRESETS[1].filter);
  const [templateText, setTemplateText] = useState(PRESETS[1].text);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("smart_day_eve");
  const [activeDayFilter, setActiveDayFilter] = useState<string>("all");
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [bonusTiersEnabled, setBonusTiersEnabled] = useState(true);
  const [bonusTiers, setBonusTiers] = useState<BonusTier[]>(DEFAULT_BONUS_TIERS);
  const [csvFormat, setCsvFormat] = useState<CsvFormatMode>("standard");
  const [isEditingDetailTemplate, setIsEditingDetailTemplate] = useState(false);
  const [detailTemplateDraft, setDetailTemplateDraft] = useState("");

  // SMS.RU Integration State
  const smsRuStorageKey = `marketing_sms_ru_${clubId}`;
  const [smsRuConfig, setSmsRuConfig] = useState<{ apiId: string; senderName?: string; testMode?: boolean } | null>(null);
  const [smsRuBalance, setSmsRuBalance] = useState<number | null>(null);
  const [smsRuSendModalOpen, setSmsRuSendModalOpen] = useState(false);
  const [isSendingViaSmsRu, setIsSendingViaSmsRu] = useState(false);
  const [smsRuSendResult, setSmsRuSendResult] = useState<{ ok: boolean; sent: number; failed: number; cost: number; balance?: number } | null>(null);

  // Exact Cost Calculation from SMS.RU
  const [wizardCostSmsRu, setWizardCostSmsRu] = useState<{ totalCost: number; totalSms: number } | null>(null);
  const [wizardCostError, setWizardCostError] = useState<string | null>(null);
  const [isCalculatingWizardCost, setIsCalculatingWizardCost] = useState(false);
  const [detailCostSmsRu, setDetailCostSmsRu] = useState<{ totalCost: number; totalSms: number } | null>(null);
  const [detailCostError, setDetailCostError] = useState<string | null>(null);
  const [isCalculatingDetailCost, setIsCalculatingDetailCost] = useState(false);

  const loadSmsRu = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(smsRuStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSmsRuConfig(parsed);
        if (parsed.apiId) {
          fetch(`/api/clubs/${clubId}/marketing/sms-ru?apiId=${encodeURIComponent(parsed.apiId)}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.ok && typeof d.balance === "number") setSmsRuBalance(d.balance);
            })
            .catch(() => {});
        }
      } else {
        setSmsRuConfig(null);
        setSmsRuBalance(null);
      }
    } catch (e) {
      console.warn("Failed to read SMS.RU config:", e);
    }
  };

  useEffect(() => {
    loadSmsRu();
    window.addEventListener("marketing_sms_ru_updated", loadSmsRu);
    return () => window.removeEventListener("marketing_sms_ru_updated", loadSmsRu);
  }, [clubId]);

  // Extract all available zones from data
  const availableZones = useMemo(() => {
    if (!analytics || !analytics.profiles) return [];
    const set = new Set<string>();
    for (const p of analytics.profiles) {
      if (p.favoriteZone && p.favoriteZone !== "—") set.add(p.favoriteZone);
    }
    return Array.from(set).sort();
  }, [analytics]);

  // Load existing campaigns on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const smsList = parsed.filter((c: MarketingCampaignRecord) => c.channel === "sms");
            setCampaigns(smsList);
          }
        }
      } catch (err) {
        console.warn("Failed to load campaigns:", err);
      }
    }
  }, [storageKey]);

  // Calculate filtered clients based on current segmentation filters
  const filteredClients = useMemo(() => {
    if (!analytics || !analytics.profiles) return [];

    return analytics.profiles.filter((p) => {
      // Excluded / Admin phones check
      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
      if (excludedPhones.includes(norm) || norm.length < 10) return false;

      // Spent range
      if (filters.spentMin !== "" && (p.totalSpent || 0) < Number(filters.spentMin)) return false;
      if (filters.spentMax !== "" && (p.totalSpent || 0) > Number(filters.spentMax)) return false;

      // Inactivity / Days since
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

      // Zone
      if (filters.favoriteZone !== "all" && p.favoriteZone !== filters.favoriteZone) return false;

      // Loyalty / Anti-bonus-hunter check
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

  // Summary statistics for the filtered cohort
  const cohortStats = useMemo(() => {
    const count = filteredClients.length;
    const totalSpent = filteredClients.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const totalBalance = filteredClients.reduce((sum, c) => sum + (c.balance || 0), 0);
    const totalBonusBalance = filteredClients.reduce((sum, c) => sum + (c.bonusBalance || 0), 0);
    const totalGiftBonus = filteredClients.reduce((sum, c) => {
      return sum + calculateClientGiftBonus(c.totalSpent || 0, bonusTiers, bonusTiersEnabled);
    }, 0);
    const totalVisits = filteredClients.reduce((sum, c) => sum + (c.visits ?? c.txCount ?? (c.totalSpent > 0 ? 1 : 0)), 0);
    const avgSpentPerGuest = count > 0 ? Math.round(totalSpent / count) : 0;
    const avgCheckPerVisit = totalVisits > 0 ? Math.round(totalSpent / totalVisits) : 0;
    return {
      count,
      totalSpent,
      totalBalance,
      totalBonusBalance,
      totalGiftBonus,
      totalVisits,
      avgSpentPerGuest,
      avgCheckPerVisit,
    };
  }, [filteredClients, bonusTiers, bonusTiersEnabled]);

  // Human-readable criteria description
  const segmentationDescription = useMemo(() => {
    const parts: string[] = [];
    const periodShort = dateFilter?.monthKey
      ? availableMonths.find((m) => m.key === dateFilter.monthKey)?.label
      : dateFilter?.startDate && dateFilter?.endDate
        ? `${analytics?.reportDays || 0} дн.`
        : `весь период (${totalDatasetDays} дн.)`;

    if (filters.spentMin !== "" && filters.spentMax !== "") parts.push(`Траты за ${periodShort}: ${filters.spentMin}–${filters.spentMax} ₽`);
    else if (filters.spentMin !== "") parts.push(`Траты за ${periodShort} от ${filters.spentMin} ₽`);
    else if (filters.spentMax !== "") parts.push(`Траты за ${periodShort} до ${filters.spentMax} ₽`);

    if (filters.daysSinceMin !== "" && filters.daysSinceMax !== "") parts.push(`Не был: ${filters.daysSinceMin}–${filters.daysSinceMax} дн.`);
    else if (filters.daysSinceMin !== "") parts.push(`Не был от ${filters.daysSinceMin} дн.`);
    else if (filters.daysSinceMax !== "") parts.push(`Не был до ${filters.daysSinceMax} дн.`);

    if (filters.balanceMin !== "") parts.push(`Баланс от ${filters.balanceMin} ₽`);
    if (filters.bonusMin !== "") parts.push(`Бонусы от ${filters.bonusMin} Б`);
    if (filters.visitsMin !== "") parts.push(`Визитов за ${periodShort} от ${filters.visitsMin}`);

    if (filters.loyaltyMode === "no_bonus_hunters") parts.push("Без бонусоедов");
    if (filters.loyaltyMode === "loyal_only") parts.push("Только лояльные гости");

    if (filters.dayType === "weekday") parts.push("Будни");
    if (filters.dayType === "weekend") parts.push("Выходные");
    if (filters.dayType === "specific" && filters.specificDay) parts.push(`День: ${filters.specificDay}`);

    if (filters.preferredTime === "night") parts.push("Ночники");
    if (filters.preferredTime === "morning") parts.push("Утро");
    if (filters.preferredTime === "day") parts.push("День");
    if (filters.preferredTime === "evening") parts.push("Вечер");

    if (filters.favoriteZone !== "all") parts.push(`Зона: ${filters.favoriteZone}`);

    return parts.length > 0 ? parts.join(" • ") : "Все клиенты без ограничений";
  }, [filters, dateFilter, availableMonths, analytics?.reportDays, totalDatasetDays]);

  // Substitute tags into message
  const renderMessage = (
    text: string,
    client: ClientProfile | null,
    scheduledDay?: string,
    customBonusTiers?: BonusTier[],
    isTiersEnabled?: boolean
  ) => {
    if (!client) return text;
    const name = client.name ? client.name.split(" ")[0] : "друг";
    const rubBal = Math.round(client.balance || 0).toLocaleString("ru");
    const bonusBal = Math.round(client.bonusBalance || 0).toLocaleString("ru");
    const seat = client.favoriteSeat || "компьютер";
    const day = client.favoriteDay ? client.favoriteDay.toLowerCase() : "выходные";
    const targetDay = scheduledDay ? scheduledDay.toLowerCase() : "сегодня";
    const zone = client.favoriteZone || "VIP";
    const tariff = client.favoriteTariff || "стандарт";

    const activeTiers = customBonusTiers ?? bonusTiers;
    const activeEnabled = isTiersEnabled !== undefined ? isTiersEnabled : bonusTiersEnabled;
    const giftBonus = calculateClientGiftBonus(client.totalSpent || 0, activeTiers, activeEnabled);

    const scheduledTime = getScheduledTime(client);
    const scheduledDate = getScheduledDate(scheduledDay || "Сразу");

    return text
      .replace(/{Имя}/g, name)
      .replace(/{Баланс_Руб}/g, `${rubBal} ₽`)
      .replace(/{Баланс_Бонус}/g, bonusBal)
      .replace(/{Любимый_ПК}/g, seat)
      .replace(/{Любимый_День}/g, day)
      .replace(/{День_Отправки}/g, targetDay)
      .replace(/{Время_Отправки}/g, scheduledTime)
      .replace(/{Дата_Отправки}/g, scheduledDate)
      .replace(/{Любимая_Зона}/g, zone)
      .replace(/{Любимый_Тариф}/g, tariff)
      .replace(/{Бонус_В_Подарок}/g, giftBonus.toLocaleString("ru"))
      .replace(/{Подарочный_Бонус}/g, giftBonus.toLocaleString("ru"));
  };

  // Schedule distribution of filtered cohort across days of week
  const scheduleDistribution = useMemo(() => {
    const map: Record<string, ClientProfile[]> = {};
    if (scheduleMode === "instant") {
      map["Сразу"] = [...filteredClients];
      return map;
    }
    for (const d of DAYS_OF_WEEK) {
      map[d] = [];
    }
    filteredClients.forEach((client, idx) => {
      const day = getScheduledDay(client, scheduleMode, idx);
      if (!map[day]) map[day] = [];
      map[day].push(client);
    });
    return map;
  }, [filteredClients, scheduleMode]);

  const sampleClient = filteredClients[0] || null;
  const sampleDay = sampleClient ? getScheduledDay(sampleClient, scheduleMode, 0) : undefined;
  const sampleMessage = useMemo(() => renderMessage(templateText, sampleClient, sampleDay), [templateText, sampleClient, sampleDay]);

  // Message calculations
  const isCyrillic = /[а-яёА-ЯЁ]/.test(sampleMessage);
  const singleLimit = isCyrillic ? 70 : 160;
  const charLimit = singleLimit;
  const multiLimit = isCyrillic ? 67 : 153;
  const msgLength = sampleMessage.length;
  const smsParts = msgLength <= singleLimit ? 1 : Math.ceil(msgLength / multiLimit);
  const charsUntilNextPart = smsParts === 1 
    ? Math.max(0, singleLimit - msgLength)
    : Math.max(0, (smsParts * multiLimit) - msgLength);
  const charsToTrimToOnePart = msgLength > singleLimit ? msgLength - singleLimit : 0;
  const costPerSms = 8.5;
  const estimatedCost = filteredClients.length * smsParts * costPerSms;

  // Actions
  const handleStartWizard = () => {
    setWizardStep(1);
    setWizardCostSmsRu(null);
    setWizardCostError(null);
    setViewMode("wizard");
  };

  const handleApplyPreset = (p: typeof PRESETS[0]) => {
    setFilters(p.filter);
    setTemplateText(p.text);
    setCampaignName(p.campaignName);
    setWizardCostSmsRu(null);
    setWizardCostError(null);
  };

  const handleFinishWizard = () => {
    const scheduleDayMap: Record<string, string> = {};
    const scheduleTimeMap: Record<string, string> = {};
    const scheduleDateMap: Record<string, string> = {};
    filteredClients.forEach((c, idx) => {
      const norm = (c.phone || "").replace(/\D/g, "").slice(-10);
      const day = getScheduledDay(c, scheduleMode, idx);
      scheduleDayMap[norm] = day;
      scheduleTimeMap[norm] = getScheduledTime(c);
      scheduleDateMap[norm] = getScheduledDate(day);
    });

    const record: MarketingCampaignRecord = {
      id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clubId,
      name: campaignName.trim() || "Новая SMS-кампания",
      channel: "sms",
      templateText,
      targetPhones: filteredClients.map((c) => (c.phone || "").replace(/\D/g, "").slice(-10)),
      createdAt: new Date().toISOString(),
      scheduleMode,
      scheduleDayMap,
      scheduleTimeMap,
      scheduleDateMap,
      periodLabel,
      bonusTiers: bonusTiersEnabled ? bonusTiers : undefined,
      bonusTiersEnabled,
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
    setActiveDayFilter("all");
    setViewMode("detail");
  };

  const handleExportCsv = (
    clientList: ClientProfile[],
    text: string,
    name: string,
    dayMap?: Record<string, string>,
    filterDay: string = "all",
    formatMode: CsvFormatMode = csvFormat
  ) => {
    let targetList = clientList;
    if (filterDay !== "all" && dayMap) {
      targetList = clientList.filter((c) => {
        const norm = (c.phone || "").replace(/\D/g, "").slice(-10);
        return dayMap[norm] === filterDay;
      });
    }

    if (targetList.length === 0) return;

    const currentTiers = activeCampaign?.bonusTiers ?? bonusTiers;
    const isTiersOn = activeCampaign?.bonusTiersEnabled ?? bonusTiersEnabled;

    let headerRow: string[];
    if (formatMode === "ru_date") {
      headerRow = ["номер", "текст", "дата", "время", "день"];
    } else if (formatMode === "ru_day") {
      headerRow = ["номер", "текст", "день", "время"];
    } else if (formatMode === "sms_ru") {
      headerRow = ["phone", "text", "date", "time"];
    } else {
      headerRow = ["phone", "text", "date", "time", "day"];
    }

    const rows = [headerRow];
    for (const c of targetList) {
      const p = (c.phone || "").replace(/\D/g, "");
      const norm = p.slice(-10);
      // Format 7XXXXXXXXXX: strictly starts with 7, without +, exactly 11 digits
      const phone7 = `7${norm}`;
      const scheduledDay = dayMap?.[norm] || getScheduledDay(c, scheduleMode, 0);
      const scheduledDate = getScheduledDate(scheduledDay);
      const scheduledTime = getScheduledTime(c);
      const msg = renderMessage(text, c, scheduledDay, currentTiers, isTiersOn).replace(/"/g, '""');

      if (formatMode === "ru_date") {
        rows.push([phone7, `"${msg}"`, `"${scheduledDate}"`, `"${scheduledTime}"`, `"${scheduledDay}"`]);
      } else if (formatMode === "ru_day") {
        rows.push([phone7, `"${msg}"`, `"${scheduledDay}"`, `"${scheduledTime}"`]);
      } else if (formatMode === "sms_ru") {
        rows.push([phone7, `"${msg}"`, `"${scheduledDate}"`, `"${scheduledTime}"`]);
      } else {
        rows.push([phone7, `"${msg}"`, `"${scheduledDate}"`, `"${scheduledTime}"`, `"${scheduledDay}"`]);
      }
    }

    const csvContent = "\uFEFF" + rows.map((r) => r.join(";")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const daySuffix = filterDay !== "all" ? `_${filterDay.toLowerCase()}` : "";
    link.setAttribute("download", `${name.toLowerCase().replace(/\s+/g, "_")}${daySuffix}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleDeleteCampaign = (id: string) => {
    if (!confirm("Удалить эту кампанию?")) return;
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

  const activeCampaignDayMap = useMemo(() => {
    return activeCampaign?.scheduleDayMap || {};
  }, [activeCampaign]);

  const activeCampaignDayBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of DAYS_OF_WEEK) counts[d] = 0;
    counts["Сразу"] = 0;
    activeCampaignClients.forEach((c) => {
      const norm = (c.phone || "").replace(/\D/g, "").slice(-10);
      const day = activeCampaignDayMap[norm] || "Сразу";
      counts[day] = (counts[day] || 0) + 1;
    });
    return counts;
  }, [activeCampaignClients, activeCampaignDayMap]);

  const displayedClients = useMemo(() => {
    if (activeDayFilter === "all") return activeCampaignClients;
    return activeCampaignClients.filter((c) => {
      const norm = (c.phone || "").replace(/\D/g, "").slice(-10);
      const day = activeCampaignDayMap[norm] || "Сразу";
      return day === activeDayFilter;
    });
  }, [activeCampaignClients, activeCampaignDayMap, activeDayFilter]);

  // Reset detail cost when campaign or day filter changes
  useEffect(() => {
    setDetailCostSmsRu(null);
  }, [activeCampaignId, activeDayFilter]);

  // Reset template editing state when campaign or view mode changes
  useEffect(() => {
    setIsEditingDetailTemplate(false);
    setDetailTemplateDraft("");
  }, [activeCampaignId, viewMode]);

  const handleStartEditTemplate = () => {
    if (!activeCampaign) return;
    setDetailTemplateDraft(activeCampaign.templateText || "");
    setIsEditingDetailTemplate(true);
  };

  const handleSaveDetailTemplate = () => {
    if (!activeCampaignId) return;
    const newText = detailTemplateDraft.trim();
    if (!newText) {
      alert("Текст шаблона не может быть пустым");
      return;
    }

    const updated = campaigns.map((c) => {
      if (c.id === activeCampaignId) {
        return { ...c, templateText: newText };
      }
      return c;
    });
    setCampaigns(updated);

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        const list: MarketingCampaignRecord[] = saved ? JSON.parse(saved) : [];
        const updatedList = list.map((c) => {
          if (c.id === activeCampaignId) {
            return { ...c, templateText: newText };
          }
          return c;
        });
        localStorage.setItem(storageKey, JSON.stringify(updatedList));
      } catch (e) {
        console.warn("Failed to persist updated template:", e);
      }
    }

    setIsEditingDetailTemplate(false);
    setDetailCostSmsRu(null);
  };

  const handleCancelEditTemplate = () => {
    setIsEditingDetailTemplate(false);
    setDetailTemplateDraft("");
  };

  // Request exact calculation from SMS.RU API (sms/cost)
  const fetchSmsRuCost = async (
    targets: ClientProfile[],
    text: string,
    dayMap?: Record<string, string>
  ): Promise<{ ok: boolean; totalCost: number; totalSms: number; error?: string }> => {
    if (!smsRuConfig?.apiId || targets.length === 0) {
      return { ok: false, totalCost: 0, totalSms: 0, error: "Нет API ID или пустой список" };
    }
    const currentTiers = activeCampaign?.bonusTiers ?? bonusTiers;
    const isTiersOn = activeCampaign?.bonusTiersEnabled ?? bonusTiersEnabled;
    const messages = targets.map((c) => {
      const norm = (c.phone || "").replace(/\D/g, "").slice(-10);
      const scheduledDay = dayMap?.[norm] || "Сразу";
      return {
        phone: c.phone || "",
        text: renderMessage(text, c, scheduledDay, currentTiers, isTiersOn),
      };
    });

    try {
      const res = await fetch(`/api/clubs/${clubId}/marketing/sms-ru`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiId: smsRuConfig.apiId,
          senderName: smsRuConfig.senderName,
          action: "cost",
          messages,
        }),
      });
      const data = await res.json();
      if (data.ok && Number(data.totalCost) > 0) {
        return {
          ok: true,
          totalCost: Number(data.totalCost),
          totalSms: Number(data.totalSms || targets.length),
        };
      }
      return {
        ok: false,
        totalCost: 0,
        totalSms: 0,
        error: data.error || "Шлюз не вернул точную стоимость",
      };
    } catch (e: any) {
      console.warn("Failed to fetch SMS.RU cost:", e);
      return { ok: false, totalCost: 0, totalSms: 0, error: e.message || "Ошибка подключения" };
    }
  };

  const handleCalculateWizardCost = async () => {
    if (!smsRuConfig?.apiId || filteredClients.length === 0 || !templateText.trim()) return;
    setIsCalculatingWizardCost(true);
    setWizardCostError(null);
    try {
      const dayMap: Record<string, string> = {};
      filteredClients.forEach((c, idx) => {
        const norm = (c.phone || "").replace(/\D/g, "").slice(-10);
        dayMap[norm] = getScheduledDay(c, scheduleMode, idx);
      });
      const result = await fetchSmsRuCost(filteredClients, templateText, dayMap);
      if (result.ok && result.totalCost > 0) {
        setWizardCostSmsRu({ totalCost: result.totalCost, totalSms: result.totalSms });
        setWizardCostError(null);
      } else {
        setWizardCostSmsRu(null);
        setWizardCostError(result.error || "SMS.RU требует зарегистрировать буквенное имя отправителя (код 221)");
      }
    } finally {
      setIsCalculatingWizardCost(false);
    }
  };

  const handleCalculateDetailCost = async (targets: ClientProfile[] = displayedClients) => {
    if (!smsRuConfig?.apiId || targets.length === 0 || !activeCampaign) return;
    setIsCalculatingDetailCost(true);
    setDetailCostError(null);
    try {
      const result = await fetchSmsRuCost(targets, activeCampaign.templateText, activeCampaignDayMap);
      if (result.ok && result.totalCost > 0) {
        setDetailCostSmsRu({ totalCost: result.totalCost, totalSms: result.totalSms });
        setDetailCostError(null);
      } else {
        setDetailCostSmsRu(null);
        setDetailCostError(result.error || "SMS.RU требует зарегистрировать буквенное имя отправителя (код 221)");
      }
    } finally {
      setIsCalculatingDetailCost(false);
    }
  };

  const handleSendSmsRuCampaign = async (targets: ClientProfile[]) => {
    if (!smsRuConfig?.apiId) {
      alert("Сначала укажите API-ключ SMS.RU в табе «Исключения и Настройки»");
      return;
    }
    if (targets.length === 0) return;

    setIsSendingViaSmsRu(true);
    setSmsRuSendResult(null);

    const currentTiers = activeCampaign?.bonusTiers ?? bonusTiers;
    const isTiersOn = activeCampaign?.bonusTiersEnabled ?? bonusTiersEnabled;
    const messages = targets.map((c) => {
      const norm = (c.phone || "").replace(/\D/g, "").slice(-10);
      const scheduledDay = activeCampaignDayMap[norm] || "Сразу";
      const finalMsg = renderMessage(activeCampaign?.templateText || "", c, scheduledDay, currentTiers, isTiersOn);
      return {
        phone: c.phone || "",
        text: finalMsg,
      };
    });

    try {
      const res = await fetch(`/api/clubs/${clubId}/marketing/sms-ru`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiId: smsRuConfig.apiId,
          senderName: smsRuConfig.senderName,
          testMode: smsRuConfig.testMode,
          messages,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSmsRuSendResult({
          ok: true,
          sent: data.totalSent ?? targets.length,
          failed: data.totalFailed ?? 0,
          cost: data.totalCost ?? 0,
          balance: data.balance,
        });
        if (typeof data.balance === "number") {
          setSmsRuBalance(data.balance);
        }
      } else {
        setSmsRuSendResult({
          ok: false,
          sent: 0,
          failed: targets.length,
          cost: 0,
          balance: smsRuBalance ?? undefined,
        });
        alert(data.error || "Ошибка отправки через SMS.RU");
      }
    } catch (e: any) {
      alert("Сетевая ошибка при обращении к SMS.RU: " + e.message);
    } finally {
      setIsSendingViaSmsRu(false);
    }
  };

  // -------------------------------------------------------------
  // VIEW 1: CAMPAIGNS HUB (ГЛАВНАЯ СТРАНИЦА SMS-РАССЫЛОК)
  // -------------------------------------------------------------
  if (viewMode === "hub") {
    const totalContactsTargeted = campaigns.reduce((sum, c) => sum + (c.targetPhones?.length || 0), 0);

    return (
      <div className="space-y-8">
        {/* Hub Header */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              SMS-рассылки
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Управление маркетинговыми рассылками, гибкая сегментация аудитории и экспорт в SMS-шлюзы
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

        {/* Hub Top Metrics */}
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
              {totalContactsTargeted.toLocaleString("ru")}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">по всем рассылкам</span>
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
              Шлюз SMS.RU
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {smsRuBalance !== null ? `${smsRuBalance.toLocaleString("ru")} ₽` : smsRuConfig?.apiId ? "Подключен" : "~3.50 ₽"}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {smsRuConfig?.testMode
                ? "тестовый режим (test=1)"
                : smsRuBalance !== null
                ? "баланс в личн. кабинете"
                : smsRuConfig?.apiId
                ? "ключ активен"
                : "средний тариф шлюза"}
            </span>
          </div>
        </div>

        {/* Campaigns List or Empty State */}
        {campaigns.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Пока нет созданных кампаний
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Запустите пошаговый мастер создания рассылки: настройте гибкие диапазоны трат, давности визита и баланса клиентов.
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
                    <th className="py-3 px-4 font-semibold text-right">Охват</th>
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
                          className="hover:underline text-left"
                        >
                          {camp.name}
                        </button>
                        <p className="text-[11px] text-slate-500 font-normal line-clamp-1 mt-0.5 font-mono flex items-center gap-1.5">
                          {camp.periodLabel && (
                            <span className="text-[10px] text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200 shrink-0 font-sans font-medium">
                              {camp.periodLabel}
                            </span>
                          )}
                          <span className="truncate">{camp.templateText}</span>
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {camp.targetPhones.length.toLocaleString("ru")} чел.
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(camp.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
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
  // VIEW 2: WIZARD ("КВЕСТ" НАСТРОЙКИ С ДИАПАЗОНАМИ)
  // -------------------------------------------------------------
  if (viewMode === "wizard") {
    return (
      <div className="w-full py-4 space-y-8">
        {/* Wizard Header Bar */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Мастер создания рассылки • Шаг {wizardStep} из 3
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
            {wizardStep === 1 && "Настройка сегментации аудитории"}
            {wizardStep === 2 && "Текст сообщения и подстановки"}
            {wizardStep === 3 && "Проверка и запуск кампании"}
          </h2>
        </div>

        {/* STEP 1: CONFIGURABLE SEGMENTATION & RANGES */}
        {wizardStep === 1 && (
          <div className="space-y-8">
            {/* Campaign Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Название рассылки
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Например: Возврат остывающих китов на выходные"
                className="w-full text-base font-semibold py-2.5 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>

            {/* Quick Presets Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Быстрые шаблоны сегментов
                </span>
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_SEGMENTATION)}
                  className="text-xs text-slate-400 hover:text-slate-800 transition-colors"
                >
                  Сбросить все фильтры
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Period Selection Section */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-violet-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Период сегментации аудитории:
                  </span>
                  <span className="text-xs font-semibold text-violet-700 bg-violet-100/80 border border-violet-200 px-2 py-0.5 rounded-md">
                    {periodLabel}
                  </span>
                </div>
                {onDateFilterChange && (
                  <button
                    type="button"
                    onClick={() => setShowCustomRange(!showCustomRange)}
                    className="text-[11px] text-slate-600 hover:text-slate-900 underline font-medium self-start sm:self-auto"
                  >
                    {showCustomRange ? "Скрыть выбор дат" : "Выбрать произвольные даты ↗"}
                  </button>
                )}
              </div>

              {/* Quick Month / Period Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => onDateFilterChange?.(null)}
                  className={cn(
                    "text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all",
                    !dateFilter
                      ? "bg-violet-600 text-white shadow-sm font-semibold ring-1 ring-violet-400"
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
                          ? "bg-violet-600 text-white shadow-sm font-semibold ring-1 ring-violet-400"
                          : "bg-white hover:bg-slate-200/70 text-slate-700 border border-slate-200"
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Range Inputs (if open) */}
              {showCustomRange && (
                <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-[11px] text-slate-500 font-medium">С даты:</span>
                  <input
                    type="date"
                    value={customStart}
                    min={datasetStartIso}
                    max={datasetEndIso}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-slate-900"
                  />
                  <span className="text-[11px] text-slate-500 font-medium">По:</span>
                  <input
                    type="date"
                    value={customEnd}
                    min={datasetStartIso}
                    max={datasetEndIso}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customStart || !customEnd) return;
                      const s = new Date(`${customStart}T00:00:00`);
                      const e = new Date(`${customEnd}T23:59:59`);
                      if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
                      onDateFilterChange?.({
                        startDate: s,
                        endDate: e,
                        monthKey: undefined,
                      });
                    }}
                    className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium"
                  >
                    Применить даты
                  </button>
                  {dateFilter && (
                    <button
                      type="button"
                      onClick={() => onDateFilterChange?.(null)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium ml-2"
                    >
                      Сбросить фильтр
                    </button>
                  )}
                </div>
              )}

              <p className="text-[11px] text-slate-500 leading-relaxed">
                💡 Все фильтры ниже (траты LTV, число визитов, отсиженные часы) пересчитываются строго за выбранный период.
              </p>
            </div>

            {/* Configurable Ranges Section */}
            <div className="space-y-5 border-t border-slate-200 pt-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Диапазоны фильтрации
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. LTV / Spent Range */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <label className="text-xs font-medium text-slate-700 block">
                      Траты клиента за период (₽)
                    </label>
                    <span className="text-[10px] text-violet-700 bg-violet-50 font-semibold px-1.5 py-0.5 rounded border border-violet-200 truncate max-w-[170px]" title={periodLabel}>
                      {dateFilter?.monthKey 
                        ? availableMonths.find((m) => m.key === dateFilter.monthKey)?.label 
                        : dateFilter?.startDate && dateFilter?.endDate 
                          ? `${analytics?.reportDays || 0} дн.`
                          : `весь период (${totalDatasetDays} дн.)`}
                    </span>
                  </div>
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
                  <span className="text-[10px] text-slate-400 block truncate" title={periodLabel}>
                    Учитываются пополнения за: {periodLabel}
                  </span>
                </div>

                {/* 2. Days Since Last Visit Range */}
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

                {/* 3. Real Money Balance Range */}
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

                {/* 4. Bonus Balance Range */}
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

                {/* 5. Visits Range */}
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

                {/* 6. Favorite Zone Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 block">
                    Любимая зона клуба
                  </label>
                  <select
                    value={filters.favoriteZone}
                    onChange={(e) => setFilters({ ...filters, favoriteZone: e.target.value })}
                    className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                  >
                    <option value="all">Все зоны без ограничений</option>
                    {availableZones.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Loyalty & Anti-Bonus-Hunter Filter */}
              <div className="pt-3 border-t border-slate-200">
                <div className="space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <label className="text-xs font-bold text-slate-900 block">
                      Фильтр лояльности (защита от бонусоедов)
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
                        desc: "Без фильтрации по бонусам",
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
                        onClick={() => setFilters({ ...filters, loyaltyMode: opt.id as LoyaltyFilterMode })}
                        className={cn(
                          "p-2.5 rounded-lg text-left border transition-colors flex flex-col justify-between",
                          (filters.loyaltyMode || "all") === opt.id
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs"
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

                  {/* Specific day picker if needed */}
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

              {/* Automatic Day-of-Week Schedule Distribution */}
              <div className="space-y-4 border-t border-slate-200 pt-6">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Автоматическое расписание по дням и времени суток
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Алгоритм рассчитывает день недели и персональное время отправки SMS каждому гостю по его привычкам: утро (10:30), день (13:30), вечер (17:00), ночники (19:30 перед началом ночи).
                    </p>
                  </div>
                </div>

                {/* Strategy Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      id: "smart_day_eve",
                      title: "Накануне визита (за 1 день)",
                      badge: "Рекомендуется",
                      desc: "В четверг тем, кто ходит в пятницу; в пятницу — субботникам. Гость успевает забронировать место.",
                    },
                    {
                      id: "smart_day",
                      title: "В день визита",
                      badge: "Smart Day",
                      desc: "Отправка ровно в любимый день гостя (Пт, Сб, Вс и др.), когда он привык приходить в клуб.",
                    },
                    {
                      id: "even",
                      title: "Равномерно на 7 дней",
                      badge: "Плавная нагрузка",
                      desc: "Делит базу поровну по дням недели (Пн–Вс), чтобы избежать очередей и перегрузки ПК.",
                    },
                    {
                      id: "instant",
                      title: "Разово всем сразу",
                      badge: "Без расписания",
                      desc: "Классическая мгновенная отправка всей базе в один момент времени.",
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setScheduleMode(m.id as ScheduleMode)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-colors flex flex-col justify-between",
                        scheduleMode === m.id
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-900"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn(
                            "text-xs font-bold leading-tight",
                            scheduleMode === m.id ? "text-white" : "text-slate-900"
                          )}>
                            {m.title}
                          </span>
                          <span className={cn(
                            "text-[10px] font-mono px-1.5 py-0.5 rounded",
                            scheduleMode === m.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                          )}>
                            {m.badge}
                          </span>
                        </div>
                        <p className={cn(
                          "text-[11px] mt-1.5 leading-relaxed line-clamp-3",
                          scheduleMode === m.id ? "text-slate-300" : "text-slate-500"
                        )}>
                          {m.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Live 7-Day Schedule Preview */}
                {scheduleMode !== "instant" && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-semibold text-slate-700 block">
                      Прогноз распределения отправки ({cohortStats.count.toLocaleString("ru")} получателей):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const count = (scheduleDistribution[day] || []).length;
                        const share = cohortStats.count > 0 ? Math.round((count / cohortStats.count) * 100) : 0;
                        const dayCost = Math.round(count * smsParts * costPerSms);
                        return (
                          <div
                            key={day}
                            className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 text-center"
                          >
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                              {day.slice(0, 2)} • {day}
                            </span>
                            <p className="text-lg font-bold text-slate-900 font-mono">
                              {count.toLocaleString("ru")} <span className="text-xs font-normal text-slate-400">чел</span>
                            </p>
                            <div className="text-[11px] text-slate-500 space-x-1 font-mono">
                              <span>{share}%</span>
                              <span>•</span>
                              <span>~{dayCost} ₽</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tiered Gift Bonuses Section */}
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Шкала подарочных бонусов
                    </h3>
                    <span className={cn(
                      "text-[10px] font-mono px-1.5 py-0.5 rounded",
                      bonusTiersEnabled
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}>
                      {bonusTiersEnabled ? "Включена" : "Отключена"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Сумма бонуса зависит от общей суммы трат гостя. В текст сообщения подставляется тегом <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{"{Бонус_В_Подарок}"}</code>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setBonusTiersEnabled(!bonusTiersEnabled)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors self-start sm:self-auto",
                    bonusTiersEnabled
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
                  )}
                >
                  {bonusTiersEnabled ? "Шкала включена" : "Включить шкалу"}
                </button>
              </div>

              {bonusTiersEnabled && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {bonusTiers.map((tier, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-[11px] text-slate-500 shrink-0">Траты от:</span>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="0"
                              step="500"
                              value={tier.minSpent}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                const updated = [...bonusTiers];
                                updated[idx] = { ...updated[idx], minSpent: val };
                                setBonusTiers(updated);
                              }}
                              className="w-full py-1 px-2 font-mono text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded focus:border-slate-900 focus:outline-none"
                            />
                            <span className="absolute right-2 top-1 text-[10px] text-slate-400 pointer-events-none">₽</span>
                          </div>
                        </div>

                        <span className="text-slate-400 font-mono text-xs shrink-0">→</span>

                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-[11px] text-slate-500 shrink-0">Бонус:</span>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="0"
                              step="50"
                              value={tier.bonus}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                const updated = [...bonusTiers];
                                updated[idx] = { ...updated[idx], bonus: val };
                                setBonusTiers(updated);
                              }}
                              className="w-full py-1 px-2 font-mono text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded focus:border-slate-900 focus:outline-none"
                            />
                            <span className="absolute right-2 top-1 text-[10px] text-slate-400 pointer-events-none">Б</span>
                          </div>
                        </div>

                        {bonusTiers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setBonusTiers(bonusTiers.filter((_, i) => i !== idx));
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors shrink-0"
                            title="Удалить ступень"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const lastSpent = bonusTiers.length > 0 ? Math.max(...bonusTiers.map((t) => t.minSpent)) : 0;
                        const lastBonus = bonusTiers.length > 0 ? Math.max(...bonusTiers.map((t) => t.bonus)) : 0;
                        setBonusTiers([...bonusTiers, { minSpent: lastSpent + 5000, bonus: lastBonus + 500 }]);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium rounded-lg text-xs transition-colors self-start"
                    >
                      <Plus className="w-3.5 h-3.5" /> Добавить ступень
                    </button>

                    <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                      <span>Суммарно к выдаче:</span>
                      <span className="font-bold text-slate-900 font-mono text-xs">
                        {cohortStats.totalGiftBonus.toLocaleString("ru")} Б
                      </span>
                      <span className="text-slate-400">
                        (в среднем ~{cohortStats.count > 0 ? Math.round(cohortStats.totalGiftBonus / cohortStats.count) : 0} Б на гостя)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Live Counter & Summary */}
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
                  <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-left" title="Суммарная выручка, которую эти отобранные гости принесли клубу за выбранный период">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Принесли в клуб (LTV)</span>
                    <span className="font-bold text-slate-900 font-mono text-xs">{Math.round(cohortStats.totalSpent).toLocaleString("ru")} ₽</span>
                  </div>

                  <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-left" title="Сумма реальных рублей, которая сейчас лежит на игровых счетах (депозитах) этих клиентов в системе клуба">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Остаток на балансах (₽)</span>
                    <span className="font-bold text-slate-900 font-mono text-xs">{Math.round(cohortStats.totalBalance).toLocaleString("ru")} ₽</span>
                  </div>

                  <div className="px-3 py-1.5 bg-amber-50/80 border border-amber-200 rounded-lg text-left" title="Сумма бонусных баллов, которая сейчас лежит на клубных картах этих клиентов">
                    <span className="text-[10px] text-amber-700 block uppercase font-semibold">Остаток бонусов у гостей</span>
                    <span className="font-bold text-amber-900 font-mono text-xs">{Math.round(cohortStats.totalBonusBalance).toLocaleString("ru")} Б</span>
                  </div>

                  {bonusTiersEnabled && cohortStats.totalGiftBonus > 0 && (
                    <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-left" title="Суммарное количество бонусов, которое будет подарено этой когорте гостей по шкале трат">
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Подарки по шкале (Б)</span>
                      <span className="font-bold text-slate-900 font-mono text-xs">{Math.round(cohortStats.totalGiftBonus).toLocaleString("ru")} Б</span>
                    </div>
                  )}

                  <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-left" title="Сколько денег суммарно принес один отобранный гость за выбранный период">
                    <span className="text-[10px] text-slate-500 block uppercase font-semibold">Траты на 1 гостя (LTV)</span>
                    <span className="font-bold text-slate-900 font-mono text-xs">{cohortStats.avgSpentPerGuest.toLocaleString("ru")} ₽</span>
                  </div>

                  {cohortStats.avgCheckPerVisit > 0 && (
                    <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-left" title="Средний чек одного визита в клуб среди отобранных клиентов">
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Чек за 1 визит</span>
                      <span className="font-bold text-slate-900 font-mono text-xs">{cohortStats.avgCheckPerVisit.toLocaleString("ru")} ₽</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-500 font-mono bg-slate-50 p-3 rounded-lg border border-slate-200">
                {segmentationDescription}
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
                Продолжить к тексту сообщения →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: TEMPLATE TEXT & TAGS */}
        {wizardStep === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 block">
                  Готовые шаблоны сообщений
                </label>
                <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  ✓ Все оптимизированы под 1 SMS (до 70 симв.)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setTemplateText(p.text)}
                    className="p-3 text-left border border-slate-200 rounded-lg hover:border-slate-400 bg-white transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-900 block">{p.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        1 SMS ({p.text.length} с.)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 line-clamp-1 mt-1">{p.text}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Текст SMS
                </label>
                <span className="text-[11px] text-slate-400">
                  Кликните тег, чтобы вставить персонализацию
                </span>
              </div>

              {/* Tags bar */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {TEMPLATE_TAGS.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => setTemplateText((prev) => prev + " " + t.tag)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-mono transition-colors"
                    title={t.desc}
                  >
                    {t.tag}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                value={templateText}
                onChange={(e) => {
                  setTemplateText(e.target.value);
                  setWizardCostSmsRu(null);
                  setWizardCostError(null);
                }}
                placeholder="Введите текст сообщения с тегами..."
                className={cn(
                  "w-full text-sm p-3 bg-white border rounded-lg text-slate-900 focus:outline-none transition-colors",
                  smsParts > 1
                    ? "border-amber-400 focus:border-amber-600 focus:ring-1 focus:ring-amber-400"
                    : "border-slate-300 focus:border-slate-900"
                )}
              />

              {/* Character Limit and Progress Bar (70 chars limit) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-bold px-2 py-0.5 rounded text-[11px] font-mono",
                      smsParts === 1
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-amber-100 text-amber-900 border border-amber-300"
                    )}>
                      {smsParts === 1 ? "1 SMS (Эконом)" : `${smsParts} SMS-части (тариф x${smsParts})`}
                    </span>
                    <span className="font-mono text-slate-700 font-semibold text-xs">
                      {msgLength} / {smsParts === 1 ? singleLimit : smsParts * multiLimit} симв.
                    </span>
                  </div>

                  <div className="text-[11px]">
                    {smsParts === 1 ? (
                      <span className="text-emerald-700 font-medium">
                        ✓ В лимите 1 SMS (осталось {charsUntilNextPart} симв. до удорожания)
                      </span>
                    ) : (
                      <span className="text-amber-800 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Сократите на {charsToTrimToOnePart} симв., чтобы платить в 2 раза меньше!</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${Math.min(100, (msgLength / singleLimit) * 100)}%` }}
                    className={cn(
                      "h-full transition-all duration-300",
                      smsParts === 1 ? "bg-emerald-500" : "bg-amber-500"
                    )}
                  />
                  {smsParts > 1 && (
                    <div
                      style={{ width: `${Math.min(100, ((msgLength - singleLimit) / (multiLimit * (smsParts - 1))) * 100)}%` }}
                      className="h-full bg-rose-500 transition-all duration-300"
                    />
                  )}
                </div>
              </div>

              {/* Warning box when message exceeds 70 characters */}
              {smsParts > 1 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Внимание: длина {msgLength} симв. превысила лимит 1 SMS (до 70 симв.)!</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Сообщение отправляется как <b>{smsParts} SMS-части</b> (каждая часть по {multiLimit} симв.), и операторы сотовой связи тарифицируют <b>каждую часть отдельно</b>. Стоимость за одного клиента возрастает до <b>~{(smsParts * costPerSms).toFixed(2)} ₽</b> (вместо ~{costPerSms.toFixed(2)} ₽).
                  </p>
                  <p className="text-[11px] text-amber-950 font-semibold">
                    💰 Сократите текст всего на <b>{charsToTrimToOnePart} симв.</b>, чтобы сэкономить <b>~{Math.round(filteredClients.length * (smsParts - 1) * costPerSms).toLocaleString("ru")} ₽</b> на этой рассылке!
                  </p>
                </div>
              )}

              {/* Cost Calculation Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pt-2 gap-2 border-t border-slate-100">
                <span>
                  Бюджет на получателя: <b className="text-slate-800 font-mono">~{(smsParts * costPerSms).toFixed(2)} ₽</b> ({smsParts} SMS × {costPerSms} ₽)
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  {wizardCostSmsRu && wizardCostSmsRu.totalCost > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-medium text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Точный тариф SMS.RU: <b className="font-mono text-emerald-900">{wizardCostSmsRu.totalCost.toFixed(2)} ₽</b> ({wizardCostSmsRu.totalSms} SMS)
                    </span>
                  ) : (
                    <div className="flex flex-col sm:items-end">
                      <span>
                        Итого ориентировочно: <b className="text-slate-900 font-mono">~{Math.round(estimatedCost).toLocaleString("ru")} ₽</b>
                      </span>
                      {wizardCostError && (
                        <span className="text-[10px] text-amber-700 flex items-center gap-1 font-medium mt-0.5" title={wizardCostError}>
                          <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Расчет по базовой ставке операторов (~8.50 ₽/SMS). В SMS.RU нужен буквенный отправитель (код 221)</span>
                        </span>
                      )}
                    </div>
                  )}
                  {smsRuConfig?.apiId && (
                    <button
                      type="button"
                      onClick={handleCalculateWizardCost}
                      disabled={isCalculatingWizardCost || !templateText.trim() || filteredClients.length === 0}
                      className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition-colors flex items-center gap-1 disabled:opacity-40 self-start sm:self-auto"
                    >
                      {isCalculatingWizardCost ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                          <span>Считаем...</span>
                        </>
                      ) : (
                        <>
                          <Calculator className="w-3 h-3 text-slate-500" />
                          <span>{wizardCostSmsRu && wizardCostSmsRu.totalCost > 0 ? "Обновить тариф" : "Запросить в SMS.RU"}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Live Client Preview Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                  Пример с подстановкой для {sampleClient ? (sampleClient.name || "гостя") : "клиента"}:
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {sampleMessage.length} симв. • {smsParts} SMS
                </span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed font-normal bg-white p-3 rounded-lg border border-slate-200/80">
                «{sampleMessage}»
              </p>
            </div>

            {/* Telecom Rules Explainer Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-slate-600 text-xs">
              <span className="font-semibold text-slate-800 block text-[11px] uppercase tracking-wider">
                ℹ️ Правило операторов связи РФ по длине SMS (126-ФЗ):
              </span>
              <ul className="text-[11px] space-y-1 list-disc list-inside text-slate-500 leading-relaxed">
                <li><b>1 SMS (русский язык / кириллица)</b>: ровно до <b>70 символов</b> (включая пробелы и знаки).</li>
                <li><b>2+ SMS (составные)</b>: если в тексте 71 символ и больше, 3 символа в каждой части забирает служебный заголовок склейки (UDH), поэтому длина каждой части становится <b>67 символов</b> (71–134 симв. = 2 SMS, 135–201 симв. = 3 SMS).</li>
                <li><b>Тарификация</b>: оператор сотовой связи списывает оплату <b>за каждую часть отдельно</b> (~8.50 ₽ × {smsParts} = ~{(smsParts * costPerSms).toFixed(2)} ₽).</li>
              </ul>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                ← Назад к диапазонам
              </button>
              <button
                type="button"
                onClick={() => {
                  setWizardStep(3);
                  if (smsRuConfig?.apiId && !wizardCostSmsRu) {
                    handleCalculateWizardCost();
                  }
                }}
                disabled={!templateText.trim()}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors"
              >
                Проверить и сохранить →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIRM & COMPLETE */}
        {wizardStep === 3 && (
          <div className="space-y-6">
            <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Название
                </span>
                <p className="text-base font-bold text-slate-900 mt-0.5">{campaignName}</p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                <div>
                  <span className="text-xs text-slate-400 block">Получателей</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                    {filteredClients.length.toLocaleString("ru")}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Частей SMS</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                    {smsParts}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block flex items-center justify-between">
                    <span>{wizardCostSmsRu && wizardCostSmsRu.totalCost > 0 ? "Точный бюджет SMS.RU" : "Бюджет (~8.50 ₽)"}</span>
                    {smsRuConfig?.apiId && (
                      <button
                        type="button"
                        onClick={handleCalculateWizardCost}
                        disabled={isCalculatingWizardCost}
                        className="text-[10px] text-blue-600 hover:text-blue-800 underline font-normal"
                      >
                        {isCalculatingWizardCost ? "расчет..." : wizardCostSmsRu && wizardCostSmsRu.totalCost > 0 ? "пересчитать" : "уточнить в SMS.RU"}
                      </button>
                    )}
                  </span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                    {isCalculatingWizardCost ? (
                      <span className="text-slate-400 text-sm font-normal flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" /> считаем...
                      </span>
                    ) : wizardCostSmsRu && wizardCostSmsRu.totalCost > 0 ? (
                      <span className="text-emerald-700">{wizardCostSmsRu.totalCost.toFixed(2)} ₽</span>
                    ) : (
                      `~${Math.round(estimatedCost).toLocaleString("ru")} ₽`
                    )}
                  </p>
                  {wizardCostSmsRu && wizardCostSmsRu.totalCost > 0 ? (
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {wizardCostSmsRu.totalSms} SMS частей
                    </span>
                  ) : wizardCostError ? (
                    <span className="text-[10px] text-amber-600 block">
                      базовый тариф операторов (~8.50 ₽/SMS, нужен Sender ID)
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-1">
                <span className="text-xs text-slate-400 block">Параметры сегмента</span>
                <p className="text-xs text-slate-800 font-mono bg-slate-50 p-2.5 rounded-lg leading-relaxed">
                  {segmentationDescription}
                </p>
              </div>

              {/* Step 3 Schedule Summary */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 block">Режим распределения отправки</span>
                  <span className="text-xs font-semibold text-slate-800">
                    {scheduleMode === "smart_day_eve" && "Умное: накануне визита (за 1 день)"}
                    {scheduleMode === "smart_day" && "В день привычного визита"}
                    {scheduleMode === "even" && "Равномерно по дням (Пн–Вс)"}
                    {scheduleMode === "instant" && "Разово всем сразу"}
                  </span>
                </div>

                {scheduleMode !== "instant" && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
                    {DAYS_OF_WEEK.map((day) => {
                      const count = (scheduleDistribution[day] || []).length;
                      const avgPerClient = wizardCostSmsRu && wizardCostSmsRu.totalCost > 0 && filteredClients.length > 0
                        ? wizardCostSmsRu.totalCost / filteredClients.length
                        : smsParts * costPerSms;
                      const dayCost = Math.round(count * avgPerClient);
                      return (
                        <div key={day} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
                          <span className="text-[11px] font-bold text-slate-700 uppercase block">{day.slice(0, 2)}</span>
                          <p className="text-sm font-bold text-slate-900 font-mono">{count} <span className="text-[10px] font-normal text-slate-400">чел</span></p>
                          <span className="text-[10px] text-slate-500 font-mono block">~{dayCost} ₽</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-1">
                <span className="text-xs text-slate-400 block">Шаблон</span>
                <p className="text-xs text-slate-800 font-mono bg-slate-50 p-3 rounded-lg leading-relaxed">
                  {templateText}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-1">
                <span className="text-xs text-slate-400 block">Пример готового сообщения (как увидит гость)</span>
                <p className="text-xs text-slate-900 font-medium p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg leading-relaxed">
                  «{sampleMessage}»
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                ← Назад к тексту
              </button>
              <button
                type="button"
                onClick={handleFinishWizard}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
              >
                Создать кампанию и открыть
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: CAMPAIGN DETAIL (СТРАНИЦА СОЗДАННОЙ КАМПАНИИ)
  // -------------------------------------------------------------
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
            ← Ко всем кампаниям
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleStartWizard}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs rounded-lg transition-colors"
            >
              + Новая кампания
            </button>
            {activeCampaign && (
              <button
                type="button"
                onClick={() => handleDeleteCampaign(activeCampaign.id)}
                className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
              >
                Удалить кампанию
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                SMS-кампания
              </span>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Готова к отправке
              </span>
              {activeCampaign?.scheduleMode && (
                <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {activeCampaign.scheduleMode === "smart_day_eve" && "Расписание: накануне визита"}
                  {activeCampaign.scheduleMode === "smart_day" && "Расписание: в день визита"}
                  {activeCampaign.scheduleMode === "even" && "Расписание: равномерно на 7 дней"}
                  {activeCampaign.scheduleMode === "instant" && "Отправка: разово"}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {activeCampaign?.name || "SMS-кампания"}
            </h2>
            <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
              <span>Создана {activeCampaign?.createdAt ? new Date(activeCampaign.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "сегодня"}</span>
              {activeCampaign?.periodLabel && (
                <>
                  <span>•</span>
                  <span className="text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    Период: {activeCampaign.periodLabel}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
            {/* CSV Format Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">Колонки CSV:</span>
              <select
                value={csvFormat}
                onChange={(e) => setCsvFormat(e.target.value as CsvFormatMode)}
                className="py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-900"
              >
                <option value="standard">phone; text; date; time; day (Стандарт)</option>
                <option value="ru_date">номер; текст; дата; время; день (Русский)</option>
                <option value="sms_ru">phone; text; date; time (SMS-шлюз)</option>
                <option value="ru_day">номер; текст; день; время (По дням)</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeDayFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => handleExportCsv(activeCampaignClients, activeCampaign?.templateText || "", activeCampaign?.name || "sms", activeCampaignDayMap, activeDayFilter)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shadow-xs"
                >
                  Скачать CSV ({activeDayFilter})
                </button>
              )}

              <button
                type="button"
                onClick={() => handleExportCsv(activeCampaignClients, activeCampaign?.templateText || "", activeCampaign?.name || "sms", activeCampaignDayMap, "all")}
                disabled={activeCampaignClients.length === 0}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shadow-xs"
              >
                Скачать полный CSV ({activeCampaignClients.length})
              </button>

              {smsRuConfig?.apiId && (
                <button
                  type="button"
                  onClick={() => {
                    setSmsRuSendResult(null);
                    setSmsRuSendModalOpen(true);
                    handleCalculateDetailCost(displayedClients);
                  }}
                  disabled={displayedClients.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Отправить в SMS.RU</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
          CSV-файл успешно скачан: номер в формате 7xxxxxxxxxx, текст, дата (ДД.ММ.ГГГГ) и персональное время отправки (ЧЧ:ММ). Лишние данные удалены.
        </div>
      )}

      {/* Structured Metrics Block */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-slate-200 pb-6">
        <div>
          <span className="text-xs text-slate-400 uppercase tracking-wider block">
            Получателей
          </span>
          <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
            {activeCampaignClients.length.toLocaleString("ru")}
          </p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">уникальных гостей</span>
        </div>

        <div>
          <span className="text-xs text-slate-400 uppercase tracking-wider block">
            Длина шаблона
          </span>
          <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
            {(activeCampaign?.templateText || "").length} <span className="text-base font-normal text-slate-400">симв.</span>
          </p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">~1 SMS-часть на контакт</span>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              {detailCostSmsRu && detailCostSmsRu.totalCost > 0 ? "Точный бюджет SMS.RU" : "Оценка бюджета"}
            </span>
            {smsRuConfig?.apiId && (
              <button
                type="button"
                onClick={() => handleCalculateDetailCost(displayedClients)}
                disabled={isCalculatingDetailCost || displayedClients.length === 0}
                className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium"
              >
                {isCalculatingDetailCost ? "расчет..." : detailCostSmsRu && detailCostSmsRu.totalCost > 0 ? "пересчитать" : "запросить в SMS.RU"}
              </button>
            )}
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
            {isCalculatingDetailCost ? (
              <span className="text-sm font-normal text-slate-400 flex items-center gap-1.5 py-1">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> запрос в SMS.RU...
              </span>
            ) : detailCostSmsRu && detailCostSmsRu.totalCost > 0 ? (
              <span className="text-emerald-700">
                {detailCostSmsRu.totalCost.toFixed(2)} <span className="text-base font-normal text-slate-400">₽</span>
              </span>
            ) : (
              <>
                ~{Math.round(displayedClients.length * costPerSms).toLocaleString("ru")} <span className="text-base font-normal text-slate-400">₽</span>
              </>
            )}
          </p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {detailCostSmsRu && detailCostSmsRu.totalCost > 0
              ? `по тарифам операторов (${detailCostSmsRu.totalSms} SMS частей)`
              : detailCostError
                ? "базовый тариф (нужен Sender ID в SMS.RU)"
                : activeDayFilter !== "all"
                  ? `на ${activeDayFilter} (${displayedClients.length} чел по ~8.50 ₽)`
                  : "по базовой ставке операторов ~8.50 ₽/SMS"}
          </span>
        </div>

        <div>
          <span className="text-xs text-slate-400 uppercase tracking-wider block">
            Режим рассылки
          </span>
          <p className="text-base font-bold text-slate-900 mt-2">
            {activeCampaign?.scheduleMode === "smart_day_eve" && "Накануне визита"}
            {activeCampaign?.scheduleMode === "smart_day" && "В день визита"}
            {activeCampaign?.scheduleMode === "even" && "Равномерно на 7 дн."}
            {(!activeCampaign?.scheduleMode || activeCampaign?.scheduleMode === "instant") && "Разово"}
          </p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">автоматический график</span>
        </div>
      </div>

      {/* 7-Day Schedule Breakdown Strip & Day Filter */}
      {activeCampaign?.scheduleMode && activeCampaign.scheduleMode !== "instant" && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
              Распределение отправки по дням недели
            </span>
            <span className="text-xs text-slate-400">
              Нажмите на день недели, чтобы отфильтровать список и скачать CSV под этот день
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {/* All Days button */}
            <button
              type="button"
              onClick={() => setActiveDayFilter("all")}
              className={cn(
                "p-3 rounded-xl border text-center transition-all",
                activeDayFilter === "all"
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 text-slate-900"
              )}
            >
              <span className={cn(
                "text-[11px] font-bold uppercase tracking-wider block",
                activeDayFilter === "all" ? "text-slate-300" : "text-slate-500"
              )}>
                Все дни
              </span>
              <p className="text-base font-bold font-mono mt-0.5">
                {activeCampaignClients.length}
              </p>
              <span className={cn(
                "text-[10px] block font-mono mt-0.5",
                activeDayFilter === "all" ? "text-slate-300" : "text-slate-400"
              )}>
                100% базы
              </span>
            </button>

            {/* Each day card */}
            {DAYS_OF_WEEK.map((d) => {
              const count = activeCampaignDayBreakdown[d] || 0;
              const share = activeCampaignClients.length > 0 ? Math.round((count / activeCampaignClients.length) * 100) : 0;
              const isSelected = activeDayFilter === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setActiveDayFilter(isSelected ? "all" : d)}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all",
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-900"
                  )}
                >
                  <span className={cn(
                    "text-[11px] font-bold uppercase tracking-wider block",
                    isSelected ? "text-slate-300" : "text-slate-600"
                  )}>
                    {d.slice(0, 2)} • {d}
                  </span>
                  <p className="text-base font-bold font-mono mt-0.5">
                    {count} <span className={cn("text-[10px] font-normal", isSelected ? "text-slate-300" : "text-slate-400")}>чел</span>
                  </p>
                  <span className={cn(
                    "text-[10px] block font-mono mt-0.5",
                    isSelected ? "text-slate-300" : "text-slate-400"
                  )}>
                    {share}% • ~{Math.round(count * costPerSms)} ₽
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Message Template Display / Edit */}
      {(() => {
        const isDraftCyrillic = /[а-яёА-ЯЁ]/.test(detailTemplateDraft);
        const draftSingleLimit = isDraftCyrillic ? 70 : 160;
        const draftMultiLimit = isDraftCyrillic ? 67 : 153;
        const draftLength = detailTemplateDraft.length;
        const draftSmsParts = draftLength <= draftSingleLimit ? 1 : Math.ceil(draftLength / draftMultiLimit);

        if (isEditingDetailTemplate) {
          return (
            <div className="space-y-3 bg-white border border-slate-300 rounded-xl p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider block">
                    Редактирование шаблона кампании
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Кликните тег для вставки. После сохранения сообщения клиентов и выгрузка CSV обновятся мгновенно.
                  </span>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleCancelEditTemplate}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDetailTemplate}
                    disabled={!detailTemplateDraft.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Сохранить шаблон</span>
                  </button>
                </div>
              </div>

              {/* Tags bar */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {TEMPLATE_TAGS.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => setDetailTemplateDraft((prev) => (prev ? prev + " " + t.tag : t.tag))}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-mono transition-colors"
                    title={t.desc}
                  >
                    {t.tag}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={detailTemplateDraft}
                onChange={(e) => setDetailTemplateDraft(e.target.value)}
                placeholder="Введите текст SMS с тегами..."
                className="w-full text-sm p-3 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-slate-900 transition-colors"
              />

              {/* Live Character & Part Counter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-bold px-2 py-0.5 rounded text-[11px] font-mono",
                    draftSmsParts === 1
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-amber-100 text-amber-900 border border-amber-300"
                  )}>
                    {draftSmsParts === 1 ? "1 SMS (Эконом)" : `${draftSmsParts} SMS-части`}
                  </span>
                  <span className="font-mono text-slate-700 font-semibold text-xs">
                    {draftLength} / {draftSmsParts === 1 ? draftSingleLimit : draftSmsParts * draftMultiLimit} симв.
                  </span>
                </div>

                <div className="text-[11px] text-slate-500">
                  {draftSmsParts === 1 ? (
                    <span className="text-emerald-700 font-medium">
                      ✓ В лимите 1 SMS (осталось {Math.max(0, draftSingleLimit - draftLength)} симв.)
                    </span>
                  ) : (
                    <span className="text-amber-800 font-medium">
                      Превышен лимит 1 SMS (сократите на {draftLength - draftSingleLimit} симв., чтобы платить как за 1 часть)
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-2 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Шаблон с тегами персонализации
                </span>
                <span className="text-[11px] text-slate-400">
                  По этому шаблону генерируется персональное сообщение для каждого гостя
                </span>
              </div>
              <button
                type="button"
                onClick={handleStartEditTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Редактировать шаблон</span>
              </button>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono leading-relaxed select-all">
              {activeCampaign?.templateText}
            </div>
          </div>
        );
      })()}

      {/* Recipient Table */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Список сформированных сообщений ({displayedClients.length.toLocaleString("ru")}
              {activeDayFilter !== "all" && ` • день: ${activeDayFilter}`})
            </h3>
            <p className="text-xs text-slate-500">
              Итоговый текст, сгенерированный под каждого гостя индивидуально с учётом дня отправки
            </p>
          </div>
          {activeDayFilter !== "all" && (
            <button
              type="button"
              onClick={() => setActiveDayFilter("all")}
              className="text-xs text-slate-500 hover:text-slate-900 underline"
            >
              Сбросить фильтр по дню
            </button>
          )}
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4 font-semibold w-12">№</th>
                  <th className="py-3 px-4 font-semibold min-w-[130px]">Телефон (7xxx)</th>
                  <th className="py-3 px-4 font-semibold min-w-[140px]">Клиент</th>
                  <th className="py-3 px-4 font-semibold min-w-[170px]">Отправка (дата и время)</th>
                  <th className="py-3 px-4 font-semibold min-w-[90px] text-right">Подарок Б</th>
                  <th className="py-3 px-4 font-semibold min-w-[340px]">Итоговый текст сообщения</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {displayedClients.slice(0, 50).map((c, idx) => {
                  const norm = (c.phone || "").replace(/\D/g, "").slice(-10);
                  const scheduledDay = activeCampaignDayMap[norm] || "Сразу";
                  const scheduledDate = getScheduledDate(scheduledDay);
                  const scheduledTime = getScheduledTime(c);
                  const currentTiers = activeCampaign?.bonusTiers ?? bonusTiers;
                  const isTiersOn = activeCampaign?.bonusTiersEnabled ?? bonusTiersEnabled;
                  const giftBonus = calculateClientGiftBonus(c.totalSpent || 0, currentTiers, isTiersOn);
                  const finalMsg = renderMessage(activeCampaign?.templateText || "", c, scheduledDay, currentTiers, isTiersOn);
                  return (
                    <tr key={c.phone + idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">7{norm}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900 leading-tight">{c.name || "Гость"}</div>
                        {c.valueCategory === "diamond" && (
                          <div className="text-[10px] text-slate-400 font-mono">VIP • {c.cashShare}% свои</div>
                        )}
                        {c.valueCategory === "loyal" && (
                          <div className="text-[10px] text-slate-400 font-mono">Лояльный • {c.cashShare}% свои</div>
                        )}
                        {c.valueCategory === "bonus_heavy" && (
                          <div className="text-[10px] text-slate-400 font-mono">Бонусоед • {c.bonusGivenRatio}% бонусов</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900 font-mono text-xs">
                          {scheduledDay} • {scheduledDate}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {scheduledTime} ({getScheduledTimeLabel(c)})
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900">
                        {giftBonus > 0 ? `+${giftBonus.toLocaleString()} Б` : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 italic max-w-md truncate">{finalMsg}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {displayedClients.length > 50 && (
            <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-400">
              Показаны первые 50 строк. При скачивании в CSV файл войдут все {displayedClients.length.toLocaleString("ru")} получателей.
            </div>
          )}
        </div>
      </div>

      {/* SMS.RU Send Confirmation Modal */}
      {smsRuSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                  <Send className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Запуск отправки через SMS.RU
                  </h3>
                  <p className="text-xs text-slate-500">
                    Кампания: «{activeCampaign?.name}»
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSmsRuSendModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Когорта получателей:</span>
                <span className="font-semibold text-slate-900">
                  {activeDayFilter !== "all" ? `Только день: ${activeDayFilter}` : "Все дни рассылки"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Количество номеров:</span>
                <span className="font-bold text-slate-900 font-mono">{displayedClients.length} чел</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">
                  {detailCostSmsRu && detailCostSmsRu.totalCost > 0 ? "Точная стоимость (SMS.RU API):" : "Ориентировочная стоимость:"}
                </span>
                <span className="font-bold text-slate-900 font-mono">
                  {isCalculatingDetailCost ? (
                    <span className="text-slate-400 font-normal flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-600" /> расчет тарифа через API...
                    </span>
                  ) : detailCostSmsRu && detailCostSmsRu.totalCost > 0 ? (
                    <span className="text-emerald-700 font-bold">{detailCostSmsRu.totalCost.toFixed(2)} ₽ ({detailCostSmsRu.totalSms} SMS частей)</span>
                  ) : (
                    <span>~{Math.round(displayedClients.length * 8.5)} ₽ (~8.50 ₽/SMS)</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Текущий баланс SMS.RU:</span>
                <span className={cn(
                  "font-bold font-mono",
                  smsRuBalance !== null && detailCostSmsRu && detailCostSmsRu.totalCost > 0 && smsRuBalance < detailCostSmsRu.totalCost
                    ? "text-rose-600"
                    : smsRuBalance !== null && smsRuBalance < displayedClients.length * 8.5
                      ? "text-rose-600"
                      : "text-emerald-700"
                )}>
                  {smsRuBalance !== null ? `${smsRuBalance.toLocaleString("ru")} ₽` : "проверяется..."}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1.5 border-t border-slate-200">
                <span className="text-slate-500">Режим шлюза:</span>
                <span className={cn(
                  "font-bold text-[11px] px-2 py-0.5 rounded",
                  smsRuConfig?.testMode
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                )}>
                  {smsRuConfig?.testMode ? "ТЕСТОВЫЙ РЕЖИМ (test=1, без списаний)" : "БОЕВАЯ ОТПРАВКА (списание с баланса)"}
                </span>
              </div>
            </div>

            {detailCostError && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Операторы требуют зарегистрировать буквенное имя (код 221). Стоимость рассчитана по базовой ставке операторов ~8.50 ₽/SMS.</span>
              </div>
            )}

            {smsRuBalance !== null && detailCostSmsRu && smsRuBalance < detailCostSmsRu.totalCost && !smsRuConfig?.testMode && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Баланса ({smsRuBalance} ₽) может не хватить на полную отправку ({detailCostSmsRu.totalCost.toFixed(2)} ₽). Пополните счёт в SMS.RU.</span>
              </div>
            )}

            {smsRuSendResult && (
              <div className={cn(
                "p-4 rounded-xl text-xs space-y-1.5",
                smsRuSendResult.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-900" : "bg-rose-50 border border-rose-200 text-rose-900"
              )}>
                <div className="flex items-center gap-1.5 font-bold">
                  {smsRuSendResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
                  <span>{smsRuSendResult.ok ? "Отправка успешно завершена!" : "Ошибка отправки"}</span>
                </div>
                <p className="leading-relaxed">
                  Успешно передано в шлюз: <b>{smsRuSendResult.sent}</b> из {displayedClients.length}.
                  {smsRuSendResult.failed > 0 && ` Ошибок: ${smsRuSendResult.failed}.`}
                  {smsRuSendResult.cost > 0 && ` Списано: ~${Math.round(smsRuSendResult.cost)} ₽.`}
                  {smsRuSendResult.balance !== undefined && ` Текущий баланс: ${smsRuSendResult.balance} ₽.`}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSmsRuSendModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                {smsRuSendResult ? "Закрыть" : "Отмена"}
              </button>

              {!smsRuSendResult && (
                <button
                  type="button"
                  onClick={() => handleSendSmsRuCampaign(displayedClients)}
                  disabled={isSendingViaSmsRu || displayedClients.length === 0}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2"
                >
                  {isSendingViaSmsRu ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Отправка в шлюз...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Подтвердить и отправить</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
