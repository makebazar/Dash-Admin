"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ClientProfile, ClubAnalytics } from "./segmentation";
import type { MarketingCampaignRecord } from "./SmsCampaignModal";

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
  excludedPhones: string[];
}

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
  dayType: "all",
  specificDay: "",
  preferredTime: "all",
  favoriteZone: "all",
};

const TEMPLATE_TAGS = [
  { tag: "{Имя}", desc: "Имя клиента" },
  { tag: "{Баланс_Руб}", desc: "Баланс в рублях" },
  { tag: "{Баланс_Бонус}", desc: "Бонусный баланс" },
  { tag: "{Любимый_ПК}", desc: "Любимый компьютер" },
  { tag: "{Любимый_День}", desc: "Любимый день недели" },
  { tag: "{Любимая_Зона}", desc: "Любимая зона" },
  { tag: "{Любимый_Тариф}", desc: "Любимый тариф" },
];

const PRESETS = [
  {
    name: "Все клиенты клуба",
    filter: { ...DEFAULT_SEGMENTATION, spentMin: 1 },
    campaignName: "Рассылка всей базе клиентов",
    text: "Привет, {Имя}! Ждем тебя в Colizeum. Твой любимый {Любимый_ПК} готов к каткам!",
  },
  {
    name: "Забытый баланс на счете",
    filter: { ...DEFAULT_SEGMENTATION, balanceMin: 100, daysSinceMin: 7 },
    campaignName: "Напоминание о забытом балансе",
    text: "Привет, {Имя}! В Colizeum на твоем счете {Баланс_Руб} ₽ и {Баланс_Бонус} Б. Твой {Любимый_ПК} свободен, заглядывай!",
  },
  {
    name: "VIP-киты (Whales)",
    filter: { ...DEFAULT_SEGMENTATION, spentMin: 2500 },
    campaignName: "VIP-бронь для постоянных гостей",
    text: "Привет, {Имя}! Скоро {Любимый_День}. Твой привычный {Любимый_ПК} в {Любимая_Зона} ждет тебя. Забронировать на вечер?",
  },
  {
    name: "Остывающие постоянники",
    filter: { ...DEFAULT_SEGMENTATION, daysSinceMin: 20, daysSinceMax: 45, spentMin: 1000 },
    campaignName: "Удержание остывающих гостей",
    text: "Привет, {Имя}! Мы соскучились в Colizeum. Твой любимый {Любимый_ПК} свободен {Любимый_День}!",
  },
  {
    name: "Клиенты в оттоке (>30 дней)",
    filter: { ...DEFAULT_SEGMENTATION, daysSinceMin: 31, spentMin: 500 },
    campaignName: "Возврат ушедших клиентов",
    text: "{Имя}, давно не виделись в Colizeum! Дарим 250 бонусов на 4 дня. Заходи затестить новое железо!",
  },
  {
    name: "Новички (1 визит)",
    filter: { ...DEFAULT_SEGMENTATION, visitsMin: 1, visitsMax: 1, daysSinceMax: 14 },
    campaignName: "Приветственная рассылка новичкам",
    text: "{Имя}, привет! Надеемся, тебе понравилась первая катка в Colizeum! Дарим бонус на следующий визит.",
  },
  {
    name: "Ночные игроки (Пакет Ночь)",
    filter: { ...DEFAULT_SEGMENTATION, preferredTime: "night" as const, spentMin: 500 },
    campaignName: "Спецпредложение на ночные пакеты",
    text: "Привет, {Имя}! Планируешь ночной марафон? Твой {Любимый_ПК} в {Любимая_Зона} свободен на сегодняшнюю ночь!",
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

export function SmsTab({ clubId, analytics, excludedPhones }: Props) {
  const storageKey = `marketing_campaigns_${clubId}`;

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
  const [downloadSuccess, setDownloadSuccess] = useState(false);

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

      return true;
    });
  }, [analytics, filters, excludedPhones]);

  // Summary statistics for the filtered cohort
  const cohortStats = useMemo(() => {
    const count = filteredClients.length;
    const totalSpent = filteredClients.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const totalBalance = filteredClients.reduce((sum, c) => sum + (c.balance || 0), 0);
    const avgSpent = count > 0 ? Math.round(totalSpent / count) : 0;
    return { count, totalSpent, totalBalance, avgSpent };
  }, [filteredClients]);

  // Human-readable criteria description
  const segmentationDescription = useMemo(() => {
    const parts: string[] = [];
    if (filters.spentMin !== "" && filters.spentMax !== "") parts.push(`Траты: ${filters.spentMin}–${filters.spentMax} ₽`);
    else if (filters.spentMin !== "") parts.push(`Траты от ${filters.spentMin} ₽`);
    else if (filters.spentMax !== "") parts.push(`Траты до ${filters.spentMax} ₽`);

    if (filters.daysSinceMin !== "" && filters.daysSinceMax !== "") parts.push(`Не был: ${filters.daysSinceMin}–${filters.daysSinceMax} дн.`);
    else if (filters.daysSinceMin !== "") parts.push(`Не был от ${filters.daysSinceMin} дн.`);
    else if (filters.daysSinceMax !== "") parts.push(`Не был до ${filters.daysSinceMax} дн.`);

    if (filters.balanceMin !== "") parts.push(`Баланс от ${filters.balanceMin} ₽`);
    if (filters.bonusMin !== "") parts.push(`Бонусы от ${filters.bonusMin} Б`);
    if (filters.visitsMin !== "") parts.push(`Визитов от ${filters.visitsMin}`);

    if (filters.dayType === "weekday") parts.push("Будни");
    if (filters.dayType === "weekend") parts.push("Выходные");
    if (filters.dayType === "specific" && filters.specificDay) parts.push(`День: ${filters.specificDay}`);

    if (filters.preferredTime === "night") parts.push("Ночники");
    if (filters.preferredTime === "morning") parts.push("Утро");
    if (filters.preferredTime === "day") parts.push("День");
    if (filters.preferredTime === "evening") parts.push("Вечер");

    if (filters.favoriteZone !== "all") parts.push(`Зона: ${filters.favoriteZone}`);

    return parts.length > 0 ? parts.join(" • ") : "Все клиенты без ограничений";
  }, [filters]);

  // Substitute tags into message
  const renderMessage = (text: string, client: ClientProfile | null) => {
    if (!client) return text;
    const name = client.name ? client.name.split(" ")[0] : "друг";
    const rubBal = Math.round(client.balance || 0).toLocaleString("ru");
    const bonusBal = Math.round(client.bonusBalance || 0).toLocaleString("ru");
    const seat = client.favoriteSeat || "компьютер";
    const day = client.favoriteDay ? client.favoriteDay.toLowerCase() : "выходные";
    const zone = client.favoriteZone || "VIP";
    const tariff = client.favoriteTariff || "стандарт";

    return text
      .replace(/{Имя}/g, name)
      .replace(/{Баланс_Руб}/g, `${rubBal} ₽`)
      .replace(/{Баланс_Бонус}/g, bonusBal)
      .replace(/{Любимый_ПК}/g, seat)
      .replace(/{Любимый_День}/g, day)
      .replace(/{Любимая_Зона}/g, zone)
      .replace(/{Любимый_Тариф}/g, tariff);
  };

  const sampleClient = filteredClients[0] || null;
  const sampleMessage = useMemo(() => renderMessage(templateText, sampleClient), [templateText, sampleClient]);

  // Message calculations
  const isCyrillic = /[а-яёА-ЯЁ]/.test(sampleMessage);
  const charLimit = isCyrillic ? 70 : 160;
  const multiLimit = isCyrillic ? 67 : 153;
  const msgLength = sampleMessage.length;
  const smsParts = msgLength <= charLimit ? 1 : Math.ceil(msgLength / multiLimit);
  const costPerSms = 3.5;
  const estimatedCost = filteredClients.length * smsParts * costPerSms;

  // Actions
  const handleStartWizard = () => {
    setWizardStep(1);
    setViewMode("wizard");
  };

  const handleApplyPreset = (p: typeof PRESETS[0]) => {
    setFilters(p.filter);
    setTemplateText(p.text);
    setCampaignName(p.campaignName);
  };

  const handleFinishWizard = () => {
    const record: MarketingCampaignRecord = {
      id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clubId,
      name: campaignName.trim() || "Новая SMS-кампания",
      channel: "sms",
      templateText,
      targetPhones: filteredClients.map((c) => (c.phone || "").replace(/\D/g, "").slice(-10)),
      createdAt: new Date().toISOString(),
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

  const handleExportCsv = (clientList: ClientProfile[], text: string, name: string) => {
    if (clientList.length === 0) return;

    const rows = [["phone", "name", "message", "balance_rub", "bonus_balance", "favorite_pc", "favorite_day"]];
    for (const c of clientList) {
      const p = (c.phone || "").replace(/\D/g, "");
      const fullPhone = p.length === 11 && p.startsWith("8") ? "7" + p.slice(1) : p;
      const msg = renderMessage(text, c).replace(/"/g, '""');
      rows.push([
        `+${fullPhone}`,
        `"${c.name || ""}"`,
        `"${msg}"`,
        `${Math.round(c.balance || 0)}`,
        `${Math.round(c.bonusBalance || 0)}`,
        `"${c.favoriteSeat || ""}"`,
        `"${c.favoriteDay || ""}"`,
      ]);
    }

    const csvContent = "\uFEFF" + rows.map((r) => r.join(";")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.csv`);
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
              Стоимость SMS
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              ~3.50 ₽
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">средний тариф шлюза</span>
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
                        <p className="text-[11px] text-slate-500 font-normal line-clamp-1 mt-0.5 font-mono">
                          {camp.templateText}
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

            {/* Configurable Ranges Section */}
            <div className="space-y-5 border-t border-slate-200 pt-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Диапазоны фильтрации
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. LTV / Spent Range */}
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

                <div className="text-xs text-slate-600 space-x-4">
                  <span>Оборот: <b className="text-slate-900">{Math.round(cohortStats.totalSpent).toLocaleString("ru")} ₽</b></span>
                  <span>Баланс: <b className="text-slate-900">{Math.round(cohortStats.totalBalance).toLocaleString("ru")} ₽</b></span>
                  <span>Средний чек: <b className="text-slate-900">{cohortStats.avgSpent.toLocaleString("ru")} ₽</b></span>
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
              <label className="text-xs font-semibold text-slate-700 block">
                Готовые варианты сообщений
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setTemplateText(p.text)}
                    className="p-3 text-left border border-slate-200 rounded-lg hover:border-slate-400 bg-white transition-colors"
                  >
                    <span className="text-xs font-semibold text-slate-900 block">{p.name}</span>
                    <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{p.text}</span>
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
                onChange={(e) => setTemplateText(e.target.value)}
                placeholder="Введите текст сообщения с тегами..."
                className="w-full text-sm p-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
              />

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>
                  Длина: <b className="text-slate-800">{msgLength}</b> симв. • <b className="text-slate-800">{smsParts}</b> SMS на контакт
                </span>
                <span>
                  Ориентировочный бюджет: <b className="text-slate-900 font-mono">~{Math.round(estimatedCost).toLocaleString("ru")} ₽</b>
                </span>
              </div>
            </div>

            {/* Live Client Preview Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                Пример для {sampleClient ? (sampleClient.name || "гостя") : "клиента"}:
              </span>
              <p className="text-xs text-slate-800 leading-relaxed font-normal">
                «{sampleMessage}»
              </p>
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
                onClick={() => setWizardStep(3)}
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
                  <span className="text-xs text-slate-400 block">Бюджет</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                    ~{Math.round(estimatedCost).toLocaleString("ru")} ₽
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-1">
                <span className="text-xs text-slate-400 block">Параметры сегмента</span>
                <p className="text-xs text-slate-800 font-mono bg-slate-50 p-2.5 rounded-lg leading-relaxed">
                  {segmentationDescription}
                </p>
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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                SMS-кампания
              </span>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Готова к отправке
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              {activeCampaign?.name || "SMS-кампания"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Создана {activeCampaign?.createdAt ? new Date(activeCampaign.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "сегодня"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleExportCsv(activeCampaignClients, activeCampaign?.templateText || "", activeCampaign?.name || "sms")}
            disabled={activeCampaignClients.length === 0}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm self-start sm:self-auto"
          >
            Скачать CSV для рассылки
          </button>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
          CSV-файл успешно скачан со всеми персонализированными сообщениями для SMS-шлюза.
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
          <span className="text-xs text-slate-400 uppercase tracking-wider block">
            Оценка бюджета
          </span>
          <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
            ~{Math.round(activeCampaignClients.length * costPerSms).toLocaleString("ru")} <span className="text-base font-normal text-slate-400">₽</span>
          </p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">по ставке 3.50 ₽/SMS</span>
        </div>

        <div>
          <span className="text-xs text-slate-400 uppercase tracking-wider block">
            Канал
          </span>
          <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
            SMS
          </p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">готово к импорту в шлюз</span>
        </div>
      </div>

      {/* Message Template Display */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
          Шаблон с тегами персонализации
        </span>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono leading-relaxed">
          {activeCampaign?.templateText}
        </div>
      </div>

      {/* Recipient Table */}
      <div className="space-y-3 pt-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Список сформированных сообщений ({activeCampaignClients.length.toLocaleString("ru")})
          </h3>
          <p className="text-xs text-slate-500">
            Итоговый текст, сгенерированный под каждого гостя индивидуально
          </p>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4 font-semibold w-12">№</th>
                  <th className="py-3 px-4 font-semibold min-w-[140px]">Клиент</th>
                  <th className="py-3 px-4 font-semibold min-w-[130px]">Телефон</th>
                  <th className="py-3 px-4 font-semibold min-w-[90px] text-right">Баланс</th>
                  <th className="py-3 px-4 font-semibold min-w-[90px] text-right">Бонусы</th>
                  <th className="py-3 px-4 font-semibold min-w-[110px]">Любимый ПК</th>
                  <th className="py-3 px-4 font-semibold min-w-[340px]">Итоговый текст сообщения</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {activeCampaignClients.slice(0, 50).map((c, idx) => {
                  const finalMsg = renderMessage(activeCampaign?.templateText || "", c);
                  return (
                    <tr key={c.phone + idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{c.name || "Гость"}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{c.phone}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{Math.round(c.balance || 0).toLocaleString()} ₽</td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-700">{Math.round(c.bonusBalance || 0).toLocaleString()} Б</td>
                      <td className="py-2.5 px-4 text-slate-600">{c.favoriteSeat || "—"}</td>
                      <td className="py-2.5 px-4 text-slate-700 italic max-w-md truncate">{finalMsg}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {activeCampaignClients.length > 50 && (
            <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-400">
              Показаны первые 50 строк. При скачивании в CSV файл войдут все {activeCampaignClients.length.toLocaleString("ru")} получателей.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
