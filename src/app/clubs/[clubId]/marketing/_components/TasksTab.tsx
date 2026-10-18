"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  CheckSquare, 
  Sparkles, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar, 
  User, 
  Copy, 
  Check, 
  Flame, 
  Wallet,
  ShieldCheck,
  RefreshCw,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientProfile, ClubAnalytics } from "./segmentation";

export interface MarketingTask {
  id: string;
  clubId: string;
  phone: string;
  clientName: string;
  type: "whale_booking" | "churn_prevent" | "balance_reminder" | "custom";
  title: string;
  script: string;
  targetDetails: {
    favoriteDay?: string;
    favoriteSeat?: string;
    favoriteZone?: string;
    favoriteTariff?: string;
    balance?: number;
    bonusBalance?: number;
    totalSpent?: number;
  };
  status: "pending" | "completed" | "no_answer" | "rejected";
  createdAt: string;
  completedAt?: string;
  adminNote?: string;
}

interface Props {
  clubId: string;
  analytics: ClubAnalytics | null;
  excludedPhones: string[];
}

export function TasksTab({ clubId, analytics, excludedPhones }: Props) {
  const [tasks, setTasks] = useState<MarketingTask[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed" | "rejected">("pending");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Storage key
  const storageKey = `marketing_tasks_${clubId}`;

  // Load tasks on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setTasks(parsed);
        }
      } catch (err) {
        console.warn("Failed to load tasks from localStorage:", err);
      }
    }
  }, [storageKey]);

  // Save tasks helper
  const saveTasks = (newTasks: MarketingTask[]) => {
    setTasks(newTasks);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newTasks));
      } catch (err) {
        console.warn("Failed to save tasks to localStorage:", err);
      }
    }
  };

  // Generate smart tasks from client profiles
  const handleGenerateSmartTasks = () => {
    if (!analytics || !analytics.profiles) return;

    const existingPhones = new Set(tasks.map((t) => t.phone));
    const generated: MarketingTask[] = [];

    // Filter eligible profiles
    const profiles = analytics.profiles.filter((p) => {
      const norm = (p.phone || "").replace(/\D/g, "").slice(-10);
      return !excludedPhones.includes(norm) && !existingPhones.has(norm);
    });

    // 1. VIP Whales booking tasks (Top priority)
    const whales = profiles
      .filter((p) => p.isWhale && (p.favoriteSeat || p.favoriteDay))
      .slice(0, 15);

    for (const w of whales) {
      const dayText = w.favoriteDay ? `в ${w.favoriteDay.toLowerCase()}` : "на днях";
      const seatText = w.favoriteSeat ? `твой привычный ${w.favoriteSeat}` : "место в клубе";
      const zoneText = w.favoriteZone ? `в зоне ${w.favoriteZone}` : "";

      generated.push({
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        clubId,
        phone: w.phone,
        clientName: w.name || "VIP Гость",
        type: "whale_booking",
        title: `VIP-бронь: ${w.favoriteSeat || "ПК"} (${w.favoriteDay || "Ближайший день"})`,
        script: `Привет, ${w.name ? w.name.split(" ")[0] : "друг"}! Это администратор Colizeum. Заметили, что ты обычно играешь ${dayText}. Забронировать за тобой ${seatText} ${zoneText} на вечер?`,
        targetDetails: {
          favoriteDay: w.favoriteDay,
          favoriteSeat: w.favoriteSeat,
          favoriteZone: w.favoriteZone,
          favoriteTariff: w.favoriteTariff,
          totalSpent: w.totalSpent,
        },
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      existingPhones.add(w.phone);
    }

    // 2. Churn prevention tasks (Cooling regulars)
    const coolingRegulars = profiles
      .filter((p) => p.status === "cooling" && p.totalSpent >= 2000)
      .slice(0, 15);

    for (const c of coolingRegulars) {
      const name = c.name ? c.name.split(" ")[0] : "друг";
      const seat = c.favoriteSeat ? `твой любимый ${c.favoriteSeat}` : "мощный ПК";
      const day = c.favoriteDay ? `в ${c.favoriteDay.toLowerCase()}` : "на этой неделе";

      generated.push({
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        clubId,
        phone: c.phone,
        clientName: c.name || "Постоянный гость",
        type: "churn_prevent",
        title: `Удержание: не был ${c.daysSince || 20} дн. (Чек ${Math.round(c.totalSpent).toLocaleString("ru")} ₽)`,
        script: `Привет, ${name}! Давно не заглядывал в Colizeum. Как насчет катки ${day}? Мы обновили девайсы, ${seat} свободен для тебя!`,
        targetDetails: {
          favoriteDay: c.favoriteDay,
          favoriteSeat: c.favoriteSeat,
          favoriteZone: c.favoriteZone,
          totalSpent: c.totalSpent,
        },
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      existingPhones.add(c.phone);
    }

    // 3. Balance reminder tasks
    const balanceHolders = profiles
      .filter((p) => p.status !== "active" && (p.balance >= 200 || p.bonusBalance >= 150))
      .slice(0, 15);

    for (const b of balanceHolders) {
      const name = b.name ? b.name.split(" ")[0] : "друг";
      const balStr = b.balance > 0 ? `${Math.round(b.balance)} ₽` : "";
      const bonusStr = b.bonusBalance > 0 ? `${Math.round(b.bonusBalance)} бонусов` : "";
      const moneyText = [balStr, bonusStr].filter(Boolean).join(" и ");

      generated.push({
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        clubId,
        phone: b.phone,
        clientName: b.name || "Гость с балансом",
        type: "balance_reminder",
        title: `Напоминание о балансе (${moneyText})`,
        script: `Привет, ${name}! Напоминаем, что на твоем аккаунте в Colizeum тебя ждут ${moneyText}. Заглядывай поиграть — забронировать место?`,
        targetDetails: {
          balance: b.balance,
          bonusBalance: b.bonusBalance,
          favoriteSeat: b.favoriteSeat,
        },
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      existingPhones.add(b.phone);
    }

    if (generated.length === 0) {
      alert("Все подходящие клиенты уже добавлены в задачи или находятся в исключениях.");
      return;
    }

    saveTasks([...generated, ...tasks]);
  };

  // Status updates
  const handleUpdateStatus = (taskId: string, newStatus: MarketingTask["status"]) => {
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          status: newStatus,
          completedAt: newStatus !== "pending" ? new Date().toISOString() : undefined,
        };
      }
      return t;
    });
    saveTasks(updated);
  };

  const handleDeleteTask = (taskId: string) => {
    saveTasks(tasks.filter((t) => t.id !== taskId));
  };

  const handleClearAllTasks = () => {
    if (confirm("Вы уверены, что хотите удалить все задачи?")) {
      saveTasks([]);
    }
  };

  const handleCopyScript = (taskId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(taskId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, typeFilter]);

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Generator */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-600/30 text-violet-400 border border-violet-500/30">
              <CheckSquare className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">Персональные задачи администраторам</h2>
            {pendingCount > 0 && (
              <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount} к выполнению
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Администратор смены получает готовые задания на опережение с персональным текстом (любимый ПК, привычный день недели и тариф гостя).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleGenerateSmartTasks}
            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Сгенерировать задачи из базы</span>
          </button>

          {tasks.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllTasks}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition-colors"
              title="Очистить список задач"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-slate-400 mr-1">Статус:</span>
          {[
            { id: "pending", label: "К выполнению", count: pendingCount },
            { id: "completed", label: "Завершенные", count: completedCount },
            { id: "all", label: "Все задачи", count: tasks.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
                statusFilter === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full",
                statusFilter === tab.id ? "bg-slate-700 text-slate-200" : "bg-slate-100 text-slate-500"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-400">Тип:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs font-medium bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-slate-400"
          >
            <option value="all">Все типы</option>
            <option value="whale_booking">⭐ VIP-бронь (Киты)</option>
            <option value="churn_prevent">🔄 Удержание оттока</option>
            <option value="balance_reminder">💰 Забытый баланс</option>
          </select>
        </div>
      </div>

      {/* Task Cards List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Нет задач в выбранном фильтре</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Нажмите кнопку «Сгенерировать задачи из базы», чтобы система отобрала китов и засыпающих постоянников для смены.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((t) => {
            const isCompleted = t.status === "completed";
            const isRejected = t.status === "rejected";
            const isPending = t.status === "pending";
            const phoneDigits = t.phone.replace(/\D/g, "");
            const waUrl = `https://wa.me/7${phoneDigits.slice(-10)}?text=${encodeURIComponent(t.script)}`;
            const telUrl = `tel:+7${phoneDigits.slice(-10)}`;

            return (
              <div
                key={t.id}
                className={cn(
                  "bg-white border rounded-2xl p-4 flex flex-col justify-between transition-all shadow-sm space-y-3",
                  isCompleted ? "border-emerald-200 bg-emerald-50/20" : isRejected ? "border-slate-200 opacity-60" : "border-slate-200 hover:border-slate-300"
                )}
              >
                {/* Card Top: Type & Badges */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                      t.type === "whale_booking" ? "bg-amber-100 text-amber-800" :
                      t.type === "churn_prevent" ? "bg-purple-100 text-purple-800" :
                      "bg-emerald-100 text-emerald-800"
                    )}>
                      {t.type === "whale_booking" ? "⭐ Кит / Бронь" :
                       t.type === "churn_prevent" ? "🔄 Возврат оттока" : "💰 Деньги на счете"}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteTask(t.id)}
                      className="text-slate-300 hover:text-rose-500 p-1 rounded transition-colors"
                      title="Удалить карточку"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Client Info */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.clientName}</span>
                    </h4>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">
                      +7 {t.phone.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, "($1) $2-$3-$4")}
                    </p>
                  </div>

                  {/* Attributes Badges */}
                  <div className="flex flex-wrap items-center gap-1 text-[11px]">
                    {t.targetDetails.favoriteSeat && (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                        ПК: {t.targetDetails.favoriteSeat}
                      </span>
                    )}
                    {t.targetDetails.favoriteDay && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                        День: {t.targetDetails.favoriteDay}
                      </span>
                    )}
                    {t.targetDetails.favoriteZone && (
                      <span className="bg-violet-50 text-violet-700 px-2 py-0.5 rounded font-medium">
                        {t.targetDetails.favoriteZone}
                      </span>
                    )}
                  </div>

                  {/* Ready Script */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-700 relative group">
                    <p className="italic leading-relaxed pr-6 text-[11px]">
                      «{t.script}»
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopyScript(t.id, t.script)}
                      className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                      title="Скопировать скрипт"
                    >
                      {copiedId === t.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Card Bottom: Actions */}
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1 transition-colors shadow-sm"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                    <a
                      href={telUrl}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Звонок</span>
                    </a>
                  </div>

                  {/* Status Buttons */}
                  <div className="flex items-center gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(t.id, "completed")}
                      className={cn(
                        "flex-1 py-1 text-[11px] font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1",
                        isCompleted
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      )}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Забронил</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(t.id, "rejected")}
                      className={cn(
                        "py-1 px-2.5 text-[11px] font-medium rounded-lg border transition-colors",
                        isRejected
                          ? "bg-slate-600 text-white border-slate-600"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      )}
                      title="Отказ / Не актуально"
                    >
                      Отказ
                    </button>

                    {!isPending && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(t.id, "pending")}
                        className="py-1 px-2 text-[11px] text-slate-400 hover:text-slate-600 font-medium"
                        title="Вернуть в работу"
                      >
                        Вернуть
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
