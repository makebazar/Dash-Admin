"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  MessageSquare, 
  Download, 
  Sparkles, 
  Send, 
  Users, 
  Wallet, 
  Tag, 
  Smartphone, 
  CheckCircle2, 
  Flame, 
  UserCheck, 
  FileText,
  ChevronRight,
  RefreshCw,
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

const TEMPLATE_TAGS = [
  { tag: "{Имя}", desc: "Имя клиента" },
  { tag: "{Баланс_Руб}", desc: "Баланс в рублях" },
  { tag: "{Баланс_Бонус}", desc: "Бонусный баланс" },
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
    name: "VIP-бронь на привычный день",
    cohort: "whales",
    text: "Привет, {Имя}! Скоро {Любимый_День}. Твой привычный {Любимый_ПК} в {Любимая_Зона} ждет тебя. Забронировать место на вечер?",
  },
  {
    name: "Спецпредложение на отток",
    cohort: "churned",
    text: "{Имя}, давно не виделись в Colizeum! Дарим 250 бонусов на 4 дня. Успей затестить новое железо в эти дни!",
  },
  {
    name: "Остывающие постоянники",
    cohort: "cooling",
    text: "Привет, {Имя}! Мы соскучились в Colizeum. Твой любимый {Любимый_ПК} готов к каткам {Любимый_День}!",
  },
];

