"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  Gift,
  Coins,
  Disc,
  Lock,
  Dice5,
  Bomb,
  Rocket as RocketIcon,
  CreditCard as CardIcon,
  Bird,
  Trophy,
} from "lucide-react";

export type Prize = {
  id?: number;
  name: string;
  type: "physical" | "virtual" | "bonus" | "attempt";
  value: number;
  probability: number;
  daily_limit: number;
  is_active: boolean;
  image_url?: string;
  game_slug?: string;
  min_level?: number;
  max_level?: number;
  target_level?: number;
  win_condition?: {
    dice_sums?: number[];
    dice_double?: number | "any";
  };
};

export const GAMES = [
  { id: "wheel", label: "Колесо фортуны", icon: Disc },
  { id: "safe", label: "Сейф", icon: Lock },
  { id: "dice", label: "Кости", icon: Dice5 },
  { id: "mines", label: "Мины", icon: Bomb },
  { id: "rocket", label: "Ракета", icon: RocketIcon },
  { id: "cards", label: "Карты", icon: CardIcon },
  { id: "flappy", label: "Flappy", icon: Bird },
];

const CONFIG_BASED_GAMES = ["mines", "rocket", "flappy"];

interface GamesTabProps {
  clubId: string;
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
  prizes: Prize[];
  setPrizes: (prizes: Prize[]) => void;
}

