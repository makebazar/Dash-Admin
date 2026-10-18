"use client";

import { useState, useMemo } from "react";
import { 
  Download, 
  Share2, 
  Users, 
  Flame, 
  Gamepad2, 
  Moon, 
  Calendar, 
  Sparkles, 
  Check, 
  Copy, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientProfile, ClubAnalytics } from "./segmentation";
import type { MarketingCampaignRecord } from "./SmsCampaignModal";

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
  excludedPhones: string[];
}

type VkPreset = "lookalike_whales" | "churned_recovery" | "ps_zone" | "night_owls" | "weekend_fans";

export function VkTab({ clubId, analytics, excludedPhones }: Props) {
  const [activePreset, setActivePreset] = useState<VkPreset>("lookalike_whales");
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const storageKey = `marketing_campaigns_${clubId}`;

  const PRESETS = [
    {
      id: "lookalike_whales" as const,
      title: "⭐ Киты (Whales) для Lookalike",
      badge: "Топ LTV",
      desc: "Топ-клиенты по сумме трат. Загружается в VK Рекламу для создания Lookalike (похожей аудитории) в радиусе 1–3 км вокруг клуба.",
      icon: Sparkles,
      color: "border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-900",
      iconBg: "bg-amber-100 text-amber-700",
      filter: (p: ClientProfile) => p.isWhale || p.totalSpent >= 2500,
    },
    {
      id: "churned_recovery" as const,
      title: "🔄 Реактивация оттока (30–90 дней)",
      badge: "Возврат чека",
      desc: "Бывшие активные клиенты с чеком от 1 000 ₽, переставшие посещать клуб. Идеально под ретаргетинг с промокодом на возвращение.",
      icon: Users,
      color: "border-purple-200 bg-purple-50/50 hover:bg-purple-50 text-purple-900",
      iconBg: "bg-purple-100 text-purple-700",
      filter: (p: ClientProfile) => p.status === "churned" && p.totalSpent >= 1000,
    },
    {
      id: "ps_zone" as const,
      title: "🎮 Консольщики (PS Зона)",
      badge: "PlayStation",
      desc: "Игроки в консольной зоне (FC25, UFC, Mortal Kombat). Идеально под таргет турниров на выходные и аренду диванов для компаний.",
      icon: Gamepad2,
      color: "border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-900",
      iconBg: "bg-blue-100 text-blue-700",
      filter: (p: ClientProfile) => p.favoriteZone === "PS Зона" || p.gamerPersona === "console",
    },
    {
      id: "night_owls" as const,
      title: "🌙 Ночники (Пакет Ночь)",
      badge: "Пакет Ночь",
      desc: "Постоянные посетители ночных пакетов. Для показа спецпредложений на ночные катки перед четвергом, пятницей и субботой.",
      icon: Moon,
      color: "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-900",
      iconBg: "bg-indigo-100 text-indigo-700",
      filter: (p: ClientProfile) => p.gamerPersona === "night_owl" || (p.favoriteTariff && p.favoriteTariff.toLowerCase().includes("ночь")),
    },
    {
      id: "weekend_fans" as const,
      title: "📅 Выходной прайм-тайм",
      badge: "Суббота-Вск",
      desc: "Клиенты, приходящие преимущественно в пятницу вечером, субботу и воскресенье. Для анонса дневных пакетов и свободных мест.",
      icon: Calendar,
      color: "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900",
      iconBg: "bg-emerald-100 text-emerald-700",
      filter: (p: ClientProfile) => p.dayPattern === "weekend",
    },
  ];

  const currentPresetMeta = PRESETS.find((p) => p.id === activePreset)!;

  // Filter audience
  const audience = useMemo(() => {
    if (!analytics || !analytics.profiles) return [];
    return analytics.profiles.filter((p) => {
      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
      if (excludedPhones.includes(norm) || norm.length < 10) return false;
      return currentPresetMeta.filter(p);
    });
  }, [analytics, activePreset, excludedPhones, currentPresetMeta]);

  // Aggregate stats
  const totalRevenueAudience = audience.reduce((s, p) => s + (p.totalSpent || 0), 0);
  const avgSpend = audience.length > 0 ? Math.round(totalRevenueAudience / audience.length) : 0;

  const getCleanPhoneList = () => {
    return audience
      .map((p) => {
        const raw = (p.phone || "").replace(/\D/g, "");
        if (raw.length === 11 && raw.startsWith("8")) return "+7" + raw.slice(1);
        if (raw.length === 11 && raw.startsWith("7")) return "+" + raw;
        if (raw.length === 10) return "+7" + raw;
        return "";
      })
      .filter(Boolean);
  };

  const handleRegisterCampaign = () => {
    const record: MarketingCampaignRecord = {
      id: `vk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clubId,
      name: `VK: ${currentPresetMeta.title}`,
      channel: "vk",
      templateText: `Экспорт сегмента ${currentPresetMeta.title} в ads.vk.com`,
      targetPhones: audience.map((c) => (c.phone || "").replace(/\D/g, "").slice(-10)),
      createdAt: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        const list: MarketingCampaignRecord[] = saved ? JSON.parse(saved) : [];
        list.unshift(record);
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch (e) {
        console.warn("Failed to register campaign:", e);
      }
    }
  };

  const handleDownloadTxt = () => {
    const list = getCleanPhoneList();
    if (list.length === 0) return;

    handleRegisterCampaign();

    const textContent = list.join("\r\n");
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `vk_audience_${activePreset}_${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
  };

  const handleCopyPhones = () => {
    const list = getCleanPhoneList();
    if (list.length === 0) return;
    navigator.clipboard.writeText(list.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <Share2 className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">Аудитории для VK Рекламы</h2>
            <span className="bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {audience.length.toLocaleString("ru")} телефонов
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-3xl">
            Экспорт готовых сегментов в формате для кабинета <b>ads.vk.com</b>. Позволяет находить двойников лучших клиентов (Lookalike) и возвращать ушедших гостей точечным таргетингом в радиусе клуба.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          <button
            type="button"
            onClick={handleCopyPhones}
            disabled={audience.length === 0}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs rounded-xl transition-all border border-slate-700 flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Скопировано!" : "Скопировать"}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTxt}
            disabled={audience.length === 0}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Скачать .TXT для VK</span>
          </button>
        </div>
      </div>

      {/* Preset Cards Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PRESETS.map((p) => {
          const count = analytics?.profiles?.filter((c) => {
            const norm = (c.phone || "").replace(/\D/g, "").slice(-10);
            return !excludedPhones.includes(norm) && norm.length >= 10 && p.filter(c);
          }).length || 0;

          const isSelected = activePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePreset(p.id)}
              className={cn(
                "p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-3",
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 shadow-md scale-102"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800"
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "p-2 rounded-xl text-xs",
                    isSelected ? "bg-slate-800 text-white" : p.iconBg
                  )}>
                    <p.icon className="w-4 h-4" />
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    isSelected 
                      ? "bg-slate-800 text-slate-300 border-slate-700" 
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  )}>
                    {p.badge}
                  </span>
                </div>
                <p className="text-xs font-bold leading-snug">{p.title}</p>
              </div>

              <div>
                <p className={cn(
                  "text-xl font-bold tracking-tight tabular-nums",
                  isSelected ? "text-blue-400" : "text-slate-900"
                )}>
                  {count.toLocaleString("ru")}
                </p>
                <span className={cn(
                  "text-[10px]",
                  isSelected ? "text-slate-400" : "text-slate-400"
                )}>
                  контактов в базе
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Preset Details & Action Scoreboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Preset Summary & VK Instructions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Выбранная аудитория
              </span>
              <h3 className="text-base font-bold text-slate-900">{currentPresetMeta.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed pt-1">
                {currentPresetMeta.desc}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Контактов:</span>
                <span className="font-bold text-slate-900 tabular-nums">{audience.length.toLocaleString("ru")} чел.</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Выручка сегмента:</span>
                <span className="font-bold text-slate-900 tabular-nums">{Math.round(totalRevenueAudience).toLocaleString("ru")} ₽</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Средний чек на гостя:</span>
                <span className="font-bold text-emerald-600 tabular-nums">{avgSpend.toLocaleString("ru")} ₽</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadTxt}
                disabled={audience.length === 0}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Скачать TXT для загрузки</span>
              </button>

              <button
                type="button"
                onClick={handleCopyPhones}
                disabled={audience.length === 0}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Телефоны скопированы!" : "Скопировать список (+7)"}</span>
              </button>
            </div>

            {downloadSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Аудитория скачана и добавлена в сквозную аналитику!</span>
              </div>
            )}
          </div>

          {/* Guide Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600" />
              Инструкция по загрузке в VK
            </h4>
            <ol className="text-xs text-slate-600 space-y-2.5 list-decimal pl-4 leading-relaxed">
              <li>
                Зайдите в кабинет <a href="https://ads.vk.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5">ads.vk.com <ExternalLink className="w-3 h-3" /></a>
              </li>
              <li>Перейдите во вкладку <b>«Аудитории»</b> $\rightarrow$ <b>«Пользовательские аудитории»</b>.</li>
              <li>Нажмите <b>«Загрузить список»</b> $\rightarrow$ выберите тип <b>«Номера телефонов»</b>.</li>
              <li>Загрузите скачанный файл <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">.txt</code>.</li>
              <li>
                <b>Для Китов:</b> нажмите <i>«Создать похожую аудиторию (Lookalike)»</i> и ограничьте гео радиусом 1.5–3 км вокруг вашего клуба.
              </li>
            </ol>
          </div>
        </div>

        {/* Right Column: Audience Table Preview */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Контакты аудитории ({audience.length.toLocaleString("ru")})
                </h3>
                <p className="text-xs text-slate-500">
                  Список клиентов, отобранных по критериям сегмента
                </p>
              </div>

              <span className="text-xs font-semibold text-slate-400">
                Формат: +7 (XXX) XXX-XX-XX
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <th className="py-2.5 px-3 font-semibold w-12">№</th>
                    <th className="py-2.5 px-3 font-semibold min-w-[140px]">Клиент</th>
                    <th className="py-2.5 px-3 font-semibold min-w-[130px]">Телефон</th>
                    <th className="py-2.5 px-3 font-semibold min-w-[110px] text-right">Потрачено</th>
                    <th className="py-2.5 px-3 font-semibold min-w-[110px]">Любимая зона</th>
                    <th className="py-2.5 px-3 font-semibold min-w-[130px]">Любимый тариф</th>
                    <th className="py-2.5 px-3 font-semibold min-w-[100px]">Дни</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {audience.slice(0, 50).map((c, idx) => (
                    <tr key={c.phone + idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{c.name || "Гость"}</td>
                      <td className="py-2 px-3 font-mono text-slate-700">{c.phone}</td>
                      <td className="py-2 px-3 text-right font-bold tabular-nums text-slate-900">
                        {Math.round(c.totalSpent || 0).toLocaleString()} ₽
                      </td>
                      <td className="py-2 px-3 text-slate-600">{c.favoriteZone || "—"}</td>
                      <td className="py-2 px-3 text-slate-600">{c.favoriteTariff || "—"}</td>
                      <td className="py-2 px-3 text-slate-600">{c.favoriteDay || (c.dayPattern === "weekend" ? "Выходные" : "Будни")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {audience.length > 50 && (
              <p className="text-center text-xs text-slate-400">
                Показаны первые 50 из {audience.length.toLocaleString("ru")} контактов. В выгрузку попадают все номера.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
