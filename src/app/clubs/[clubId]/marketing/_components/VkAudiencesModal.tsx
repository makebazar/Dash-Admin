"use client";

import { useState, useMemo } from "react";
import { X, Download, Share2, Users, Flame, Gamepad2, Moon, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientProfile, ClubAnalytics } from "./segmentation";
import type { MarketingCampaignRecord } from "./SmsCampaignModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  analytics: ClubAnalytics | null;
  excludedPhones: string[];
  onCampaignCreated?: (campaign: MarketingCampaignRecord) => void;
}

type VkPreset = "lookalike_whales" | "churned_recovery" | "ps_zone" | "night_owls" | "weekend_fans";

export function VkAudiencesModal({
  isOpen,
  onClose,
  clubId,
  analytics,
  excludedPhones,
  onCampaignCreated,
}: Props) {
  const [activePreset, setActivePreset] = useState<VkPreset>("lookalike_whales");
  const [campaignName, setCampaignName] = useState("VK Аудитория: Киты для Lookalike");

  const PRESETS = [
    {
      id: "lookalike_whales",
      title: "⭐ Киты (Whales) для Lookalike",
      desc: "Топ-гости по сумме трат. Загружается в VK для поиска точно таких же платежеспособных игроков в радиусе 3 км вокруг клуба.",
      icon: Sparkles,
      color: "text-amber-500 bg-amber-50 border-amber-200",
      filter: (p: ClientProfile) => p.isWhale || p.totalSpent >= 2500,
    },
    {
      id: "churned_recovery",
      title: "🔄 Реактивация оттока (30–90 дней)",
      desc: "Бывшие активные клиенты (потратили > 1 000 ₽), переставшие ходить. Идеально под ретаргетинг с промокодом на возвращение.",
      icon: Users,
      color: "text-purple-500 bg-purple-50 border-purple-200",
      filter: (p: ClientProfile) => p.status === "churned" && p.totalSpent >= 1000,
    },
    {
      id: "ps_zone",
      title: "🎮 Консольщики (PS Зона)",
      desc: "Игроки на PlayStation (FC25, UFC, Mortal Kombat). Идеально под таргет турниров и брони диванов на компании.",
      icon: Gamepad2,
      color: "text-blue-500 bg-blue-50 border-blue-200",
      filter: (p: ClientProfile) => p.favoriteZone === "PS Зона" || p.gamerPersona === "console",
    },
    {
      id: "night_owls",
      title: "🌙 Ночники (Пакет Ночь)",
      desc: "Любители ночных каток. Для показа спецпредложений на ночные пакеты перед пятницей и субботой.",
      icon: Moon,
      color: "text-indigo-500 bg-indigo-50 border-indigo-200",
      filter: (p: ClientProfile) => p.gamerPersona === "night_owl" || (p.favoriteTariff && p.favoriteTariff.toLowerCase().includes("ночь")),
    },
    {
      id: "weekend_fans",
      title: "🎉 Игроки выходного дня",
      desc: "Посещают клуб только в пятницу–воскресенье. Для рекламы скидок и повышенного кешбэка на будние дни (Вт–Ср).",
      icon: Calendar,
      color: "text-emerald-500 bg-emerald-50 border-emerald-200",
      filter: (p: ClientProfile) => p.dayPattern === "weekend" && p.totalSpent >= 1000,
    },
  ];

  const currentPresetMeta = PRESETS.find((p) => p.id === activePreset)!;

  // Filter phones for selected preset
  const targetProfiles = useMemo(() => {
    if (!analytics || !analytics.profiles) return [];
    return analytics.profiles.filter((p) => {
      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
      if (excludedPhones.includes(norm)) return false;
      return currentPresetMeta.filter(p);
    });
  }, [analytics, activePreset, excludedPhones, currentPresetMeta]);

  const handleSelectPreset = (p: (typeof PRESETS)[0]) => {
    setActivePreset(p.id as VkPreset);
    setCampaignName(`VK: ${p.title}`);
  };

  const handleExportTxt = () => {
    if (targetProfiles.length === 0) {
      alert("В выбранном сегменте нет подходящих контактов.");
      return;
    }

    // Formatted for ads.vk.com (one +79XXXXXXXXX per line)
    const lines = targetProfiles.map((p) => `+7${p.phone.replace(/\D/g, "").slice(-10)}`);
    const content = lines.join("\r\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${campaignName.replace(/[^\w\dа-яёА-ЯЁ]+/g, "_")}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Register campaign for attribution tracking
    const record: MarketingCampaignRecord = {
      id: `camp_vk_${Date.now()}`,
      clubId,
      name: campaignName,
      channel: "vk",
      templateText: `VK Таргет аудитория: ${currentPresetMeta.title}`,
      targetPhones: targetProfiles.map((p) => p.phone.replace(/\D/g, "").slice(-10)),
      createdAt: new Date().toISOString(),
    };

    onCampaignCreated?.(record);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Share2 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Экспорт аудиторий для VK Рекламы</h3>
              <p className="text-xs text-slate-400">Формат списков телефонов под кабинет ads.vk.com</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Preset Cards */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Выберите целевую стратегию таргета
            </label>

            <div className="space-y-2">
              {PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = activePreset === preset.id;
                const count = analytics?.profiles
                  ? analytics.profiles.filter((p) => {
                      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
                      return !excludedPhones.includes(norm) && preset.filter(p);
                    }).length
                  : 0;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={cn(
                      "w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3",
                      isSelected
                        ? "border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-400"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <span className={cn("p-2 rounded-lg border shrink-0", preset.color)}>
                      <Icon className="w-4 h-4" />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900">{preset.title}</span>
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {count} чел.
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {preset.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Instructions Box */}
          <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs space-y-2 border border-slate-800">
            <div className="flex items-center gap-1.5 text-white font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Как загрузить список в кабинет VK:</span>
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-slate-400 text-[11px] leading-relaxed">
              <li>Скачайте сгенерированный файл телефонов нажатием кнопки ниже.</li>
              <li>Перейдите в кабинет <b>ads.vk.com</b> $\rightarrow$ раздел <b>«Аудитории»</b> $\rightarrow$ <b>«Пользовательские аудитории»</b>.</li>
              <li>Нажмите <b>«Загрузить список»</b> $\rightarrow$ выберите тип <b>«Телефоны»</b> и загрузите этот файл.</li>
              <li>VK найдет профили гостей в соцсети. Для китов выберите <b>«Создать похожую аудиторию (Lookalike)»</b>.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Выбрано: <b className="text-slate-900">{targetProfiles.length} контактов</b>
          </div>

          <button
            type="button"
            onClick={handleExportTxt}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Скачать файл для VK ({targetProfiles.length} чел)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
