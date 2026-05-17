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

export function QuestsTab({
  clubId,
  products,
  categories,
  serviceRules,
}: {
  clubId: string;
  products: any[];
  categories: any[];
  serviceRules: any[];
}) {
  const [quests, setQuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingQuest, setEditingQuest] = useState<any | null>(null);

  useEffect(() => {
    fetchQuests();
  }, [clubId]);

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
      reset_period: "none",
      min_level: 1,
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
    <div className="space-y-6 max-w-5xl">
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-xl uppercase italic tracking-tight flex items-center gap-3">
              <Target className="w-6 h-6 text-orange-500" />
              Конструктор <span className="text-orange-500">Квестов</span>
            </h3>
            <p className="text-slate-500 text-sm font-medium mt-1">
              Создавайте автоматические задания для гостей. Квесты могут
              проверять покупки в баре или покупку пакетов времени.
            </p>
          </div>
          <button
            onClick={openNewQuest}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold transition-all text-sm shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" />
            СОЗДАТЬ КВЕСТ
          </button>
        </div>

        {editingQuest ? (
          <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-lg uppercase italic">
                {editingQuest.id ? "Редактирование квеста" : "Новый квест"}
              </h4>
              <button
                onClick={() => setEditingQuest(null)}
                className="p-2 hover:bg-slate-200 rounded-full"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Название
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
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                    placeholder="Напр. Бодрость на всю ночь"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Описание
                  </label>
                  <textarea
                    value={editingQuest.description}
                    onChange={(e) =>
                      setEditingQuest({
                        ...editingQuest,
                        description: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500 min-h-20"
                    placeholder="Купи 2 Red Bull и получи..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Тип Триггера
                  </label>
                  <select
                    value={editingQuest.trigger_type}
                    onChange={(e) =>
                      setEditingQuest({
                        ...editingQuest,
                        trigger_type: e.target.value,
                        target_entity_id: "",
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                  >
                    <option value="receipt_item">
                      Покупка товаров / услуг в баре
                    </option>{" "}
                    <option value="receipt_total">
                      Сумма чека в баре больше чем
                    </option>
                    <option value="service_award">
                      Покупка услуги/пакета админом
                    </option>
                    <option value="manual_verification">
                      Ручное подтверждение (отзыв, подписка)
                    </option>
                    <option value="game_play_count">
                      Количество сыгранных игр
                    </option>
                    <option value="game_win_count">Количество выигрышей</option>
                    <option value="ticket_spend">Трата билетов</option>
                    <option value="total_spent_accumulative">
                      Накопительная сумма трат в баре
                    </option>
                    <option value="service_accumulative">
                      Накопительная покупка услуги
                    </option>
                    <option value="balance_topup">Пополнение баланса</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Периодичность сброса
                  </label>
                  <select
                    value={editingQuest.reset_period || "none"}
                    onChange={(e) =>
                      setEditingQuest({
                        ...editingQuest,
                        reset_period: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                  >
                    <option value="none">Без сброса (Разовый)</option>
                    <option value="weekly">Еженедельно</option>
                    <option value="monthly">Ежемесячно</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Дополнительное условие: купленная услуга
                  </label>
                  <select
                    value={editingQuest.target_service_id || ""}
                    onChange={(e) =>
                      setEditingQuest({
                        ...editingQuest,
                        target_service_id: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                  >
                    <option value="">-- Не требуется --</option>
                    {serviceRules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-400 mt-1 italic px-2">
                    * Квест сработает только если у игрока сегодня куплена эта
                    услуга (пакет времени).
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Минимальный уровень
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
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                  />
                  <p className="text-[10px] text-slate-400 font-medium px-2 mt-1 italic">
                    Квест будет виден гостям только с этого уровня.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    {editingQuest.trigger_type === "receipt_item" &&
                    (editingQuest.target_entity_id || "").includes(",")
                      ? "Сколько КОМПЛЕКТОВ нужно купить?"
                      : [
                            "receipt_total",
                            "total_spent_accumulative",
                            "balance_topup",
                          ].includes(editingQuest.trigger_type)
                        ? "Сумма (₽)"
                        : "Количество"}
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={Math.floor(Number(editingQuest.target_value || 0))}
                    onChange={(e) =>
                      setEditingQuest({
                        ...editingQuest,
                        target_value: Math.floor(Number(e.target.value)),
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                  />
                  {editingQuest.trigger_type === "receipt_item" &&
                    (editingQuest.target_entity_id || "").includes(",") && (
                      <p className="text-[9px] text-slate-400 mt-2 italic px-2">
                        * Например, если нужно купить 2 набора "Кола + Чипсы",
                        укажите здесь 2.
                      </p>
                    )}
                </div>

                {editingQuest.trigger_type === "manual_verification" && (
                  <div className="space-y-4 bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                        Текст на кнопке (напр. Оставить отзыв)
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
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                        placeholder="Оставить отзыв"
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
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                        placeholder="https://yandex.ru/maps/..."
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingQuest.requires_photo_verification}
                        onChange={(e) =>
                          setEditingQuest({
                            ...editingQuest,
                            requires_photo_verification: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-orange-500"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        Требуется фото-подтверждение
                      </span>
                    </label>
                  </div>
                )}

                <div className="space-y-4 bg-slate-100/50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                      <Calendar className="w-3 h-3" /> Дни доступности
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day) => {
                        const isSelected = (
                          editingQuest.available_days || []
                        ).includes(day.id);
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
                              "w-9 h-9 rounded-xl text-[10px] font-black transition-all border shadow-sm",
                              isSelected
                                ? "bg-orange-500 border-orange-600 text-white"
                                : "bg-white border-slate-200 text-slate-600 hover:border-orange-500",
                            )}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                        <Clock className="w-3 h-3" /> Начало
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
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                        <Clock className="w-3 h-3" /> Конец
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
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>

                {editingQuest.trigger_type === "receipt_item" && (
                  <div className="space-y-4 bg-white/50 p-4 rounded-2xl border border-slate-100">
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
                            (editingQuest.target_entity_id_type ||
                              "product") === "product"
                              ? "bg-slate-900 border-slate-900 text-white"
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
                              ? "bg-slate-900 border-slate-900 text-white"
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
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                        >
                          <option value="">-- Выберите категорию --</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.products_count} тов.)
                            </option>
                          ))}
                        </select>
                        <p className="text-[9px] text-slate-400 mt-2 italic">
                          * Система будет автоматически выбирать доступный товар
                          из этой категории для отображения гостю.
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
                                      const current = (
                                        editingQuest.target_entity_id || ""
                                      )
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
                            const current = (
                              editingQuest.target_entity_id || ""
                            )
                              .split(",")
                              .filter(Boolean);
                            if (!current.includes(e.target.value)) {
                              setEditingQuest({
                                ...editingQuest,
                                target_entity_id: [
                                  ...current,
                                  e.target.value,
                                ].join(","),
                              });
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                        >
                          <option value="">-- Добавить товар --</option>
                          {products.map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              disabled={(
                                editingQuest.target_entity_id || ""
                              ).includes(String(p.id))}
                            >
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
                {["service_award", "service_accumulative"].includes(
                  editingQuest.trigger_type,
                ) && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Услуги (выберите одну или несколько)
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
                                  const current = (
                                    editingQuest.target_entity_id || ""
                                  )
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
                            target_entity_id: [...current, e.target.value].join(
                              ",",
                            ),
                          });
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-orange-500"
                    >
                      <option value="">-- Добавить услугу --</option>
                      {serviceRules.map((s) => (
                        <option
                          key={s.id}
                          value={s.id}
                          disabled={(
                            editingQuest.target_entity_id || ""
                          ).includes(String(s.id))}
                        >
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-slate-400 mt-2 italic">
                      * Оставьте пустым, чтобы квест срабатывал на любые услуги.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-2">
                    Награды
                  </h4>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                      XP (Опыт)
                    </label>
                    <input
                      type="number"
                      value={editingQuest.reward_xp}
                      onChange={(e) =>
                        setEditingQuest({
                          ...editingQuest,
                          reward_xp: Math.floor(Number(e.target.value)),
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 p-2"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                      Билеты
                    </label>
                    <input
                      type="number"
                      value={editingQuest.reward_tickets}
                      onChange={(e) =>
                        setEditingQuest({
                          ...editingQuest,
                          reward_tickets: Math.floor(Number(e.target.value)),
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 p-2"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                      Бонусные рубли
                    </label>
                    <input
                      type="number"
                      value={Math.floor(editingQuest.reward_bonus_balance)}
                      onChange={(e) =>
                        setEditingQuest({
                          ...editingQuest,
                          reward_bonus_balance: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 p-2"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingQuest.is_active}
                    onChange={(e) =>
                      setEditingQuest({
                        ...editingQuest,
                        is_active: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm font-bold text-slate-700">
                    Квест активен
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSaveQuest}
                disabled={saving}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all text-sm shadow-lg shadow-orange-500/20 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                СОХРАНИТЬ
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quests.length === 0 && (
              <div className="col-span-2 text-center py-10 text-slate-400 font-medium italic">
                Нет активных квестов
              </div>
            )}
            {quests.map((quest) => (
              <div
                key={quest.id}
                className={`border border-slate-200 rounded-3xl p-5 flex flex-col ${!quest.is_active ? "opacity-50 grayscale" : "bg-white"}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-black italic text-lg leading-tight">
                    {quest.title}
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingQuest(quest)}
                      className="p-1.5 text-slate-400 hover:text-orange-500 bg-slate-50 hover:bg-orange-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuest(quest.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-4 flex-1">
                  {quest.description}
                </p>

                {(quest.available_days || quest.time_start) && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {quest.available_days && (
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-[9px] font-bold text-slate-400">
                        <Calendar className="w-3 h-3 text-orange-400" />
                        {quest.available_days.length === 7
                          ? "Ежедневно"
                          : quest.available_days
                              .map(
                                (d: number) =>
                                  DAYS.find((day) => day.id === d)?.label,
                              )
                              .join(", ")}
                      </div>
                    )}
                    {quest.time_start && (
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg text-[9px] font-bold text-slate-400">
                        <Clock className="w-3 h-3 text-orange-400" />
                        {quest.time_start.slice(0, 5)} -{" "}
                        {quest.time_end?.slice(0, 5)}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-slate-50 p-3 rounded-xl flex gap-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  {quest.reward_xp > 0 && (
                    <span className="text-orange-500">
                      +{Math.floor(quest.reward_xp)} XP
                    </span>
                  )}
                  {quest.reward_tickets > 0 && (
                    <span className="text-blue-500">
                      +{Math.floor(quest.reward_tickets)} БИЛ.
                    </span>
                  )}
                  {quest.reward_bonus_balance > 0 && (
                    <span className="text-yellow-600">
                      +{Math.floor(quest.reward_bonus_balance)} ₽
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
