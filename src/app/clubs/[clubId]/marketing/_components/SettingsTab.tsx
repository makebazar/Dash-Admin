"use client";

import { useState } from "react";
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
  Save
} from "lucide-react";
import { normalizePhone } from "./segmentation";

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