export function SmsTab({ clubId, analytics, excludedPhones }: Props) {
  const [selectedCohort, setSelectedCohort] = useState<"balance" | "whales" | "cooling" | "churned" | "all">("balance");
  const [templateText, setTemplateText] = useState(PRESET_TEMPLATES[0].text);
  const [campaignName, setCampaignName] = useState("SMS: Забытые деньги на балансе");
  const [sampleClientIdx, setSampleClientIdx] = useState(0);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Storage key for campaign registry
  const storageKey = `marketing_campaigns_${clubId}`;

  // Filter cohort clients
  const targetClients: ClientProfile[] = useMemo(() => {
    if (!analytics || !analytics.profiles) return [];

    const validProfiles = analytics.profiles.filter((p) => {
      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
      return !excludedPhones.includes(norm) && norm.length >= 10;
    });

    switch (selectedCohort) {
      case "balance":
        return validProfiles
          .filter((p) => (p.balance >= 100 || p.bonusBalance >= 200) && p.status !== "active")
          .sort((a, b) => (b.balance + b.bonusBalance) - (a.balance + a.bonusBalance));
      case "whales":
        return validProfiles
          .filter((p) => p.isWhale || p.totalSpent >= 2500)
          .sort((a, b) => b.totalSpent - a.totalSpent);
      case "cooling":
        return validProfiles
          .filter((p) => p.status === "cooling" && p.totalSpent > 0)
          .sort((a, b) => b.totalSpent - a.totalSpent);
      case "churned":
        return validProfiles
          .filter((p) => p.status === "churned" && p.totalSpent > 0)
          .sort((a, b) => b.totalSpent - a.totalSpent);
      case "all":
        return validProfiles.filter((p) => p.totalSpent > 0);
      default:
        return validProfiles;
    }
  }, [analytics, selectedCohort, excludedPhones]);

  const sampleClient = targetClients[sampleClientIdx % Math.max(1, targetClients.length)] || null;

  // Substitute tags helper
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

  const previewMessage = useMemo(() => {
    return renderMessage(templateText, sampleClient);
  }, [templateText, sampleClient]);

  // Calculations for SMS parts and costs
  const isCyrillic = /[а-яёА-ЯЁ]/.test(previewMessage);
  const charLimit = isCyrillic ? 70 : 160;
  const multiLimit = isCyrillic ? 67 : 153;
  const msgLength = previewMessage.length;
  const smsParts = msgLength <= charLimit ? 1 : Math.ceil(msgLength / multiLimit);
  const costPerSms = 3.5; // ~3.5 ₽ avg in RU SMS aggregators
  const estimatedCost = targetClients.length * smsParts * costPerSms;

  const handleInsertTag = (tag: string) => {
    setTemplateText((prev) => prev + " " + tag);
  };

  const handleSelectPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setTemplateText(preset.text);
    setSelectedCohort(preset.cohort as any);
    setCampaignName(`SMS: ${preset.name}`);
  };

  const handleRegisterCampaign = () => {
    const record: MarketingCampaignRecord = {
      id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clubId,
      name: campaignName,
      channel: "sms",
      templateText,
      targetPhones: targetClients.map((c) => (c.phone || "").replace(/\D/g, "").slice(-10)),
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

  const handleExportCsv = () => {
    if (targetClients.length === 0) return;

    handleRegisterCampaign();

    const rows = [["phone", "name", "message", "balance_rub", "bonus_balance", "favorite_pc", "favorite_day"]];
    for (const c of targetClients) {
      const p = (c.phone || "").replace(/\D/g, "");
      const fullPhone = p.length === 11 && p.startsWith("8") ? "7" + p.slice(1) : p;
      const msg = renderMessage(templateText, c).replace(/"/g, '""');
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
    link.setAttribute("download", `sms_campaign_${selectedCohort}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-600/30 text-violet-400 border border-violet-500/30">
              <MessageSquare className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">Персонализированные SMS-рассылки</h2>
            <span className="bg-violet-500/30 text-violet-300 border border-violet-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {targetClients.length.toLocaleString("ru")} получателей
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-3xl">
            Конструктор шаблонов с автоподстановкой любимого дня недели, ПК, зоны, бонусов и забытого остатка гостя. Экспорт готового файла для SMS-шлюзов с фиксацией в сквозной аналитике доходимости.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={targetClients.length === 0}
          className="px-5 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 self-start md:self-auto shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Скачать CSV для рассылки</span>
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Template Builder & Settings */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Cohort Selector */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              1. Когорта получателей
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: "balance", label: "Забытые балансы", count: analytics?.profiles?.filter((p) => (p.balance >= 100 || p.bonusBalance >= 200) && p.status !== "active").length },
                { id: "whales", label: "Киты (Whales)", count: analytics?.whales?.length },
                { id: "cooling", label: "Остывающие", count: analytics?.coolingCount },
                { id: "churned", label: "Отток (>30 дн.)", count: analytics?.churnedCount },
                { id: "all", label: "Все с чеком > 0", count: analytics?.profiles?.filter((p) => p.totalSpent > 0).length },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCohort(c.id as any)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    selectedCohort === c.id
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                  )}
                >
                  <p className="text-xs font-bold">{c.label}</p>
                  <span className={cn(
                    "text-[10px] font-semibold block mt-0.5",
                    selectedCohort === c.id ? "text-violet-300" : "text-slate-400"
                  )}>
                    {c.count ?? 0} чел.
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Presets Quick Select */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Готовые сценарии рассылок
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_TEMPLATES.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className="p-3 text-left bg-slate-50 hover:bg-violet-50/60 border border-slate-200/80 hover:border-violet-200 rounded-xl transition-colors group"
                >
                  <p className="text-xs font-bold text-slate-900 group-hover:text-violet-700">{p.name}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{p.text}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Template Editor */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                2. Текст сообщения
              </label>
              <span className="text-[11px] text-slate-400">
                Нажмите на тег для вставки в текст
              </span>
            </div>

            {/* Tags Pills */}
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_TAGS.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => handleInsertTag(t.tag)}
                  className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                  title={t.desc}
                >
                  <span>{t.tag}</span>
                </button>
              ))}
            </div>

            <textarea
              rows={4}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              placeholder="Напишите текст сообщения..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
            />

            {/* Campaign Name */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                Название кампании для сквозной аналитики:
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:border-violet-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live Phone Mockup & Cost Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Smartphone Mockup */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col items-center">
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-violet-600" />
                Живой предпросмотр SMS
              </span>

              {targetClients.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSampleClientIdx((prev) => prev + 1)}
                  className="text-xs text-violet-600 hover:text-violet-800 font-semibold flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Другой гость</span>
                </button>
              )}
            </div>

            {/* Phone Screen */}
            <div className="w-full max-w-[320px] bg-slate-900 p-3 rounded-[36px] shadow-xl border-4 border-slate-800">
              {/* Speaker Notch */}
              <div className="w-20 h-3.5 bg-slate-800 rounded-full mx-auto mb-2" />

              {/* Screen Content */}
              <div className="bg-slate-100 rounded-[28px] p-4 text-slate-900 min-h-[300px] flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="text-center pb-2 border-b border-slate-200">
                    <p className="text-xs font-bold text-slate-900">COLIZEUM</p>
                    <span className="text-[10px] text-slate-400">Сегодня, 18:30</span>
                  </div>

                  {/* SMS Bubble */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-sm p-3.5 shadow-sm text-xs text-slate-800 leading-relaxed font-normal">
                    {previewMessage}
                  </div>
                </div>

                {/* Recipient Details */}
                {sampleClient && (
                  <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 space-y-0.5">
                    <p><b>Получатель:</b> {sampleClient.name || "Гость"} ({sampleClient.phone})</p>
                    <p><b>Баланс:</b> {sampleClient.balance} ₽ / {sampleClient.bonusBalance} Б</p>
                    <p><b>Любимый ПК:</b> {sampleClient.favoriteSeat || "Не определен"}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Cost & Length Scoreboard */}
            <div className="w-full grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-medium">Длина</span>
                <p className="text-sm font-bold text-slate-900 tabular-nums">{msgLength} симв.</p>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-medium">SMS-части</span>
                <p className="text-sm font-bold text-slate-900 tabular-nums">{smsParts} часть</p>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 block font-medium">Оценка бюджета</span>
                <p className="text-sm font-bold text-violet-600 tabular-nums">~{Math.round(estimatedCost).toLocaleString("ru")} ₽</p>
              </div>
            </div>

            {downloadSuccess && (
              <div className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>CSV-файл скачан, кампания зарегистрирована в сквозной аналитике!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Audience Table Preview */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Предпросмотр таблицы получателей ({targetClients.length.toLocaleString("ru")})
            </h3>
            <p className="text-xs text-slate-500">
              Персональные сообщения, которые попадут в выгрузку для SMS-шлюза
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={targetClients.length === 0}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Скачать весь список</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-100">
                <th className="py-2.5 px-3 font-semibold w-12">№</th>
                <th className="py-2.5 px-3 font-semibold min-w-[140px]">Клиент</th>
                <th className="py-2.5 px-3 font-semibold min-w-[130px]">Телефон</th>
                <th className="py-2.5 px-3 font-semibold min-w-[100px] text-right">Баланс (₽)</th>
                <th className="py-2.5 px-3 font-semibold min-w-[100px] text-right">Бонусы</th>
                <th className="py-2.5 px-3 font-semibold min-w-[110px]">Любимый ПК</th>
                <th className="py-2.5 px-3 font-semibold min-w-[320px]">Сгенерированный текст SMS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {targetClients.slice(0, 30).map((c, idx) => {
                const personalized = renderMessage(templateText, c);
                return (
                  <tr key={c.phone + idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{c.name || "Гость"}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{c.phone}</td>
                    <td className="py-2 px-3 text-right font-medium">{Math.round(c.balance || 0).toLocaleString()} ₽</td>
                    <td className="py-2 px-3 text-right font-medium text-amber-600">{Math.round(c.bonusBalance || 0).toLocaleString()} Б</td>
                    <td className="py-2 px-3 text-slate-600">{c.favoriteSeat || "—"}</td>
                    <td className="py-2 px-3 text-slate-700 italic max-w-md truncate">{personalized}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {targetClients.length > 30 && (
          <p className="text-center text-xs text-slate-400 pt-2">
            Показаны первые 30 из {targetClients.length.toLocaleString("ru")} получателей. При скачивании в CSV попадут все.
          </p>
        )}
      </div>
    </div>
  );
}
