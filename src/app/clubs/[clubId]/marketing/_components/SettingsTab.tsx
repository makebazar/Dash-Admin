"use client";

import { useState, useEffect } from "react";
import { 
  UserX, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ShieldAlert, 
  Search, 
  Phone, 
  Info,
  Sliders,
  Save,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  Send,
  ExternalLink,
  Wallet,
  Share2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizePhone } from "./segmentation";

export interface SmsRuConfig {
  apiId: string;
  senderName: string;
  testMode: boolean;
}

export interface VkAdsConfig {
  clientId: string;
  clientSecret: string;
}

interface Props {
  clubId: string;
  excludedPhones: string[];
  onSaveExcludedPhones: (phones: string[]) => void;
}

export function SettingsTab({ clubId, excludedPhones, onSaveExcludedPhones }: Props) {
  const [phoneInput, setPhoneInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // SMS.RU Settings State
  const smsStorageKey = `marketing_sms_ru_${clubId}`;
  const [apiId, setApiId] = useState("");
  const [senderName, setSenderName] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [smsSaveSuccess, setSmsSaveSuccess] = useState(false);

  // Test SMS State
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("Тестовое SMS из DashAdmin: интеграция успешно работает!");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // VK Ads API Configuration State
  const vkConfigKey = `marketing_vk_config_${clubId}`;
  const [vkClientId, setVkClientId] = useState("X3aiv6IIlQxTMLta");
  const [vkClientSecret, setVkClientSecret] = useState(
    "nxLVn9KmGxcGXVVzB1d5W04AkMiA1tbLguJm5qxYM59495CMUsCSCP0qmavcD1DGL2jw9wtNnQwtJLY3qBU5iC0P7PMut2sPnl3lVzQDjCoQfrc7eZ5QdytHsYtzanZIvShlMXV4fTQoLxootwa8XLgWwC00LBSVSuPP7bh9azSgHJcwxp4aMhpd8f9HRzdPJR22ZFk2PvJbBtaDbqSI3k9tz5qjYMdRebx5FFq962M6DVtxM7T"
  );
  const [showVkSecret, setShowVkSecret] = useState(false);
  const [isCheckingVkAuth, setIsCheckingVkAuth] = useState(false);
  const [vkAuthStatus, setVkAuthStatus] = useState<{ ok: boolean; message: string; user?: any } | null>(null);
  const [vkSaveSuccess, setVkSaveSuccess] = useState(false);

  // Load SMS.RU and VK settings on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(smsStorageKey);
        if (saved) {
          const parsed: SmsRuConfig = JSON.parse(saved);
          setApiId(parsed.apiId || "");
          setSenderName(parsed.senderName || "");
          setTestMode(Boolean(parsed.testMode));
          if (parsed.apiId) {
            checkBalance(parsed.apiId);
          }
        }
      } catch (e) {
        console.warn("Failed to load SMS.RU settings:", e);
      }

      try {
        const savedVk = localStorage.getItem(vkConfigKey);
        if (savedVk) {
          const parsedVk = JSON.parse(savedVk);
          if (parsedVk.clientId) setVkClientId(parsedVk.clientId);
          if (parsedVk.clientSecret) setVkClientSecret(parsedVk.clientSecret);
          if (parsedVk.clientId && parsedVk.clientSecret) {
            checkVkAuth(parsedVk.clientId, parsedVk.clientSecret);
          }
        } else {
          checkVkAuth(vkClientId, vkClientSecret);
        }
      } catch (e) {
        console.warn("Failed to load VK settings:", e);
      }
    }
  }, [smsStorageKey, vkConfigKey]);

  const checkBalance = async (keyToCheck: string) => {
    if (!keyToCheck.trim()) {
      setBalanceError("Сначала введите API-ключ");
      return;
    }
    setIsCheckingBalance(true);
    setBalanceError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/marketing/sms-ru?apiId=${encodeURIComponent(keyToCheck.trim())}`);
      const data = await res.json();
      if (data.ok && typeof data.balance === "number") {
        setBalance(data.balance);
      } else {
        setBalanceError(data.error || "Не удалось проверить баланс");
        setBalance(null);
      }
    } catch (e: any) {
      setBalanceError(e.message || "Ошибка подключения");
      setBalance(null);
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const handleSaveSmsSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const config: SmsRuConfig = {
      apiId: apiId.trim(),
      senderName: senderName.trim(),
      testMode,
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(smsStorageKey, JSON.stringify(config));
      window.dispatchEvent(new Event("marketing_sms_ru_updated"));
    }
    setSmsSaveSuccess(true);
    setTimeout(() => setSmsSaveSuccess(false), 3000);
    if (apiId.trim()) {
      checkBalance(apiId.trim());
    }
  };

  const handleSendTestSms = async () => {
    if (!apiId.trim()) {
      setTestResult({ ok: false, message: "Сначала укажите и сохраните API-ключ" });
      return;
    }
    const clean = testPhone.replace(/\D/g, "");
    if (clean.length < 10) {
      setTestResult({ ok: false, message: "Введите корректный номер для теста (от 10 цифр)" });
      return;
    }
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const params = new URLSearchParams({
        apiId: apiId.trim(),
        action: "send_test",
        to: clean,
        msg: testMsg,
        test: testMode ? "1" : "0",
      });
      if (senderName.trim()) params.set("from", senderName.trim());

      const res = await fetch(`/api/clubs/${clubId}/marketing/sms-ru?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          message: `${testMode ? "[ТЕСТОВЫЙ РЕЖИМ] " : ""}SMS успешно отправлено на +${clean}. Списано: ${data.cost ?? 0} ₽.`,
        });
        if (typeof data.balance === "number") setBalance(data.balance);
      } else {
        setTestResult({ ok: false, message: data.error || "Ошибка отправки" });
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || "Сетевая ошибка при отправке" });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleAddPhone = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const norm = normalizePhone(phoneInput);
    if (norm.length < 10) {
      setError("Введите корректный номер телефона (минимум 10 цифр)");
      return;
    }

    if (excludedPhones.includes(norm)) {
      setError("Этот номер уже добавлен в список исключений");
      return;
    }

    const updated = [...excludedPhones, norm];
    onSaveExcludedPhones(updated);
    setPhoneInput("");
    setCommentInput("");
    setSuccessMsg(`Номер +7 (${norm.slice(0, 3)}) ${norm.slice(3, 6)}-${norm.slice(6, 8)}-${norm.slice(8, 10)} добавлен в исключения`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleRemovePhone = (phoneToRemove: string) => {
    const updated = excludedPhones.filter((p) => p !== phoneToRemove);
    onSaveExcludedPhones(updated);
  };

  const handleClearAll = () => {
    if (confirm("Вы уверены, что хотите очистить весь список исключений?")) {
      onSaveExcludedPhones([]);
    }
  };

  const checkVkAuth = async (cId = vkClientId, cSecret = vkClientSecret) => {
    if (!cId.trim() || !cSecret.trim()) {
      setVkAuthStatus({ ok: false, message: "Заполните Client ID и Client Secret приложения ads.vk.com" });
      return;
    }
    setIsCheckingVkAuth(true);
    setVkAuthStatus(null);
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
        setVkAuthStatus({
          ok: true,
          message: data.message || "Подключение к VK Рекламе успешно установлено",
          user: data.user,
        });
      } else {
        setVkAuthStatus({ ok: false, message: data.error || "Ошибка авторизации в VK Рекламе" });
      }
    } catch (e: any) {
      setVkAuthStatus({ ok: false, message: "Ошибка связи с сервером: " + (e.message || String(e)) });
    } finally {
      setIsCheckingVkAuth(false);
    }
  };

  const handleSaveVkSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          vkConfigKey,
          JSON.stringify({
            clientId: vkClientId.trim(),
            clientSecret: vkClientSecret.trim(),
          })
        );
        window.dispatchEvent(new Event("marketing_vk_config_updated"));
      } catch (err) {
        console.warn(err);
      }
    }
    setVkSaveSuccess(true);
    setTimeout(() => setVkSaveSuccess(false), 3000);
    checkVkAuth(vkClientId, vkClientSecret);
  };

  const filteredPhones = excludedPhones.filter((p) => p.includes(search.replace(/\D/g, "")));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              <Sliders className="w-4 h-4" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Настройки маркетинга и интеграций</h2>
            {excludedPhones.length > 0 && (
              <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold px-2.5 py-0.5 rounded-full tabular-nums">
                {excludedPhones.length} в исключениях
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
            Шлюзы рассылок (SMS.RU), рекламный кабинет (VK Реклама) и черный список номеров персонала для сквозной аналитики и задач.
          </p>
        </div>

        {excludedPhones.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="px-3.5 py-2 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-semibold rounded-xl border border-slate-200 hover:border-rose-200 shadow-xs transition-colors self-start md:self-auto cursor-pointer"
          >
            Очистить весь список
          </button>
        )}
      </div>

      {/* SMS.RU Integration Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Key className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Интеграция с SMS.RU (Шлюз рассылок)
              </h3>
              {balance !== null ? (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full tabular-nums">
                  Баланс: {balance.toLocaleString("ru")} ₽
                </span>
              ) : apiId ? (
                <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Ключ сохранен
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-500 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  Не подключено
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Позволяет отправлять маркетинговые SMS напрямую из кабинета без выгрузки CSV-файлов
            </p>
          </div>

          <a
            href="https://sms.ru/?panel=apps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 self-start sm:self-auto hover:underline"
          >
            <span>Получить API-ключ на sms.ru</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <form onSubmit={handleSaveSmsSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API ID Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  API ID (Ключ из личного кабинета) <span className="text-rose-500">*</span>
                </label>
                {apiId && (
                  <button
                    type="button"
                    onClick={() => checkBalance(apiId)}
                    disabled={isCheckingBalance}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={cn("w-3 h-3", isCheckingBalance && "animate-spin")} />
                    <span>Проверить баланс</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  value={apiId}
                  onChange={(e) => setApiId(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showApiKey ? "Скрыть" : "Показать"}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {balanceError && (
                <p className="text-[11px] text-rose-600 font-medium">{balanceError}</p>
              )}
            </div>

            {/* Sender Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Имя отправителя (Sender ID) <span className="text-slate-400 font-normal">(буквенное имя)</span>
                </label>
                <a
                  href="https://sms.ru/?panel=senders"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-600 hover:text-blue-800 underline font-normal"
                >
                  Раздел имён в SMS.RU ↗
                </a>
              </div>
              <input
                type="text"
                placeholder="Например: MYCLUB (согласованное в sms.ru)"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
              />
              <span className="text-[10px] text-slate-500 block leading-relaxed">
                Операторы РФ (126-ФЗ) требуют зарегистрированного буквенного имени для доставки SMS.
              </span>
            </div>
          </div>

          {/* Operator Tariffs Reference Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 text-xs">
                Официальные тарифы операторов связи РФ:
              </span>
              <span className="text-[10px] text-slate-400">МТС • Мегафон • Билайн • Т2</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 bg-white rounded-lg border border-slate-200/80 space-y-0.5">
                <span className="font-bold text-blue-600 block">МТС</span>
                <span className="text-slate-500 block text-[10px]">Имя: 3 000 ₽/мес</span>
                <span className="text-slate-500 block text-[10px]">Шаблон: 2 000 ₽</span>
                <span className="tabular-nums text-slate-800 font-semibold block pt-0.5">от 8.50 ₽/SMS</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200/80 space-y-0.5">
                <span className="font-bold text-emerald-600 block">Мегафон</span>
                <span className="text-slate-500 block text-[10px]">Имя: 2 550 ₽/мес</span>
                <span className="text-slate-500 block text-[10px]">Шаблон: 1 220 ₽</span>
                <span className="tabular-nums text-slate-800 font-semibold block pt-0.5">от 8.40 ₽/SMS</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200/80 space-y-0.5">
                <span className="font-bold text-amber-600 block">Билайн</span>
                <span className="text-slate-500 block text-[10px]">Имя: 2 080 ₽/мес</span>
                <span className="text-slate-500 block text-[10px]">Шаблон: 1 220 ₽</span>
                <span className="tabular-nums text-slate-800 font-semibold block pt-0.5">от 8.40 ₽/SMS</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-slate-200/80 space-y-0.5">
                <span className="font-bold text-slate-900 block">Т2 (Tele2)</span>
                <span className="text-slate-500 block text-[10px]">Имя: бесплатно</span>
                <span className="text-slate-500 block text-[10px]">Шаблон: 1 100 ₽</span>
                <span className="tabular-nums text-slate-800 font-semibold block pt-0.5">от 8.36 ₽/SMS</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed pt-0.5">
              💡 <b>Совет:</b> Если вы не хотите платить абонплату за буквенное имя операторам (~7 600 ₽/мес), вы можете формировать сегменты и скачивать готовый <b>CSV-файл</b> для бесплатной рассылки через корпоративный мессенджер клуба (Telegram, VK) или корпоративный телефон клуба.
            </p>
          </div>

          {/* Test mode toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">Тестовый режим (test=1)</span>
                {testMode && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                    Эмуляция активна
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Запросы будут эмулироваться без реальной отправки на телефоны и без списания денег с баланса
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
            </label>
          </div>

          <div className="flex items-center justify-between pt-1">
            {smsSaveSuccess ? (
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Настройки SMS.RU сохранены
              </span>
            ) : <span />}

            <button
              type="submit"
              className="px-5 py-2.5 bg-black hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Сохранить настройки SMS.RU</span>
            </button>
          </div>
        </form>

        {/* Test SMS Block */}
        {apiId && (
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>Тестовая отправка SMS на свой номер</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Проверьте работу интеграции, отправив одно тестовое сообщение
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <input
                  type="text"
                  placeholder="+7 (999) 000-00-00"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
                />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Текст сообщения..."
                  value={testMsg}
                  onChange={(e) => setTestMsg(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={handleSendTestSms}
                  disabled={isSendingTest || !testPhone.trim()}
                  className="px-4 py-2 bg-black hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSendingTest ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Отправить тест</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div className={cn(
                "p-3.5 rounded-xl text-xs font-medium flex items-start gap-2.5 leading-relaxed",
                testResult.ok ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-rose-50 text-rose-900 border border-rose-200"
              )}>
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                <div className="space-y-0.5">
                  <p className="font-semibold">{testResult.ok ? "Отправлено успешно" : "Ответ шлюза SMS.RU"}</p>
                  <p className="text-[11px] font-normal leading-normal">{testResult.message}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* VK Ads Integration Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <Share2 className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Интеграция с VK Реклама (ads.vk.com)
              </h3>
              {vkAuthStatus?.ok ? (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  Кабинет активен: {vkAuthStatus.user?.name || vkAuthStatus.user?.email || "OAuth 2.0"}
                </span>
              ) : vkClientId && vkClientSecret ? (
                <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  Требуется проверка
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-500 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  Не настроено
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Автоматическая передача сегментов аудиторий и запуск рекламных кампаний через OAuth 2.0 API
            </p>
          </div>

          <a
            href="https://ads.vk.com/hq/settings/access"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 self-start sm:self-auto hover:underline"
          >
            <span>Настройки доступа ads.vk.com</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <form onSubmit={handleSaveVkSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Client ID (Идентификатор приложения) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="X3aiv6IIlQxTMLta"
                value={vkClientId}
                onChange={(e) => setVkClientId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Client Secret (Секретный ключ) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showVkSecret ? "text" : "password"}
                  placeholder="Секретный ключ..."
                  value={vkClientSecret}
                  onChange={(e) => setVkClientSecret(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowVkSecret(!showVkSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showVkSecret ? "Скрыть" : "Показать"}
                >
                  {showVkSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => checkVkAuth(vkClientId, vkClientSecret)}
                disabled={isCheckingVkAuth}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isCheckingVkAuth && "animate-spin")} />
                <span>{isCheckingVkAuth ? "Проверка связи..." : "Проверить подключение"}</span>
              </button>

              {vkAuthStatus && (
                <span className={cn(
                  "text-xs font-medium flex items-center gap-1.5",
                  vkAuthStatus.ok ? "text-emerald-700" : "text-rose-600"
                )}>
                  {vkAuthStatus.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
                  <span>{vkAuthStatus.message}</span>
                </span>
              )}

              {vkSaveSuccess && !vkAuthStatus && (
                <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Настройки сохранены
                </span>
              )}
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-black hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <Save className="w-4 h-4" />
              <span>Сохранить настройки VK</span>
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Add Phone Form */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="space-y-1 border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-slate-900" />
              <span>Добавить исключение</span>
            </h3>
            <p className="text-xs text-slate-500">
              Введите номер сотрудника или админа для скрытия из CRM
            </p>
          </div>

          <form onSubmit={handleAddPhone} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Номер телефона <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="+7 (999) 000-00-00"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Комментарий / Роль (опционально)
              </label>
              <input
                type="text"
                placeholder="Администратор смены, Управляющий..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-black hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить в исключения</span>
            </button>
          </form>

          <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-700" />
              Как это работает?
            </span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              При загрузке любых выгрузок (или открытии сохраненного среза) система отфильтровывает эти номера. Балансы сотрудников, их тестовые пополнения и списания не попадут в отчеты и выручку.
            </p>
          </div>
        </div>

        {/* Right Column: List of Excluded Phones */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Список заблокированных номеров ({excludedPhones.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Номера, исключенные из CRM и аналитических срезов
                </p>
              </div>

              {excludedPhones.length > 5 && (
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Поиск по цифрам..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
                  />
                </div>
              )}
            </div>

            {excludedPhones.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <UserX className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-700">Список исключений пуст</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Добавьте телефоны сотрудников клуба слева, чтобы они не учитывались в клиентской аналитике.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto pr-1">
                {filteredPhones.map((phone, idx) => {
                  const formatted = `+7 (${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 8)}-${phone.slice(8, 10)}`;
                  return (
                    <div
                      key={phone}
                      className="py-3 px-3 flex items-center justify-between hover:bg-slate-50/70 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-6 text-center tabular-nums">
                          {idx + 1}.
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-slate-900 tabular-nums tracking-wide">
                            {formatted}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            Скрыт из аналитики и рассылок
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePhone(phone)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Удалить из исключений"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
