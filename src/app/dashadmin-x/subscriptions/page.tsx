"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Settings2,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Subscription {
  id: number;
  club_id: number;
  club_name: string;
  owner_id: string;
  full_name: string;
  phone_number: string;
  created_at: string;
  employees_count: number;
  subscription_plan: string;
  subscription_status: string;
  subscription_started_at: string;
  subscription_ends_at: string;
  subscription_is_active: boolean;
  is_in_grace_period: boolean;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"subscriptions" | "payments">("subscriptions");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch("/api/dashadmin-x/subscriptions");
      const data = await res.json();
      if (res.ok) {
        setSubscriptions(data.subscriptions);
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch =
      sub.club_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.phone_number.includes(searchQuery);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && sub.subscription_is_active) ||
      (statusFilter === "expired" && !sub.subscription_is_active) ||
      (statusFilter === "trial" && sub.subscription_status === "trialing");

    return matchesSearch && matchesStatus;
  });

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      (order.club_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.owner_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.owner_phone || "").includes(searchQuery) ||
      (order.plan_code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toString().includes(searchQuery);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && order.status === "paid") ||
      (statusFilter === "trial" && order.status === "pending") ||
      (statusFilter === "expired" && order.status === "failed");

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (sub: Subscription) => {
    if (sub.subscription_status === "trialing") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
          <Clock className="h-3 w-3" />
          Триал
        </span>
      );
    }
    if (sub.subscription_is_active) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
          <CheckCircle2 className="h-3 w-3" />
          Активна
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">
        <XCircle className="h-3 w-3" />
        Истекла
      </span>
    );
  };

  return (
    <div className="p-8">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Подписки
            </h1>
            <p className="text-slate-500 mt-1">
              Управление подписками клубов и тарифами
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashadmin-x/subscriptions/plans"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Settings2 className="h-4 w-4" />
              Управление тарифами
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              label: "Всего клубов",
              value: subscriptions.length,
              icon: Store,
              color: "bg-blue-500",
            },
            {
              label: "Активные",
              value: subscriptions.filter((s) => s.subscription_is_active)
                .length,
              icon: CheckCircle2,
              color: "bg-emerald-500",
            },
            {
              label: "Триал",
              value: subscriptions.filter(
                (s) => s.subscription_status === "trialing",
              ).length,
              icon: Clock,
              color: "bg-amber-500",
            },
            {
              label: "Истекли",
              value: subscriptions.filter(
                (s) =>
                  !s.subscription_is_active &&
                  s.subscription_status !== "trialing",
              ).length,
              icon: AlertCircle,
              color: "bg-rose-500",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-2 rounded-xl text-white", stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {stat.value}
              </h3>
            </div>
          ))}
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-slate-200 -mt-2">
          <button
            onClick={() => {
              setActiveTab("subscriptions");
              setStatusFilter("all");
            }}
            className={cn(
              "px-6 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer",
              activeTab === "subscriptions"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            Подписки клубов
          </button>
          <button
            onClick={() => {
              setActiveTab("payments");
              setStatusFilter("all");
            }}
            className={cn(
              "px-6 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2",
              activeTab === "payments"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <CreditCard className="h-4 w-4" />
            История платежей и логи
          </button>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === "subscriptions"
                  ? "Поиск по названию клуба, владельцу или телефону..."
                  : "Поиск по ID заказа, клубу, владельцу или тарифу..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-slate-200 transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="h-4 w-4 text-slate-400 mr-1" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border-none rounded-xl text-sm py-2 px-4 focus:ring-2 focus:ring-slate-200 outline-none cursor-pointer"
            >
              {activeTab === "subscriptions" ? (
                <>
                  <option value="all">Все статусы</option>
                  <option value="active">Активные</option>
                  <option value="trial">Триал</option>
                  <option value="expired">Истекшие</option>
                </>
              ) : (
                <>
                  <option value="all">Все платежи</option>
                  <option value="active">Оплаченные (paid)</option>
                  <option value="trial">В ожидании (pending)</option>
                  <option value="expired">Ошибки (failed)</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* List Content */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {activeTab === "subscriptions" ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Клуб
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Владелец
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Тариф
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Дата окончания
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-400"
                    >
                      Загрузка данных...
                    </td>
                  </tr>
                ) : filteredSubscriptions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-400"
                    >
                      Ничего не найдено
                    </td>
                  </tr>
                ) : (
                  filteredSubscriptions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">
                            {sub.club_name}
                          </span>
                          <span className="text-xs text-slate-500 mt-0.5">
                            ID: {sub.club_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-sm">
                          <span className="font-medium text-slate-700">
                            {sub.full_name}
                          </span>
                          <span className="text-slate-500 mt-0.5">
                            {sub.phone_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-900 bg-slate-100 px-2 py-1 rounded text-xs">
                          {sub.subscription_plan.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(sub)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          {sub.subscription_ends_at
                            ? format(
                                new Date(sub.subscription_ends_at),
                                "d MMMM yyyy",
                                { locale: ru },
                              )
                            : "Бессрочно"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all">
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    ID / Дата
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Клуб
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Плательщик
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Тариф
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Сумма
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Дата оплаты
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-slate-400"
                    >
                      Загрузка логов платежей...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-slate-400"
                    >
                      История платежей пуста
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">
                            #{order.id}
                          </span>
                          <span className="text-xs text-slate-500 mt-0.5">
                            {format(
                              new Date(order.created_at),
                              "dd.MM.yyyy HH:mm",
                              { locale: ru },
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">
                            {order.club_name || "Удаленный клуб"}
                          </span>
                          <span className="text-xs text-slate-500 mt-0.5">
                            ID: {order.club_id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-sm">
                          <span className="font-medium text-slate-700">
                            {order.owner_name || "—"}
                          </span>
                          <span className="text-slate-500 mt-0.5">
                            {order.owner_phone || ""}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs w-max uppercase">
                            {order.plan_code}
                          </span>
                          <span className="text-xs text-slate-500 mt-0.5">
                            На {order.period_value}{" "}
                            {order.period_unit === "month"
                              ? "мес."
                              : order.period_unit === "year"
                                ? "г."
                                : "дн."}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900 text-sm">
                          {Number(order.amount).toLocaleString("ru-RU")} ₽
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {order.status === "paid" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <CheckCircle2 className="h-3 w-3" />
                            Оплачен
                          </span>
                        ) : order.status === "pending" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                            <Clock className="h-3 w-3" />
                            Ожидание
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                            <XCircle className="h-3 w-3" />
                            Ошибка
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {order.paid_at
                            ? format(
                                new Date(order.paid_at),
                                "dd.MM.yyyy HH:mm",
                                { locale: ru },
                              )
                            : "—"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple Store icon placeholder as Lucide-react Store might not be imported or available in this context if I missed it
function Store({ className }: { className?: string }) {
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
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
    </svg>
  );
}
