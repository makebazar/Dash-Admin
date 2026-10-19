"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ClientProfile, ClubAnalytics, DateFilter } from "./segmentation";
import type { MarketingCampaignRecord } from "./SmsCampaignModal";
import type { SegmentationFilter } from "./SmsTab";

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
  excludedPhones: string[];
  dateFilter?: DateFilter | null;
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

const PRESETS = [
  {
    name: "Киты для Lookalike (LTV 2500+ ₽)",
    campaignName: "VK: Lookalike на VIP-клиентов",
    strategy: "Поиск в радиусе 1.5–3 км аудитории с похожими паттернами трат",
    filter: { ...DEFAULT_SEGMENTATION, spentMin: 2500 },
    creativeAngle: "Атмосфера топового клуба, VIP-буткампы, мощное железо и турниры",
    sampleText: "Играй на топовом железе твоего района! Забронируй свой привычный сетап в пару кликов.",
  },
  {
    name: "Реактивация оттока (>30 дней)",
    campaignName: "VK: Возврат остывших гостей",
    strategy: "Прямой ретаргетинг на ушедших клиентов со спецпредложением на камбэк",
    filter: { ...DEFAULT_SEGMENTATION, daysSinceMin: 31, spentMin: 500 },
    creativeAngle: "Промокод на возвращение, обновленный сетап, новые игры",
    sampleText: "Давно не заглядывал? Дарим 200 бонусов на баланс! Заходи оценить новинки в клубе.",
  },
  {
    name: "Ночники (Пакет Ночь)",
    campaignName: "VK: Анонс ночных пакетов",
    strategy: "Показ рекламы в вечернее время (17:00–22:00) перед ночными катками",
    filter: { ...DEFAULT_SEGMENTATION, preferredTime: "night" as const, spentMin: 500 },
    creativeAngle: "Ночной пакет по выгодной цене, комфорт, нон-стоп катки с друзьями",
    sampleText: "Ночной нон-стоп в клубе: бери друзей и катай всю ночь по специальному тарифу!",
  },
  {
    name: "Консольщики (PS Зона / Файтинги / FC25)",
    campaignName: "VK: Турниры и аренда PS-зоны",
    strategy: "Аренда диванов на компании, турниры по FC25 и Mortal Kombat",
    filter: { ...DEFAULT_SEGMENTATION, favoriteZone: "PS Зона" },
    creativeAngle: "Удобные диваны, большой экран, напитки и зарубы с друзьями",
    sampleText: "Пятничные катки в FC25 и Mortal Kombat! Бронируй диван на компанию.",
  },
  {
    name: "Игроки выходных (Трафик в будни)",
    campaignName: "VK: Загрузка будних дней",
    strategy: "Перенаправление клиентов выходных на будние дни (скидки на дневные часы)",
    filter: { ...DEFAULT_SEGMENTATION, dayType: "weekend" as const, spentMin: 1000 },
    creativeAngle: "Двойной кешбэк или скидка 30% во вторник и среду",
    sampleText: "Зачем ждать выходных? По будням до 18:00 действуют специальные дневные часы со скидкой.",
  },
];

