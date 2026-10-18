"use client";

import { useState } from "react";
import { X, ShieldAlert, Plus, Trash2, CheckCircle2, UserX } from "lucide-react";
import { normalizePhone } from "./segmentation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  excludedPhones: string[];
  onSaveExcludedPhones: (phones: string[]) => void;
}

export function MarketingSettingsModal({
  isOpen,
  onClose,
  clubId,
  excludedPhones,
  onSaveExcludedPhones,
}: Props) {
  const [phoneInput, setPhoneInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddPhone = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
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
  };

  const handleRemovePhone = (phoneToRemove: string) => {
    const updated = excludedPhones.filter((p) => p !== phoneToRemove);
    onSaveExcludedPhones(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <UserX className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Настройки маркетинга и исключения</h3>
              <p className="text-xs text-slate-400">Исключение сотрудников и тестовых номеров</p>
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
          <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-800">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Для чего нужен черный список?</p>
              <p className="mt-0.5 text-amber-700/90 leading-relaxed">
                Номера администраторов, управляющих и владельца клуба будут автоматически скрыты из списков клиентов, 
                задач на звонки, SMS-рассылок и выгрузок для таргета VK.
              </p>
            </div>
          </div>

          {/* Add Form */}
          <form onSubmit={handleAddPhone} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Добавить номер в исключения
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="+7 (999) 000-00-00"
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  if (error) setError(null);
                }}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Исключить</span>
              </button>
            </div>
            {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
          </form>

          {/* List of Excluded Phones */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold">Исключенные номера ({excludedPhones.length})</span>
              {excludedPhones.length > 0 && (
                <button
                  type="button"
                  onClick={() => onSaveExcludedPhones([])}
                  className="text-rose-600 hover:text-rose-700 text-[11px] font-medium"
                >
                  Очистить все
                </button>
              )}
            </div>

            {excludedPhones.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400">
                Нет исключенных номеров. Добавьте телефоны администраторов и управляющего.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {excludedPhones.map((phone) => (
                  <div
                    key={phone}
                    className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-mono font-medium text-slate-800">
                      +7 {phone.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, "($1) $2-$3-$4")}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePhone(phone)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Удалить из исключений"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl transition-colors shadow-sm"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
