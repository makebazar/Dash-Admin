"use client";

import React, { useState, useEffect } from "react";
import { Package, Plus, Trash2, Edit2, Check, AlertTriangle, HelpCircle, Save, X } from "lucide-react";
import { motion } from "framer-motion";

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

export function CasesTab({ clubId, products, categories, serviceRules }: CasesTabProps) {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  
  // Active drop items under editing
  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);

  useEffect(() => {
    fetchCases();
  }, [clubId]);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/promo/admin/cases?clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
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
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black italic uppercase tracking-tight">
            Управление <span className="text-orange-500">Кейсами</span>
          </h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
            Настройка сундуков с призами за бонусы клуба
          </p>
        </div>

        {!editingCase && (
          <button
            onClick={handleCreateCase}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic text-xs tracking-wider px-5 py-3 rounded-2xl transition-all shadow-md shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" />
            Создать кейс
          </button>
        )}
      </div>

      {editingCase ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black uppercase italic">
              {editingCase.id ? "Редактирование" : "Создание"} кейса
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingCase(null)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl font-bold uppercase text-xs transition"
              >
                <X className="w-4 h-4" />
                Отмена
              </button>
              <button
                onClick={handleSaveCase}
                className="flex items-center gap-1.5 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase italic text-xs transition shadow-md shadow-orange-500/10"
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
                  <label className="text-[10px] font-black uppercase text-slate-400">Название кейса</label>
                  <input
                    type="text"
                    value={editingCase.name || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, name: e.target.value })}
                    placeholder="Например: Бронзовый сундук"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Цена открытия (в бонусах)</label>
                  <input
                    type="number"
                    value={editingCase.price_bonus === null || editingCase.price_bonus === undefined ? "" : editingCase.price_bonus}
                    onChange={(e) => setEditingCase({ ...editingCase, price_bonus: parseFloat(e.target.value) || 0 })}
                    placeholder="100"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Описание</label>
                <textarea
                  value={editingCase.description || ""}
                  onChange={(e) => setEditingCase({ ...editingCase, description: e.target.value })}
                  placeholder="Опишите, какие призы содержатся внутри..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Ссылка на изображение</label>
                  <input
                    type="text"
                    value={editingCase.image_url || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, image_url: e.target.value })}
                    placeholder="https://example.com/case.png (или пусто для дефолта)"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex items-center h-full pt-5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingCase.is_active}
                      onChange={(e) => setEditingCase({ ...editingCase, is_active: e.target.checked })}
                      className="w-5 h-5 rounded-lg border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-slate-700">Активен (виден игрокам)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* RTP Badge box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
                  Ожидаемый RTP Кейса
                  <span className="cursor-help" title="Ожидаемая отдача кейса в процентах на основе ценностей призов и их весов.">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-300" />
                  </span>
                </h4>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className={`text-4xl font-black italic ${
                    currentRtp > 100 ? "text-red-500" : currentRtp < 50 ? "text-yellow-600" : "text-emerald-600"
                  }`}>
                    {currentRtp}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  Показывает отношение средней стоимости выигрыша к стоимости открытия кейса.
                </p>
              </div>

              {currentRtp > 100 && (
                <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-red-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Внимание:</span> RTP превышает 100%! Игрок будет выигрывать больше, чем тратит. Клуб будет нести убытки.
                  </div>
                </div>
              )}
              {currentRtp < 50 && currentRtp > 0 && (
                <div className="mt-4 flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-yellow-800 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Внимание:</span> RTP ниже 50%. Игрокам может быть неинтересно открывать этот кейс из-за низкой окупаемости.
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
                <h4 className="text-sm font-black uppercase italic">Настройка содержимого (Дроп-лист)</h4>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  Список предметов, которые могут выпасть, и их вероятности
                </p>
              </div>
              <button
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-4 py-2 border border-orange-500 hover:bg-orange-50 text-orange-500 rounded-xl font-bold uppercase text-xs transition"
              >
                <Plus className="w-4 h-4" />
                Добавить предмет
              </button>
            </div>

            {caseItems.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl py-10 flex flex-col items-center justify-center text-slate-400 text-sm">
                <Package className="w-10 h-10 text-slate-300 mb-2" />
                Дроп-лист пуст. Добавьте предметы, чтобы игрокам было что выигрывать.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {caseItems.map((item, index) => (
                  <div
                    key={index}
                    className={`border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-end transition ${
                      item.is_rare ? "bg-orange-50/30 border-orange-200" : "bg-white border-slate-200"
                    }`}
                  >
                    {/* Item Name */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Название приза</label>
                      <input
                        type="text"
                        value={item.name || ""}
                        onChange={(e) => handleItemChange(index, "name", e.target.value)}
                        placeholder="Coca-Cola 0.5"
                        disabled={item.reward_type === "bar_item" || (item.reward_type === "club_service" && item.club_service_id !== null)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500 disabled:bg-slate-50 disabled:text-slate-500 font-medium"
                      />
                    </div>

                    {/* Reward Type */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Тип награды</label>
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
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500 bg-white"
                      >
                        <option value="bonus_limitless">Безлимитный вывод (₽)</option>
                        <option value="bonus_standard">Бонусы (с лимитом) (₽)</option>
                        {/* <option value="bar_item">Товар из Бара (определенный)</option>
                        <option value="bar_category">Случайный товар из категории</option> */}
                        <option value="club_service">Услуга</option>
                        <option value="withdraw_boost">Буст процента вывода (%)</option>
                        <option value="bp_xp">Опыт (XP)</option>
                        <option value="ticket">Билет</option>
                        <option value="custom">Произвольный приз (название)</option>
                      </select>
                    </div>

                    {/* Product picker if bar item */}
                    {item.reward_type === "bar_item" && (
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Товар склада</label>
                        <select
                          value={item.bar_product_id || ""}
                          onChange={(e) => handleItemChange(index, "bar_product_id", e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500 bg-white"
                        >
                          <option value="">-- Выбрать товар --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.price} ₽)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Category picker if bar category */}
                    {item.reward_type === "bar_category" && (
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Категория товаров</label>
                        <select
                          value={item.bar_category_id || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleItemChange(index, "bar_category_id", val ? parseInt(val) : null);
                            const cat = categories.find(c => String(c.id) === String(val));
                            if (cat) {
                              handleItemChange(index, "name", `Рандом: ${cat.name}`);
                            }
                          }}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500 bg-white"
                        >
                          <option value="">-- Выбрать категорию --</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Service picker if service item */}
                    {item.reward_type === "club_service" && (
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Услуга клуба</label>
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
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500 bg-white"
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
                        <label className="text-[10px] font-black uppercase text-slate-400">
                          {item.reward_type === "bar_category" && "Примерная ценность (₽)"}
                          {item.reward_type === "club_service" && "Примерная ценность (₽)"}
                          {item.reward_type === "bonus_limitless" && "Бонусы безлимит (₽)"}
                          {item.reward_type === "bonus_standard" && "Бонусы клуба (₽)"}
                          {item.reward_type === "withdraw_boost" && "Процент буста (%)"}
                          {item.reward_type === "bp_xp" && "Количество XP"}
                          {item.reward_type === "ticket" && "Билеты (шт)"}
                          {item.reward_type === "custom" && "Ценность (₽ / XP)"}
                        </label>
                        <input
                          type="number"
                          value={item.reward_value === null || item.reward_value === undefined ? "" : item.reward_value}
                          onChange={(e) => handleItemChange(index, "reward_value", parseFloat(e.target.value) || 0)}
                          placeholder="Ценность"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    )}

                    {/* Weight (Probability) */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                        Вес выпадения
                        <span className="cursor-help" title="Чем выше вес, тем чаще выпадает этот предмет. Вероятность = Вес / Сумма весов">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-300" />
                        </span>
                      </label>
                      <input
                        type="number"
                        value={item.weight === null || item.weight === undefined ? "" : item.weight}
                        onChange={(e) => handleItemChange(index, "weight", parseInt(e.target.value) || 0)}
                        placeholder="100"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    {/* Rare checkbox */}
                    <div className="md:col-span-2 flex items-center pb-2 px-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.is_rare}
                          onChange={(e) => handleItemChange(index, "is_rare", e.target.checked)}
                          className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-700">Редкий</span>
                      </label>
                    </div>

                    {/* Delete Item */}
                    <div className="md:col-span-1 flex justify-end pb-1.5">
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 rounded-xl text-slate-400 transition"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((c) => {
            const calculatedRtp = calculateRTP(c.price_bonus, c.items || []);
            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-black uppercase italic text-base leading-tight">{c.name}</h3>
                      <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">
                        Цена: {c.price_bonus} ₽
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                        c.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {c.is_active ? "Активен" : "Отключен"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-medium line-clamp-2 leading-relaxed">
                    {c.description || "Описание отсутствует."}
                  </p>

                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Наград внутри:</span>
                      <span className="font-bold text-slate-800">
                        {c.items?.length || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                      <span>Ожидаемый RTP:</span>
                      <span className={`font-bold ${
                        calculatedRtp > 100 ? "text-red-500" : "text-emerald-600"
                      }`}>
                        {calculatedRtp}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-5">
                  <button
                    onClick={() => handleEditCase(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold uppercase text-xs transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Настроить
                  </button>
                  <button
                    onClick={() => c.id && handleDeleteCase(c.id)}
                    className="py-2.5 px-3 hover:bg-red-50 border border-slate-200 hover:border-red-200 hover:text-red-500 text-slate-400 rounded-xl transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {cases.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-3xl text-slate-400">
              <Package className="w-12 h-12 text-slate-300 mb-2" />
              <p className="font-bold text-sm uppercase">Нет настроенных кейсов</p>
              <p className="text-xs mt-1">Нажмите кнопку сверху, чтобы создать свой первый кейс.</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
