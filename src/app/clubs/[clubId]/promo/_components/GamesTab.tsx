"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type Prize = {
  id?: number;
  name: string;
  type: "virtual" | "attempt" | "withdraw_boost" | "bonus_limitless" | "physical" | "none";
  value: number;
  probability: number;
  daily_limit: number;
  is_active: boolean;
  image_url?: string;
  game_slug?: string;
  win_condition?: {
    dice_sums?: number[];
    dice_double?: number | "any";
  };
};

export interface GameDefinition {
  id: string;
  label: string;
  description: string;
  badge: string;
  defaultTickets: number;
  rulesHint: string;
}

export const GAMES: GameDefinition[] = [
  {
    id: "wheel",
    label: "Колесо фортуны",
    description: "Классическое колесо удачи с секторами призов разной ценности и шансами выпадения.",
    badge: "Колесо",
    defaultTickets: 1,
    rulesHint: "Игрок крутит колесо. Выпадает приз в соответствии с настроенными вероятностями.",
  },
  {
    id: "safe",
    label: "Взлом сейфа",
    description: "Игрок подбирает секретный цифровой код от хранилища для получения клубного приза.",
    badge: "Сейф",
    defaultTickets: 1,
    rulesHint: "Сервер случайно генерирует выигрышный код среди доступных вариантов. При угадывании кода игрок выигрывает приз.",
  },
  {
    id: "dice",
    label: "Бросок костей",
    description: "Бросок двух игральных костей с призами за выпадение определенных числовых комбинаций.",
    badge: "Кости",
    defaultTickets: 1,
    rulesHint: "Игрок бросает 2 кубика (сумма от 2 до 12). Приз выпадает при совпадении с выбранными суммами в условии выпадения.",
  },
  {
    id: "cards",
    label: "Карты удачи",
    description: "Карточная мини-игра с выбором закрытых карт и мгновенным раскрытием наград.",
    badge: "Карты",
    defaultTickets: 1,
    rulesHint: "Игрок открывает случайную карту из колоды и получает соответствующую награду.",
  },
  {
    id: "defuse",
    label: "Сапёр C4 (Defuse)",
    description: "Обезвреживание бомбы C4 в стиле CS2: за 5 секунд нужно перерезать 2 верных провода из 5 (первый верный провод даёт +3 сек).",
    badge: "Defuse",
    defaultTickets: 1,
    rulesHint: "Игрок перерезает 2 провода из 5. За 1-й верный провод начисляется +3.00 сек. При успешном разминировании выпадает приз из пула по настроенным вероятностям.",
  },
];

export type PoolPresetKey = "economy" | "balanced" | "generous";

export const PRESET_META: {
  key: PoolPresetKey;
  title: string;
  subtitle: string;
}[] = [
  {
    key: "economy",
    title: "Экономный",
    subtitle: "Низкий расход бонусов, больше билетов и бустов пополнения.",
  },
  {
    key: "balanced",
    title: "Стандартный",
    subtitle: "Оптимальный баланс: частые небольшие выигрыши и редкий крупный приз.",
  },
  {
    key: "generous",
    title: "Щедрый",
    subtitle: "Повышенные награды и высокий шанс победы для ивентов и выходных.",
  },
];

