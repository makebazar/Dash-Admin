"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Save, Zap, Gift, Lock, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function BattlePassTab({
  clubId,
  products = []
}: {
  clubId: string;
  products?: any[];
}) {
  const [season, setSeason] = useState<any>({
    name: "Новый сезон",
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_active: true
  });
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBP();
  }, [clubId]);

  const fetchBP = async () => {
    try {
      const res = await fetch(`/api/promo/admin/bp?clubId=${clubId}`);
      const data = await res.json();
      if (data.season) {
        setSeason({
          ...data.season,
          start_date: new Date(data.season.start_date).toISOString().split('T')[0],
          end_date: new Date(data.season.end_date).toISOString().split('T')[0],
        });
      }
      setTiers(data.tiers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/promo/admin/bp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, season, tiers }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Боевой Пропуск успешно сохранен");
        fetchBP();
      } else {
        alert("Ошибка: " + data.error);
      }
    } catch (e) {
      alert("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const addTier = (isPremium: boolean) => {
    const nextLevel = tiers.length > 0
      ? Math.max(...tiers.map(t => t.level_number)) + 1
      : 1;
    const lastXp = tiers.length > 0
      ? Math.max(...tiers.map(t => t.xp_required))
      : 0;

    setTiers([...tiers, {
      level_number: nextLevel,
      xp_required: lastXp + 500,
      reward_type: "bonus_balance",
      reward_value: 100,
      reward_name: "100 Бонусов",
      is_premium: isPremium
    }]);
  };

  const updateTier = (idx: number, field: string, value: any) => {
    const newTiers = [...tiers];
    newTiers[idx] = { ...newTiers[idx], [field]: value };

    // Auto-update reward name if it's a simple one
    if (field === "reward_type" || field === "reward_value") {
      const type = newTiers[idx].reward_type;
      const val = newTiers[idx].reward_value;
      if (type === "bonus_balance") newTiers[idx].reward_name = `${val} Бонусов`;
      if (type === "ticket") newTiers[idx].reward_name = `${val} Билетов`;
      if (type === "xp_boost") newTiers[idx].reward_name = `Бустер x2 (${val}ч)`;
    }

    setTiers(newTiers);
  };

  const removeTier = (idx: number) => {
    setTiers(tiers.filter((_, i) => i !== idx));
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  return (
    <div className="space-y-8 max-w-5xl pb-20">
      {/* Season Settings */}
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
        <div>
          <h3 className="font-black text-xl uppercase italic tracking-tight">Настройки <span className="text-orange-500">Сезона</span></h3>
          <p className="text-slate-500 text-sm font-medium">Укажите название и даты действия текущего Боевого Пропуска.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Название сезона</label>
            <input
              type="text"
              value={season.name}
              onChange={e => setSeason({...season, name: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2 font-bold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Начало</label>
            <input
              type="date"
              value={season.start_date}
              onChange={e => setSeason({...season, start_date: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2 font-bold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Окончание</label>
            <input
              type="date"
              value={season.end_date}
              onChange={e => setSeason({...season, end_date: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2 font-bold"
            />
          </div>
        </div>
      </div>

      {/* Tiers Management */}
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-xl uppercase italic tracking-tight text-orange-600">Награды и Уровни</h3>
            <p className="text-slate-500 text-sm font-medium">Добавьте уровни прогресса и укажите призы для бесплатной и платной веток.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addTier(false)} className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200">
              + Free Уровень
            </button>
            <button onClick={() => addTier(true)} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600">
              + Premium Уровень
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {tiers.sort((a,b) => a.level_number - b.level_number || (a.is_premium ? 1 : -1)).map((tier, idx) => (
            <div key={idx} className={cn(
              "p-6 rounded-[2rem] border transition-all flex flex-col lg:flex-row gap-6 items-center",
              tier.is_premium ? "bg-amber-50/50 border-amber-200" : "bg-slate-50 border-slate-100"
            )}>
              {/* Level & XP */}
              <div className="flex items-center gap-4 shrink-0 lg:w-48">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black",
                  tier.is_premium ? "bg-amber-500 text-white" : "bg-slate-900 text-white"
                )}>
                  <span className="text-[8px] uppercase tracking-tighter opacity-50">Lvl</span>
                  {tier.level_number}
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">XP Порог</label>
                  <input
                    type="number"
                    value={tier.xp_required}
                    onChange={e => updateTier(idx, "xp_required", parseInt(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-xs"
                  />
                </div>
              </div>

              {/* Reward Type */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Тип награды</label>
                  <select
                    value={tier.reward_type}
                    onChange={e => updateTier(idx, "reward_type", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-xs"
                  >
                    <option value="bonus_balance">Бонусные рубли</option>
                    <option value="ticket">Билеты в игры</option>
                    <option value="xp_boost">Бустер XP (x2)</option>
                    <option value="bar_item">Товар из бара</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Значение / Товар</label>
                  {tier.reward_type === "bar_item" ? (
                    <select
                      value={tier.reward_value}
                      onChange={e => {
                        const product = products.find(p => p.id == e.target.value);
                        updateTier(idx, "reward_value", e.target.value);
                        updateTier(idx, "reward_name", product?.name || "Товар");
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-xs"
                    >
                      <option value="">Выберите товар...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={tier.reward_value}
                      onChange={e => updateTier(idx, "reward_value", parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-xs"
                      placeholder={tier.reward_type === "xp_boost" ? "Часов (напр 24)" : "Сумма"}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Отображаемое имя</label>
                  <input
                    type="text"
                    value={tier.reward_name}
                    onChange={e => updateTier(idx, "reward_name", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-xs"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 shrink-0">
                <div className={cn(
                  "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                  tier.is_premium ? "bg-amber-100 border-amber-200 text-amber-600" : "bg-slate-100 border-slate-200 text-slate-500"
                )}>
                  {tier.is_premium ? "Premium" : "Free"}
                </div>
                <button onClick={() => removeTier(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-2">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {tiers.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
              <Gift className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold italic tracking-tight">Уровни еще не созданы.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-10 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
          >
            {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
            СОХРАНИТЬ BATTLE PASS
          </button>
        </div>
      </div>
    </div>
  );
}
