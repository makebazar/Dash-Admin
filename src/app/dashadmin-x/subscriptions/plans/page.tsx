"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  DollarSign,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Plan {
  id: number;
  code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_amount: number;
  price_per_extra_club: number;
  period_unit: string;
  period_value: number;
  grace_period_days: number;
  display_order: number;
  is_active: boolean;
  is_public: boolean;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Plan>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/dashadmin-x/subscription-plans");
      const data = await res.json();
      if (res.ok) {
        setPlans(data.plans);
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setEditForm(plan);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!editForm.id) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/dashadmin-x/subscription-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        await fetchPlans();
        setEditingId(null);
      }
    } catch (error) {
      console.error("Error saving plan:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const newPlan = {
        code: "new_plan_" + Date.now(),
        name: "Новый тариф",
        price_amount: 0,
        price_per_extra_club: 0,
        period_unit: "month",
        period_value: 1,
        grace_period_days: 7,
        is_active: true,
      };
      const res = await fetch("/api/dashadmin-x/subscription-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlan),
      });
      if (res.ok) {
        await fetchPlans();
        const data = await res.json();
        startEdit(data.plan);
      }
    } catch (error) {
      console.error("Error creating plan:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !window.confirm(
        "Вы уверены, что хотите полностью удалить этот тариф? Это действие необратимо.",
      )
    )
      return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/dashadmin-x/subscription-plans?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchPlans();
      }
    } catch (error) {
      console.error("Error deleting plan:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashadmin-x/subscriptions"
              className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl transition-all"
            >
              <ChevronLeft className="h-5 w-5 text-slate-500" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Тарифные планы
              </h1>
              <p className="text-slate-500 mt-1">
                Настройка стоимости и параметров подписки
              </p>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Создать тариф
          </button>
        </div>

        {/* Warning Callout */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-4">
          <div className="p-2 bg-amber-100 rounded-xl h-fit text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-900">
              Важное замечание
            </h4>
            <p className="text-sm text-amber-800 mt-1">
              Изменение цен не влияет на уже оплаченные подписки. Новые цены
              будут применены при следующем продлении или покупке. Скидка за
              второй клуб активируется автоматически, если у владельца есть
              другой активный клуб.
            </p>
          </div>
        </div>

        {/* Plans List */}
        <div className="grid grid-cols-1 gap-6">
          {isLoading ? (
            <div className="text-center py-20 text-slate-400 font-medium">
              Загрузка тарифов...
            </div>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  "bg-white rounded-2xl border transition-all overflow-hidden",
                  editingId === plan.id
                    ? "border-slate-900 shadow-lg ring-1 ring-slate-900"
                    : "border-slate-200 shadow-sm",
                )}
              >
                {editingId === plan.id ? (
                  // Edit Mode
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2 col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Название
                        </label>
                        <input
                          type="text"
                          value={editForm.name || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Код (slug)
                        </label>
                        <input
                          type="text"
                          value={editForm.code || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, code: e.target.value })
                          }
                          className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Приоритет
                        </label>
                        <input
                          type="number"
                          value={editForm.display_order || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              display_order: Number(e.target.value),
                            })
                          }
                          className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Цена за 1-й клуб
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="number"
                            value={editForm.price_amount || 0}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                price_amount: Number(e.target.value),
                              })
                            }
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-200 transition-all font-mono"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                          ЦЕНА ЗА СЛЕД. КЛУБЫ
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                          <input
                            type="number"
                            value={editForm.price_per_extra_club || 0}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                price_per_extra_club: Number(e.target.value),
                              })
                            }
                            className="w-full pl-10 pr-4 py-2 bg-emerald-50 text-emerald-900 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-200 transition-all font-mono"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Период
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editForm.period_value || 1}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                period_value: Number(e.target.value),
                              })
                            }
                            className="w-20 px-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                          />
                          <select
                            value={editForm.period_unit || "month"}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                period_unit: e.target.value,
                              })
                            }
                            className="flex-1 px-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                          >
                            <option value="month">Месяц</option>
                            <option value="year">Год</option>
                            <option value="day">День</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Grace Period (дней)
                        </label>
                        <input
                          type="number"
                          value={editForm.grace_period_days || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              grace_period_days: Number(e.target.value),
                            })
                          }
                          className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            setEditForm({
                              ...editForm,
                              is_active: !editForm.is_active,
                            })
                          }
                          className={cn(
                            "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                            editForm.is_active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {editForm.is_active
                            ? "Тариф активен"
                            : "Тариф выключен"}
                        </button>
                        <button
                          onClick={() =>
                            setEditForm({
                              ...editForm,
                              is_public: !editForm.is_public,
                            })
                          }
                          className={cn(
                            "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                            editForm.is_public
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700",
                          )}
                        >
                          {editForm.is_public ? "Публичный" : "Внутренний"}
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-all"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
                        >
                          {isSaving ? "Сохранение..." : "Сохранить изменения"}
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex gap-5 items-start">
                      <div className="p-3 bg-slate-100 rounded-2xl text-slate-600">
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-slate-900">
                            {plan.name}
                          </h3>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold tracking-widest uppercase">
                            {plan.code}
                          </span>
                          {!plan.is_active && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded text-[10px] font-bold uppercase">
                              Выключен
                            </span>
                          )}
                          <span
                            className={cn(
                              "px-2 py-0.5 border rounded text-[10px] font-bold uppercase",
                              plan.is_public
                                ? "bg-blue-50 text-blue-600 border-blue-100"
                                : "bg-orange-50 text-orange-600 border-orange-100",
                            )}
                          >
                            {plan.is_public ? "Публичный" : "Внутренний"}
                          </span>
                        </div>{" "}
                        <p className="text-sm text-slate-500 mt-1">
                          {plan.tagline || "Описание не задано"}
                        </p>
                        <div className="flex items-center gap-6 mt-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Цена (1-й клуб)
                            </span>
                            <span className="text-lg font-bold text-slate-900">
                              {plan.price_amount}₽
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                              Цена (след. клубы)
                            </span>
                            <span className="text-lg font-bold text-emerald-600">
                              {plan.price_per_extra_club}₽
                            </span>
                          </div>
                          <div className="flex flex-col border-l border-slate-100 pl-6">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Период
                            </span>
                            <span className="text-sm font-medium text-slate-700">
                              {plan.period_value}{" "}
                              {plan.period_unit === "month"
                                ? "мес."
                                : plan.period_unit === "year"
                                  ? "год"
                                  : "дн."}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => startEdit(plan)}
                        className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        disabled={isSaving}
                        className="p-2.5 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>{" "}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CreditCard({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}
