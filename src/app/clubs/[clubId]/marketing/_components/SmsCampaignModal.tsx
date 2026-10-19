"use client";

import { useState, useMemo } from "react";
import { X, MessageSquare, Download, Sparkles, Send, Users, Wallet, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientProfile, ClubAnalytics } from "./segmentation";

export interface BonusTier {
  minSpent: number;
  bonus: number;
}

export interface MarketingCampaignRecord {
  id: string;
  clubId: string;
  name: string;
  channel: "sms" | "vk" | "tasks";
  templateText: string;
  targetPhones: string[];
  createdAt: string;
  returnedCount?: number;
  returnedRevenue?: number;
  scheduleMode?: "instant" | "smart_day" | "smart_day_eve" | "even";
  scheduleDayMap?: Record<string, string>; // phone -> scheduled day
  periodLabel?: string; // Human readable period used for segmentation
  bonusTiers?: BonusTier[];
  bonusTiersEnabled?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  analytics: ClubAnalytics | null;
  excludedPhones: string[];
  onCampaignCreated?: (campaign: MarketingCampaignRecord) => void;
}

const TEMPLATE_TAGS = [
  { tag: "{Имя}", desc: "Имя клиента" },
  { tag: "{Баланс_Руб}", desc: "Баланс в рублях" },
  { tag: "{Баланс_Бонус}", desc: "Бонусный баланс" },
  { tag: "{Бонус_В_Подарок}", desc: "Сумма бонуса по шкале трат" },
  { tag: "{Любимый_ПК}", desc: "Любимый компьютер" },
  { tag: "{Любимый_День}", desc: "Любимый день недели" },
  { tag: "{Любимая_Зона}", desc: "Любимая зона" },
  { tag: "{Любимый_Тариф}", desc: "Любимый тариф" },
];

const PRESET_TEMPLATES = [
  {
    name: "Забытые деньги на балансе",
    cohort: "balance",
    text: "Привет, {Имя}! Напоминаем, что в Colizeum на твоем счете {Баланс_Руб} ₽ и {Баланс_Бонус} Б. Твой {Любимый_ПК} свободен, заглядывай поиграть!",
  },
  {
    name: "Бронь на привычный день",
    cohort: "whales",
    text: "Привет, {Имя}! Скоро {Любимый_День}. Твой привычный {Любимый_ПК} в {Любимая_Зона} ждет тебя. Забронировать место на вечер?",
  },
  {
    name: "Спецпредложение на отток",
    cohort: "churned",
    text: "{Имя}, давно не виделись в Colizeum! Дарим 250 бонусов на 4 дня. Успей затестить новое железо в эти дни!",
  },
];

