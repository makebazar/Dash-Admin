"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  Loader2,
  User,
  Phone,
  Calendar,
  ShieldCheck,
  Building2,
  ChevronRight,
  MoreVertical,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface UserMembership {
  id: number | string;
  name: string;
  role?: string;
}

interface UserData {
  id: string;
  full_name: string;
  phone_number: string;
  is_super_admin: boolean;
  created_at: string;
  subscription_plan: string;
  subscription_status: string;
  subscription_ends_at: string | null;
  clubs_owned_count: number;
  clubs_work_count: number;
  owned_clubs: UserMembership[];
  work_clubs: UserMembership[];
}

export default function UsersPageX() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/dashadmin-x/users");
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(query) ||
        u.phone_number?.includes(query),
    );
  }, [users, searchQuery]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 bg-[#FAFAFA] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-1">
              Пользователи
            </h1>
            <p className="text-base text-slate-500 font-medium">
              Управление аккаунтами и доступом
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">
                Всего
              </span>
              <span className="text-sm font-bold text-slate-900">
                {users.length}
              </span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8 max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Поиск по имени или телефону..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-12 bg-white border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-200 transition-all text-sm shadow-sm"
          />
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-slate-200" />
              <p className="text-slate-400 text-sm font-medium">Загрузка...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 py-24 text-center shadow-sm"
            >
              <User className="h-12 w-12 text-slate-100 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Пользователи не найдены
              </h3>
              <p className="text-slate-500 text-sm">Попробуйте другой запрос</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredUsers.map((user) => (
                <Card
                  key={user.id}
                  className="group bg-white border-slate-200 p-5 rounded-2xl hover:border-slate-300 transition-all shadow-sm flex flex-col lg:flex-row lg:items-center gap-6"
                >
                  {/* User Profile Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                      {user.full_name ? (
                        <span className="text-sm font-bold text-slate-400">
                          {user.full_name.substring(0, 2).toUpperCase()}
                        </span>
                      ) : (
                        <User className="h-5 w-5 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-slate-900 truncate text-base">
                          {user.full_name || "Без имени"}
                        </p>
                        {user.is_super_admin && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-[9px] font-bold text-white uppercase tracking-wider">
                            Админ
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-slate-400">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span className="text-xs font-medium">
                            {user.phone_number}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span className="text-xs font-medium">
                            {formatDate(user.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Club Badges */}
                  <div className="flex flex-wrap items-center gap-2 lg:w-1/3">
                    {user.clubs_owned_count > 0 && (
                      <div className="px-3 py-1 bg-emerald-50 border border-emerald-100/50 rounded-lg flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-emerald-600" />
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">
                          Владелец ({user.clubs_owned_count})
                        </span>
                      </div>
                    )}
                    {user.clubs_work_count > 0 && (
                      <div className="px-3 py-1 bg-blue-50 border border-blue-100/50 rounded-lg flex items-center gap-2">
                        <ShieldCheck className="h-3 w-3 text-blue-600" />
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-tight">
                          Персонал ({user.clubs_work_count})
                        </span>
                      </div>
                    )}
                    {user.clubs_owned_count === 0 &&
                      user.clubs_work_count === 0 && (
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                          Без клубов
                        </span>
                      )}
                  </div>

                  {/* Subscription Info */}
                  <div className="lg:w-48 shrink-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Подписка
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-bold",
                          user.subscription_status === "active"
                            ? "text-emerald-600"
                            : "text-slate-500",
                        )}
                      >
                        {user.subscription_plan || "Free"}
                      </span>
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          user.subscription_status === "active"
                            ? "bg-emerald-500"
                            : "bg-slate-300",
                        )}
                      />
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/dashadmin-x/users/${user.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-4 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider"
                      >
                        Детали
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
