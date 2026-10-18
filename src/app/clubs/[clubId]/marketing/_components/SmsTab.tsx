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
    name: "Забытый баланс",
    cohort: "balance",
    defaultName: "Напоминание о забытом балансе",
    text: "Привет, {Имя}! В Colizeum на твоем счете {Баланс_Руб} ₽ и {Баланс_Бонус} Б. Твой {Любимый_ПК} свободен, заглядывай!",
  },
  {
    name: "VIP-бронь на привычный день",
    cohort: "whales",
    defaultName: "VIP-бронь для постоянных гостей",
    text: "Привет, {Имя}! Скоро {Любимый_День}. Твой привычный {Любимый_ПК} в {Любимая_Зона} ждет тебя. Забронировать на вечер?",
  },
  {
    name: "Реактивация оттока",
    cohort: "churned",
    defaultName: "Возврат остывших клиентов",
    text: "{Имя}, давно не виделись в Colizeum! Дарим 250 бонусов на 4 дня. Заходи затестить новое железо!",
  },
  {
    name: "Остывающие постоянники",
    cohort: "cooling",
    defaultName: "Удержание регулярных гостей",
    text: "Привет, {Имя}! Мы соскучились. Твой любимый {Любимый_ПК} готов к каткам {Любимый_День}!",
  },
];

