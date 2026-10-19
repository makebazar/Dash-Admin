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
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizePhone } from "./segmentation";

export interface SmsRuConfig {
  apiId: string;
  senderName: string;
  testMode: boolean;
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

  // Load SMS.RU settings on mount
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
    }
  }, [smsStorageKey]);

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

  const filteredPhones = excludedPhones.filter((p) => p.includes(search.replace(/\D/g, "")));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <UserX className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">Настройки маркетинга и Номера-исключения</h2>
            <span className="bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {excludedPhones.length} в черном списке
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-3xl">
            Номера администраторов клуба, техников, управляющих и владельцев. Они автоматически вырезаются из всех расчетов: базы гостей, задач для смены, списков Китов, SMS-рассылок и рекламы в VK.
          </p>
        </div>

        {excludedPhones.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="px-3.5 py-2 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 text-xs font-semibold rounded-xl border border-slate-700 hover:border-rose-800/60 transition-colors self-start md:self-auto"
          >
            Очистить весь список
          </button>
        )}
      </div>

      {/* SMS.RU Integration Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
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
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full font-mono">
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
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
              <label className="text-xs font-semibold text-slate-700">
                Имя отправителя (Sender ID) <span className="text-slate-400 font-normal">(опционально)</span>
              </label>
              <input
                type="text"
                placeholder="Например: COLIZEUM (если согласовано в sms.ru)"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition-colors"
              />
              <span className="text-[10px] text-slate-400 block">
                Оставьте пустым для отправки с общего сервисного номера SMS.RU
              </span>
            </div>
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
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2"
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
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Текст сообщения..."
                  value={testMsg}
                  onChange={(e) => setTestMsg(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={handleSendTestSms}
                  disabled={isSendingTest || !testPhone.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors shrink-0 flex items-center gap-1.5"
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
                "p-3 rounded-lg text-xs font-medium flex items-center gap-2",
                testResult.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
              )}>
                {testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Add Phone Form */}
        <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="space-y-1 border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-violet-600" />
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
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
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
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
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
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить в исключения</span>
            </button>
          </form>

          <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-violet-600" />
              Как это работает?
            </span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              При загрузке любых выгрузок (или открытии сохраненного среза) система отфильтровывает эти номера. Балансы сотрудников, их тестовые пополнения и списания не попадут в отчеты и выручку.
            </p>
          </div>
        </div>

        {/* Right Column: List of Excluded Phones */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
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
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-400 focus:bg-white"
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
                          <p className="text-xs font-bold text-slate-900 font-mono tracking-wide">
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
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
