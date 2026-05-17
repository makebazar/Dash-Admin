"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Loader2,
  Search,
  Check,
  AlertTriangle,
  Settings2,
  Users,
  LayoutDashboard,
  Clock,
  Box,
  DollarSign,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AccessLevel = "none" | "view" | "edit";

interface Role {
  id: number;
  name: string;
  is_customizable: boolean;
  employee_access_settings: Record<string, any>;
  users_count: number;
  club_employees_count: number;
}

const MODULE_LABELS: Record<string, { label: string; desc: string }> = {
  employees_access: {
    label: "Управление сотрудниками",
    desc: "Доступ к списку команды, найму и профилям",
  },
  salaries_access: {
    label: "Зарплаты",
    desc: "Расчет, выплаты, штрафы и бонусы",
  },
  schedule_access: {
    label: "График смен",
    desc: "Просмотр и редактирование графиков",
  },
  requests_access: {
    label: "Запросы",
    desc: "Обработка отгулов, замен и обращений",
  },
  shifts_access: {
    label: "История смен",
    desc: "Просмотр закрытых смен и отчетов",
  },
  reviews_access: {
    label: "Центр проверок (Оценки)",
    desc: "Аудиты рабочих мест, фотоотчеты",
  },
  tasks_access: {
    label: "Сервисные задачи",
    desc: "Тех. обслуживание, прачечная",
  },
  inventory_access: { label: "Склад", desc: "Учет товаров, приход, списания" },
  equipment_access: {
    label: "Оборудование",
    desc: "Добавление ПК, ремонт, перемещения",
  },
  signage_access: {
    label: "Управление экранами",
    desc: "Телевизоры и трансляции",
  },
  finance_access: { label: "Финансы", desc: "P&L, расходы, доходы, кассы" },
  dashboard_access: {
    label: "Аналитика (Дашборд)",
    desc: "Главные цифры клуба",
  },
  kb_access: { label: "База знаний", desc: "Создание и редактирование статей" },
  settings_general_access: {
    label: "Общие настройки",
    desc: "Конфигурация, таймзоны, режимы работы",
  },
  settings_salary_access: {
    label: "Настройки зарплат",
    desc: "Схемы, ставки, параметры KPI",
  },
  settings_reports_access: {
    label: "Шаблоны отчетов",
    desc: "Конфигурация кассовых отчетов",
  },
  settings_checklists_access: {
    label: "Настройки чеклистов",
    desc: "Задачи на смену, приемка/сдача",
  },
};

const EMPLOYEE_FLAGS: Record<
  string,
  {
    label: string;
    desc: string;
    type: "boolean" | "select";
    options?: { value: string; label: string }[];
  }
