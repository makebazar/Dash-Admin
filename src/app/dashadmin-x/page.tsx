"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  CreditCard,
  ArrowRight,
  Loader2,
  PhoneCall,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Stats {
  totalClubs: number;
  totalUsers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
}

interface RecentActivity {
  id: string;
  type: "new_user" | "new_club" | "subscription_change";
  description: string;
  timestamp: string;
}

export default function DashAdminXPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/dashadmin-x/dashboard-stats");
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setActivities(data.recentActivities || []);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return (
      new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 0,
      }).format(value) + " ₽"
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const STATS_CARDS = [
    {
      label: "Всего клубов",
      value: stats?.totalClubs ?? 0,
      icon: Building2,
      href: "/dashadmin-x/clubs",
      color: "text-slate-600",
      bgColor: "bg-slate-100",
    },
    {
      label: "Пользователей",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      href: "/dashadmin-x/users",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Активных подписок",
      value: stats?.activeSubscriptions ?? 0,
      icon: CreditCard,
      href: "/dashadmin-x/subscriptions",
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      label: "Выручка за месяц",
      value: formatCurrency(stats?.monthlyRevenue ?? 0),
      icon: CreditCard,
      href: "/dashadmin-x/subscriptions",
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      isCurrency: true,
    },
  ];

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">
            Панель управления
          </h1>
          <p className="text-lg text-slate-500">
            Обзор системы и ключевые показатели
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {STATS_CARDS.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.href} href={stat.href} className="group">
                <Card className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn("p-3 rounded-xl", stat.bgColor)}>
                      <Icon className={cn("h-6 w-6", stat.color)} />
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold tracking-tight text-slate-900">
                      {isLoading ? (
                        <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
                      ) : stat.isCurrency ? (
                        stat.value
                      ) : (
                        new Intl.NumberFormat("ru-RU").format(
                          Number(stat.value),
                        )
                      )}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-6">
            Быстрые действия
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashadmin-x/crm"
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all"
            >
              <div className="p-3 rounded-xl bg-slate-100">
                <PhoneCall className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">CRM Лиды</p>
                <p className="text-sm text-slate-500">
                  Обзвон и воронка продаж
                </p>
              </div>
            </Link>
            <Link
              href="/dashadmin-x/users"
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all"
            >
              <div className="p-3 rounded-xl bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">
                  Управление пользователями
                </p>
                <p className="text-sm text-slate-500">
                  Добавить, редактировать, удалить
                </p>
              </div>
            </Link>
            <Link
              href="/dashadmin-x/clubs"
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all"
            >
              <div className="p-3 rounded-xl bg-emerald-100">
                <Building2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Управление клубами</p>
                <p className="text-sm text-slate-500">
                  Просмотр и настройка клубов
                </p>
              </div>
            </Link>
            <Link
              href="/dashadmin-x/roles"
              className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all"
            >
              <div className="p-3 rounded-xl bg-purple-100">
                <svg
                  className="h-5 w-5 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900">Роли и разрешения</p>
                <p className="text-sm text-slate-500">Настройка доступов</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-6">
            Последняя активность
          </h2>
          <Card className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : activities.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                Нет недавней активности
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          activity.type === "new_user" && "bg-blue-100",
                          activity.type === "new_club" && "bg-emerald-100",
                          activity.type === "subscription_change" &&
                            "bg-amber-100",
                        )}
                      >
                        {activity.type === "new_user" && (
                          <Users className="h-4 w-4 text-blue-600" />
                        )}
                        {activity.type === "new_club" && (
                          <Building2 className="h-4 w-4 text-emerald-600" />
                        )}
                        {activity.type === "subscription_change" && (
                          <CreditCard className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                      <p className="text-sm text-slate-700">
                        {activity.description}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatDate(activity.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
