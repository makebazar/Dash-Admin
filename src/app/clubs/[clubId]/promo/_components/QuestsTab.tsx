"use client";

import React, { useState, useEffect } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Target,
  Edit2,
  X,
  Clock,
  Calendar,
  Sparkles,
  Smartphone,
  Award,
  Gamepad2,
  Lock,
  PlusCircle,
  ArrowRight,
  Coffee,
  CheckCircle,
  HelpCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Ticket,
  Coins,
  ExternalLink,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  { id: 1, label: "Пн" },
  { id: 2, label: "Вт" },
  { id: 3, label: "Ср" },
  { id: 4, label: "Чт" },
  { id: 5, label: "Пт" },
  { id: 6, label: "Сб" },
  { id: 0, label: "Вс" },
];

const TRIGGER_CATEGORIES = [
  {
    id: "bar",
    title: "Покупки в баре",
    description: "Товары, категории, чеки",
    icon: "🍹",
    triggers: [
      { id: "receipt_item", label: "Покупка товаров / категорий" },
      { id: "receipt_total", label: "Сумма одного чека" },
      { id: "total_spent_accumulative", label: "Накопительные траты" },
    ],
  },
  {
    id: "services",
    title: "Услуги клуба",
    description: "Пакеты времени, баланс",
    icon: "💼",
    triggers: [
      { id: "service_award", label: "Покупка пакета / услуги" },
      { id: "service_accumulative", label: "Накопительные услуги" },
      { id: "balance_topup", label: "Пополнение баланса" },
    ],
  },
  {
    id: "games",
    title: "Игровой центр",
    description: "Сыгранные игры, победы",
    icon: "🎮",
    triggers: [
      { id: "game_play_count", label: "Количество игр" },
      { id: "game_win_count", label: "Количество побед" },
      { id: "ticket_spend", label: "Трата билетов в лавке" },
    ],
  },
  {
    id: "manual",
    title: "Действия гостя",
    description: "Подписки, отзывы, ручное",
    icon: "📝",
    triggers: [
      { id: "manual_verification", label: "Ручное подтверждение" },
      { id: "visit_cumulative", label: "Накопительное посещение" },
      { id: "visit_streak", label: "Посещения подряд (Streak)" },
    ],
  },
];

const renderTargetExplanation = (quest: any, products: any[], categories: any[], serviceRules: any[]) => {
  const { trigger_type, target_entity_id, target_entity_id_type, target_value } = quest;
  if (trigger_type === "receipt_item") {
    if (target_entity_id_type === "category") {
      const cat = categories.find(c => String(c.id) === String(target_entity_id));
      return `Купить любой товар из категории "${cat?.name || "..."}" в количестве ${target_value || 1} шт.`;
    } else {
      const ids = (target_entity_id || "").split(",").filter(Boolean);
      const names = ids.map((id: string) => products.find(p => String(p.id) === String(id))?.name || "...").join(" + ");
      if (ids.length > 1) {
        return `Купить комплект (${names}) в количестве ${target_value || 1} шт.`;
      }
      return `Купить "${names || "выбранный товар"}" в количестве ${target_value || 1} шт.`;
    }
  } else if (trigger_type === "receipt_total") {
    return `Сделать покупку в баре на сумму от ${target_value || 0} ₽ в одном чеке.`;
  } else if (trigger_type === "service_award") {
    const ids = (target_entity_id || "").split(",").filter(Boolean);
    const names = ids.map((id: string) => serviceRules.find(s => String(s.id) === String(id))?.name || "...").join(", ");
    return `Приобрести пакет(ы) времени: "${names || "любой"}" (${target_value || 1} раз).`;
  } else if (trigger_type === "service_accumulative") {
    const ids = (target_entity_id || "").split(",").filter(Boolean);
    const names = ids.map((id: string) => serviceRules.find(s => String(s.id) === String(id))?.name || "...").join(", ");
    return `Накопительная покупка пакетов "${names || "любого"}": всего ${target_value || 1} шт.`;
  } else if (trigger_type === "balance_topup") {
    return `Пополнить баланс аккаунта на сумму от ${target_value || 0} ₽.`;
  } else if (trigger_type === "manual_verification") {
    return `Нажмите кнопку ниже для перехода и подтвердите действие у администратора.`;
  } else if (trigger_type === "visit_cumulative") {
    return `Посетить клуб ${target_value || 1} раз(а) (подтверждает администратор).`;
  } else if (trigger_type === "visit_streak") {
    return `Посетить клуб ${target_value || 1} дней подряд (подтверждает администратор).`;
  } else if (trigger_type === "game_play_count") {
    return `Сыграть ${target_value || 1} игр(ы) на игровых компьютерах.`;
  } else if (trigger_type === "game_win_count") {
    return `Выиграть в турнире или соревновании ${target_value || 1} раз(а).`;
  } else if (trigger_type === "ticket_spend") {
    return `Потратить ${target_value || 1} билетов(а) в игровом магазине (лавке).`;
  } else if (trigger_type === "total_spent_accumulative") {
    return `Потратить в сумме ${target_value || 0} ₽ в баре за все время действия квеста.`;
  }
  return "";
};