> = {
  shift_start_enabled: {
    label: "Разрешить начало смены",
    desc: "Доступ к кнопке открытия смены",
    type: "boolean",
  },
  shift_end_mode: {
    label: "Режим закрытия смены",
    desc: "Требуется ли кассовый отчет при закрытии",
    type: "select",
    options: [
      { value: "FULL_REPORT", label: "Полный кассовый отчет" },
      { value: "NO_REPORT", label: "Без отчета" },
    ],
  },
  handover_checklist_on_start: {
    label: "Чеклист при открытии",
    desc: "Проверка оборудования и зон",
    type: "select",
    options: [
      { value: "DISABLED", label: "Отключен" },
      { value: "OPTIONAL", label: "По желанию" },
      { value: "REQUIRED", label: "Обязателен" },
    ],
  },
  closing_checklist_enabled: {
    label: "Чеклист при закрытии",
    desc: "Финальная проверка зон перед уходом",
    type: "boolean",
  },
  shift_zone_handover_enabled: {
    label: "Передача зон (принятие смены)",
    desc: "Инвентаризация холодильников/витрин",
    type: "boolean",
  },
  inventory_actions_enabled: {
    label: "Действия со складом на смене",
    desc: "Списания, приход, продажа",
    type: "boolean",
  },
  maintenance_enabled: {
    label: "Работа с задачами",
    desc: "Обслуживание ПК, прачечная",
    type: "boolean",
  },
  schedule_enabled: {
    label: "Просмотр своего графика",
    desc: "Доступ к календарю смен",
    type: "boolean",
  },
  requests_enabled: {
    label: "Отправка запросов",
    desc: "Замена, больничный, аванс",
    type: "boolean",
  },
  workstations_view_enabled: {
    label: "Мониторинг рабочих мест",
    desc: "Просмотр статуса ПК в зале",
    type: "boolean",
  },
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [reassignToRoleId, setReassignToRoleId] = useState<string>("");

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/dashadmin-x/roles");
      const data = await res.json();
      if (res.ok) {
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/dashadmin-x/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName.trim() }),
      });
      if (res.ok) {
        await fetchRoles();
        setIsCreateDialogOpen(false);
        setNewRoleName("");
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при создании роли");
      }
    } catch (error) {
      console.error("Error creating role:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/dashadmin-x/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: roleToDelete.id,
          reassignRoleId: reassignToRoleId || null,
        }),
      });
      if (res.ok) {
        await fetchRoles();
        setIsDeleteDialogOpen(false);
        setRoleToDelete(null);
        setReassignToRoleId("");
        if (selectedRoleId === roleToDelete.id) {
          setSelectedRoleId(null);
        }
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка при удалении роли");
      }
    } catch (error) {
      console.error("Error deleting role:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSetting = async (
    roleId: number,
    key: string,
    value: any,
    isTopLevel: boolean = false,
  ) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;

    let updatedRole = { ...role };
    let payload: any = { roleId };

    if (isTopLevel) {
      updatedRole = { ...updatedRole, [key]: value };
      payload[key] = value;
    } else {
      const newSettings = { ...role.employee_access_settings, [key]: value };
      updatedRole = { ...updatedRole, employee_access_settings: newSettings };
      payload.employee_access_settings = newSettings;
    }

    // Optimistic update
    setRoles(roles.map((r) => (r.id === roleId ? updatedRole : r)));

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/dashadmin-x/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        fetchRoles();
      }
    } catch (error) {
      console.error("Error updating role:", error);
      fetchRoles();
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  if (isLoading && roles.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Управление ролями
          </h1>
          <p className="text-slate-500 mt-1">
            Детальная настройка RBAC (Role-Based Access Control)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Поиск роли..."
              className="pl-9 h-10 rounded-xl border-slate-200 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="h-10 px-4 bg-black text-white hover:bg-slate-800 rounded-xl flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Создать роль</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Roles List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">
            Список ролей
          </div>
          {filteredRoles.map((role) => (
            <div
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={cn(
                "group cursor-pointer p-4 rounded-2xl border transition-all relative",
                selectedRoleId === role.id
                  ? "bg-black border-black text-white shadow-lg"
                  : "bg-white border-slate-200 hover:border-slate-300 text-slate-900",
              )}
            >
              {role.name !== "Админ" && role.name !== "Управляющий" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRoleToDelete(role);
                    setIsDeleteDialogOpen(true);
                  }}
                  className={cn(
                    "absolute top-4 right-4 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100",
                    selectedRoleId === role.id
                      ? "hover:bg-white/20 text-white/60 hover:text-white"
                      : "hover:bg-rose-50 text-slate-300 hover:text-rose-500",
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <div className="flex items-center justify-between mb-2 pr-8">
                <h3 className="font-bold tracking-tight">{role.name}</h3>
                <Badge
                  variant={selectedRoleId === role.id ? "secondary" : "outline"}
                  className={cn(
                    "text-[10px]",
                    selectedRoleId === role.id &&
                      "bg-white/20 border-transparent text-white",
                  )}
                >
                  ID {role.id}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs opacity-70">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>
                    {role.users_count + role.club_employees_count} чел.
                  </span>
                </div>
                {role.employee_access_settings.employee_only && (
                  <Badge
                    variant="outline"
                    className="text-[9px] border-amber-500/50 text-amber-500"
                  >
                    Только смена
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Settings Editor */}
        <div className="lg:col-span-8">
          {selectedRole ? (
            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-black flex items-center justify-center text-white">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold">
                        {selectedRole.name}
                      </CardTitle>
                      <CardDescription>
                        Матрица прав доступа к модулям
                      </CardDescription>
                    </div>
                  </div>
                  {isSaving ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  ) : saveSuccess ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-sm animate-in fade-in slide-in-from-right-2">
                      <Check className="h-4 w-4" />
                      Сохранено
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="space-y-12">
                  {/* 0. Critical Access */}
                  <section>
                    <SectionHeader
                      icon={Settings2}
                      title="Критический доступ"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <BooleanSettingItem
                        label="Разрешить редактирование владельцам"
                        description="Если включено, владелец клуба сможет настраивать права этой роли для своего клуба."
                        active={!!selectedRole.is_customizable}
                        onToggle={(v) =>
                          handleUpdateSetting(
                            selectedRole.id,
                            "is_customizable",
                            v,
                            true,
                          )
                        }
                      />
                      <BooleanSettingItem
                        label="Только кабинет сотрудника"
                        description="Отключает доступ в управ-кабинет полностью."
                        active={
                          !!selectedRole.employee_access_settings.employee_only
                        }
                        onToggle={(v) =>
                          handleUpdateSetting(
                            selectedRole.id,
                            "employee_only",
                            v,
                          )
                        }
                        variant="warning"
                      />
                      <BooleanSettingItem
                        label="Полный доступ (Владелец)"
                        description="Переопределяет все флаги ниже, давая полные права на всё."
                        active={
                          !!selectedRole.employee_access_settings.is_full_access
                        }
                        onToggle={(v) =>
                          handleUpdateSetting(
                            selectedRole.id,
                            "is_full_access",
                            v,
                          )
                        }
                        variant="danger"
                      />
                    </div>
                  </section>

                  {/* 1. Команда и HR */}
                  <section>
                    <SectionHeader icon={Users} title="Команда и HR" />
                    <div className="space-y-3">
                      {[
                        "employees_access",
                        "salaries_access",
                        "schedule_access",
                        "requests_access",
                      ].map((key) => (
                        <AccessLevelItem
                          key={key}
                          roleId={selectedRole.id}
                          settingKey={key}
                          settings={selectedRole.employee_access_settings}
                          onUpdate={handleUpdateSetting}
                        />
                      ))}
                    </div>
                  </section>

                  {/* 2. Операции и Смены */}
                  <section>
                    <SectionHeader icon={Clock} title="Операции и Смены" />
                    <div className="space-y-3">
                      {["shifts_access", "reviews_access", "tasks_access"].map(
                        (key) => (
                          <AccessLevelItem
                            key={key}
                            roleId={selectedRole.id}
                            settingKey={key}
                            settings={selectedRole.employee_access_settings}
                            onUpdate={handleUpdateSetting}
                          />
                        ),
                      )}
                    </div>
                  </section>

                  {/* 3. Активы и Инфраструктура */}
                  <section>
                    <SectionHeader icon={Box} title="Активы и Инфраструктура" />
                    <div className="space-y-3">
                      {[
                        "inventory_access",
                        "equipment_access",
                        "signage_access",
                      ].map((key) => (
                        <AccessLevelItem
                          key={key}
                          roleId={selectedRole.id}
                          settingKey={key}
                          settings={selectedRole.employee_access_settings}
                          onUpdate={handleUpdateSetting}
                        />
                      ))}
                    </div>
                  </section>

                  {/* 4. Финансы и Данные */}
                  <section>
                    <SectionHeader icon={DollarSign} title="Финансы и Данные" />
                    <div className="space-y-3">
                      {["finance_access", "dashboard_access", "kb_access"].map(
                        (key) => (
                          <AccessLevelItem
                            key={key}
                            roleId={selectedRole.id}
                            settingKey={key}
                            settings={selectedRole.employee_access_settings}
                            onUpdate={handleUpdateSetting}
                          />
                        ),
                      )}
                    </div>
                  </section>

                  {/* 5. Настройки */}
                  <section>
                    <SectionHeader
                      icon={Settings2}
                      title="Системные Настройки"
                    />
                    <div className="space-y-3">
                      {[
                        "settings_general_access",
                        "settings_salary_access",
                        "settings_reports_access",
                        "settings_checklists_access",
                      ].map((key) => (
                        <AccessLevelItem
                          key={key}
                          roleId={selectedRole.id}
                          settingKey={key}
                          settings={selectedRole.employee_access_settings}
                          onUpdate={handleUpdateSetting}
                        />
                      ))}
                    </div>
                  </section>

                  <hr className="border-slate-100" />

                  {/* Employee Shift Flags */}
                  <section>
                    <SectionHeader
                      icon={LayoutDashboard}
                      title="Права в рабочем кабинете (смена)"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(EMPLOYEE_FLAGS).map(([key, config]) =>
                        config.type === "boolean" ? (
                          <BooleanSettingItem
                            key={key}
                            label={config.label}
                            description={config.desc}
                            active={
                              !!selectedRole.employee_access_settings[key]
                            }
                            onToggle={(v) =>
                              handleUpdateSetting(selectedRole.id, key, v)
                            }
                          />
                        ) : (
                          <SelectSettingItem
                            key={key}
                            label={config.label}
                            description={config.desc}
                            value={
                              selectedRole.employee_access_settings[key] ||
                              config.options?.[0]?.value ||
                              ""
                            }
                            options={config.options || []}
                            onChange={(v) =>
                              handleUpdateSetting(selectedRole.id, key, v)
                            }
                          />
                        ),
                      )}
                    </div>
                  </section>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full min-h-[500px] rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300 mb-4 shadow-sm">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Выберите роль
              </h3>
              <p className="text-sm text-slate-500 max-w-70 mt-1">
                Нажмите на роль из списка слева, чтобы настроить её права
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden max-w-md">
          <DialogHeader className="p-8 bg-black text-white">
            <DialogTitle className="text-2xl font-bold">Новая роль</DialogTitle>
            <p className="text-slate-400 text-sm mt-1">
              Создайте новую роль для системы
            </p>
          </DialogHeader>
          <div className="p-8 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Название роли
              </Label>
              <Input
                placeholder="Напр. Супервайзер"
                className="h-12 rounded-2xl border-slate-200"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setIsCreateDialogOpen(false)}
              className="rounded-xl"
            >
              Отмена
            </Button>
            <Button
              onClick={handleCreateRole}
              disabled={isSaving || !newRoleName.trim()}
              className="bg-black text-white hover:bg-slate-800 rounded-xl px-8"
            >
              {isSaving ? "Создание..." : "Создать роль"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden max-w-md">
          <DialogHeader className="p-8 bg-rose-600 text-white">
            <DialogTitle className="text-2xl font-bold">
              Удаление роли
            </DialogTitle>
            <p className="text-rose-100 text-sm mt-1">
              Вы уверены, что хотите удалить роль "{roleToDelete?.name}"?
            </p>
          </DialogHeader>
          <div className="p-8 space-y-6">
            {(roleToDelete?.users_count || 0) +
              (roleToDelete?.club_employees_count || 0) >
            0 ? (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3 text-amber-800">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">
                    У этой роли есть активные пользователи (
                    {(roleToDelete?.users_count || 0) +
                      (roleToDelete?.club_employees_count || 0)}{" "}
                    чел.). Выберите роль, которой они будут назначены после
                    удаления.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Переназначить на роль
                  </Label>
                  <Select
                    value={reassignToRoleId}
                    onValueChange={setReassignToRoleId}
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {roles
                        .filter((r) => r.id !== roleToDelete?.id)
                        .map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <p className="text-slate-600">
                Это действие необратимо. Роль будет полностью удалена из
                системы.
              </p>
            )}
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="rounded-xl"
            >
              Отмена
            </Button>
            <Button
              onClick={handleDeleteRole}
              disabled={
                isSaving ||
                ((roleToDelete?.users_count || 0) +
                  (roleToDelete?.club_employees_count || 0) >
                  0 &&
                  !reassignToRoleId)
              }
              className="bg-rose-600 text-white hover:bg-rose-700 rounded-xl px-8"
            >
              {isSaving ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <Icon className="h-4 w-4 text-slate-400" />
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">
        {title}
      </h4>
    </div>
  );
}

function AccessLevelItem({
  roleId,
  settingKey,
  settings,
  onUpdate,
}: {
  roleId: number;
  settingKey: string;
  settings: Record<string, any>;
  onUpdate: (id: number, key: string, val: string) => void;
}) {
  // Resolve current level. If missing, default to 'none'.
  // If it's a legacy boolean flag disguised as a module (before migration), we handle it safely.
  let currentLevel: AccessLevel = "none";
  if (
    settings[settingKey] === "edit" ||
    settings[settingKey] === "view" ||
    settings[settingKey] === "none"
  ) {
    currentLevel = settings[settingKey];
  } else if (settings[settingKey] === true) {
    currentLevel = "edit";
  }

  const config = MODULE_LABELS[settingKey];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-slate-300 transition-colors">
      <div>
        <Label className="text-sm font-bold">{config.label}</Label>
        <p className="text-xs text-slate-500 mt-0.5">{config.desc}</p>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
        <button
          onClick={() => onUpdate(roleId, settingKey, "none")}
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
            currentLevel === "none"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          Нет
        </button>
        <button
          onClick={() => onUpdate(roleId, settingKey, "view")}
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
            currentLevel === "view"
              ? "bg-blue-50 text-blue-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          Чтение
        </button>
        <button
          onClick={() => onUpdate(roleId, settingKey, "edit")}
          className={cn(
            "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
            currentLevel === "edit"
              ? "bg-emerald-50 text-emerald-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          Полный
        </button>
      </div>
    </div>
  );
}

function BooleanSettingItem({
  label,
  description,
  active,
  onToggle,
  variant = "default",
}: {
  label: string;
  description?: string;
  active: boolean;
  onToggle: (v: boolean) => void;
  variant?: "default" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 p-4 rounded-2xl border transition-all",
        active
          ? "bg-white border-slate-200 shadow-sm"
          : "bg-slate-50/50 border-slate-100 opacity-80",
      )}
    >
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Label
            className="text-sm font-bold cursor-pointer"
            onClick={() => onToggle(!active)}
          >
            {label}
          </Label>
          {variant === "warning" && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          )}
          {variant === "danger" && (
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
          )}
        </div>
        {description && (
          <p className="text-xs text-slate-500 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Switch
        checked={active}
        onCheckedChange={onToggle}
        className={cn(
          active &&
            variant === "warning" &&
            "data-[state=checked]:bg-amber-500",
          active && variant === "danger" && "data-[state=checked]:bg-rose-500",
        )}
      />
    </div>
  );
}

function SelectSettingItem({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border bg-white border-slate-200 shadow-sm transition-all">
      <div className="flex-1 space-y-1">
        <Label className="text-sm font-bold">{label}</Label>
        {description && (
          <p className="text-xs text-slate-500 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