export function SmsTab({ clubId, analytics, excludedPhones }: Props) {
  const storageKey = `marketing_campaigns_${clubId}`;

  // Loaded campaigns history
  const [campaigns, setCampaigns] = useState<MarketingCampaignRecord[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Wizard state: "wizard" when configuring, "view" when showing results
  const [mode, setMode] = useState<"view" | "wizard">("view");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Wizard form values
  const [campaignName, setCampaignName] = useState("Рассылка постоянным гостям");
  const [selectedCohort, setSelectedCohort] = useState<"balance" | "whales" | "cooling" | "churned" | "all">("balance");
  const [templateText, setTemplateText] = useState(PRESETS[0].text);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Load existing campaigns on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const smsList = parsed.filter((c: MarketingCampaignRecord) => c.channel === "sms");
            setCampaigns(smsList);
            if (smsList.length > 0) {
              setSelectedCampaignId(smsList[0].id);
              setMode("view");
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load campaigns:", err);
      }
      // If no SMS campaigns yet, open wizard
      setMode("wizard");
    }
  }, [storageKey]);

  // Cohort audience calculation
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

  // Message renderer
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

  const sampleClient = targetClients[0] || null;
  const sampleMessage = useMemo(() => renderMessage(templateText, sampleClient), [templateText, sampleClient]);

  // Length and cost metrics
  const isCyrillic = /[а-яёА-ЯЁ]/.test(sampleMessage);
  const charLimit = isCyrillic ? 70 : 160;
  const multiLimit = isCyrillic ? 67 : 153;
  const msgLength = sampleMessage.length;
  const smsParts = msgLength <= charLimit ? 1 : Math.ceil(msgLength / multiLimit);
  const costPerSms = 3.5;
  const estimatedCost = targetClients.length * smsParts * costPerSms;

  const handleStartWizard = () => {
    setWizardStep(1);
    setMode("wizard");
  };

  const handleFinishWizard = () => {
    const record: MarketingCampaignRecord = {
      id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      clubId,
      name: campaignName.trim() || "Новая SMS-кампания",
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
        console.warn("Failed to save campaign:", e);
      }
    }

    setCampaigns((prev) => [record, ...prev]);
    setSelectedCampaignId(record.id);
    setMode("view");
  };

  const activeCampaign = campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || null;

  // Active campaign clients
  const activeCampaignClients = useMemo(() => {
    if (!activeCampaign || !analytics || !analytics.profiles) return [];
    const phoneSet = new Set(activeCampaign.targetPhones);
    return analytics.profiles.filter((p) => {
      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
      return phoneSet.has(norm);
    });
  }, [activeCampaign, analytics]);

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
    if (selectedCampaignId === id) {
      setSelectedCampaignId(updated[0]?.id || null);
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
    if (updated.length === 0) {
      setMode("wizard");
      setWizardStep(1);
    }
  };

  // -------------------------------------------------------------
  // RENDER 1: WIZARD ("КВЕСТ" НАСТРОЙКИ КАМПАНИИ)
  // -------------------------------------------------------------
  if (mode === "wizard") {
    return (
      <div className="max-w-3xl mx-auto py-4 space-y-8">
        {/* Step Indicator Header */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Мастер создания рассылки • Шаг {wizardStep} из 3
            </span>
            {campaigns.length > 0 && (
              <button
                type="button"
                onClick={() => setMode("view")}
                className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
              >
                Отмена и возврат к списку
              </button>
            )}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            {wizardStep === 1 && "Когорта получателей"}
            {wizardStep === 2 && "Текст сообщения и подстановки"}
            {wizardStep === 3 && "Проверка и запуск"}
          </h2>
        </div>

        {/* STEP 1: AUDIENCE & NAME */}
        {wizardStep === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Название кампании
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Например: Напоминание о забытых бонусах на счетах"
                className="w-full text-base font-semibold py-2.5 px-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Кому отправить сообщение?
              </label>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                {[
                  {
                    id: "balance",
                    title: "Гости с забытыми деньгами на балансе",
                    desc: "Баланс от 100 ₽ или бонусы от 200 Б, клиент не был в клубе более 7 дней",
                    count: analytics?.profiles?.filter((p) => (p.balance >= 100 || p.bonusBalance >= 200) && p.status !== "active").length || 0,
                  },
                  {
                    id: "whales",
                    title: "VIP-клиенты и Киты (Whales)",
                    desc: "Гости с чеком от 2 500 ₽ или максимальным статусом трат",
                    count: analytics?.whales?.length || 0,
                  },
                  {
                    id: "cooling",
                    title: "Остывающие постоянники",
                    desc: "Регулярно ходили в клуб, но не появлялись последние 20–40 дней",
                    count: analytics?.coolingCount || 0,
                  },
                  {
                    id: "churned",
                    title: "Клиенты в оттоке",
                    desc: "Бывшие активные клиенты, которые не были более 30 дней",
                    count: analytics?.churnedCount || 0,
                  },
                  {
                    id: "all",
                    title: "Все клиенты с ненулевым чеком",
                    desc: "Вся база клуба за исключением служебных номеров",
                    count: analytics?.profiles?.filter((p) => p.totalSpent > 0).length || 0,
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={cn(
                      "flex items-start gap-4 p-4 cursor-pointer transition-colors",
                      selectedCohort === item.id ? "bg-slate-50" : "hover:bg-slate-50/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="cohort"
                      checked={selectedCohort === item.id}
                      onChange={() => setSelectedCohort(item.id as any)}
                      className="mt-1 h-4 w-4 text-slate-900 focus:ring-slate-900"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                        <span className="text-xs font-mono font-bold text-slate-900">{item.count.toLocaleString("ru")} чел.</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <span className="text-xs text-slate-500 font-medium">
                Выбрано: <b>{targetClients.length.toLocaleString("ru")}</b> получателей
              </span>
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                disabled={targetClients.length === 0}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors"
              >
                Продолжить к тексту $\rightarrow$
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
                    onClick={() => {
                      setTemplateText(p.text);
                      if (!campaignName || campaignName.includes("Рассылка")) {
                        setCampaignName(p.defaultName);
                      }
                    }}
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
                $\leftarrow$ Назад к аудитории
              </button>
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                disabled={!templateText.trim()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors"
              >
                Проверить и сохранить $\rightarrow$
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
                    {targetClients.length.toLocaleString("ru")}
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
                $\leftarrow$ Назад к тексту
              </button>
              <button
                type="button"
                onClick={handleFinishWizard}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
              >
                Завершить настройку и открыть кампанию
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER 2: STRUCTURED OVERVIEW PAGE (РЕЗУЛЬТАТ ПОСЛЕ НАСТРОЙКИ)
  // -------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Кампания
            </span>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Сформирована
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            {activeCampaign?.name || "SMS-кампания"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Создана {activeCampaign?.createdAt ? new Date(activeCampaign.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "сегодня"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleStartWizard}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs rounded-lg transition-colors"
          >
            + Новая рассылка
          </button>

          <button
            type="button"
            onClick={() => handleExportCsv(activeCampaignClients, activeCampaign?.templateText || "", activeCampaign?.name || "sms")}
            disabled={activeCampaignClients.length === 0}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Список сформированных сообщений ({activeCampaignClients.length.toLocaleString("ru")})
            </h3>
            <p className="text-xs text-slate-500">
              Итоговый текст, сгенерированный под каждого гостя индивидуально
            </p>
          </div>

          {activeCampaign && (
            <button
              type="button"
              onClick={() => handleDeleteCampaign(activeCampaign.id)}
              className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
            >
              Удалить эту кампанию
            </button>
          )}
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

      {/* Other Campaigns Switcher if multiple exist */}
      {campaigns.length > 1 && (
        <div className="pt-6 border-t border-slate-200 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Другие созданные кампании
          </span>
          <div className="flex flex-wrap gap-2">
            {campaigns.map((camp) => (
              <button
                key={camp.id}
                type="button"
                onClick={() => setSelectedCampaignId(camp.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  selectedCampaignId === camp.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
                )}
              >
                {camp.name} ({camp.targetPhones.length} чел.)
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