export const POOL_PRESETS: Record<string, Record<PoolPresetKey, Omit<Prize, "id" | "game_slug">[]>> = {
  wheel: {
    economy: [
      { name: "Повезёт в другой раз", type: "none", value: 0, probability: 30, daily_limit: 0, is_active: true },
      { name: "10 Бонусов", type: "virtual", value: 10, probability: 25, daily_limit: 0, is_active: true },
      { name: "1 Билет (Ре-спин)", type: "attempt", value: 1, probability: 18, daily_limit: 0, is_active: true },
      { name: "Буст +10% к пополнению", type: "withdraw_boost", value: 10, probability: 12, daily_limit: 0, is_active: true },
      { name: "20 Бонусов", type: "virtual", value: 20, probability: 9, daily_limit: 0, is_active: true },
      { name: "35 Бонусов", type: "virtual", value: 35, probability: 4, daily_limit: 10, is_active: true },
      { name: "50 Бонусов", type: "virtual", value: 50, probability: 1.5, daily_limit: 5, is_active: true },
      { name: "100 ₽ Безлимит (Джекпот)", type: "bonus_limitless", value: 100, probability: 0.5, daily_limit: 1, is_active: true },
    ],
    balanced: [
      { name: "Мимо сектора", type: "none", value: 0, probability: 22, daily_limit: 0, is_active: true },
      { name: "15 Бонусов", type: "virtual", value: 15, probability: 26, daily_limit: 0, is_active: true },
      { name: "1 Билет (Ещё крутка)", type: "attempt", value: 1, probability: 18, daily_limit: 0, is_active: true },
      { name: "Буст +15% к пополнению", type: "withdraw_boost", value: 15, probability: 12, daily_limit: 0, is_active: true },
      { name: "30 Бонусов", type: "virtual", value: 30, probability: 12, daily_limit: 0, is_active: true },
      { name: "50 Бонусов", type: "virtual", value: 50, probability: 6, daily_limit: 10, is_active: true },
      { name: "100 Бонусов", type: "virtual", value: 100, probability: 3, daily_limit: 3, is_active: true },
      { name: "200 ₽ Безлимит (Джекпот)", type: "bonus_limitless", value: 200, probability: 1, daily_limit: 1, is_active: true },
    ],
    generous: [
      { name: "Почти выпало", type: "none", value: 0, probability: 15, daily_limit: 0, is_active: true },
      { name: "20 Бонусов", type: "virtual", value: 20, probability: 25, daily_limit: 0, is_active: true },
      { name: "1 Билет (Фриспин)", type: "attempt", value: 1, probability: 18, daily_limit: 0, is_active: true },
      { name: "Буст +20% к пополнению", type: "withdraw_boost", value: 20, probability: 12, daily_limit: 0, is_active: true },
      { name: "40 Бонусов", type: "virtual", value: 40, probability: 15, daily_limit: 0, is_active: true },
      { name: "75 Бонусов", type: "virtual", value: 75, probability: 9, daily_limit: 10, is_active: true },
      { name: "150 Бонусов", type: "virtual", value: 150, probability: 4.5, daily_limit: 4, is_active: true },
      { name: "300 ₽ Безлимит (Мега-куш)", type: "bonus_limitless", value: 300, probability: 1.5, daily_limit: 2, is_active: true },
    ],
  },
  safe: {
    economy: [
      { name: "Неверный код (Блокировка)", type: "none", value: 0, probability: 68, daily_limit: 0, is_active: true },
      { name: "Отмычка (+1 Билет)", type: "attempt", value: 1, probability: 12, daily_limit: 0, is_active: true },
      { name: "25 Бонусов", type: "virtual", value: 25, probability: 10, daily_limit: 0, is_active: true },
      { name: "Буст +15% к пополнению", type: "withdraw_boost", value: 15, probability: 5, daily_limit: 0, is_active: true },
      { name: "50 Бонусов", type: "virtual", value: 50, probability: 3.5, daily_limit: 8, is_active: true },
      { name: "150 Бонусов", type: "virtual", value: 150, probability: 1, daily_limit: 2, is_active: true },
      { name: "250 ₽ Золотой слиток", type: "bonus_limitless", value: 250, probability: 0.5, daily_limit: 1, is_active: true },
    ],
    balanced: [
      { name: "Неверный код (Блокировка)", type: "none", value: 0, probability: 62, daily_limit: 0, is_active: true },
      { name: "Отмычка (+1 Билет)", type: "attempt", value: 1, probability: 12, daily_limit: 0, is_active: true },
      { name: "35 Бонусов", type: "virtual", value: 35, probability: 12, daily_limit: 0, is_active: true },
      { name: "Буст +15% к пополнению", type: "withdraw_boost", value: 15, probability: 6, daily_limit: 0, is_active: true },
      { name: "75 Бонусов", type: "virtual", value: 75, probability: 5, daily_limit: 6, is_active: true },
      { name: "150 Бонусов", type: "virtual", value: 150, probability: 2, daily_limit: 2, is_active: true },
      { name: "300 ₽ Алмазный фонд", type: "bonus_limitless", value: 300, probability: 1, daily_limit: 1, is_active: true },
    ],
    generous: [
      { name: "Неверный код (Блокировка)", type: "none", value: 0, probability: 55, daily_limit: 0, is_active: true },
      { name: "Двойная отмычка (+2 Билета)", type: "attempt", value: 2, probability: 12, daily_limit: 0, is_active: true },
      { name: "50 Бонусов", type: "virtual", value: 50, probability: 14, daily_limit: 0, is_active: true },
      { name: "Буст +25% к пополнению", type: "withdraw_boost", value: 25, probability: 7, daily_limit: 0, is_active: true },
      { name: "100 Бонусов", type: "virtual", value: 100, probability: 7.5, daily_limit: 8, is_active: true },
      { name: "200 Бонусов", type: "virtual", value: 200, probability: 3, daily_limit: 3, is_active: true },
      { name: "400 ₽ Полное хранилище", type: "bonus_limitless", value: 400, probability: 1.5, daily_limit: 1, is_active: true },
    ],
  },
  dice: {
    economy: [
      { name: "Джекпот (Змеиные глаза 2 или 12)", type: "bonus_limitless", value: 120, probability: 5.56, daily_limit: 1, is_active: true, win_condition: { dice_sums: [2, 12] } },
      { name: "Редкий бросок (Сумма 3 или 11)", type: "virtual", value: 35, probability: 11.11, daily_limit: 8, is_active: true, win_condition: { dice_sums: [3, 11] } },
      { name: "Любой дубль (+1 Билет)", type: "attempt", value: 1, probability: 16.67, daily_limit: 0, is_active: true, win_condition: { dice_sums: [], dice_double: "any" } },
      { name: "Счастливая десятка (Сумма 10)", type: "virtual", value: 15, probability: 8.33, daily_limit: 0, is_active: true, win_condition: { dice_sums: [10] } },
    ],
    balanced: [
      { name: "Джекпот (Сумма 2 или 12)", type: "bonus_limitless", value: 180, probability: 5.56, daily_limit: 1, is_active: true, win_condition: { dice_sums: [2, 12] } },
      { name: "Снайперский бросок (Сумма 3 или 11)", type: "virtual", value: 45, probability: 11.11, daily_limit: 8, is_active: true, win_condition: { dice_sums: [3, 11] } },
      { name: "Любой дубль (Парные кости)", type: "virtual", value: 25, probability: 16.67, daily_limit: 0, is_active: true, win_condition: { dice_sums: [], dice_double: "any" } },
      { name: "Точный расчёт (Сумма 4 или 10)", type: "attempt", value: 1, probability: 16.67, daily_limit: 0, is_active: true, win_condition: { dice_sums: [4, 10] } },
    ],
    generous: [
      { name: "Мега-Джекпот (Сумма 2 или 12)", type: "bonus_limitless", value: 250, probability: 5.56, daily_limit: 2, is_active: true, win_condition: { dice_sums: [2, 12] } },
      { name: "Элитный бросок (Сумма 3 или 11)", type: "virtual", value: 75, probability: 11.11, daily_limit: 10, is_active: true, win_condition: { dice_sums: [3, 11] } },
      { name: "Любой дубль (Парные кости)", type: "virtual", value: 40, probability: 16.67, daily_limit: 0, is_active: true, win_condition: { dice_sums: [], dice_double: "any" } },
      { name: "Крайние суммы (Сумма 4 или 10)", type: "virtual", value: 20, probability: 16.67, daily_limit: 0, is_active: true, win_condition: { dice_sums: [4, 10] } },
    ],
  },
  cards: {
    economy: [
      { name: "Пустая карта", type: "none", value: 0, probability: 45, daily_limit: 0, is_active: true },
      { name: "Обычная карта (15 Бонусов)", type: "virtual", value: 15, probability: 25, daily_limit: 0, is_active: true },
      { name: "Карта повтора (+1 Билет)", type: "attempt", value: 1, probability: 15, daily_limit: 0, is_active: true },
      { name: "Карта буста (+10% к пополнению)", type: "withdraw_boost", value: 10, probability: 8, daily_limit: 0, is_active: true },
      { name: "Редкая карта (40 Бонусов)", type: "virtual", value: 40, probability: 5, daily_limit: 8, is_active: true },
      { name: "Эпическая карта (80 Бонусов)", type: "virtual", value: 80, probability: 1.5, daily_limit: 3, is_active: true },
      { name: "Легендарный Джокер (160 ₽)", type: "bonus_limitless", value: 160, probability: 0.5, daily_limit: 1, is_active: true },
    ],
    balanced: [
      { name: "Пустая карта", type: "none", value: 0, probability: 35, daily_limit: 0, is_active: true },
      { name: "Обычная карта (20 Бонусов)", type: "virtual", value: 20, probability: 26, daily_limit: 0, is_active: true },
      { name: "Карта повтора (+1 Билет)", type: "attempt", value: 1, probability: 16, daily_limit: 0, is_active: true },
      { name: "Карта буста (+15% к пополнению)", type: "withdraw_boost", value: 15, probability: 10, daily_limit: 0, is_active: true },
      { name: "Редкая карта (50 Бонусов)", type: "virtual", value: 50, probability: 8.5, daily_limit: 8, is_active: true },
      { name: "Эпическая карта (100 Бонусов)", type: "virtual", value: 100, probability: 3.5, daily_limit: 3, is_active: true },
      { name: "Легендарный Туз (200 ₽)", type: "bonus_limitless", value: 200, probability: 1, daily_limit: 1, is_active: true },
    ],
    generous: [
      { name: "Пустая карта", type: "none", value: 0, probability: 25, daily_limit: 0, is_active: true },
      { name: "Обычная карта (25 Бонусов)", type: "virtual", value: 25, probability: 28, daily_limit: 0, is_active: true },
      { name: "Карта повтора (+1 Билет)", type: "attempt", value: 1, probability: 16, daily_limit: 0, is_active: true },
      { name: "Карта буста (+20% к пополнению)", type: "withdraw_boost", value: 20, probability: 10, daily_limit: 0, is_active: true },
      { name: "Редкая карта (65 Бонусов)", type: "virtual", value: 65, probability: 13, daily_limit: 10, is_active: true },
      { name: "Эпическая карта (130 Бонусов)", type: "virtual", value: 130, probability: 6, daily_limit: 4, is_active: true },
      { name: "Легендарный Джокер (250 ₽)", type: "bonus_limitless", value: 250, probability: 2, daily_limit: 2, is_active: true },
    ],
  },
  defuse: {
    economy: [
      { name: "Детонация C4 (Взрыв)", type: "none", value: 0, probability: 52, daily_limit: 0, is_active: true },
      { name: "Сапёрный набор (+1 Билет)", type: "attempt", value: 1, probability: 16, daily_limit: 0, is_active: true },
      { name: "20 Бонусов за разминирование", type: "virtual", value: 20, probability: 17, daily_limit: 0, is_active: true },
      { name: "Буст +15% к пополнению", type: "withdraw_boost", value: 15, probability: 8, daily_limit: 0, is_active: true },
      { name: "45 Бонусов (Чистый дефьюз)", type: "virtual", value: 45, probability: 5, daily_limit: 8, is_active: true },
      { name: "90 Бонусов (Мастер-сапёр)", type: "virtual", value: 90, probability: 1.5, daily_limit: 2, is_active: true },
      { name: "200 ₽ Легенда дефьюза", type: "bonus_limitless", value: 200, probability: 0.5, daily_limit: 1, is_active: true },
    ],
    balanced: [
      { name: "Детонация C4 (Взрыв)", type: "none", value: 0, probability: 45, daily_limit: 0, is_active: true },
      { name: "Сапёрный набор (+1 Билет)", type: "attempt", value: 1, probability: 15, daily_limit: 0, is_active: true },
      { name: "25 Бонусов за разминирование", type: "virtual", value: 25, probability: 20, daily_limit: 0, is_active: true },
      { name: "Буст +15% к пополнению", type: "withdraw_boost", value: 15, probability: 8, daily_limit: 0, is_active: true },
      { name: "50 Бонусов (Чистый дефьюз)", type: "virtual", value: 50, probability: 7.5, daily_limit: 8, is_active: true },
      { name: "120 Бонусов (Мастер-сапёр)", type: "virtual", value: 120, probability: 3.5, daily_limit: 3, is_active: true },
      { name: "250 ₽ Легенда дефьюза", type: "bonus_limitless", value: 250, probability: 1, daily_limit: 1, is_active: true },
    ],
    generous: [
      { name: "Детонация C4 (Взрыв)", type: "none", value: 0, probability: 35, daily_limit: 0, is_active: true },
      { name: "Сапёрный набор (+1 Билет)", type: "attempt", value: 1, probability: 16, daily_limit: 0, is_active: true },
      { name: "35 Бонусов за разминирование", type: "virtual", value: 35, probability: 22, daily_limit: 0, is_active: true },
      { name: "Буст +20% к пополнению", type: "withdraw_boost", value: 20, probability: 9, daily_limit: 0, is_active: true },
      { name: "75 Бонусов (Чистый дефьюз)", type: "virtual", value: 75, probability: 11, daily_limit: 10, is_active: true },
      { name: "160 Бонусов (Мастер-сапёр)", type: "virtual", value: 160, probability: 5, daily_limit: 4, is_active: true },
      { name: "350 ₽ MVP Раунда (Безлимит)", type: "bonus_limitless", value: 350, probability: 2, daily_limit: 2, is_active: true },
    ],
  },
};

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
  const searchParams = useSearchParams();

  // State: selected game (null = show all games catalog, string = full game page)
  const [selectedGame, setSelectedGame] = useState<string | null>(() => {
    const param = searchParams.get("game");
    if (param && GAMES.some((g) => g.id === param)) {
      return param;
    }
    return null;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activePresetKey, setActivePresetKey] = useState<PoolPresetKey | null>(null);
  const [ticketCostState, setTicketCostState] = useState<number>(1);

  // Sync selectedGame with URL
  const selectGame = (gameId: string | null) => {
    setSelectedGame(gameId);
    setActivePresetKey(null);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (gameId) {
        params.set("game", gameId);
      } else {
        params.delete("game");
      }
      const qs = params.toString();
      const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      window.history.pushState(null, "", newUrl);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const param = new URLSearchParams(window.location.search).get("game");
      if (param && GAMES.some((g) => g.id === param)) {
        setSelectedGame(param);
      } else {
        setSelectedGame(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const activeGameObj = GAMES.find((g) => g.id === selectedGame);

  // Synchronize ticket cost when game changes
  useEffect(() => {
    if (selectedGame) {
      const cfg = settings?.game_configs?.[selectedGame];
      const defaultCost = activeGameObj?.defaultTickets ?? 1;
      setTicketCostState(cfg?.tickets_per_play ?? defaultCost);
    }
  }, [selectedGame, settings, activeGameObj]);

  const isGameEnabled = selectedGame
    ? (settings?.enabled_games || []).includes(selectedGame)
    : false;

  const filteredPrizes = selectedGame
    ? prizes.filter((p) => p.game_slug === selectedGame)
    : [];

  const totalProbability = filteredPrizes.reduce(
    (sum, p) => sum + (Number(p.probability) || 0),
    0
  );

  // Применить пресет для текущей выбранной игры
  const handleApplyPreset = (presetKey: PoolPresetKey) => {
    if (!selectedGame) return;
    const template = POOL_PRESETS[selectedGame]?.[presetKey];
    if (!template) return;

    const generated: Prize[] = template.map((item) => ({
      ...item,
      game_slug: selectedGame,
    }));

    const otherGamesPrizes = prizes.filter((p) => p.game_slug !== selectedGame);
    setPrizes([...otherGamesPrizes, ...generated]);
    setActivePresetKey(presetKey);
  };

  // Handlers for prize manipulation
  const handleAddPrize = () => {
    if (!selectedGame) return;
    const newPrize: Prize = {
      name: "Новый приз",
      type: "virtual",
      value: 100,
      probability: 1,
      daily_limit: 0,
      is_active: true,
      game_slug: selectedGame,
    };
    setPrizes([...prizes, newPrize]);
  };

  const handleUpdatePrize = (filteredIndex: number, updates: Partial<Prize>) => {
    const currentPrize = filteredPrizes[filteredIndex];
    const globalIndex = prizes.indexOf(currentPrize);
    if (globalIndex === -1) return;

    const nextPrizes = [...prizes];
    nextPrizes[globalIndex] = { ...nextPrizes[globalIndex], ...updates };
    setPrizes(nextPrizes);
  };

  const handleDeletePrize = (filteredIndex: number) => {
    const currentPrize = filteredPrizes[filteredIndex];
    setPrizes(prizes.filter((p) => p !== currentPrize));
  };

  const handleToggleGameEnabled = async () => {
    if (!selectedGame) return;
    const currentList = settings?.enabled_games || [];
    const nextList = currentList.includes(selectedGame)
      ? currentList.filter((id: string) => id !== selectedGame)
      : [...currentList, selectedGame];

    await saveSettings({
      ...settings,
      enabled_games: nextList,
    });
  };

  const handleSaveAll = async () => {
    if (!selectedGame) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // 1. Save game configs in promo_settings
      const newSettings = {
        ...settings,
        game_configs: {
          ...(settings?.game_configs || {}),
          [selectedGame]: {
            ...(settings?.game_configs?.[selectedGame] || {}),
            tickets_per_play: Number(ticketCostState) || 1,
          },
        },
      };
      await saveSettings(newSettings);

      // 2. Save prizes to backend
      const res = await fetch(`/api/promo/admin/prizes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, prizes }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.prizes)) {
          setPrizes(data.prizes);
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert("Ошибка при сохранении призового фонда");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. ВИД: СПИСОК ВСЕХ МИНИ-ИГР (КАТАЛОГ)
  // ─────────────────────────────────────────────────────────────
  if (!selectedGame || !activeGameObj) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Мини-игры
          </h2>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Выберите мини-игру для настройки ее параметров, стоимости билетов и призового фонда
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GAMES.map((game) => {
            const isEnabled = (settings?.enabled_games || []).includes(game.id);
            const gamePrizes = prizes.filter((p) => p.game_slug === game.id);
            const totalProb = gamePrizes.reduce(
              (sum, p) => sum + (Number(p.probability) || 0),
              0
            );
            const ticketCost =
              settings?.game_configs?.[game.id]?.tickets_per_play ??
              game.defaultTickets;

            return (
              <div
                key={game.id}
                onClick={() => selectGame(game.id)}
                className="bg-white border border-slate-200 hover:border-slate-400 rounded-2xl p-5 shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-slate-700 transition-colors">
                        {game.label}
                      </h3>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {game.badge}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 border",
                        isEnabled
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      )}
                    >
                      {isEnabled ? "Включена" : "Отключена"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    {game.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                    <div className="bg-slate-50 rounded-xl p-2.5">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Стоимость
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">
                        {ticketCost} {ticketCost === 1 ? "билет" : ticketCost < 5 ? "билета" : "билетов"}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Призов
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">
                        {gamePrizes.length} шт.
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Шансы
                      </div>
                      <div
                        className={cn(
                          "text-xs font-bold mt-0.5",
                          Math.abs(totalProb - 100) < 0.01
                            ? "text-emerald-600"
                            : totalProb === 0
                            ? "text-slate-400"
                            : "text-amber-600"
                        )}
                      >
                        {totalProb.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 flex items-center justify-between border-t border-slate-100 text-xs">
                  <span className="text-slate-400 text-[11px]">
                    {isEnabled ? "Доступна гостям" : "Скрыта от гостей"}
                  </span>
                  <span className="font-semibold text-slate-900 group-hover:underline">
                    Настроить игру →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ВИД: ПОЛНОЦЕННАЯ СТРАНИЦА НАСТРОЙКИ ВЫБРАННОЙ ИГРЫ
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Навигация назад */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => selectGame(null)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 shadow-xs cursor-pointer transition-all"
        >
          ← Все игры
        </button>

        <span className="text-xs text-slate-400">
          Настройка игры: <strong className="text-slate-700">{activeGameObj.label}</strong>
        </span>
      </div>

      {/* Верхний блок: статус, имя игры и параметры */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {activeGameObj.label}
            </h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5 leading-relaxed">
              {activeGameObj.description}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="font-semibold text-xs text-slate-900">
                {isGameEnabled ? "Игра активна" : "Игра отключена"}
              </div>
              <div className="text-[11px] text-slate-400">
                {isGameEnabled ? "Доступна в приложении гостя" : "Скрыта от гостей"}
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleGameEnabled}
              className={cn(
                "w-11 h-6 rounded-full relative transition-colors duration-200 cursor-pointer shrink-0",
                isGameEnabled ? "bg-slate-900" : "bg-slate-300"
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow-xs",
                  isGameEnabled ? "left-6" : "left-1"
                )}
              />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Стоимость участия (билетов за запуск)
            </label>
            <input
              type="number"
              min={1}
              value={ticketCostState}
              onChange={(e) => setTicketCostState(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-slate-900 focus:bg-white transition-all"
            />
            <p className="text-[11px] text-slate-400">
              Количество промо-билетов, списываемых со счёта игрока за один запуск игры.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Механика работы
            </label>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              {activeGameObj.rulesHint}
            </p>
          </div>
        </div>
      </div>

      {/* Призовой фонд */}
      <div className="space-y-4">
        {/* Авто-генерация пула по 3 пресетам + Экономика пула */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                Шаблоны призового фонда
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Готовые варианты распределения вероятностей и призов для {activeGameObj.label}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {PRESET_META.map((preset) => {
              const isSelected = activePresetKey === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handleApplyPreset(preset.key)}
                  className={cn(
                    "text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group",
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-white hover:bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-xs font-bold transition-colors",
                        isSelected ? "text-white" : "text-slate-900"
                      )}>
                        {preset.title}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-[11px] leading-relaxed",
                        isSelected ? "text-slate-300" : "text-slate-500"
                      )}
                    >
                      {preset.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-900">
              Призовой фонд ({filteredPrizes.length})
            </h3>
            <span
              className={cn(
                "text-xs font-semibold",
                selectedGame === "dice" || Math.abs(totalProbability - 100) < 0.01
                  ? "text-emerald-600"
                  : "text-amber-600"
              )}
            >
              {selectedGame === "dice"
                ? `Сумма шансов по граням: ${totalProbability.toFixed(1)}%`
                : `Сумма шансов: ${totalProbability.toFixed(1)}%${
                    Math.abs(totalProbability - 100) < 0.01
                      ? " (баланс)"
                      : " (рекомендуется 100%)"
                  }`}
            </span>
          </div>

          <button
            onClick={handleAddPrize}
            className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer self-start sm:self-auto"
          >
            + Добавить приз
          </button>
        </div>

        {filteredPrizes.length === 0 ? (
          <div className="bg-white border border-slate-200 border-dashed rounded-2xl py-12 flex flex-col items-center justify-center space-y-2 text-center px-4">
            <p className="text-sm font-semibold text-slate-900">
              В этой игре пока нет призов
            </p>
            <p className="text-xs text-slate-500">
              Нажмите «+ Добавить приз», чтобы настроить награды для гостей
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredPrizes.map((prize, idx) => {
              return (
                <div
                  key={prize.id ? `prize_${prize.id}` : `new_prize_${idx}`}
                  className={cn(
                    "bg-white border border-slate-200 p-5 rounded-2xl shadow-xs relative transition-all space-y-4",
                    !prize.is_active && "opacity-60 bg-slate-50/50"
                  )}
                >
                  {/* Верхняя строка карточки приза */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <input
                        className="text-sm sm:text-base font-bold text-slate-900 outline-none focus:border-b focus:border-slate-900 bg-transparent w-full"
                        value={prize.name}
                        placeholder="Название приза"
                        onChange={(e) =>
                          handleUpdatePrize(idx, { name: e.target.value })
                        }
                      />
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdatePrize(idx, { is_active: !prize.is_active })
                        }
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer",
                          prize.is_active
                            ? "text-emerald-600 hover:text-emerald-700"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                        title={prize.is_active ? "Приз активен (кликните, чтобы отключить)" : "Приз выключен (кликните, чтобы включить)"}
                      >
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            prize.is_active ? "bg-emerald-500" : "bg-slate-300"
                          )}
                        />
                        <span>{prize.is_active ? "Активен" : "Выключен"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePrize(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Удалить приз"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Параметры приза */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-500">
                        Тип приза
                      </label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                        value={prize.type === "physical" ? "virtual" : prize.type}
                        onChange={(e) => {
                          const nextType = e.target.value as any;
                          handleUpdatePrize(idx, {
                            type: nextType,
                            ...(nextType === "none" ? { value: 0, name: prize.name === "Новый приз" ? "Пусто" : prize.name } : {}),
                          });
                        }}
                      >
                        <option value="virtual">Баланс (₽)</option>
                        <option value="bonus_limitless">Безлимитный вывод (₽)</option>
                        <option value="attempt">Билеты (+шт)</option>
                        <option value="withdraw_boost">Буст вывода (% к пополнению)</option>
                        <option value="none">Пусто (без выигрыша)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-500">
                        Значение
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        disabled={(prize.type as string) === "none"}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white disabled:opacity-50"
                        value={Math.round(Number(prize.value) || 0)}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdatePrize(idx, {
                            value: val === "" ? 0 : parseInt(val, 10) || 0,
                          });
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-500">
                        Шанс (%)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max="100"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                        value={prize.probability ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdatePrize(idx, {
                            probability: val === "" ? 0 : parseFloat(val) || 0,
                          });
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-500">
                        Лимит (день)
                      </label>
                      <input
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                        value={prize.daily_limit || 0}
                        placeholder="0 - без лимита"
                        onChange={(e) =>
                          handleUpdatePrize(idx, {
                            daily_limit: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Дополнительное условие для костей */}
                  {selectedGame === "dice" && (
                    <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
                      {(() => {
                        const calcDiceProb = (
                          sums: number[],
                          dbl?: number | "any",
                        ) => {
                          let favorable = 0;
                          for (let d1 = 1; d1 <= 6; d1++) {
                            for (let d2 = 1; d2 <= 6; d2++) {
                              const hitSum = sums.includes(d1 + d2);
                              const hitDbl =
                                dbl &&
                                d1 === d2 &&
                                (dbl === "any" || Number(dbl) === d1);
                              if (hitSum || hitDbl) favorable++;
                            }
                          }
                          return Number(((favorable / 36) * 100).toFixed(2));
                        };

                        const currentSums = prize.win_condition?.dice_sums || [];
                        const currentDouble = prize.win_condition?.dice_double;

                        return (
                          <>
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold text-slate-600">
                                Условие выпадения: сумма двух кубиков
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
                                  (sum) => {
                                    const isSelected =
                                      currentSums.includes(sum);
                                    return (
                                      <button
                                        key={sum}
                                        type="button"
                                        onClick={() => {
                                          const nextSums = isSelected
                                            ? currentSums.filter(
                                                (s) => s !== sum,
                                              )
                                            : [...currentSums, sum];
                                          const nextCond = {
                                            ...(prize.win_condition || {}),
                                            dice_sums: nextSums,
                                          };
                                          handleUpdatePrize(idx, {
                                            win_condition: nextCond,
                                            probability: calcDiceProb(
                                              nextSums,
                                              currentDouble,
                                            ),
                                          });
                                        }}
                                        className={cn(
                                          "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold transition-all cursor-pointer",
                                          isSelected
                                            ? "bg-slate-900 text-white"
                                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100",
                                        )}
                                      >
                                        {sum}
                                      </button>
                                    );
                                  },
                                )}
                              </div>
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                              <div className="text-[11px] font-semibold text-slate-600">
                                Или выпадение дубля (одинаковые грани)
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { label: "Любой дубль", val: "any" as const },
                                  { label: "1-1", val: 1 },
                                  { label: "2-2", val: 2 },
                                  { label: "3-3", val: 3 },
                                  { label: "4-4", val: 4 },
                                  { label: "5-5", val: 5 },
                                  { label: "6-6", val: 6 },
                                ].map((opt) => {
                                  const isSelected =
                                    String(currentDouble) === String(opt.val);
                                  return (
                                    <button
                                      key={String(opt.val)}
                                      type="button"
                                      onClick={() => {
                                        const nextDbl = isSelected
                                          ? undefined
                                          : opt.val;
                                        const nextCond = {
                                          ...(prize.win_condition || {}),
                                          dice_double: nextDbl,
                                        };
                                        handleUpdatePrize(idx, {
                                          win_condition: nextCond,
                                          probability: calcDiceProb(
                                            currentSums,
                                            nextDbl,
                                          ),
                                        });
                                      }}
                                      className={cn(
                                        "px-2.5 h-7 rounded-md flex items-center justify-center text-xs font-bold transition-all cursor-pointer",
                                        isSelected
                                          ? "bg-slate-900 text-white"
                                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100",
                                      )}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Sticky Bottom Save Bar */}
        <div className="sticky bottom-4 z-30 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-lg flex items-center justify-between gap-4 mt-6">
          <div className="flex items-center gap-3">
            {saveSuccess ? (
              <span className="text-xs font-semibold text-emerald-600">
                Изменения успешно сохранены
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Призов в игре: <strong className="text-slate-700">{filteredPrizes.length}</strong>{" "}
                (сумма шансов:{" "}
                <strong
                  className={
                    Math.abs(totalProbability - 100) < 0.01
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }
                >
                  {totalProbability.toFixed(1)}%
                </strong>
                )
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="h-10 px-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-medium text-xs sm:text-sm transition-all shadow-xs cursor-pointer active:scale-98 shrink-0"
          >
            {isSaving ? "Сохранение..." : "Сохранить изменения"}
          </button>
        </div>
      </div>
    </div>
  );
}
