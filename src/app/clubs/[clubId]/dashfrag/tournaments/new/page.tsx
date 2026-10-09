"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";

interface Prize {
  place: number;
  reward: number;
  text_prize: string;
  description: string;
}

export default function CreateTournamentPage() {
  const { clubId } = useParams();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [game, setGame] = useState<"CS2" | "Dota2" | "ALL">("CS2");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minMatches, setMinMatches] = useState(5);
  const [prizes, setPrizes] = useState<Prize[]>([
    { place: 1, reward: 5000, text_prize: "", description: "" },
    { place: 2, reward: 3000, text_prize: "", description: "" },
    { place: 3, reward: 1000, text_prize: "", description: "" },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddPrize = () => {
    const nextPlace = prizes.length + 1;
    setPrizes([...prizes, { place: nextPlace, reward: 1000, text_prize: "", description: "" }]);
  };

  const handleRemovePrize = (index: number) => {
    const updated = prizes
      .filter((_, i) => i !== index)
      .map((item, idx) => ({ ...item, place: idx + 1 }));
    setPrizes(updated);
  };

  const handlePrizeChange = (index: number, field: keyof Prize, value: any) => {
    const updated = [...prizes];
    updated[index] = { ...updated[index], [field]: value };
    setPrizes(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) {
      setErrorMessage("Заполните все обязательные поля");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/promo/admin/frag/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId,
          title: title.trim(),
          game,
          start_date: startDate,
          end_date: endDate,
          min_matches: minMatches,
          prizes,
          description: description.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Не удалось создать турнирный сезон");
      }

      router.push(`/clubs/${clubId}/dashfrag?tab=tournaments`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Произошла ошибка при сохранении");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <div>
          <Link
            href={`/clubs/${clubId}/dashfrag?tab=tournaments`}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-900 transition-colors no-underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад к DashFrag
          </Link>
        </div>

        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold uppercase text-slate-900">
            Создание турнирного сезона
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Настройте параметры соревнований, периоды проведения и призовой фонд для игроков клуба
          </p>
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-4 rounded-2xl">
              ✕ {errorMessage}
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-3xl shadow-xs space-y-6">
            <h3 className="text-sm font-bold uppercase text-slate-900 tracking-wider">
              1. Основная информация
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-500 block ml-1">
                  Название сезона <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Осенний Кубок CS2 — Октябрь 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500 block ml-1">
                    Дисциплина <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={game}
                    onChange={(e) => setGame(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="CS2">Counter-Strike 2</option>
                    <option value="Dota2">Dota 2</option>
                    <option value="ALL">Все дисциплины (CS2 + Dota 2)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500 block ml-1">
                    Мин. каток для участия <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={minMatches}
                    onChange={(e) => setMinMatches(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-500 block ml-1">
                  Описание и правила (необязательно)
                </label>
                <textarea
                  rows={3}
                  placeholder="Укажите правила турнира, особые условия или спонсорскую информацию..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-xs text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Dates */}
          <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-3xl shadow-xs space-y-6">
            <h3 className="text-sm font-bold uppercase text-slate-900 tracking-wider">
              2. Период проведения
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-500 block ml-1">
                  Дата и время начала <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-500 block ml-1">
                  Дата и время окончания <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Prizes */}
          <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-3xl shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase text-slate-900 tracking-wider">
                3. Призовые места
              </h3>
              <button
                type="button"
                onClick={handleAddPrize}
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Добавить место
              </button>
            </div>

            <div className="space-y-4">
              {prizes.map((p, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      #{p.place} место
                    </span>
                    {prizes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePrize(idx)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Удалить место"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="relative">
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                        Денежный приз (₽)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Сумма в ₽"
                        value={p.reward || ""}
                        onChange={(e) =>
                          handlePrizeChange(idx, "reward", parseFloat(e.target.value) || 0)
                        }
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-xs text-slate-900 outline-none focus:border-slate-400 transition-all pr-8"
                      />
                      <span className="absolute right-3 bottom-2 text-xs font-bold text-slate-400">
                        ₽
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                        Физический приз (необязательно)
                      </label>
                      <input
                        type="text"
                        placeholder="например: Игровая мышь Logitech"
                        value={p.text_prize}
                        onChange={(e) =>
                          handlePrizeChange(idx, "text_prize", e.target.value)
                        }
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-xs text-slate-900 outline-none focus:border-slate-400 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Описание или комментарий к призу (необязательно)"
                      value={p.description}
                      onChange={(e) =>
                        handlePrizeChange(idx, "description", e.target.value)
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-xs text-slate-900 outline-none focus:border-slate-400 transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-4 pt-4">
            <Link
              href={`/clubs/${clubId}/dashfrag?tab=tournaments`}
              className="px-6 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 transition-all no-underline"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Запуск...
                </span>
              ) : (
                "Запустить Сезон"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
