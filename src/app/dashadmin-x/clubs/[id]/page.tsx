"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Loader2,
  AlertCircle,
  UserPlus,
  X,
  Trash2,
  ShieldAlert,
  Briefcase,
  Users,
  Search,
  Plus,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Club {
  id: number;
  name: string;
  address: string;
  owner_id: string;
  timezone: string;
  day_start_hour: number;
  night_start_hour: number;
  inventory_required: boolean;
  public_id: string;
  is_active: boolean;
  referred_by_id?: string | null;
  referral_reward_type?: string;
  referral_reward_value?: number;
}

interface Owner {
  id: string;
  full_name: string;
  phone_number: string;
  is_primary: boolean;
}

interface Employee {
  id: string;
  full_name: string;
  phone_number: string;
  role: string;
  hired_at: string;
}

interface User {
  id: string;
  full_name: string;
  phone_number: string;
}

export default function ClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [club, setClub] = useState<Club | null>(null);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [employeesList, setEmployeesList] = useState<User[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberMode, setAddMemberMode] = useState<"owner" | "employee">(
    "employee",
  );
  const [isDestroyOpen, setIsDestroyOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [clubRes, employeesRes] = await Promise.all([
        fetch(`/api/dashadmin-x/clubs/${id}`),
        fetch(`/api/dashadmin-x/employees`),
      ]);

      const data = await clubRes.json();
      if (clubRes.ok) {
        setClub(data.club);
        setOwners(data.owners);
        setEmployees(data.employees);
        setAvailableUsers(data.availableUsers);
      } else {
        setError(data.error || "Ошибка загрузки");
      }

      if (employeesRes.ok) {
        const empData = await employeesRes.json();
        setEmployeesList(empData.employees || []);
      }
    } catch (err) {
      setError("Сетевая ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = (field: keyof Club, value: any) => {
    if (!club) return;
    setClub({ ...club, [field]: value });
    setHasChanges(true);
  };

  const saveChanges = async () => {
    if (!club) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashadmin-x/clubs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(club),
      });
      if (res.ok) {
        setHasChanges(false);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка сохранения");
      }
    } catch (err) {
      setError("Ошибка сети");
    } finally {
      setIsSaving(false);
    }
  };

  const addMember = async (userId: string, role: string) => {
    setIsAddMemberOpen(false);
    try {
      const res = await fetch(`/api/dashadmin-x/clubs/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const removeMember = async (userId: string) => {
    try {
      const res = await fetch(
        `/api/dashadmin-x/clubs/${id}?mode=remove-member&userId=${userId}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const makePrimaryOwner = async (userId: string) => {
    if (
      !confirm(
        "Сделать этого пользователя основным владельцем? Все подписки будут привязаны к нему.",
      )
    )
      return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/dashadmin-x/clubs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_id: userId }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const archiveClub = async () => {
    try {
      const res = await fetch(
        `/api/dashadmin-x/clubs/${id}?mode=archive-club`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const restoreClub = async () => {
    try {
      const res = await fetch(
        `/api/dashadmin-x/clubs/${id}?mode=restore-club`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const destroyClub = async () => {
    if (confirmName !== club?.name) return;
    try {
      const res = await fetch(
        `/api/dashadmin-x/clubs/${id}?mode=destroy-club`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) router.push("/dashadmin-x/clubs");
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-slate-200" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-32">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-[#FAFAFA]/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none mb-1">
                {club?.name || "Настройка клуба"}
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                ID: {club?.public_id || club?.id}
              </p>
            </div>
          </div>

          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3"
            >
              <Button
                onClick={saveChanges}
                disabled={isSaving}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 h-10 shadow-sm transition-all"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Сохранить изменения"
                )}
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-16">
          {/* General Settings */}
          <section>
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">
              Конфигурация
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-900">
                  Название
                </Label>
                <Input
                  value={club?.name || ""}
                  onChange={(e) => handleUpdate("name", e.target.value)}
                  className="bg-white border-slate-200 rounded-xl h-11 focus:ring-1 focus:ring-slate-200 transition-all shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-900">
                  Адрес
                </Label>
                <Input
                  value={club?.address || ""}
                  onChange={(e) => handleUpdate("address", e.target.value)}
                  className="bg-white border-slate-200 rounded-xl h-11 focus:ring-1 focus:ring-slate-200 transition-all shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-900">
                  Прикрепленный сотрудник
                </Label>
                <Select
                  value={club?.referred_by_id || "none"}
                  onValueChange={(v) => handleUpdate("referred_by_id", v === "none" ? null : v)}
                >
                  <SelectTrigger className="bg-white border-slate-200 rounded-xl h-11 focus:ring-1 focus:ring-slate-200 transition-all shadow-sm text-sm">
                    <SelectValue placeholder="Сотрудник не выбран" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">Сотрудник не выбран</SelectItem>
                    {employeesList.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {club?.referred_by_id && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-900">
                      Тип вознаграждения
                    </Label>
                    <Select
                      value={club?.referral_reward_type || "percentage"}
                      onValueChange={(v) => handleUpdate("referral_reward_type", v)}
                    >
                      <SelectTrigger className="bg-white border-slate-200 rounded-xl h-11 focus:ring-1 focus:ring-slate-200 transition-all shadow-sm text-sm">
                        <SelectValue placeholder="Процент от подписки" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="percentage">Процент от подписки</SelectItem>
                        <SelectItem value="fixed">Фиксированная выплата</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-900">
                      Размер вознаграждения
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={club?.referral_reward_value ?? 0}
                        onChange={(e) => handleUpdate("referral_reward_value", parseFloat(e.target.value) || 0)}
                        className="bg-white border-slate-200 rounded-xl h-11 pr-8 focus:ring-1 focus:ring-slate-200 transition-all shadow-sm"
                      />
                      <span className="absolute right-3 top-3 text-slate-400 text-sm font-semibold select-none">
                        {club?.referral_reward_type === "fixed" ? "₽" : "%"}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Owners Management */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                Владельцы (Доступ)
              </h2>
              <Button
                onClick={() => {
                  setAddMemberMode("owner");
                  setIsAddMemberOpen(true);
                }}
                variant="ghost"
                className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-bold uppercase tracking-wider"
              >
                <UserPlus className="h-3.5 w-3.5 mr-2" />
                Добавить владельца
              </Button>
            </div>

            <div className="space-y-3">
              {owners.map((owner) => (
                <div
                  key={owner.id}
                  className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl group shadow-sm transition-all hover:border-slate-300"
                >
                  <div
                    onClick={() =>
                      router.push(`/dashadmin-x/users/${owner.id}`)
                    }
                    className="flex items-center gap-4 cursor-pointer flex-1 min-w-0"
                  >
                    <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                      <span className="text-xs font-bold text-slate-400">
                        {owner.full_name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {owner.full_name}
                        </p>
                        {owner.is_primary && (
                          <span className="text-[9px] font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter shrink-0">
                            Основной
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">
                        {owner.phone_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!owner.is_primary && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            makePrimaryOwner(owner.id);
                          }}
                          title="Сделать основным"
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition-all"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMember(owner.id);
                          }}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Team/Employees Management */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                Команда клуба
              </h2>
              <Button
                onClick={() => {
                  setAddMemberMode("employee");
                  setIsAddMemberOpen(true);
                }}
                variant="ghost"
                className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-bold uppercase tracking-wider"
              >
                <UserPlus className="h-3.5 w-3.5 mr-2" />
                Нанять сотрудника
              </Button>
            </div>

            {employees.length === 0 ? (
              <div className="p-8 text-center bg-white border-2 border-dashed border-slate-100 rounded-3xl">
                <Users className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">
                  В команде пока нет сотрудников
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {employees.map((emp) => {
                  const isManager = emp.role === "Управляющий";
                  return (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl group shadow-sm transition-all hover:border-slate-300"
                    >
                      <div
                        onClick={() =>
                          router.push(`/dashadmin-x/users/${emp.id}`)
                        }
                        className="flex items-center gap-4 min-w-0 cursor-pointer flex-1"
                      >
                        <div
                          className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center border shrink-0",
                            isManager
                              ? "bg-purple-50 border-purple-100/50"
                              : "bg-emerald-50 border-emerald-100/50",
                          )}
                        >
                          <Briefcase
                            className={cn(
                              "h-4 w-4",
                              isManager
                                ? "text-purple-600"
                                : "text-emerald-600",
                            )}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {emp.full_name}
                            </p>
                            {isManager && (
                              <div className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <p
                              className={cn(
                                "text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5",
                                isManager
                                  ? "text-purple-600"
                                  : "text-slate-400",
                              )}
                            >
                              {emp.role}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold tracking-tight uppercase">
                              {emp.phone_number}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMember(emp.id);
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Operational Settings */}
          <section>
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">
              Параметры работы
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                  Таймзона
                </Label>
                <Select
                  value={club?.timezone}
                  onValueChange={(v) => handleUpdate("timezone", v)}
                >
                  <SelectTrigger className="border-none bg-slate-50 rounded-xl h-10 px-3 shadow-none focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Europe/Moscow">Москва</SelectItem>
                    <SelectItem value="Asia/Yekaterinburg">
                      Екатеринбург
                    </SelectItem>
                    <SelectItem value="Asia/Novosibirsk">
                      Новосибирск
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                  Начало дня
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={club?.day_start_hour}
                    onChange={(e) =>
                      handleUpdate("day_start_hour", parseInt(e.target.value))
                    }
                    className="border-none bg-slate-50 rounded-xl h-10 w-20 text-center font-bold"
                  />
                  <span className="text-sm font-bold text-slate-400">:00</span>
                </div>
              </div>
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                  Начало ночи
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    value={club?.night_start_hour}
                    onChange={(e) =>
                      handleUpdate("night_start_hour", parseInt(e.target.value))
                    }
                    className="border-none bg-slate-50 rounded-xl h-10 w-20 text-center font-bold"
                  />
                  <span className="text-sm font-bold text-slate-400">:00</span>
                </div>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="pt-16 border-t border-slate-100">
            <div className="p-8 bg-red-50/50 border border-red-100 rounded-3xl">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-red-100 rounded-2xl">
                  <ShieldAlert className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                    Опасная зона
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">
                    Архивация скроет клуб из общего списка. Удаление приведет к
                    безвозвратной потере данных.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                {club?.is_active ? (
                  <Button
                    onClick={archiveClub}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl h-11 px-6 shadow-sm font-bold"
                  >
                    Архивировать клуб
                  </Button>
                ) : (
                  <Button
                    onClick={restoreClub}
                    variant="outline"
                    className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-xl h-11 px-6 shadow-sm font-bold"
                  >
                    Восстановить из архива
                  </Button>
                )}

                <Button
                  onClick={() => setIsDestroyOpen(true)}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-11 px-6 shadow-sm font-bold"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Полное удаление
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Add Member Modal */}
      <Dialog
        open={isAddMemberOpen}
        onOpenChange={(open) => {
          setIsAddMemberOpen(open);
          if (!open) setUserSearchQuery("");
        }}
      >
        <DialogContent className="rounded-3xl max-w-md border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100 text-left sm:text-left">
            <DialogTitle className="text-xl font-bold text-slate-900">
              {addMemberMode === "owner"
                ? "Добавить владельца"
                : "Нанять сотрудника"}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              Найдите пользователя по имени или номеру телефона.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            {addMemberMode === "employee" && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Роль
                </Label>
                <Select
                  defaultValue="Сотрудник"
                  onValueChange={(v) => {
                    /* role stored locally if needed */
                  }}
                >
                  <SelectTrigger className="h-12 bg-white border-slate-200 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Админ">Админ</SelectItem>
                    <SelectItem value="Управляющий">Управляющий</SelectItem>
                    <SelectItem value="Сотрудник">Сотрудник</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Поиск пользователя
              </Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Имя или +7..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-11 h-12 bg-white border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-200"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-75 overflow-y-auto pr-1 custom-scrollbar">
              {availableUsers
                .filter((u) => {
                  const isAlreadyMember =
                    owners.find((o) => o.id === u.id) ||
                    employees.find((e) => e.id === u.id);
                  if (isAlreadyMember) return false;

                  const query = userSearchQuery.toLowerCase();
                  return (
                    u.full_name.toLowerCase().includes(query) ||
                    u.phone_number.toLowerCase().includes(query)
                  );
                })
                .map((user) => (
                  <button
                    key={user.id}
                    onClick={() =>
                      addMember(
                        user.id,
                        addMemberMode === "owner" ? "Владелец" : "Сотрудник",
                      )
                    }
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all text-left group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {user.full_name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        {user.phone_number}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 text-slate-300 group-hover:text-blue-600" />
                  </button>
                ))}

              {userSearchQuery &&
                availableUsers.filter((u) => {
                  const isAlreadyMember =
                    owners.find((o) => o.id === u.id) ||
                    employees.find((e) => e.id === u.id);
                  if (isAlreadyMember) return false;
                  const query = userSearchQuery.toLowerCase();
                  return (
                    u.full_name.toLowerCase().includes(query) ||
                    u.phone_number.toLowerCase().includes(query)
                  );
                }).length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Пользователи не найдены
                  </div>
                )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Destroy Club Modal */}
      <Dialog open={isDestroyOpen} onOpenChange={setIsDestroyOpen}>
        <DialogContent className="rounded-3xl max-w-md border-none shadow-2xl p-8">
          <DialogHeader className="text-center sm:text-center mb-8">
            <div className="h-16 w-16 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Trash2 className="h-8 w-8 text-red-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-slate-900 mb-2">
              Вы уверены?
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-sm leading-relaxed">
              Введите{" "}
              <span className="font-bold text-slate-900">"{club?.name}"</span>{" "}
              для подтверждения.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Название клуба"
              className="h-12 bg-slate-50 border-slate-100 rounded-xl text-center font-bold focus:bg-white transition-all"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsDestroyOpen(false)}
                className="flex-1 h-12 rounded-xl border-slate-200 font-bold"
              >
                Отмена
              </Button>
              <Button
                variant="destructive"
                disabled={confirmName !== club?.name}
                onClick={destroyClub}
                className="flex-1 h-12 rounded-xl bg-red-600 font-bold disabled:opacity-30 transition-all"
              >
                Удалить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