export function SmsCampaignModal({
  isOpen,
  onClose,
  clubId,
  analytics,
  excludedPhones,
  onCampaignCreated,
}: Props) {
  const [campaignName, setCampaignName] = useState("SMS-кампания " + new Date().toLocaleDateString("ru-RU"));
  const [selectedCohort, setSelectedCohort] = useState<"balance" | "whales" | "churned" | "weekend">("balance");
  const [template, setTemplate] = useState(PRESET_TEMPLATES[0].text);

  // Filter cohort recipients
  const recipients = useMemo(() => {
    if (!analytics || !analytics.profiles) return [];

    return analytics.profiles.filter((p) => {
      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
      if (excludedPhones.includes(norm)) return false;

      switch (selectedCohort) {
        case "balance":
          return p.status !== "active" && (p.balance >= 150 || p.bonusBalance >= 150);
        case "whales":
          return p.isWhale || p.totalSpent >= 2500;
        case "churned":
          return p.status === "churned" && p.totalSpent > 1000;
        case "weekend":
          return p.dayPattern === "weekend" && p.totalSpent > 1000;
        default:
          return true;
      }
    });
  }, [analytics, selectedCohort, excludedPhones]);

  // Sample recipient for live preview
  const sampleClient = recipients[0] || (analytics?.profiles ? analytics.profiles[0] : null);

  // Format message for a specific client
  const renderMessageForClient = (p: ClientProfile | null): string => {
    if (!p) return template;
    const firstName = p.name ? p.name.split(" ")[0].trim() : "друг";
    const rub = p.balance ? `${Math.round(p.balance)}` : "0";
    const bonus = p.bonusBalance ? `${Math.round(p.bonusBalance)}` : "0";
    const seat = p.favoriteSeat || "ПК";
    const day = p.favoriteDay ? p.favoriteDay.toLowerCase() : "выходные";
    const zone = p.favoriteZone || "Стандарт";
    const tariff = p.favoriteTariff || "пакет";

    return template
      .replace(/{Имя}/g, firstName)
      .replace(/{Баланс_Руб}/g, rub)
      .replace(/{Баланс_Бонус}/g, bonus)
      .replace(/{Любимый_ПК}/g, seat)
      .replace(/{Любимый_День}/g, day)
      .replace(/{Любимая_Зона}/g, zone)
      .replace(/{Любимый_Тариф}/g, tariff);
  };

  const previewMessage = renderMessageForClient(sampleClient);

  // Character counter & SMS parts
  const isCyrillic = /[а-яё]/i.test(previewMessage);
  const maxPerPart = isCyrillic ? 70 : 160;
  const charsCount = previewMessage.length;
  const partsCount = Math.max(1, Math.ceil(charsCount / maxPerPart));
  const estimatedBudget = Math.round(recipients.length * partsCount * 3.5);

  const handleInsertTag = (tag: string) => {
    setTemplate((prev) => prev + " " + tag);
  };

  const handleExportCSV = () => {
    if (recipients.length === 0) {
      alert("В выбранной когорте нет получателей.");
      return;
    }

    const rows: string[] = ["Телефон;Текст сообщения"];
    for (const r of recipients) {
      const normPhone = `7${r.phone.replace(/\D/g, "").slice(-10)}`;
      const text = renderMessageForClient(r).replace(/"/g, '""');
      rows.push(`"${normPhone}";"${text}"`);
    }

    const csvContent = "\uFEFF" + rows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${campaignName.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Register campaign for attribution tracking
    const campaignRecord: MarketingCampaignRecord = {
      id: `camp_${Date.now()}`,
      clubId,
      name: campaignName,
      channel: "sms",
      templateText: template,
      targetPhones: recipients.map((r) => r.phone.replace(/\D/g, "").slice(-10)),
      createdAt: new Date().toISOString(),
    };

    onCampaignCreated?.(campaignRecord);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
              <MessageSquare className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Конструктор SMS-рассылки</h3>
              <p className="text-xs text-slate-400">Персональные шаблоны с автоподстановкой привычек гостя</p>
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
          {/* Campaign Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Название кампании</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Cohort Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Кому отправляем (Сегмент)</label>
              <span className="text-xs font-bold text-violet-600">
                {recipients.length} получателей
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "balance", label: "💰 С балансом (>150 ₽)" },
                { id: "whales", label: "⭐ Киты (Whales)" },
                { id: "churned", label: "🔄 Отток (>30 дн.)" },
                { id: "weekend", label: "🎉 Гости выходных" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCohort(c.id as any)}
                  className={cn(
                    "px-3 py-2 text-xs font-semibold rounded-xl border text-left transition-all",
                    selectedCohort === c.id
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Template presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-slate-400">Быстрый шаблон:</span>
            {PRESET_TEMPLATES.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setTemplate(p.text)}
                className="text-[11px] font-medium px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Template Input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Текст шаблона с тегами</label>
            <textarea
              rows={3}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
              placeholder="Введите текст SMS..."
            />

            {/* Clickable Tags */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Вставить тег:</span>
              {TEMPLATE_TAGS.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => handleInsertTag(t.tag)}
                  className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200/60 font-mono text-[11px] font-semibold hover:bg-violet-100 transition-colors"
                  title={t.desc}
                >
                  {t.tag}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Предпросмотр для {sampleClient ? sampleClient.name || "первого гостя" : "гостя"}:</span>
              </span>
              <span className="font-mono text-[11px]">
                {charsCount} симв. ({partsCount} SMS)
              </span>
            </div>

            <div className="bg-slate-900 text-white p-3.5 rounded-xl font-sans text-xs leading-relaxed border border-slate-800 shadow-inner">
              «{previewMessage}»
            </div>
          </div>

          {/* Budget & Stats */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Ориентировочный бюджет:</span>
              <span className="font-black text-slate-900 text-sm">{estimatedBudget.toLocaleString("ru")} ₽</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[11px]">Получателей:</span>
              <span className="font-bold text-slate-900">{recipients.length} чел.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium text-xs rounded-xl"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Скачать CSV для рассылки ({recipients.length} чел)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