export function GamesTab({
  clubId,
  settings,
  saveSettings,
  prizes,
  setPrizes,
}: GamesTabProps) {
  const [selectedGame, setSelectedGame] = useState<string>("wheel");
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [levels, setLevels] = useState<{ level_number: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for game configs to avoid constant parent re-renders while typing
  const [localConfigs, setLocalConfigs] = useState<any>(
    settings?.game_configs || {},
  );

  useEffect(() => {
    setLocalConfigs(settings?.game_configs || {});
  }, [settings?.game_configs]);

  useEffect(() => {
    fetch(`/api/promo/admin/levels?clubId=${clubId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.levels && data.levels.length > 0) {
          const sorted = data.levels.sort(
            (a: any, b: any) => a.level_number - b.level_number,
          );
          setLevels(sorted);
          setSelectedLevel(sorted[0].level_number);
        } else {
          setLevels([{ level_number: 1 }]);
        }
      })
      .catch(console.error);
  }, [clubId]);

  const activeGameObj = GAMES.find((g) => g.id === selectedGame);
  const isGameEnabled = settings?.enabled_games?.includes(selectedGame);
  const isConfigBased = CONFIG_BASED_GAMES.includes(selectedGame);

  const updateConfig = (gameSlug: string, updates: any) => {
    setLocalConfigs((prev: any) => ({
      ...prev,
      [gameSlug]: {
        ...(prev[gameSlug] || {}),
        ...updates,
      },
    }));
  };

  const handleSaveConfigs = async () => {
    setIsSaving(true);
    try {
      await saveSettings({
        ...settings,
        game_configs: localConfigs,
      });
      alert("Настройки игр сохранены");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter by both game AND target_level
  const filteredPrizes = prizes.filter(
    (p) =>
      p.game_slug === selectedGame &&
      (p.target_level === selectedLevel ||
        (!p.target_level && selectedLevel === 1)),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Game Selection Sidebar */}
      <div className="lg:col-span-1 space-y-4">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 px-2">
          Доступные игры
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game.id)}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 group",
                selectedGame === game.id
                  ? "bg-indigo-50 border-indigo-200 shadow-sm"
                  : "bg-white border-slate-200 hover:border-indigo-100 hover:bg-slate-50",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    selectedGame === game.id
                      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-indigo-400",
                  )}
                >
                  <game.icon className="w-5 h-5" />
                </div>
                <span
                  className={cn(
                    "font-black italic uppercase text-xs tracking-tight transition-colors",
                    selectedGame === game.id
                      ? "text-indigo-900"
                      : "text-slate-600",
                  )}
                >
                  {game.label}
                </span>
              </div>
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  settings?.enabled_games?.includes(game.id)
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : "bg-slate-200",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Game Specific Configuration */}
      <div className="lg:col-span-3 space-y-6">
        {/* Game Header & Toggle */}
        <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              {React.createElement(activeGameObj?.icon || Disc, {
                className: "w-7 h-7 text-white",
              })}
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
                {activeGameObj?.label}
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {isConfigBased
                  ? "Настройка параметров и математики игры"
                  : "Настройка призового фонда игры"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-black italic uppercase text-xs tracking-tight">
                Статус игры
              </div>
              <div
                className={cn(
                  "text-[10px] font-bold mt-0.5",
                  isGameEnabled ? "text-emerald-500" : "text-slate-400",
                )}
              >
                {isGameEnabled ? "Включена" : "Отключена"}
              </div>
            </div>
            <button
              onClick={() => {
                const newSettings = { ...settings };
                if (!newSettings.enabled_games) newSettings.enabled_games = [];

                if (newSettings.enabled_games.includes(selectedGame)) {
                  newSettings.enabled_games = newSettings.enabled_games.filter(
                    (id: string) => id !== selectedGame,
                  );
                } else {
                  newSettings.enabled_games.push(selectedGame);
                }
                saveSettings(newSettings);
              }}
              className={cn(
                "w-14 h-8 rounded-full relative transition-colors duration-300",
                isGameEnabled ? "bg-emerald-500" : "bg-slate-300",
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-sm",
                  isGameEnabled ? "left-7" : "left-1",
                )}
              />
            </button>
          </div>
        </div>

        {isConfigBased ? (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                    Базовый множитель (Global Boost)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={localConfigs[selectedGame]?.base_bonus || 1}
                    onChange={(e) =>
                      updateConfig(selectedGame, {
                        base_bonus: parseFloat(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white transition-all outline-none"
                  />
                  <p className="text-[9px] text-slate-400 italic ml-4">
                    * Умножает финальный выигрыш. 1.0 — без изменений.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                    Максимальный итоговый множитель
                  </label>
                  <input
                    type="number"
                    value={localConfigs[selectedGame]?.max_multiplier || 100}
                    onChange={(e) =>
                      updateConfig(selectedGame, {
                        max_multiplier: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              {selectedGame === "rocket" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                      House Edge (Шанс выигрыша системы)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={localConfigs.rocket?.house_edge || 0.95}
                      onChange={(e) =>
                        updateConfig("rocket", {
                          house_edge: parseFloat(e.target.value),
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white transition-all outline-none"
                    />
                    <p className="text-[9px] text-slate-400 italic ml-4">
                      * 0.95 = 5% шанс моментального взрыва на 1.00x.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                      Скорость роста (Growth Rate)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={localConfigs.rocket?.growth_rate || 0.08}
                      onChange={(e) =>
                        updateConfig("rocket", {
                          growth_rate: parseFloat(e.target.value),
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white transition-all outline-none"
                    />
                  </div>
                </div>
              )}

              {selectedGame === "flappy" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                      Прирост за трубу (Step)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={localConfigs.flappy?.multiplier_step || 0.1}
                      onChange={(e) =>
                        updateConfig("flappy", {
                          multiplier_step: parseFloat(e.target.value),
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                      Сложность
                    </label>
                    <select
                      value={localConfigs.flappy?.difficulty || "medium"}
                      onChange={(e) =>
                        updateConfig("flappy", { difficulty: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white transition-all outline-none"
                    >
                      <option value="easy">
                        Легко (Медленно, большие окна)
                      </option>
                      <option value="medium">Средне</option>
                      <option value="hard">Сложно (Быстро, узкие окна)</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedGame === "mines" && (
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                      Минимум ячеек для вывода (Cashout)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={localConfigs.mines?.min_cashout_reveals || 2}
                      onChange={(e) =>
                        updateConfig("mines", {
                          min_cashout_reveals: parseInt(e.target.value),
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Режимы игры (Кол-во мин)
                      </label>
                      <button
                        onClick={() => {
                          const currentModes = localConfigs.mines?.modes || [];
                          updateConfig("mines", {
                            modes: [
                              ...currentModes,
                              { mines: 3, multiplier_step: 0.2 },
                            ],
                          });
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600"
                      >
                        + Добавить режим
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(localConfigs.mines?.modes || []).map(
                        (mode: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4"
                          >
                            <div className="flex-1 space-y-1">
                              <span className="text-[8px] font-black uppercase text-slate-400 ml-1">
                                Мин
                              </span>
                              <input
                                type="number"
                                value={mode.mines}
                                onChange={(e) => {
                                  const newModes = [
                                    ...localConfigs.mines.modes,
                                  ];
                                  newModes[idx].mines = parseInt(
                                    e.target.value,
                                  );
                                  updateConfig("mines", { modes: newModes });
                                }}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-xs"
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <span className="text-[8px] font-black uppercase text-slate-400 ml-1">
                                Шаг x
                              </span>
                              <input
                                type="number"
                                step="0.1"
                                value={mode.multiplier_step}
                                onChange={(e) => {
                                  const newModes = [
                                    ...localConfigs.mines.modes,
                                  ];
                                  newModes[idx].multiplier_step = parseFloat(
                                    e.target.value,
                                  );
                                  updateConfig("mines", { modes: newModes });
                                }}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-xs"
                              />
                            </div>
                            <button
                              onClick={() => {
                                const newModes =
                                  localConfigs.mines.modes.filter(
                                    (_: any, i: number) => i !== idx,
                                  );
                                updateConfig("mines", { modes: newModes });
                              }}
                              className="text-slate-300 hover:text-red-500 transition-colors pt-4"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleSaveConfigs}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase italic tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Сохранить математику
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Level Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {levels.map((level) => (
                <button
                  key={level.level_number}
                  onClick={() => setSelectedLevel(level.level_number)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase italic text-xs tracking-wider whitespace-nowrap transition-all",
                    selectedLevel === level.level_number
                      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                      : "bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <Trophy className="w-4 h-4" />
                  Уровень {level.level_number}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                  Призы ({filteredPrizes.length})
                </h3>
                <div
                  className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                    filteredPrizes.reduce(
                      (sum, p) => sum + (Number(p.probability) || 0),
                      0,
                    ) === 100
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-amber-100 text-amber-600",
                  )}
                >
                  Сумма шансов:{" "}
                  {filteredPrizes
                    .reduce((sum, p) => sum + (Number(p.probability) || 0), 0)
                    .toFixed(1)}
                  %
                </div>
              </div>

              <button
                onClick={() => {
                  const newPrize: Prize = {
                    name: "Новый приз",
                    type: "virtual",
                    value: 100,
                    probability: 1,
                    daily_limit: 0,
                    is_active: true,
                    game_slug: selectedGame,
                    target_level: selectedLevel,
                  };
                  setPrizes([...prizes, newPrize]);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase italic tracking-widest hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
              >
                <Plus className="w-3 h-3" />
                Добавить приз
              </button>
            </div>

            {filteredPrizes.length === 0 ? (
              <div className="bg-white border border-slate-200 border-dashed rounded-[2rem] py-16 flex flex-col items-center justify-center space-y-4 opacity-50">
                <Gift className="w-12 h-12 text-slate-300" />
                <p className="text-xs font-black uppercase italic tracking-widest text-slate-400">
                  В этой игре еще нет призов
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prizes.map((prize, idx) => {
                  const isRelevant =
                    prize.game_slug === selectedGame &&
                    (prize.target_level === selectedLevel ||
                      (!prize.target_level && selectedLevel === 1));

                  if (!isRelevant) return null;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm relative transition-all",
                        !prize.is_active && "opacity-50 grayscale",
                      )}
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center">
                            {prize.type === "physical" ? (
                              <Gift className="w-6 h-6 text-purple-500" />
                            ) : (
                              <Coins className="w-6 h-6 text-emerald-500" />
                            )}
                          </div>
                          <input
                            className="text-lg font-black uppercase italic tracking-tight outline-none focus:text-indigo-500 transition-colors bg-transparent w-full"
                            value={prize.name}
                            onChange={(e) => {
                              const newPrizes = [...prizes];
                              newPrizes[idx].name = e.target.value;
                              setPrizes(newPrizes);
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              const newPrizes = [...prizes];
                              newPrizes[idx].is_active = !prize.is_active;
                              setPrizes(newPrizes);
                            }}
                            className={cn(
                              "p-2 rounded-lg transition-colors",
                              prize.is_active
                                ? "bg-emerald-50 text-emerald-500"
                                : "bg-slate-100 text-slate-400",
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (prize.id) {
                                await fetch(
                                  `/api/promo/admin/prizes?clubId=${clubId}&id=${prize.id}`,
                                  { method: "DELETE" },
                                );
                              }
                              const newPrizes = prizes.filter(
                                (_, i) => i !== idx,
                              );
                              setPrizes(newPrizes);
                            }}
                            className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">
                            Тип приза
                          </label>
                          <select
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                            value={prize.type}
                            onChange={(e) => {
                              const newPrizes = [...prizes];
                              newPrizes[idx].type = e.target.value as any;
                              setPrizes(newPrizes);
                            }}
                          >
                            <option value="virtual">Баланс (₽)</option>
                            <option value="physical">Товар (Queue)</option>
                            <option value="attempt">Билеты (+шт)</option>
                            <option value="bonus">Опыт (+XP)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">
                            Значение
                          </label>
                          <input
                            type="number"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                            value={prize.value}
                            onChange={(e) => {
                              const newPrizes = [...prizes];
                              newPrizes[idx].value = parseFloat(e.target.value);
                              setPrizes(newPrizes);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">
                            Шанс (%)
                          </label>
                          <input
                            type="number"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                            value={prize.probability}
                            onChange={(e) => {
                              const newPrizes = [...prizes];
                              newPrizes[idx].probability = parseFloat(
                                e.target.value,
                              );
                              setPrizes(newPrizes);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">
                            Лимит (день)
                          </label>
                          <input
                            type="number"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                            value={prize.daily_limit || 0}
                            onChange={(e) => {
                              const newPrizes = [...prizes];
                              newPrizes[idx].daily_limit = parseInt(
                                e.target.value,
                              );
                              setPrizes(newPrizes);
                            }}
                            placeholder="0 - без лимита"
                          />
                        </div>
                      </div>

                      {prize.game_slug === "dice" && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-2xl space-y-3">
                          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                            Условие костей
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => (
                              <button
                                key={s}
                                onClick={() => {
                                  const newPrizes = [...prizes];
                                  const cond =
                                    newPrizes[idx].win_condition || {};
                                  if (!cond.dice_sums) cond.dice_sums = [];
                                  if (cond.dice_sums.includes(s)) {
                                    cond.dice_sums = cond.dice_sums.filter(
                                      (v) => v !== s,
                                    );
                                  } else {
                                    cond.dice_sums.push(s);
                                  }
                                  newPrizes[idx].win_condition = cond;
                                  setPrizes(newPrizes);
                                }}
                                className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all",
                                  prize.win_condition?.dice_sums?.includes(s)
                                    ? "bg-indigo-500 text-white"
                                    : "bg-white text-slate-400 border border-slate-200",
                                )}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    await fetch(`/api/promo/admin/prizes`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ clubId, prizes }),
                    });
                    alert("Призовой фонд сохранен");
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase italic tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Сохранить изменения
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