export function VkTab({ clubId, analytics, excludedPhones, dateFilter }: Props) {
  const storageKey = `marketing_campaigns_${clubId}`;
  const vkConfigKey = `marketing_vk_config_${clubId}`;

  // Mode: hub (список кампаний), wizard (пошаговое создание), detail (просмотр кампании)
  const [viewMode, setViewMode] = useState<"hub" | "wizard" | "detail">("hub");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Campaigns from storage
  const [campaigns, setCampaigns] = useState<MarketingCampaignRecord[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // VK API Config
  const [vkAccessToken, setVkAccessToken] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ ok: boolean; message: string } | null>(null);

  // Wizard fields
  const [campaignName, setCampaignName] = useState("VK: Lookalike на VIP-клиентов");
  const [filters, setFilters] = useState<SegmentationFilter>(PRESETS[0].filter);
  const [offerText, setOfferText] = useState(PRESETS[0].sampleText);
  const [targetAudienceNote, setTargetAudienceNote] = useState(PRESETS[0].strategy);
  const [isExportingApi, setIsExportingApi] = useState(false);
  const [apiExportResult, setApiExportResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Load campaigns & config
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedCamps = localStorage.getItem(storageKey);
      if (savedCamps) {
        const list = JSON.parse(savedCamps);
        if (Array.isArray(list)) {
          // Filter only VK campaigns
          setCampaigns(list.filter((c: MarketingCampaignRecord) => c.channel === "vk"));
        }
      }
      const savedConfig = localStorage.getItem(vkConfigKey);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.accessToken) setVkAccessToken(parsed.accessToken);
      } else {
        // Дефолтный токен из запроса пользователя
        setVkAccessToken("xXBD9XqKpjmGqX8b");
      }
    } catch (e) {
      console.warn("Failed to load VK settings:", e);
    }
  }, [storageKey, vkConfigKey]);

  const handleSaveToken = (token: string) => {
    setVkAccessToken(token);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(vkConfigKey, JSON.stringify({ accessToken: token.trim() }));
      } catch (e) {
        console.warn(e);
      }
    }
  };

  const handleCheckAuth = async (tokenToCheck = vkAccessToken) => {
    if (!tokenToCheck.trim()) {
      setAuthStatus({ ok: false, message: "Введите API токен кабинета VK" });
      return;
    }
    setIsCheckingAuth(true);
    setAuthStatus(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/marketing/vk-ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_auth", accessToken: tokenToCheck.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setAuthStatus({ ok: true, message: data.message || "Подключение активно" });
      } else {
        setAuthStatus({ ok: false, message: data.error || "Токен отклонен сервером VK" });
      }
    } catch (e: any) {
      setAuthStatus({ ok: false, message: "Ошибка проверки: " + (e.message || String(e)) });
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Filtered clients for wizard
  const filteredClients = useMemo(() => {
    if (!analytics || !analytics.profiles) return [];
    return analytics.profiles.filter((c) => {
      const norm = (c.phone || "").replace(/\D/g, "").slice(-10);
      if (excludedPhones.includes(norm) || norm.length < 10) return false;

      // Spent
      if (filters.spentMin !== "" && c.totalSpent < Number(filters.spentMin)) return false;
      if (filters.spentMax !== "" && c.totalSpent > Number(filters.spentMax)) return false;

      // Days since last visit
      if (filters.daysSinceMin !== "" && (c.daysSince === null || c.daysSince < Number(filters.daysSinceMin))) return false;
      if (filters.daysSinceMax !== "" && (c.daysSince === null || c.daysSince > Number(filters.daysSinceMax))) return false;

      // Balance
      if (filters.balanceMin !== "" && c.balance < Number(filters.balanceMin)) return false;
      if (filters.balanceMax !== "" && c.balance > Number(filters.balanceMax)) return false;

      // Preferred time
      if (filters.preferredTime !== "all" && c.preferredTime !== filters.preferredTime) return false;

      // Day pattern
      if (filters.dayType === "weekend" && c.dayPattern !== "weekend") return false;
      if (filters.dayType === "weekday" && c.dayPattern !== "weekday") return false;

      // Favorite zone
      if (filters.favoriteZone !== "all" && c.favoriteZone !== filters.favoriteZone) return false;

      return true;
    });
  }, [analytics, excludedPhones, filters]);

  // Aggregate stats
  const totalRevenue = useMemo(() => {
    return filteredClients.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  }, [filteredClients]);

  const avgCheck = useMemo(() => {
    return filteredClients.length > 0 ? Math.round(totalRevenue / filteredClients.length) : 0;
  }, [totalRevenue, filteredClients.length]);

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
    setOfferText(p.sampleText);
    setTargetAudienceNote(p.strategy);
  };

  const handleSaveAndRegisterCampaign = () => {
    const record: MarketingCampaignRecord = {
      id: `vk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clubId,
      name: campaignName.trim() || "Новая VK-кампания",
      channel: "vk",
      templateText: offerText.trim() || targetAudienceNote,
      targetPhones: filteredClients.map((c) => (c.phone || "").replace(/\D/g, "").slice(-10)),
      createdAt: new Date().toISOString(),
      periodLabel: targetAudienceNote,
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

  const handleSendViaVkApi = async (clients: ClientProfile[], audienceTitle: string) => {
    if (!vkAccessToken.trim()) {
      alert("Укажите API токен кабинета VK в настройках подключения");
      return;
    }
    const phones = getCleanPhoneList(clients);
    if (phones.length === 0) {
      alert("Список аудитории пуст");
      return;
    }

    setIsExportingApi(true);
    setApiExportResult(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/marketing/vk-ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_audience",
          accessToken: vkAccessToken.trim(),
          audienceName: audienceTitle,
          phones,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setApiExportResult({
          ok: true,
          message: `Аудитория (${data.count} номеров) успешно создана в кабинете ads.vk.com! ID: ${data.audienceId}`,
        });
      } else {
        setApiExportResult({
          ok: false,
          message: data.error || "Ошибка загрузки аудитории через API",
        });
      }
    } catch (e: any) {
      setApiExportResult({
        ok: false,
        message: "Сетевая ошибка: " + (e.message || String(e)),
      });
    } finally {
      setIsExportingApi(false);
    }
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
  // VIEW 1: CAMPAIGNS HUB (ГЛАВНАЯ СТРАНИЦА VK РЕКЛАМЫ)
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
              Сегментация аудитории клуба, экспорт списков и управление кампаниями для ads.vk.com
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
              Кампаний создано
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {campaigns.length}
            </p>
          </div>

          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Аудитория в кампаниях
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {totalTargeted.toLocaleString("ru")}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">уникальных контактов</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Клиентов в базе
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {(analytics?.profiles?.length || 0).toLocaleString("ru")}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">для сегментации</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              API Кабинета VK
            </span>
            <p className="text-3xl font-bold text-slate-900 mt-1 font-mono">
              {vkAccessToken ? "Токен задан" : "Не настроен"}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block font-mono truncate">
              {vkAccessToken ? `${vkAccessToken.slice(0, 8)}...` : "ads.vk.com"}
            </span>
          </div>
        </div>

        {/* API Token Quick Connection Box */}
        <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Подключение к кабинету VK Реклама (API)
              </h3>
              <p className="text-xs text-slate-500">
                Позволяет выгружать аудитории клиентов напрямую в ads.vk.com в один клик
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Вставьте токен API..."
                value={vkAccessToken}
                onChange={(e) => handleSaveToken(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono w-64 focus:outline-none focus:border-slate-900"
              />
              <button
                type="button"
                onClick={() => handleCheckAuth()}
                disabled={isCheckingAuth}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
              >
                {isCheckingAuth ? "Проверка..." : "Проверить"}
              </button>
            </div>
          </div>

          {authStatus && (
            <div
              className={cn(
                "p-3 rounded-lg text-xs font-medium",
                authStatus.ok
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              )}
            >
              {authStatus.message}
            </div>
          )}
        </div>

        {/* Campaigns List or Empty State */}
        {campaigns.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Пока нет созданных аудиторий VK
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Запустите мастер: отберите целевой сегмент клиентов (Киты, отток, ночники), сформируйте оффер и отправьте в VK Рекламу.
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
                    <th className="py-3 px-4 font-semibold text-right">Размер аудитории</th>
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
                        <span className="text-[11px] text-slate-400 font-normal block truncate max-w-lg mt-0.5">
                          {camp.templateText}
                        </span>
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
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCampaignId(camp.id);
                            setViewMode("detail");
                          }}
                          className="text-xs font-semibold text-slate-900 hover:underline"
                        >
                          Открыть
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(camp.id)}
                          className="text-xs text-rose-600 hover:underline"
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
  // VIEW 2: WIZARD (МАСТЕР СОЗДАНИЯ КАМПАНИИ)
  // -------------------------------------------------------------
  if (viewMode === "wizard") {
    return (
      <div className="space-y-8 max-w-4xl">
        {/* Wizard Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">
              Мастер создания • Шаг {wizardStep} из 3
            </span>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              {wizardStep === 1 && "1. Выбор аудитории и сегментация"}
              {wizardStep === 2 && "2. Оффер и рекламный посыл"}
              {wizardStep === 3 && "3. Проверка и экспорт в VK Рекламу"}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setViewMode("hub")}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            ← Отмена
          </button>
        </div>

        {/* STEP 1: SEGMENTATION */}
        {wizardStep === 1 && (
          <div className="space-y-6">
            {/* Presets */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700 block">
                Готовые стратегии для компьютерного клуба:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="p-3 text-left border border-slate-200 hover:border-slate-400 rounded-xl transition-colors bg-white space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{p.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{p.strategy}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Campaign Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Название кампании
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Например: VK: Lookalike на VIP-клиентов"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-slate-900"
              />
            </div>

            {/* Detailed Filters */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Параметры фильтрации клиентов:
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 block">Сумма трат от (₽)</label>
                  <input
                    type="number"
                    value={filters.spentMin}
                    onChange={(e) => setFilters({ ...filters, spentMin: e.target.value ? Number(e.target.value) : "" })}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 block">Сумма трат до (₽)</label>
                  <input
                    type="number"
                    value={filters.spentMax}
                    onChange={(e) => setFilters({ ...filters, spentMax: e.target.value ? Number(e.target.value) : "" })}
                    placeholder="Без ограничений"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 block">Дней без визита от</label>
                  <input
                    type="number"
                    value={filters.daysSinceMin}
                    onChange={(e) => setFilters({ ...filters, daysSinceMin: e.target.value ? Number(e.target.value) : "" })}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 block">Дней без визита до</label>
                  <input
                    type="number"
                    value={filters.daysSinceMax}
                    onChange={(e) => setFilters({ ...filters, daysSinceMax: e.target.value ? Number(e.target.value) : "" })}
                    placeholder="Без ограничений"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 block">Время суток</label>
                  <select
                    value={filters.preferredTime}
                    onChange={(e) => setFilters({ ...filters, preferredTime: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="all">Любое время</option>
                    <option value="night">Ночь (пакет Ночь)</option>
                    <option value="evening">Вечер</option>
                    <option value="day">День</option>
                    <option value="morning">Утро</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 block">Паттерн дней</label>
                  <select
                    value={filters.dayType}
                    onChange={(e) => setFilters({ ...filters, dayType: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="all">Все дни недели</option>
                    <option value="weekday">Будни (Пн–Чт)</option>
                    <option value="weekend">Выходные (Пт–Вс)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Scoreboard for current filter */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Найдено контактов:</span>
                <span className="font-bold text-slate-900 ml-2 font-mono">
                  {filteredClients.length.toLocaleString("ru")} чел.
                </span>
              </div>
              <div>
                <span className="text-slate-500">Суммарный спенд:</span>
                <span className="font-bold text-slate-900 ml-2 font-mono">
                  {Math.round(totalRevenue).toLocaleString("ru")} ₽
                </span>
              </div>
              <div>
                <span className="text-slate-500">Средний чек:</span>
                <span className="font-bold text-slate-900 ml-2 font-mono">
                  {avgCheck.toLocaleString("ru")} ₽
                </span>
              </div>
            </div>

            {/* Next button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                disabled={filteredClients.length === 0}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
              >
                Далее: Оффер и креатив →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CREATIVE & OFFER */}
        {wizardStep === 2 && (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Стратегия таргетинга / Цель кампании
              </label>
              <input
                type="text"
                value={targetAudienceNote}
                onChange={(e) => setTargetAudienceNote(e.target.value)}
                placeholder="Например: Lookalike в радиусе 2 км от клуба"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 block">
                  Рекламный посыл / Текст креатива
                </label>
                <span className="text-[11px] text-slate-400">
                  {offerText.length} символов
                </span>
              </div>
              <textarea
                rows={4}
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
                placeholder="Текст объявления для рекламной записи..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs leading-relaxed focus:outline-none focus:border-slate-900"
              />
              <span className="text-[11px] text-slate-400 block">
                Этот текст сохранится в карточке кампании для контроля сквозной конверсии и оценки того, какой оффер сработал лучше всего.
              </span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                ← Назад
              </button>

              <button
                type="button"
                onClick={() => setWizardStep(3)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
              >
                Далее: Экспорт в VK →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: EXPORT & LAUNCH */}
        {wizardStep === 3 && (
          <div className="space-y-6">
            {/* Summary card */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Параметры создаваемой кампании:
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Название:</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{campaignName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Аудитория:</span>
                  <span className="font-bold text-slate-900 block mt-0.5 font-mono">
                    {filteredClients.length.toLocaleString("ru")} чел.
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Выручка сегмента:</span>
                  <span className="font-bold text-slate-900 block mt-0.5 font-mono">
                    {Math.round(totalRevenue).toLocaleString("ru")} ₽
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Средний чек:</span>
                  <span className="font-bold text-slate-900 block mt-0.5 font-mono">
                    {avgCheck.toLocaleString("ru")} ₽
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="text-slate-400 text-[11px] block">Оффер:</span>
                <p className="text-xs text-slate-800 mt-0.5 font-medium">{offerText}</p>
              </div>
            </div>

            {/* Launch options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Direct API */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Загрузить напрямую в кабинет VK Ads
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Отправка списка номеров через API в раздел «Пользовательские аудитории» кабинета ads.vk.com.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSendViaVkApi(filteredClients, campaignName)}
                    disabled={isExportingApi || !vkAccessToken}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
                  >
                    {isExportingApi ? "Загрузка в VK..." : "Отправить в VK Ads по API"}
                  </button>
                  {!vkAccessToken && (
                    <span className="text-[10px] text-slate-400 block text-center">
                      Требуется токен в настройках
                    </span>
                  )}
                </div>
              </div>

              {/* Option B: Manual export */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Скачать файл номеров (.TXT)
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Формат один номер на строку (+79XXXXXXXXX). Загружается вручную в ads.vk.com → Аудитории → Загрузить список.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleExportTxt(filteredClients, campaignName)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition-colors"
                  >
                    {downloadSuccess ? "Файл скачан!" : "Скачать .TXT"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyPhones(filteredClients)}
                    className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
                  >
                    {copiedSuccess ? "Скопировано!" : "Копировать"}
                  </button>
                </div>
              </div>
            </div>

            {apiExportResult && (
              <div
                className={cn(
                  "p-3 rounded-lg text-xs font-medium",
                  apiExportResult.ok
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                )}
              >
                {apiExportResult.message}
              </div>
            )}

            {/* Navigation & Registration */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                ← Назад
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
  // VIEW 3: CAMPAIGN DETAIL (ПРОСМОТР КОНКРЕТНОЙ КАМПАНИИ)
  // -------------------------------------------------------------
  if (viewMode === "detail" && activeCampaign) {
    const listPhones = getCleanPhoneList(activeCampaignClients);

    return (
      <div className="space-y-6">
        {/* Detail Header */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setViewMode("hub")}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 block"
            >
              ← К списку кампаний
            </button>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {activeCampaign.name}
            </h2>
            <p className="text-xs text-slate-500">
              Создана {new Date(activeCampaign.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} • Охват {activeCampaign.targetPhones.length} чел.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleSendViaVkApi(activeCampaignClients, activeCampaign.name)}
              disabled={isExportingApi || !vkAccessToken}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
            >
              {isExportingApi ? "Отправка..." : "Отправить в VK Ads по API"}
            </button>
            <button
              type="button"
              onClick={() => handleExportTxt(activeCampaignClients, activeCampaign.name)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition-colors"
            >
              {downloadSuccess ? "Скачано!" : "Скачать .TXT"}
            </button>
            <button
              type="button"
              onClick={() => handleCopyPhones(activeCampaignClients)}
              className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
            >
              {copiedSuccess ? "Скопировано!" : "Копировать"}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteCampaign(activeCampaign.id)}
              className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors"
            >
              Удалить
            </button>
          </div>
        </div>

        {apiExportResult && (
          <div
            className={cn(
              "p-3 rounded-lg text-xs font-medium",
              apiExportResult.ok
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            )}
          >
            {apiExportResult.message}
          </div>
        )}

        {/* Campaign Info Card */}
        <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
            Оффер и рекламный посыл
          </span>
          <p className="text-xs text-slate-800 leading-relaxed font-medium">
            {activeCampaign.templateText || "Оффер не указан"}
          </p>
        </div>

        {/* Contacts Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Список контактов ({activeCampaignClients.length})
            </h3>
            <span className="text-xs text-slate-400">Формат: +7 (XXX) XXX-XX-XX</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold w-12">№</th>
                  <th className="py-2.5 px-3 font-semibold">Имя</th>
                  <th className="py-2.5 px-3 font-semibold font-mono">Телефон</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Потрачено</th>
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
                    <td className="py-2 px-3 text-slate-600">{c.favoriteZone || "—"}</td>
                    <td className="py-2 px-3 text-slate-600">{c.favoriteDay || c.dayPattern || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activeCampaignClients.length > 100 && (
            <p className="text-xs text-slate-400 text-center">
              Показаны первые 100 из {activeCampaignClients.length.toLocaleString("ru")} контактов. В экспорт и отправку попадают все номера.
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
