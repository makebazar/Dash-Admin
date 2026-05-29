"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  Phone,
  Calendar,
  UserPlus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Employee {
  id: string;
  full_name: string;
  phone_number: string;
  is_super_admin: boolean;
  is_staff: boolean;
  created_at: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Add employee modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccessMessage, setAddSuccessMessage] = useState("");

  // Revoke confirmation modal state
  const [revokingUser, setRevokingUser] = useState<Employee | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState("");

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/dashadmin-x/employees");
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        e.full_name?.toLowerCase().includes(query) ||
        e.phone_number?.includes(query)
    );
  }, [employees, searchQuery]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddSuccessMessage("");
    setIsAdding(true);

    try {
      const res = await fetch("/api/dashadmin-x/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: newPhone,
          full_name: newName,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAddSuccessMessage(data.message || "Сотрудник успешно добавлен");
        setNewPhone("");
        setNewName("");
        fetchEmployees();
        // Close modal after short delay to let user see success
        setTimeout(() => {
          setIsAddModalOpen(false);
          setAddSuccessMessage("");
        }, 1500);
      } else {
        setAddError(data.error || "Не удалось добавить сотрудника");
      }
    } catch (err) {
      setAddError("Ошибка подключения к серверу");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!revokingUser) return;
    setRevokeError("");
    setIsRevoking(true);

    try {
      const res = await fetch(`/api/dashadmin-x/employees?userId=${revokingUser.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        fetchEmployees();
        setRevokingUser(null);
      } else {
        setRevokeError(data.error || "Не удалось отозвать доступ");
      }
    } catch (err) {
      setRevokeError("Ошибка подключения к серверу");
    } finally {
      setIsRevoking(false);
    }
  };

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
              Сотрудники
            </h1>
            <p className="text-slate-500 text-sm md:text-base">
              Управление доступом сотрудников и менеджеров к административной панели
            </p>
          </div>

          <Button
            onClick={() => {
              setAddError("");
              setAddSuccessMessage("");
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-6 bg-black hover:bg-slate-800 text-white rounded-2xl shadow-lg shadow-black/5 border-none transition-all duration-300 hover:-translate-y-0.5"
          >
            <UserPlus className="h-5 w-5" />
            <span>Добавить сотрудника</span>
          </Button>
        </div>

        {/* Search Filter Card */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 mb-8 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Поиск по ФИО или номеру телефона..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 border-slate-200 rounded-xl focus-visible:ring-slate-900 transition-all text-base"
            />
          </div>
        </Card>

        {/* Employees Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
            <p className="text-sm text-slate-400 font-medium">Загрузка списка сотрудников...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-slate-200">
            <Shield className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium text-lg mb-1">Сотрудники не найдены</p>
            <p className="text-slate-400 text-sm">
              {searchQuery ? "Попробуйте изменить поисковый запрос" : "Добавьте первого сотрудника по кнопке выше"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredEmployees.map((employee, idx) => (
                <motion.div
                  key={employee.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <Card className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 flex flex-col justify-between min-h-[220px]">
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-4">
                        {employee.is_super_admin ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950 text-white text-xs font-semibold">
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                            <span>Супер-админ</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                            <span>Менеджер CRM</span>
                          </div>
                        )}

                        {/* Revoke Action */}
                        {!employee.is_super_admin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setRevokeError("");
                              setRevokingUser(employee);
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </Button>
                        )}
                      </div>

                      {/* Name & ID */}
                      <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-1">
                        {employee.full_name || "Без имени"}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono mb-4">ID: {employee.id}</p>
                    </div>

                    {/* Meta info */}
                    <div className="space-y-2.5 pt-4 border-t border-slate-100 mt-auto">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span className="font-medium">{employee.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>Добавлен: {formatDate(employee.created_at)}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Add Employee Dialog */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="rounded-3xl max-w-md border-none shadow-2xl p-6 bg-white overflow-hidden">
            <DialogHeader className="text-left sm:text-left mb-6">
              <DialogTitle className="text-2xl font-bold text-slate-900 mb-1">
                Добавление сотрудника
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Введите данные сотрудника. Если пользователь уже зарегистрирован в системе, мы добавим ему права сотрудника. Если нет — создадим новый аккаунт.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Номер телефона</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    type="tel"
                    required
                    placeholder="+7XXXXXXXXXX"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="pl-10 py-5 border-slate-200 rounded-xl focus-visible:ring-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">ФИО сотрудника</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Иван Иванов"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="pl-10 py-5 border-slate-200 rounded-xl focus-visible:ring-slate-900"
                  />
                </div>
              </div>

              {/* Status alerts */}
              {addError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2.5 text-sm text-red-700 mt-2">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                  <span>{addError}</span>
                </div>
              )}

              {addSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-start gap-2.5 text-sm text-emerald-700 mt-2">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{addSuccessMessage}</span>
                </div>
              )}

              <DialogFooter className="mt-8 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border-slate-200 hover:bg-slate-50 flex-1 py-5"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={isAdding}
                  className="bg-black hover:bg-slate-800 text-white rounded-xl flex-1 py-5 shadow-lg shadow-black/5"
                >
                  {isAdding ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Подтвердить"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Revoke Access Dialog */}
        <Dialog open={!!revokingUser} onOpenChange={(open) => !open && setRevokingUser(null)}>
          <DialogContent className="rounded-3xl max-w-md border-none shadow-2xl p-6 bg-white overflow-hidden">
            <DialogHeader className="text-center sm:text-center mb-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                <ShieldAlert className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="text-2xl font-bold text-slate-900 mb-2">
                Отозвать доступ?
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 leading-relaxed px-2">
                Вы собираетесь закрыть административный доступ сотруднику <strong className="text-slate-900">{revokingUser?.full_name}</strong> ({revokingUser?.phone_number}).
                Он больше не сможет зайти в панель CRM или просматривать статистику. Его аккаунт останется в системе как обычный клиент.
              </DialogDescription>
            </DialogHeader>

            {revokeError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2.5 text-sm text-red-700 mb-4">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                <span>{revokeError}</span>
              </div>
            )}

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                disabled={isRevoking}
                onClick={() => setRevokingUser(null)}
                className="rounded-xl border-slate-200 hover:bg-slate-50 flex-1 py-5"
              >
                Отмена
              </Button>
              <Button
                onClick={handleRevokeAccess}
                disabled={isRevoking}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl flex-1 py-5 shadow-lg shadow-red-600/5 border-none"
              >
                {isRevoking ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  "Отозвать доступ"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
