"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  Loader2,
  MapPin,
  Plus,
  LayoutGrid,
  List,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
interface Club {
  id: string | number;
  name: string;
  address: string;
  created_at: string;
  timezone: string;
  owner_name: string | null;
  owner_phone: string | null;
  employee_count: string | number;
  workstation_count: string | number;
  is_active: boolean;
}

interface Stats {
  total_clubs: number;
  total_owners: number;
  total_employees: number;
  total_workstations: number;
}

export default function ClubsPageX() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showArchived, setShowArchived] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/dashadmin-x/clubs?archived=${showArchived}`,
      );
      const data = await res.json();
      if (res.ok) {
        setClubs(data.clubs);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching clubs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredClubs = useMemo(() => {
    return clubs.filter(
      (club) =>
        club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        club.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        club.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [clubs, searchQuery]);

  const STATS_CARDS = [
    { label: "Всего клубов", value: stats?.total_clubs ?? 0 },
    { label: "Владельцев", value: stats?.total_owners ?? 0 },
    { label: "Сотрудников", value: stats?.total_employees ?? 0 },
    { label: "Игровых мест", value: stats?.total_workstations ?? 0 },
  ];

  return (
    <div className="p-4 md:p-8 lg:p-10 bg-[#FAFAFA] min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-1">
              Клубы
            </h1>
            <p className="text-base text-slate-500 font-medium">
              Управление игровыми пространствами
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-slate-900 hover:bg-slate-800 h-10 px-5 rounded-xl text-white shadow-sm transition-all active:scale-95 text-sm font-medium">
              <Plus className="h-4 w-4 mr-2" />
              Добавить клуб
            </Button>
          </div>
        </div>

        {/* Stats Overview - Ultra Minimalist */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {STATS_CARDS.map((stat, i) => (
            <div
              key={i}
              className="p-4 md:p-6 rounded-2xl border border-slate-200 bg-white"
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                {stat.label}
              </p>
              <p className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                {isLoading ? "..." : stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Search and View Toggles - Improved height and adaptation */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Поиск по названию или адресу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-10 bg-white border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-200 transition-all text-sm"
            />
          </div>
          <div className="flex items-center bg-white border border-slate-200 px-3 rounded-xl shrink-0 h-10 gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Архив
            </span>
            <Switch
              checked={showArchived}
              onCheckedChange={setShowArchived}
              className="data-[state=checked]:bg-slate-900"
            />
          </div>
          <div className="flex bg-white border border-slate-200 p-1 rounded-xl shrink-0 h-10">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "px-3 rounded-lg transition-all flex items-center justify-center",
                viewMode === "grid"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-400 hover:text-slate-600",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "px-3 rounded-lg transition-all flex items-center justify-center",
                viewMode === "list"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-400 hover:text-slate-600",
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 gap-3"
            >
              <Loader2 className="h-8 w-8 animate-spin text-slate-200" />
              <p className="text-slate-400 text-sm font-medium">Загрузка...</p>
            </motion.div>
          ) : filteredClubs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 py-24 text-center"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Ничего не найдено
              </h3>
              <p className="text-slate-500 text-sm">
                {searchQuery
                  ? "Попробуйте другой запрос"
                  : "Клубы еще не добавлены"}
              </p>
            </motion.div>
          ) : viewMode === "grid" ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {filteredClubs.map((club) => (
                <Link key={club.id} href={`/dashadmin-x/clubs/${club.id}`}>
                  <Card
                    className={cn(
                      "group bg-white border-slate-200 p-6 rounded-2xl hover:border-slate-300 transition-all cursor-pointer shadow-sm hover:shadow-md",
                      !club.is_active && "opacity-60 grayscale-[0.5]",
                    )}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                            {club.name}
                          </h3>
                          {!club.is_active && (
                            <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-tighter shrink-0 border border-slate-200">
                              Архив
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-xs truncate">
                            {club.address || "—"}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ArrowUpRight className="h-4 w-4 text-slate-400" />
                      </Button>
                    </div>

                    <div className="flex gap-8 mb-6">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                          Команда
                        </p>
                        <p className="text-lg font-bold text-slate-900 leading-tight">
                          {club.employee_count}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                          Места
                        </p>
                        <p className="text-lg font-bold text-slate-900 leading-tight">
                          {club.workstation_count}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Владелец
                      </p>
                      <p className="text-sm font-medium text-slate-700">
                        {club.owner_name || "—"}
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-200">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/30">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Клуб
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Владелец
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                        Команда
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                        Места
                      </th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredClubs.map((club) => (
                      <tr
                        key={club.id}
                        className={cn(
                          "hover:bg-slate-50/50 transition-colors group",
                          !club.is_active && "bg-slate-50/30 opacity-60",
                        )}
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/dashadmin-x/clubs/${club.id}`}
                            className="block"
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {club.name}
                              </p>
                              {!club.is_active && (
                                <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-slate-200">
                                  Архив
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {club.address || "—"}
                            </p>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-700">
                            {club.owner_name || "—"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                            {club.owner_phone || ""}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-bold text-slate-900">
                            {club.employee_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-bold text-slate-900">
                            {club.workstation_count}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                          >
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-900 transition-colors" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
