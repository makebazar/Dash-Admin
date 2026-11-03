"use client";

import React, { useState, useEffect } from "react";
import { Package, Plus, Trash2, Edit2, Check, AlertTriangle, HelpCircle, Save, X } from "lucide-react";

interface CaseItem {
  id?: number;
  name: string;
  description: string;
  reward_type: string;
  reward_value: number;
  bar_product_id: number | null;
  bar_category_id: number | null;
  club_service_id: number | null;
  image_url: string;
  weight: number;
  is_rare: boolean;
}

interface Case {
  id?: number;
  name: string;
  description: string;
  price_bonus: number;
  rtp: number;
  image_url: string;
  is_active: boolean;
  items?: CaseItem[];
}

interface CasesTabProps {
  clubId: string;
  products: any[];
  categories: any[];
  serviceRules: any[];
}

let casesCache: Record<string, Case[]> = {};

export function CasesTab({ clubId, products, categories, serviceRules }: CasesTabProps) {
  const cacheKey = String(clubId);
  const [cases, setCases] = useState<Case[]>(() => casesCache[cacheKey] || []);
  const [loading, setLoading] = useState(() => !casesCache[cacheKey]);
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  
  // Active drop items under editing
  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);

  useEffect(() => {
    fetchCases();
  }, [clubId]);

  const fetchCases = async () => {
    try {
      if (!casesCache[cacheKey]) {
        setLoading(true);
      }
      const res = await fetch(`/api/promo/admin/cases?clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        const loadedCases = data.cases || [];
        casesCache[cacheKey] = loadedCases;
        setCases(loadedCases);
      }
    } catch (err) {
      console.error("Failed to fetch cases:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCase = (c: Case) => {
    setEditingCase({ ...c });
    setCaseItems(c.items ? [...c.items] : []);
    setActiveCase(null);
  };

  const handleCreateCase = () => {
    setEditingCase({
      name: "",
      description: "",
      price_bonus: 100,
      rtp: 80,
      image_url: "",
      is_active: true,
    });
    setCaseItems([]);
    setActiveCase(null);
  };

  const handleSaveCase = async () => {
    if (!editingCase) return;
    if (!editingCase.name.trim()) {
      alert("Пожалуйста, введите название кейса");
      return;
    }

    const calculatedRtp = calculateRTP(editingCase.price_bonus, caseItems);

    try {
      const res = await fetch("/api/promo/admin/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingCase,
          clubId,
          rtp: calculatedRtp,
          items: caseItems,
        }),
      });

      if (res.ok) {
        setEditingCase(null);
        setCaseItems([]);
        fetchCases();
      } else {
        const data = await res.json();
        alert(`Ошибка при сохранении: ${data.error || "Неизвестная ошибка"}`);
      }
    } catch (err) {
      console.error("Save Case Error:", err);
      alert("Не удалось сохранить кейс");
    }
  };

  const handleDeleteCase = async (id: number) => {
    if (!confirm("Вы уверены, что хотите удалить этот кейс? Все инвентарные предметы этого кейса останутся у игроков, но новые кейсы больше нельзя будет купить.")) return;

    try {
      const res = await fetch(`/api/promo/admin/cases?id=${id}&clubId=${clubId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchCases();
        if (activeCase?.id === id) setActiveCase(null);
        if (editingCase?.id === id) setEditingCase(null);
      } else {
        alert("Не удалось удалить кейс");
      }
    } catch (err) {
      console.error("Delete Case Error:", err);
    }
  };

  const handleAddItem = () => {
    setCaseItems([
      ...caseItems,
      {
        name: "Новый предмет",
        description: "",
        reward_type: "bonus_standard",
        reward_value: 50,
        bar_product_id: null,
        bar_category_id: null,
        club_service_id: null,
        image_url: "",
        weight: 100,
        is_rare: false,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const next = [...caseItems];
    next.splice(index, 1);
    setCaseItems(next);
  };

  const handleItemChange = (index: number, field: keyof CaseItem, value: any) => {
    const next = [...caseItems];
    next[index] = {
      ...next[index],
      [field]: value,
    };
    
    // Auto-fill item name and values when selectors change
    if (field === "bar_product_id" && next[index].reward_type === "bar_item") {
      const prod = products.find((p) => p.id === parseInt(value));
      if (prod) {
        next[index].name = prod.name;
        next[index].reward_value = parseFloat(prod.price || 0);
      }
    }
    setCaseItems(next);
  };

  // RTP Calculation
  const calculateRTP = (price: number, itemsList: CaseItem[]) => {
    if (!price || price <= 0 || itemsList.length === 0) return 0;
    const totalWeight = itemsList.reduce((acc, item) => acc + (parseInt(item.weight as any) || 0), 0);
    if (totalWeight <= 0) return 0;

    const totalExpectedValue = itemsList.reduce((acc, item) => {
      const val = parseFloat(item.reward_value as any) || 0;
      const wt = parseInt(item.weight as any) || 0;
      return acc + val * wt;
    }, 0);

    return parseFloat(((totalExpectedValue / (price * totalWeight)) * 100).toFixed(2));
  };

  const currentRtp = editingCase ? calculateRTP(editingCase.price_bonus, caseItems) : 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Управление кейсами
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Настройка сундуков с призами за бонусы клуба
          </p>
        </div>

        {!editingCase && (
          <button
            onClick={handleCreateCase}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Создать кейс
          </button>
        )}
      </div>

      {editingCase ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {editingCase.id ? "Редактирование" : "Создание"} кейса
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingCase(null)}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium text-xs transition cursor-pointer"
              >
                <X className="w-4 h-4" />
                Отмена
              </button>
              <button
                onClick={handleSaveCase}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium text-xs transition shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4 md:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Название кейса</label>
                  <input
                    type="text"
                    value={editingCase.name || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, name: e.target.value })}
                    placeholder="Например: Бронзовый сундук"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Цена открытия (в бонусах)</label>
                  <input
                    type="number"
                    value={editingCase.price_bonus === null || editingCase.price_bonus === undefined ? "" : editingCase.price_bonus}
                    onChange={(e) => setEditingCase({ ...editingCase, price_bonus: parseFloat(e.target.value) || 0 })}
                    placeholder="100"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Описание</label>
                <textarea
                  value={editingCase.description || ""}
                  onChange={(e) => setEditingCase({ ...editingCase, description: e.target.value })}
                  placeholder="Опишите, какие призы содержатся внутри..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Ссылка на изображение</label>
                  <input
                    type="text"
                    value={editingCase.image_url || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, image_url: e.target.value })}
                    placeholder="https://example.com/case.png (или пусто для дефолта)"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                  />
                </div>

                <div className="flex items-center h-full pt-4">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingCase.is_active}
                      onChange={(e) => setEditingCase({ ...editingCase, is_active: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm font-medium text-slate-700">Активен (виден игрокам)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* RTP Badge box */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  Ожидаемый RTP Кейса
                  <span className="cursor-help" title="Ожидаемая отдача кейса в процентах на основе ценностей призов и их весов.">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  </span>
                </h4>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className={`text-3xl font-bold tracking-tight ${
                    currentRtp > 100 ? "text-rose-600" : currentRtp < 50 ? "text-amber-600" : "text-emerald-600"
                  }`}>
                    {currentRtp}%
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Показывает отношение средней стоимости выигрыша к стоимости открытия кейса.
                </p>
              </div>

              {currentRtp > 100 && (
                <div className="mt-4 flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-xl p-3 text-rose-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Внимание:</span> RTP превышает 100%! Игрок будет выигрывать больше, чем тратит.
                  </div>
                </div>
              )}
              {currentRtp < 50 && currentRtp > 0 && (
                <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-amber-800 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Внимание:</span> RTP ниже 50%. Игрокам может быть неинтересно открывать этот кейс из-за низкой окупаемости.
                  </div>
                </div>
              )}
              {currentRtp >= 50 && currentRtp <= 100 && (
                <div className="mt-4 flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-emerald-800 text-xs">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    Оптимальный уровень RTP. Настройки сбалансированы.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DROP ITEMS EDITOR */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Настройка содержимого (Дроп-лист)</h4>
                <p className="text-slate-500 text-xs mt-0.5">
                  Список предметов, которые могут выпасть, и их вероятности
                </p>
              </div>
              <button
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium text-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Добавить предмет
              </button>
            </div>

            {caseItems.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl py-8 flex flex-col items-center justify-center text-slate-400 text-xs">
                Дроп-лист пуст. Добавьте предметы, чтобы игрокам было что выигрывать.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {caseItems.map((item, index) => (
                  <div
                    key={index}
                    className={`border rounded-xl p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end transition ${
                      item.is_rare ? "bg-amber-50/30 border-amber-200" : "bg-slate-50/70 border-slate-200/80"
                    }`}
                  >
                    {/* Item Name */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Название приза</label>
                      <input
                        type="text"
                        value={item.name || ""}
                        onChange={(e) => handleItemChange(index, "name", e.target.value)}
                        placeholder="Coca-Cola 0.5"
                        disabled={item.reward_type === "bar_item" || (item.reward_type === "club_service" && item.club_service_id !== null)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-500 font-medium bg-white"
                      />
                    </div>

                    {/* Reward Type */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Тип награды</label>
                      <select
                        value={item.reward_type || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleItemChange(index, "reward_type", val);
                          // Reset selectors
                          handleItemChange(index, "bar_product_id", null);
                          handleItemChange(index, "bar_category_id", null);
                          handleItemChange(index, "club_service_id", null);
                          handleItemChange(index, "reward_value", 0);
                        }}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                      >
                        <option value="bonus_limitless">Безлимитный вывод (₽)</option>
                        <option value="bonus_standard">Бонусы (с лимитом) (₽)</option>
                        <option value="club_service">Услуга</option>
                        <option value="withdraw_boost">Буст процента вывода (%)</option>
                        <option value="ticket">Билет</option>
                        <option value="custom">Произвольный приз (название)</option>
                      </select>
                    </div>

                    {/* Service picker if service item */}
                    {item.reward_type === "club_service" && (
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600">Услуга клуба</label>
                        <select
                          value={item.club_service_id || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "custom" || val === "") {
                              handleItemChange(index, "club_service_id", null);
                              handleItemChange(index, "name", "");
                              handleItemChange(index, "reward_value", 0);
                            } else {
                              const serviceId = parseInt(val);
                              const service = serviceRules.find(s => s.id === serviceId);
                              if (service) {
                                handleItemChange(index, "club_service_id", serviceId);
                                handleItemChange(index, "name", service.name);
                                handleItemChange(index, "reward_value", parseFloat(service.price || 0));
                              }
                            }
                          }}
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                        >
                          <option value="custom">-- Произвольная услуга --</option>
                          {serviceRules.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Custom value inputs for non-specific items */}
                    {item.reward_type !== "bar_item" && (
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600">
                          {item.reward_type === "club_service" && "Ценность (₽)"}
                          {item.reward_type === "bonus_limitless" && "Бонусы безлимит (₽)"}
                          {item.reward_type === "bonus_standard" && "Бонусы клуба (₽)"}
                          {item.reward_type === "withdraw_boost" && "Буст (%)"}
                          {item.reward_type === "ticket" && "Билеты (шт)"}
                          {item.reward_type === "custom" && "Ценность (₽)"}
                        </label>
                        <input
                          type="number"
                          value={item.reward_value === null || item.reward_value === undefined ? "" : item.reward_value}
                          onChange={(e) => handleItemChange(index, "reward_value", parseFloat(e.target.value) || 0)}
                          placeholder="Ценность"
                          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                        />
                      </div>
                    )}

                    {/* Weight (Probability) */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        Вес выпадения
                        <span className="cursor-help" title="Чем выше вес, тем чаще выпадает этот предмет. Вероятность = Вес / Сумма весов">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        </span>
                      </label>
                      <input
                        type="number"
                        value={item.weight === null || item.weight === undefined ? "" : item.weight}
                        onChange={(e) => handleItemChange(index, "weight", parseInt(e.target.value) || 0)}
                        placeholder="100"
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white"
                      />
                    </div>

                    {/* Rare checkbox */}
                    <div className="md:col-span-2 flex items-center pb-2 px-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.is_rare}
                          onChange={(e) => handleItemChange(index, "is_rare", e.target.checked)}
                          className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                        <span className="text-xs font-medium text-slate-700">Редкий</span>
                      </label>
                    </div>

                    {/* Delete Item */}
                    <div className="md:col-span-1 flex justify-end pb-1">
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Удалить предмет"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cases.map((c) => {
            const calculatedRtp = calculateRTP(c.price_bonus, c.items || []);
            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:border-slate-300 transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 leading-tight">{c.name}</h3>
                      <span className="inline-block mt-1 text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md">
                        Цена: {c.price_bonus} ₽
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        c.is_active
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {c.is_active ? "Активен" : "Отключен"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 font-normal line-clamp-2 leading-relaxed">
                    {c.description || "Описание отсутствует."}
                  </p>

                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Наград внутри:</span>
                      <span className="font-semibold text-slate-800">
                        {c.items?.length || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                      <span>Ожидаемый RTP:</span>
                      <span className={`font-semibold ${
                        calculatedRtp > 100 ? "text-rose-600" : "text-emerald-600"
                      }`}>
                        {calculatedRtp}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5">
                  <button
                    onClick={() => handleEditCase(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-medium text-xs transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Настроить
                  </button>
                  <button
                    onClick={() => c.id && handleDeleteCase(c.id)}
                    className="py-2 px-3 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 hover:text-rose-600 text-slate-400 rounded-xl transition cursor-pointer"
                    title="Удалить кейс"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {cases.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400">
              <p className="font-semibold text-sm text-slate-700">Нет настроенных кейсов</p>
              <p className="text-xs mt-1 text-slate-400">Нажмите кнопку сверху, чтобы создать свой первый кейс.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