export function QuestsTab({
  clubId,
  products,
  categories,
  serviceRules,
  settings,
  saveSettings,
}: {
  clubId: string;
  products: any[];
  categories: any[];
  serviceRules: any[];
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
}) {
  const [quests, setQuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingQuest, setEditingQuest] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("bar");

  const [localSettings, setLocalSettings] = useState<any>(null);
  const [savingLoyalty, setSavingLoyalty] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleSaveLoyalty = async () => {
    setSavingLoyalty(true);
    try {
      await saveSettings(localSettings);
      alert("Настройки лояльности успешно сохранены!");
    } catch (e) {
      alert("Ошибка при сохранении настроек лояльности");
    } finally {
      setSavingLoyalty(false);
    }
  };

  const LOYALTY_PROGRAM_TYPES = [
    { id: "package_accumulation", label: "Накопление пакетов", icon: "📦", desc: "Купи N пакетов, получи приз" },
    { id: "visit_accumulation", label: "Визиты с покупкой пакета", icon: "🚶", desc: "Каждые N посещений с покупкой выбранного пакета — подарок" },
    { id: "visit_streak", label: "Серия дней с покупкой", icon: "🔥", desc: "Покупка выбранного пакета N дней подряд — приз" },
  ];

  const getDefaultProgram = () => ({
    id: Math.random().toString(36).slice(2),
    enabled: true,
    type: "package_accumulation",
    title: "",
    target: 5,
    trigger_product_ids: [] as number[],
    trigger_service_ids: [] as string[],
    rewards: {
      xp: 0,
      tickets: 0,
      bonus_balance: 0,
      free_package: false,
      free_package_name: "",
      free_package_quantity: 1,
      bar_reward_type: "none",
      bar_product_id: null as number | null,
      bar_category_id: null as string | null,
      bar_reward_quantity: 1,
    },
  });

  const getLoyaltyPrograms = (): any[] => localSettings?.loyalty_programs || [];

  const updateProgram = (idx: number, updates: any) => {
    const programs = [...getLoyaltyPrograms()];
    programs[idx] = { ...programs[idx], ...updates };
    setLocalSettings({ ...localSettings, loyalty_programs: programs });
  };

  const updateProgramRewards = (idx: number, rewardUpdates: any) => {
    const programs = [...getLoyaltyPrograms()];
    programs[idx] = { ...programs[idx], rewards: { ...(programs[idx].rewards || {}), ...rewardUpdates } };
    setLocalSettings({ ...localSettings, loyalty_programs: programs });
  };

  const addProgram = () => {
    setLocalSettings({
      ...localSettings,
      loyalty_programs: [...getLoyaltyPrograms(), getDefaultProgram()],
    });
  };

  const removeProgram = (idx: number) => {
    const programs = getLoyaltyPrograms().filter((_: any, i: number) => i !== idx);
    setLocalSettings({ ...localSettings, loyalty_programs: programs });
  };

  useEffect(() => {
    fetchQuests();
  }, [clubId]);

  useEffect(() => {
    if (editingQuest?.trigger_type) {
      const cat = TRIGGER_CATEGORIES.find((c) =>
        c.triggers.some((t) => t.id === editingQuest.trigger_type)
      );
      if (cat) {
        setSelectedCategory(cat.id);
      }
    }
  }, [editingQuest?.trigger_type]);

  const fetchQuests = async () => {
    try {
      const res = await fetch(`/api/promo/admin/quests?clubId=${clubId}`);
      const data = await res.json();
      setQuests(data.quests || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuest = async () => {
    setSaving(true);
    try {
      const method = editingQuest.id ? "PUT" : "POST";
      const payload = { ...editingQuest, club_id: clubId };
      const res = await fetch("/api/promo/admin/quests", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setEditingQuest(null);
        fetchQuests();
      } else {
        alert("Ошибка сохранения: " + data.error);
      }
    } catch (e) {
      alert("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuest = async (id: string) => {
    if (!confirm("Удалить квест?")) return;
    try {
      const res = await fetch(
        `/api/promo/admin/quests?id=${id}&clubId=${clubId}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) fetchQuests();
    } catch (e) {
      console.error(e);
    }
  };

  const openNewQuest = () => {
    setEditingQuest({
      title: "",
      description: "",
      trigger_type: "receipt_item",
      target_entity_id: "",
      target_entity_id_type: "product",
      target_value: 1,
      reward_xp: 0,
      reward_tickets: 0,
      reward_bonus_balance: 0,
      is_active: true,
      available_days: [1, 2, 3, 4, 5, 6, 0],
      time_start: "00:00",
      time_end: "23:59",
      action_button_text: "",
      action_button_url: "",
      requires_photo_verification: false,
      requires_seat_number: false,
      reset_period: "none",
      min_level: 1,
      reset_hours: 24,
      target_service_id: "",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-[90rem] mx-auto animate-fadeIn">
      {/* Header card / actions bar */}
      <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-[2.5rem] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-2xl uppercase italic tracking-tight flex items-center gap-3">
              <Target className="w-7 h-7 text-orange-500" />
              Конструктор <span className="text-orange-500">Квестов</span>
            </h3>
            <p className="text-slate-500 text-sm font-medium mt-1">
              Создавайте автоматические задания и вовлечение для гостей клуба. Настраивайте триггеры, кулдауны и награды.
            </p>
          </div>
          {!editingQuest && (
            <button
              onClick={openNewQuest}
              className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3.5 rounded-2xl font-bold transition-all text-sm shadow-lg shadow-orange-500/25 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              СОЗДАТЬ КВЕСТ
            </button>
          )}
        </div>

        {editingQuest ? (
          /* Split Layout: lg:grid-cols-12 */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4 border-t border-slate-100">
            
            {/* Left Column: Interactive Form (Col span 7) */}
            <div className="lg:col-span-7 space-y-8 bg-slate-50/50 border border-slate-100 p-6 sm:p-8 rounded-3xl">
              
              {/* Top Header inside Form */}
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                  <h4 className="font-black text-lg uppercase italic text-slate-800">
                    {editingQuest.id ? "Редактирование квеста" : "Настройка нового квеста"}
                  </h4>
                </div>
                <button
                  onClick={() => setEditingQuest(null)}
                  className="p-2 hover:bg-slate-200/80 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* STEP 1: Basic Info (Simplified: No images) */}
              <div className="space-y-4 bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider mb-1">
                  <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-[10px]">1</span>
                  Основное описание квеста
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                      Название квеста
                    </label>
                    <input
                      type="text"
                      value={editingQuest.title}
                      onChange={(e) =>
                        setEditingQuest({
                          ...editingQuest,
                          title: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500 focus:bg-white transition-all"
                      placeholder="Напр. Бодрость на всю ночь"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                      Описание и правила
                    </label>
                    <textarea
                      value={editingQuest.description}
                      onChange={(e) =>
                        setEditingQuest({
                          ...editingQuest,
                          description: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500 focus:bg-white min-h-[72px] transition-all"
                      placeholder="Купи 2 банки энергетика Red Bull и получи мгновенный бонус..."
                    />
                  </div>
                </div>
              </div>

              {/* STEP 2: Trigger Selector Grid */}
              <div className="space-y-5 bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider mb-1">
                  <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-[10px]">2</span>
                  Условие выполнения (Триггер)
                </div>

                {/* 4-Tile Grid of Category Categories */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {TRIGGER_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setEditingQuest({
                            ...editingQuest,
                            trigger_type: cat.triggers[0].id,
                            target_entity_id: "",
                          });
                        }}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden flex flex-col justify-between h-[100px] hover:scale-[1.02] hover:shadow-md",
                          isSelected
                            ? "border-orange-500 bg-orange-50/20 shadow-sm shadow-orange-500/5"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <span className="text-2xl">{cat.icon}</span>
                        <div>
                          <h5 className={cn("text-[10px] font-black uppercase tracking-wider leading-tight", isSelected ? "text-orange-600" : "text-slate-800")}>
                            {cat.title}
                          </h5>
                          <p className="text-[8px] text-slate-400 mt-0.5 leading-tight font-medium">
                            {cat.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Specific trigger types options depending on selected category */}
                <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-xl space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                    Конкретное условие для отслеживания
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {TRIGGER_CATEGORIES.find((c) => c.id === selectedCategory)?.triggers.map((trigger) => {
                      const isTriggerSelected = editingQuest.trigger_type === trigger.id;
                      return (
                        <button
                          key={trigger.id}
                          type="button"
                          onClick={() => {
                            setEditingQuest({
                              ...editingQuest,
                              trigger_type: trigger.id,
                              target_entity_id: "",
                            });
                          }}
                          className={cn(
                            "p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between",
                            isTriggerSelected
                              ? "bg-white border-orange-500 text-orange-600 shadow-sm"
                              : "bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300"
                          )}
                        >
                          <span>{trigger.label}</span>
                          {isTriggerSelected && (
                            <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-white text-[8px] font-bold">✓</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Conditional Sub-Inputs (Products, Services, categories, values) */}
                
                {/* Trigger target value */}
                <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    {editingQuest.trigger_type === "receipt_item" &&
                    (editingQuest.target_entity_id || "").includes(",")
                      ? "Сколько КОМПЛЕКТОВ нужно купить?"
                      : [
                            "receipt_total",
                            "total_spent_accumulative",
                            "balance_topup",
                          ].includes(editingQuest.trigger_type)
                        ? "Минимальная сумма (₽)"
                        : "Требуемое количество"}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={Math.floor(Number(editingQuest.target_value || 0))}
                    onChange={(e) =>
                      setEditingQuest({
                        ...editingQuest,
                        target_value: Math.floor(Number(e.target.value)),
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500"
                  />
                  {editingQuest.trigger_type === "receipt_item" &&
                    (editingQuest.target_entity_id || "").includes(",") && (
                      <p className="text-[9px] text-slate-400 mt-2 italic px-1">
                        * Например, если нужно купить 2 набора "Кола + Чипсы", укажите здесь 2.
                      </p>
                    )}
                </div>

                {/* If Receipt Item: Choose specific products or category */}
                {editingQuest.trigger_type === "receipt_item" && (
                  <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                        Тип цели
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuest({
                              ...editingQuest,
                              target_entity_id_type: "product",
                              target_entity_id: "",
                            })
                          }
                          className={cn(
                            "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                            (editingQuest.target_entity_id_type || "product") === "product"
                              ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-400 hover:border-slate-300",
                          )}
                        >
                          Конкретный товар
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuest({
                              ...editingQuest,
                              target_entity_id_type: "category",
                              target_entity_id: "",
                            })
                          }
                          className={cn(
                            "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                            editingQuest.target_entity_id_type === "category"
                              ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-400 hover:border-slate-300",
                          )}
                        >
                          Категория товаров
                        </button>
                      </div>
                    </div>

                    {editingQuest.target_entity_id_type === "category" ? (
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                          Выберите категорию
                        </label>
                        <select
                          value={editingQuest.target_entity_id}
                          onChange={(e) =>
                            setEditingQuest({
                              ...editingQuest,
                              target_entity_id: e.target.value,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500"
                        >
                          <option value="">-- Выберите категорию --</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.products_count} тов.)
                            </option>
                          ))}
                        </select>
                        <p className="text-[9px] text-slate-400 mt-2 italic px-1">
                          * Система будет автоматически выбирать доступный товар из этой категории для отображения гостю.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                          Выберите товары (НУЖНО КУПИТЬ ВСЕ ВМЕСТЕ)
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {(editingQuest.target_entity_id || "")
                            .split(",")
                            .filter(Boolean)
                            .map((id: string) => {
                              const p = products.find(
                                (prod) => String(prod.id) === String(id),
                              );
                              if (!p) return null;
                              return (
                                <div
                                  key={id}
                                  className="bg-orange-500/10 text-orange-600 border border-orange-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                >
                                  {p.name}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const current = (editingQuest.target_entity_id || "")
                                        .split(",")
                                        .filter(Boolean);
                                      setEditingQuest({
                                        ...editingQuest,
                                        target_entity_id: current
                                          .filter((i: string) => i !== id)
                                          .join(","),
                                      });
                                    }}
                                    className="hover:text-orange-700 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                        <select
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const current = (editingQuest.target_entity_id || "")
                              .split(",")
                              .filter(Boolean);
                            if (!current.includes(e.target.value)) {
                              setEditingQuest({
                                ...editingQuest,
                                target_entity_id: [...current, e.target.value].join(","),
                              });
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500"
                        >
                          <option value="">-- Добавить товар --</option>
                          {products.map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              disabled={(editingQuest.target_entity_id || "").split(",").includes(String(p.id))}
                            >
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* If Club Services triggers: Choose specific service rule */}
                {["service_award", "service_accumulative"].includes(editingQuest.trigger_type) && (
                  <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                        Услуги / Пакеты (выберите одну или несколько)
                      </label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(editingQuest.target_entity_id || "")
                          .split(",")
                          .filter(Boolean)
                          .map((id: string) => {
                            const s = serviceRules.find(
                              (rule) => String(rule.id) === String(id),
                            );
                            if (!s) return null;
                            return (
                              <div
                                key={id}
                                className="bg-blue-500/10 text-blue-600 border border-blue-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                              >
                                {s.name}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = (editingQuest.target_entity_id || "")
                                      .split(",")
                                      .filter(Boolean);
                                    setEditingQuest({
                                      ...editingQuest,
                                      target_entity_id: current
                                        .filter((i: string) => i !== id)
                                        .join(","),
                                    });
                                  }}
                                  className="hover:text-blue-700 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                      </div>
                      <select
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const current = (editingQuest.target_entity_id || "")
                            .split(",")
                            .filter(Boolean);
                          if (!current.includes(e.target.value)) {
                            setEditingQuest({
                              ...editingQuest,
                              target_entity_id: [...current, e.target.value].join(","),
                            });
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500"
                      >
                        <option value="">-- Добавить услугу --</option>
                        {serviceRules.map((s) => (
                          <option
                            key={s.id}
                            value={s.id}
                            disabled={(editingQuest.target_entity_id || "").split(",").includes(String(s.id))}
                          >
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[9px] text-slate-400 mt-2 italic px-1">
                        * Оставьте пустым, чтобы квест срабатывал на любые услуги.
                      </p>
                    </div>
                  </div>
                )}

                {/* If Manual Verification / Visit trigger */}
                {["manual_verification", "visit_cumulative", "visit_streak"].includes(editingQuest.trigger_type) && (
                  <div className="space-y-4 bg-orange-50/20 p-4 rounded-xl border border-orange-100">
                    {editingQuest.trigger_type === "manual_verification" && (
                      <>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                            Текст на кнопке действия
                          </label>
                          <input
                            type="text"
                            value={editingQuest.action_button_text || ""}
                            onChange={(e) =>
                              setEditingQuest({
                                ...editingQuest,
                                action_button_text: e.target.value,
                              })
                            }
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500"
                            placeholder="Оставить отзыв на картах"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                            Ссылка в кнопке (URL)
                          </label>
                          <input
                            type="text"
                            value={editingQuest.action_button_url || ""}
                            onChange={(e) =>
                              setEditingQuest({
                                ...editingQuest,
                                action_button_url: e.target.value,
                              })
                            }
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500"
                            placeholder="https://yandex.ru/maps/..."
                          />
                        </div>
                        <label className="flex items-center gap-2.5 cursor-pointer mt-1 select-none">
                          <input
                            type="checkbox"
                            checked={editingQuest.requires_photo_verification}
                            onChange={(e) =>
                              setEditingQuest({
                                ...editingQuest,
                                requires_photo_verification: e.target.checked,
                              })
                            }
                            className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 accent-orange-500"
                          />
                          <span className="text-xs font-bold text-slate-700">
                            Требуется загрузка скриншота/фото для подтверждения
                          </span>
                        </label>
                      </>
                    )}

                    <label className="flex items-center gap-2.5 cursor-pointer mt-1 select-none">
                      <input
                        type="checkbox"
                        checked={editingQuest.requires_seat_number || false}
                        onChange={(e) =>
                          setEditingQuest({
                            ...editingQuest,
                            requires_seat_number: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 accent-orange-500"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        Запрашивать номер места (ПК) у гостя
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* STEP 3: Cooldown & Availability */}
              <div className="space-y-6 bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider mb-1">
                  <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-[10px]">3</span>
                  Кулдаун и настройки доступности
                </div>

                {/* Cooldown Segmented Toggle */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Режим повторения
                  </label>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingQuest({
                          ...editingQuest,
                          reset_period: "none",
                        })
                      }
                      className={cn(
                        "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border text-center font-bold",
                        (editingQuest.reset_period || "none") === "none"
                          ? "bg-slate-900 border-slate-900 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      ☄️ Разовый квест
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingQuest({
                          ...editingQuest,
                          reset_period: "daily",
                        })
                      }
                      className={cn(
                        "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border text-center font-bold",
                        (editingQuest.reset_period || "none") !== "none"
                          ? "bg-slate-900 border-slate-900 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      🔄 Повторяемый квест
                    </button>
                  </div>

                  {/* Cooldown details if repeatable */}
                  {editingQuest.reset_period && editingQuest.reset_period !== "none" && (
                    <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-xl space-y-4 mt-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                        Интервал автоматического сброса
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { id: "daily", label: "☀️ Ежедневно", desc: "Сброс в 00:00" },
                          { id: "weekly", label: "📅 Еженедельно", desc: "В Пн в 00:00" },
                          { id: "monthly", label: "📆 Ежемесячно", desc: "1-го числа" },
                          { id: "hours", label: "⏳ Через X часов", desc: "Кулдаун от сдачи" },
                          { id: "always", label: "⚡️ Сразу заново", desc: "Всегда доступен" },
                        ].map((item) => {
                          const isSelected = editingQuest.reset_period === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setEditingQuest({
                                  ...editingQuest,
                                  reset_period: item.id,
                                  reset_hours: item.id === "hours" ? (editingQuest.reset_hours || 24) : editingQuest.reset_hours,
                                });
                              }}
                              className={cn(
                                "p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-[64px]",
                                isSelected
                                  ? "bg-white border-orange-500 text-orange-600 shadow-sm"
                                  : "bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300"
                              )}
                            >
                              <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
                              <span className="text-[8px] text-slate-400 leading-tight">{item.desc}</span>
                            </button>
                          );
                        })}
                      </div>

                      {editingQuest.reset_period === "hours" && (
                        <div className="mt-3 space-y-2 pt-2 border-t border-slate-200/50">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Количество часов кулдауна
                            </label>
                            <span className="text-xs font-black text-orange-500 bg-orange-50 border border-orange-100 px-2.5 py-0.5 rounded-full">
                              {editingQuest.reset_hours || 2} ч.
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="1"
                              max="168"
                              step="1"
                              value={editingQuest.reset_hours || 2}
                              onChange={(e) =>
                                setEditingQuest({
                                  ...editingQuest,
                                  reset_hours: parseInt(e.target.value) || 2,
                                })
                              }
                              className="flex-1 accent-orange-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <input
                              type="number"
                              min="1"
                              value={editingQuest.reset_hours || 2}
                              onChange={(e) =>
                                setEditingQuest({
                                  ...editingQuest,
                                  reset_hours: parseInt(e.target.value) || 2,
                                })
                              }
                              className="w-16 bg-white border border-slate-200 rounded-xl px-2 py-1 text-center font-bold text-xs outline-none focus:border-orange-500"
                            />
                          </div>
                          <p className="text-[9px] text-slate-400 leading-relaxed italic px-1">
                            * Игрок сможет заново выполнить этот квест через {editingQuest.reset_hours || 2} часов после завершения.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Additional requirements (Service today and level requirements) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Минимальный уровень гостя
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingQuest.min_level || 1}
                      onChange={(e) =>
                        setEditingQuest({
                          ...editingQuest,
                          min_level: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500 focus:bg-white"
                    />
                    <p className="text-[9px] text-slate-400 font-medium mt-1 italic px-1">
                      Квест будет доступен только гостям с этого уровня.
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Требуется купленная услуга сегодня
                    </label>
                    <select
                      value={editingQuest.target_service_id || ""}
                      onChange={(e) =>
                        setEditingQuest({
                          ...editingQuest,
                          target_service_id: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500 focus:bg-white"
                    >
                      <option value="">-- Не требуется --</option>
                      {serviceRules.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-slate-400 mt-1 italic px-1">
                      * Работает, только если гость сегодня купил этот пакет времени.
                    </p>
                  </div>
                </div>

                {/* Week Availability and Time windows */}
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-orange-500" /> Доступность по дням недели
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((day) => {
                        const isSelected = (editingQuest.available_days || []).includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => {
                              const current = editingQuest.available_days || [];
                              const next = isSelected
                                ? current.filter((id: number) => id !== day.id)
                                : [...current, day.id];
                              setEditingQuest({
                                ...editingQuest,
                                available_days: next,
                              });
                            }}
                            className={cn(
                              "w-10 h-10 rounded-xl text-xs font-black transition-all border shadow-sm flex items-center justify-center select-none active:scale-[0.93]",
                              isSelected
                                ? "bg-orange-500 border-orange-600 text-white shadow-orange-500/20"
                                : "bg-white border-slate-200 text-slate-600 hover:border-orange-500",
                            )}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-orange-500" /> Время начала
                      </label>
                      <input
                        type="time"
                        value={editingQuest.time_start || "00:00"}
                        onChange={(e) =>
                          setEditingQuest({
                            ...editingQuest,
                            time_start: e.target.value,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-orange-500" /> Время окончания
                      </label>
                      <input
                        type="time"
                        value={editingQuest.time_end || "23:59"}
                        onChange={(e) =>
                          setEditingQuest({
                            ...editingQuest,
                            time_end: e.target.value,
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 4: Rewards configuration simplified */}
              <div className="space-y-4 bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider mb-1">
                  <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-[10px]">4</span>
                  Награды за выполнение
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {/* XP Reward Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      🔥 Опыт (XP)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingQuest.reward_xp || 0}
                      onChange={(e) => {
                        const val = Math.max(0, Math.floor(Number(e.target.value)));
                        setEditingQuest((prev: any) => ({ ...prev, reward_xp: val }));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 font-bold text-sm outline-none focus:border-orange-500 focus:bg-white transition-all shadow-sm"
                      placeholder="0"
                    />
                  </div>

                  {/* Tickets Reward Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      🎫 Билеты
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingQuest.reward_tickets || 0}
                      onChange={(e) => {
                        const val = Math.max(0, Math.floor(Number(e.target.value)));
                        setEditingQuest((prev: any) => ({ ...prev, reward_tickets: val }));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 font-bold text-sm outline-none focus:border-orange-500 focus:bg-white transition-all shadow-sm"
                      placeholder="0"
                    />
                  </div>

                  {/* Bonus Balance Reward Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      💰 Бонусные ₽
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingQuest.reward_bonus_balance || 0}
                      onChange={(e) => {
                        const val = Math.max(0, Math.floor(Number(e.target.value)));
                        setEditingQuest((prev: any) => ({ ...prev, reward_bonus_balance: val }));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 font-bold text-sm outline-none focus:border-orange-500 focus:bg-white transition-all shadow-sm"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingQuest.is_active}
                      onChange={(e) =>
                        setEditingQuest({
                          ...editingQuest,
                          is_active: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 accent-orange-500"
                    />
                    <span className="text-sm font-bold text-slate-700">
                      Активировать квест (сразу отобразится в приложении у гостей)
                    </span>
                  </label>
                </div>
              </div>

              {/* Form Action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setEditingQuest(null)}
                  className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-slate-200 hover:bg-slate-300/80 text-slate-600 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveQuest}
                  disabled={saving}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all text-xs shadow-lg shadow-orange-500/25 disabled:opacity-50 active:scale-[0.98]"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  СОХРАНИТЬ КВЕСТ
                </button>
              </div>
            </div>

            {/* Right Column: Real-time Smartphone Live Preview (Col span 5) */}
            <div className="lg:col-span-5 lg:sticky lg:top-8 flex flex-col items-center select-none pt-4 lg:pt-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-slate-400" /> ИНТЕРАКТИВНЫЙ LIVE ПРЕДПРОСМОТР
              </span>

              {/* Smartphone Chassis */}
              <div className="w-full max-w-[340px] aspect-[9/18.5] bg-slate-950 rounded-[3rem] p-3 shadow-2xl border-4 border-slate-800 relative overflow-hidden flex flex-col shrink-0 ring-4 ring-slate-900/5 transition-all">
                {/* Speaker ear piece & camera notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-b-2xl z-50 flex items-center justify-center gap-1.5">
                  <div className="w-12 h-0.5 bg-slate-800 rounded-full"></div>
                  <div className="w-2.5 h-2.5 bg-slate-900 rounded-full border border-slate-800"></div>
                </div>

                {/* Screen Container */}
                <div className="w-full h-full bg-[#0a0a0a] rounded-[2.2rem] overflow-hidden flex flex-col relative pt-6 text-white font-sans select-none">
                  {/* Status Bar */}
                  <div className="h-6 px-5 flex justify-between items-center text-[9px] font-black text-gray-500">
                    <span>20:45</span>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 21l7.03-3.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M17 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm1 9h2v-4h-2V9h3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-3v-1z"/></svg>
                    </div>
                  </div>

                  {/* App Header (Matches real PromoHeader) */}
                  <div className="px-4 py-2.5 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[7px] font-black text-orange-500 uppercase tracking-widest leading-none mb-0.5">Клуб</span>
                        <span className="text-[10px] font-black uppercase italic tracking-tight">Задания</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 px-1.5 py-1 rounded-lg">
                          <span className="text-[6px] font-black text-orange-500 uppercase tracking-widest">LVL</span>
                          <span className="text-[8px] font-black text-white">1</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-1.5 py-1 rounded-lg">
                          <Ticket className="w-2.5 h-2.5 text-orange-500" />
                          <span className="text-[8px] font-black">0</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Screen Content - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-3 pb-6 space-y-3 scrollbar-none">
                    {/* Section header (matches real page) */}
                    <div className="mb-1 px-1">
                      <h2 className="text-[10px] font-black uppercase italic tracking-tight mb-0.5">
                        Выполняй и <span className="text-orange-500">Зарабатывай</span>
                      </h2>
                      <p className="text-gray-400 text-[7px] font-medium leading-tight">
                        Покупай в баре или выполняй активности, чтобы получать бонусы и опыт.
                      </p>
                    </div>

                    {/* Quest Card (Exact match to real PWA card, scaled for phone) */}
                    <div className={cn(
                      "bg-white/5 border border-white/10 rounded-2xl p-3 relative overflow-hidden",
                      editingQuest.min_level > 1 ? "opacity-60" : ""
                    )}>
                      {/* Lock overlay (matches real PWA) */}
                      {editingQuest.min_level > 1 && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10 flex items-center justify-center">
                          <div className="bg-zinc-900/90 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xl">
                            <Lock className="w-3 h-3 text-orange-500" />
                            <span className="font-black uppercase italic tracking-tight text-[8px]">
                              Нужен {editingQuest.min_level} уровень
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-3">
                        <div className="flex-1">
                          {/* Title */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <h3 className="text-[11px] font-black uppercase italic tracking-tight leading-tight">
                              {editingQuest.title || "Название квеста"}
                            </h3>
                          </div>
                          <p className="text-gray-400 text-[8px] mb-2 leading-relaxed">
                            {editingQuest.description || "Описание задания для гостей клуба..."}
                          </p>

                          {/* Required service badge (matches real PWA) */}
                          {editingQuest.target_service_id && (
                            <div className="mb-2">
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest border bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse">
                                <Zap className="w-2.5 h-2.5" />
                                СНАЧАЛА КУПИ: {serviceRules.find(s => String(s.id) === String(editingQuest.target_service_id))?.name || "Пакет"}
                              </div>
                            </div>
                          )}

                          {/* Day/time badges (matches real PWA) */}
                          {(editingQuest.available_days || editingQuest.time_start) && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {editingQuest.available_days && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-md text-[7px] font-bold text-gray-400">
                                  <Calendar className="w-2.5 h-2.5 text-orange-500" />
                                  {editingQuest.available_days.length === 7
                                    ? "Ежедневно"
                                    : editingQuest.available_days
                                        .map((d: number) => DAYS.find((day) => day.id === d)?.label)
                                        .join(", ")}
                                </div>
                              )}
                              {editingQuest.time_start && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-md text-[7px] font-bold text-gray-400">
                                  <Clock className="w-2.5 h-2.5 text-orange-500" />
                                  {editingQuest.time_start.slice(0, 5)} - {editingQuest.time_end?.slice(0, 5)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Progress bar (non-manual, matches real PWA h-3 → h-2 scaled) */}
                          {editingQuest.trigger_type !== "manual_verification" && (
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[7px] font-black uppercase tracking-[0.2em] text-gray-500">
                                <span className="flex items-center gap-1">
                                  <div className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" />
                                  Прогресс
                                </span>
                                <span className="text-white/80">
                                  0 / {editingQuest.target_value || 1}{" "}
                                  {["receipt_total", "total_spent_accumulative", "balance_topup"].includes(editingQuest.trigger_type) ? "₽" : "шт."}
                                </span>
                              </div>
                              <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-white/5">
                                <div
                                  className="h-full rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                  style={{ width: "20%" }}
                                />
                              </div>
                              <span className="text-[7px] text-gray-500/85 italic block leading-snug pt-0.5">
                                {renderTargetExplanation(editingQuest, products, categories, serviceRules)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Rewards row (matches real PWA reward boxes) */}
                        <div className="flex flex-row gap-1.5 w-full">
                          {editingQuest.reward_xp > 0 && (
                            <div className="flex-1 bg-orange-500/10 border border-orange-500/20 p-2 rounded-xl flex flex-col items-center justify-center gap-0.5">
                              <span className="text-[10px] font-black text-orange-500 leading-none whitespace-nowrap">
                                +{editingQuest.reward_xp}
                              </span>
                              <span className="text-[6px] font-black text-orange-500/50 uppercase tracking-widest">
                                XP
                              </span>
                            </div>
                          )}
                          {editingQuest.reward_tickets > 0 && (
                            <div className="flex-1 bg-white/5 border border-white/10 p-2 rounded-xl flex flex-col items-center justify-center gap-0.5">
                              <div className="flex items-center gap-0.5 whitespace-nowrap">
                                <span className="text-[10px] font-black text-white leading-none">
                                  +{editingQuest.reward_tickets}
                                </span>
                                <Ticket className="w-2.5 h-2.5 text-orange-500" />
                              </div>
                              <span className="text-[6px] font-black text-gray-500 uppercase tracking-widest">
                                Билеты
                              </span>
                            </div>
                          )}
                          {editingQuest.reward_bonus_balance > 0 && (
                            <div className="flex-1 bg-white/5 border border-white/10 p-2 rounded-xl flex flex-col items-center justify-center gap-0.5">
                              <div className="flex items-center gap-0.5 whitespace-nowrap">
                                <span className="text-[10px] font-black text-yellow-500 leading-none">
                                  +{editingQuest.reward_bonus_balance} ₽
                                </span>
                                <Coins className="w-2.5 h-2.5 text-yellow-500" />
                              </div>
                              <span className="text-[6px] font-black text-gray-500 uppercase tracking-widest">
                                Бонусы
                              </span>
                            </div>
                          )}
                          {!(editingQuest.reward_xp > 0) && !(editingQuest.reward_tickets > 0) && !(editingQuest.reward_bonus_balance > 0) && (
                            <div className="flex-1 text-center py-2 text-gray-600 text-[7px] italic border border-dashed border-white/5 rounded-xl">
                              Без наград
                            </div>
                          )}
                        </div>

                        {/* Manual verification area (matches real PWA) */}
                        {editingQuest.trigger_type === "manual_verification" && (
                          <div className="border-t border-white/5 pt-3 space-y-2">
                            {editingQuest.action_button_text && (
                              <div className="flex items-center justify-center gap-1 w-full bg-white text-black py-2.5 rounded-xl font-black uppercase italic tracking-tight text-[8px]">
                                {editingQuest.action_button_text}
                                <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                              </div>
                            )}
                            {editingQuest.requires_photo_verification ? (
                              <div className="space-y-1.5">
                                <p className="text-[7px] font-black uppercase tracking-widest text-gray-500 text-center">
                                  Прикрепите скриншот
                                </p>
                                <div className="border-2 border-dashed border-white/10 rounded-xl p-3 flex flex-col items-center gap-1.5 bg-white/5">
                                  <span className="text-[7px] font-bold text-gray-400">📷 Нажмите, чтобы выбрать фото</span>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full bg-orange-500 text-white py-2.5 rounded-xl font-black uppercase italic tracking-tight text-[8px] text-center shadow-lg shadow-orange-500/20">
                                Я ВЫПОЛНИЛ ЗАДАНИЕ
                              </div>
                            )}
                          </div>
                        )}

                        {/* Auto-tracking footer for non-manual quests */}
                        {!["manual_verification", "visit_cumulative", "visit_streak"].includes(editingQuest.trigger_type) ? (
                          <div className="flex items-center justify-center gap-1.5 py-2 bg-white/3 border border-white/5 rounded-xl text-[7px] font-black uppercase tracking-wider text-gray-500">
                            <Zap className="w-2.5 h-2.5 text-orange-500/60" />
                            Отслеживается автоматически
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 py-2 bg-white/3 border border-white/5 rounded-xl text-[7px] font-black uppercase tracking-wider text-gray-500">
                            <CheckCircle className="w-2.5 h-2.5 text-orange-500/60" />
                            Требуется подтверждение админа
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Repeat badge (matches real PWA) */}
                    {editingQuest.reset_period && editingQuest.reset_period !== "none" && (
                      <div className="text-center py-1">
                        <span className="text-[7px] font-bold text-gray-500 italic">
                          {"🔄 "}
                          {editingQuest.reset_period === "daily" ? "Обновляется ежедневно" :
                            editingQuest.reset_period === "weekly" ? "Обновляется еженедельно" :
                            editingQuest.reset_period === "monthly" ? "Обновляется ежемесячно" :
                            editingQuest.reset_period === "hours" ? `Обновляется каждые ${editingQuest.reset_hours || 2}ч` :
                            editingQuest.reset_period === "always" ? "Всегда доступен" : ""}
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Loyalty & Quests view */
          <div className="space-y-8">
            {/* Loyalty settings panel */}
            {localSettings && (
              <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
                {/* Panel Header */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-800">
                        Программа лояльности <span className="text-amber-500">Dash Loyalty</span>
                      </h3>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                        Накопительные скидки, бесплатные часы и вознаграждение за посещения
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveLoyalty}
                    disabled={savingLoyalty}
                    className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-2xl font-bold transition-all text-xs tracking-wider uppercase italic shadow-md active:scale-[0.98] shrink-0"
                  >
                    {savingLoyalty ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 text-amber-400" />
                    )}
                    Сохранить настройки лояльности
                  </button>
                </div>

                <div className="space-y-5">
                    
                  {/* Dynamic Loyalty Programs List */}
                  {getLoyaltyPrograms().map((prog: any, idx: number) => (
                    <div key={prog.id || idx} className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-5">
                      {/* Program Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0", prog.enabled ? "bg-amber-500/10" : "bg-slate-200")}>
                            {LOYALTY_PROGRAM_TYPES.find((t: any) => t.id === prog.type)?.icon || "📦"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <select
                              value={prog.type || "package_accumulation"}
                              onChange={e => updateProgram(idx, { type: e.target.value })}
                              className="font-black uppercase italic text-sm text-slate-800 bg-transparent border-none outline-none cursor-pointer w-full"
                            >
                              {LOYALTY_PROGRAM_TYPES.map((t: any) => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                              ))}
                            </select>
                            <p className="text-[10px] text-slate-400 font-medium">{LOYALTY_PROGRAM_TYPES.find((t: any) => t.id === prog.type)?.desc}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateProgram(idx, { enabled: !prog.enabled })}
                            className={cn("w-12 h-6 rounded-full relative transition-colors duration-300", prog.enabled ? "bg-amber-500" : "bg-slate-300")}
                          >
                            <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm", prog.enabled ? "left-7" : "left-1")} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeProgram(idx)}
                            className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {prog.enabled && (
                        <div className="space-y-5 pt-4 border-t border-slate-200/40">

                          {/* Target & Title */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                                {prog.type === "visit_streak" ? "Дней подряд" : prog.type === "visit_accumulation" ? "Цель (посещений)" : "Цель (пакетов)"}
                              </label>
                              <input
                                type="number" min="1"
                                value={prog.target ?? 5}
                                onChange={e => updateProgram(idx, { target: parseInt(e.target.value) || 1 })}
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Название программы</label>
                              <input
                                type="text"
                                value={prog.title || ""}
                                onChange={e => updateProgram(idx, { title: e.target.value })}
                                placeholder="Напр. 6-я ночь в подарок"
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-xs font-bold focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
                              />
                            </div>
                          </div>

                          {/* Per-Program Service/Product Selection */}
                          {(products.length > 0 || serviceRules.length > 0) && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">Учитываемые услуги (оставьте пустым — все)</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {products.length > 0 && (
                                  <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">📦 Склад (время)</span>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                      {products.map((prod: any) => {
                                        const isChecked = (prog.trigger_product_ids || []).includes(Number(prod.id));
                                        return (
                                          <label key={prod.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input
                                              type="checkbox" checked={isChecked}
                                              onChange={() => {
                                                const ids = prog.trigger_product_ids || [];
                                                updateProgram(idx, { trigger_product_ids: isChecked ? ids.filter((id: number) => id !== Number(prod.id)) : [...ids, Number(prod.id)] });
                                              }}
                                              className="accent-amber-500 w-3.5 h-3.5"
                                            />
                                            <div className="min-w-0">
                                              <div className="text-[10px] font-bold text-slate-700 truncate">{prod.name}</div>
                                              <div className="text-[9px] text-slate-400">{prod.selling_price} ₽</div>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {serviceRules.length > 0 && (
                                  <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">💼 Пакеты времени</span>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                      {serviceRules.map((rule: any) => {
                                        const isChecked = (prog.trigger_service_ids || []).includes(String(rule.id));
                                        return (
                                          <label key={rule.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input
                                              type="checkbox" checked={isChecked}
                                              onChange={() => {
                                                const ids = prog.trigger_service_ids || [];
                                                updateProgram(idx, { trigger_service_ids: isChecked ? ids.filter((id: string) => id !== String(rule.id)) : [...ids, String(rule.id)] });
                                              }}
                                              className="accent-amber-500 w-3.5 h-3.5"
                                            />
                                            <div className="min-w-0">
                                              <div className="text-[10px] font-bold text-slate-700 truncate">{rule.name}</div>
                                              <div className="text-[9px] text-slate-400">+{rule.tickets} билетов</div>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Rewards Section */}
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">Награды за выполнение</label>

                            {/* XP / Tickets / Bonus in a row */}
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 space-y-1.5">
                                <span className="text-[9px] font-black uppercase tracking-widest text-orange-500">⚡ Опыт (XP)</span>
                                <input
                                  type="number" min="0"
                                  value={prog.rewards?.xp || 0}
                                  onChange={e => updateProgramRewards(idx, { xp: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-white border border-orange-100 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-200"
                                  placeholder="0"
                                />
                              </div>
                              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 space-y-1.5">
                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">🎫 Билеты</span>
                                <input
                                  type="number" min="0"
                                  value={prog.rewards?.tickets || 0}
                                  onChange={e => updateProgramRewards(idx, { tickets: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-white border border-blue-100 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-200"
                                  placeholder="0"
                                />
                              </div>
                              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 space-y-1.5">
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">💰 Бонус (₽)</span>
                                <input
                                  type="number" min="0"
                                  value={prog.rewards?.bonus_balance || 0}
                                  onChange={e => updateProgramRewards(idx, { bonus_balance: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-200"
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            {/* Free Package */}
                            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">📦 Бесплатный пакет (очередь выдачи)</span>
                                <button
                                  type="button"
                                  onClick={() => updateProgramRewards(idx, { free_package: !prog.rewards?.free_package })}
                                  className={cn("w-10 h-5 rounded-full relative transition-colors duration-200", prog.rewards?.free_package ? "bg-amber-500" : "bg-slate-200")}
                                >
                                  <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow-sm", prog.rewards?.free_package ? "left-5" : "left-0.5")} />
                                </button>
                              </div>
                              {prog.rewards?.free_package && (
                                <div className="space-y-3">
                                  <input
                                    type="text"
                                    value={prog.rewards?.free_package_name || ""}
                                    onChange={e => updateProgramRewards(idx, { free_package_name: e.target.value })}
                                    placeholder="Название приза (напр. 6-я ночь в подарок)"
                                    className="w-full bg-white border border-amber-200 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200"
                                  />
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-amber-600 ml-2">
                                      Количество (шт.)
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={prog.rewards?.free_package_quantity ?? 1}
                                      onChange={e => updateProgramRewards(idx, { free_package_quantity: parseInt(e.target.value) || 1 })}
                                      className="w-full bg-white border border-amber-200 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-200"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Bar Reward */}
                            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-widest text-purple-600">🍹 Подарок из бара</span>
                                <select
                                  value={prog.rewards?.bar_reward_type || "none"}
                                  onChange={e => updateProgramRewards(idx, { bar_reward_type: e.target.value })}
                                  className="text-[10px] font-bold bg-white border border-purple-100 rounded-lg px-2 py-1 outline-none"
                                >
                                  <option value="none">Нет</option>
                                  <option value="product">Конкретный продукт</option>
                                  <option value="category">Случайный из категории</option>
                                </select>
                              </div>
                              {prog.rewards?.bar_reward_type === "product" && (
                                <select
                                  value={prog.rewards?.bar_product_id || ""}
                                  onChange={e => updateProgramRewards(idx, { bar_product_id: Number(e.target.value) || null })}
                                  className="w-full bg-white border border-purple-100 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-200"
                                >
                                  <option value="">— Выберите продукт —</option>
                                  {products.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.selling_price} ₽)</option>
                                  ))}
                                </select>
                              )}
                              {prog.rewards?.bar_reward_type === "category" && (
                                <select
                                  value={prog.rewards?.bar_category_id || ""}
                                  onChange={e => updateProgramRewards(idx, { bar_category_id: e.target.value || null })}
                                  className="w-full bg-white border border-purple-100 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-200"
                                >
                                  <option value="">— Выберите категорию —</option>
                                  {categories.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              )}
                              {(prog.rewards?.bar_reward_type || "none") !== "none" && (
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-purple-600 ml-2">
                                    Количество (шт.)
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={prog.rewards?.bar_reward_quantity ?? 1}
                                    onChange={e => updateProgramRewards(idx, { bar_reward_quantity: parseInt(e.target.value) || 1 })}
                                    className="w-full bg-white border border-purple-100 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-200"
                                  />
                                </div>
                              )}
                              {(prog.rewards?.bar_reward_type || "none") !== "none" && (
                                <p className="text-[9px] text-purple-400 font-medium">Кассир видит уведомление с призом. Случайный выбор из наличия на момент выдачи.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Program Button */}
                  <button
                    type="button"
                    onClick={addProgram}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:border-amber-400 hover:text-amber-500 transition-all font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить программу лояльности
                  </button>
                </div>
              </div>
            )}

            {/* Quests list header */}
            <div className="flex items-center justify-between pt-6 pb-2 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Список активных квестов ({quests.length})</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quests.length === 0 && (
              <div className="col-span-2 text-center py-16 text-slate-400 font-medium italic border border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
                Нет созданных квестов. Нажмите кнопку «Создать квест» выше, чтобы начать.
              </div>
            )}
            {quests.map((quest) => (
              <div
                key={quest.id}
                className={cn(
                  "border rounded-[2rem] p-6 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group hover:shadow-xl hover:shadow-slate-100 hover:border-orange-500/30 hover:scale-[1.01]",
                  !quest.is_active ? "opacity-60 grayscale bg-slate-50 border-slate-200" : "bg-white border-slate-200"
                )}
              >
                {/* Glowing top line for active premium look */}
                {quest.is_active && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-amber-500"></div>
                )}

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-2xl shrink-0 border border-orange-100 bg-orange-50/50 flex items-center justify-center text-orange-500 font-bold shadow-sm">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <span className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-1 inline-block", quest.is_active ? "bg-orange-500/10 text-orange-600" : "bg-slate-200 text-slate-500")}>
                          {quest.is_active ? "активен" : "черновик"}
                        </span>
                        <h4 className="font-black italic text-lg leading-tight uppercase tracking-tight text-slate-800">
                          {quest.title}
                        </h4>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditingQuest(quest)}
                        className="p-2 text-slate-400 hover:text-orange-500 bg-slate-50 hover:bg-orange-50 rounded-xl transition-colors border border-slate-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuest(quest.id)}
                        className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-55 rounded-xl transition-colors border border-slate-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-slate-500 mb-5 leading-relaxed">
                    {quest.description}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Limitations badges & availability summary */}
                  {(quest.available_days || quest.time_start || quest.min_level > 1 || quest.target_service_id) && (
                    <div className="flex flex-wrap gap-1.5 pb-3 border-b border-slate-100">
                      {quest.min_level > 1 && (
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-[9px] font-bold text-slate-500">
                          <Lock className="w-3 h-3 text-orange-400" />
                          Lvl {quest.min_level}+
                        </div>
                      )}
                      {quest.available_days && (
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-[9px] font-bold text-slate-500">
                          <Calendar className="w-3 h-3 text-orange-400" />
                          {quest.available_days.length === 7
                            ? "Ежедневно"
                            : quest.available_days
                                .map((d: number) => DAYS.find((day) => day.id === d)?.label)
                                .join(", ")}
                        </div>
                      )}
                      {quest.time_start && (
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-[9px] font-bold text-slate-500">
                          <Clock className="w-3 h-3 text-orange-400" />
                          {quest.time_start.slice(0, 5)} - {quest.time_end?.slice(0, 5)}
                        </div>
                      )}
                      {quest.reset_period && quest.reset_period !== "none" && (
                        <div className="flex items-center gap-1 bg-emerald-50/50 border border-emerald-100 px-2 py-1 rounded-lg text-[9px] font-black text-emerald-600">
                          🔄 {
                            quest.reset_period === "always" ? "Всегда доступен" :
                            quest.reset_period === "daily" ? "Раз в день" :
                            quest.reset_period === "weekly" ? "Раз в неделю" :
                            quest.reset_period === "monthly" ? "Раз в месяц" :
                            `Каждые ${quest.reset_hours || 24} ч.`
                          }
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quest Stats */}
                  <div className="grid grid-cols-2 gap-2 pb-2">
                    <div className="bg-slate-50/50 border border-slate-100/50 p-2 rounded-xl text-center">
                      <div className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Сыграно раз (всего):</div>
                      <div className="text-xs font-black text-slate-800 italic">
                        {quest.total_plays_count ?? 0}
                      </div>
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100/50 p-2 rounded-xl text-center">
                      <div className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Участников (людей):</div>
                      <div className="text-xs font-black text-slate-800 italic">
                        {quest.total_players_count ?? 0}
                      </div>
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100/50 p-2 rounded-xl text-center">
                      <div className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Выполнен раз:</div>
                      <div className="text-xs font-black text-emerald-600 italic">
                        {quest.completed_count ?? 0}
                      </div>
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100/50 p-2 rounded-xl text-center">
                      <div className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Выполнили гостей:</div>
                      <div className="text-xs font-black text-emerald-600 italic">
                        {quest.unique_players_count ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* Rewards summary */}
                  <div className="bg-slate-50 border border-slate-100/50 p-3.5 rounded-2xl flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">НАГРАДЫ:</span>
                    <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                      {quest.reward_xp > 0 && (
                        <span className="text-orange-500 bg-white border border-orange-100 px-2.5 py-1 rounded-xl shadow-sm">
                          +{Math.floor(quest.reward_xp)} XP
                        </span>
                      )}
                      {quest.reward_tickets > 0 && (
                        <span className="text-blue-500 bg-white border border-blue-100 px-2.5 py-1 rounded-xl shadow-sm">
                          +{Math.floor(quest.reward_tickets)} БИЛ.
                        </span>
                      )}
                      {quest.reward_bonus_balance > 0 && (
                        <span className="text-emerald-600 bg-white border border-emerald-100 px-2.5 py-1 rounded-xl shadow-sm">
                          +{Math.floor(quest.reward_bonus_balance)} ₽
                        </span>
                      )}
                      {!(quest.reward_xp > 0) && !(quest.reward_tickets > 0) && !(quest.reward_bonus_balance > 0) && (
                        <span className="text-slate-400 italic text-[9px]">Без наград</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
