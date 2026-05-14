"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Save, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export function LevelsTab({ clubId }: { clubId: string }) {
  const [levels, setLevels] = useState<
    { level_number: number; xp_required: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLevels();
  }, [clubId]);

  const fetchLevels = async () => {
    try {
      const res = await fetch(`/api/promo/admin/levels?clubId=${clubId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch");
      }
      const data = await res.json();
      setLevels(data.levels || []);
    } catch (e: any) {
      console.error(e);
      alert("Не удалось загрузить уровни: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/promo/admin/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, levels }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Уровни успешно сохранены");
      } else {
        alert("Ошибка сохранения: " + data.error);
      }
    } catch (e) {
      alert("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const addLevel = () => {
    const nextLevelNum =
      levels.length > 0
        ? Math.max(...levels.map((l) => l.level_number)) + 1
        : 1;
    const lastXp =
      levels.length > 0 ? Math.max(...levels.map((l) => l.xp_required)) : 0;
    setLevels([
      ...levels,
      { level_number: nextLevelNum, xp_required: lastXp + 1000 },
    ]);
  };

  const removeLevel = (index: number) => {
    const newLevels = [...levels];
    newLevels.splice(index, 1);
    setLevels(newLevels);
  };

  const updateLevel = (index: number, field: string, value: number) => {
    const newLevels = [...levels];
    newLevels[index] = { ...newLevels[index], [field]: value };
    setLevels(newLevels);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
        <div>
          <h3 className="font-black text-xl uppercase italic tracking-tight flex items-center gap-3">
            <Trophy className="w-6 h-6 text-orange-500" />
            Настройка <span className="text-orange-500">Уровней</span>
          </h3>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Задайте необходимое количество опыта (XP) для достижения каждого
            уровня. Игроки получают 10 XP за каждые потраченные 100₽ в баре, а
            также фиксированные награды за квесты.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <div className="col-span-3">Уровень</div>
            <div className="col-span-7">Требуемый XP (Порог)</div>
            <div className="col-span-2 text-right">Действия</div>
          </div>

          {levels
            .sort((a, b) => a.level_number - b.level_number)
            .map((level, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-4 items-center bg-slate-50 border border-slate-100 p-3 rounded-2xl"
              >
                <div className="col-span-3">
                  <input
                    type="number"
                    value={level.level_number}
                    onChange={(e) =>
                      updateLevel(
                        i,
                        "level_number",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                  />
                </div>
                <div className="col-span-7 relative">
                  <input
                    type="number"
                    value={level.xp_required}
                    onChange={(e) =>
                      updateLevel(
                        i,
                        "xp_required",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                    XP
                  </div>
                </div>
                <div className="col-span-2 flex justify-end">
                  <button
                    onClick={() => removeLevel(i)}
                    className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

          {levels.length === 0 && (
            <div className="text-center py-10 text-slate-400 font-medium italic">
              Уровни не настроены. Добавьте первый уровень.
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-slate-100 pt-6">
          <button
            onClick={addLevel}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            ДОБАВИТЬ УРОВЕНЬ
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all text-sm shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            СОХРАНИТЬ УРОВНИ
          </button>
        </div>
      </div>
    </div>
  );
}
