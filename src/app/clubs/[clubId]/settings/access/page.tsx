"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Loader2,
  Check,
  AlertTriangle,
  Settings2,
  Users,
  LayoutDashboard,
  Clock,
  Box,
  DollarSign,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { PageShell, PageHeader } from "@/components/layout/PageShell";

type AccessLevel = "none" | "view" | "edit";

interface Role {
  id: number;
  name: string;
  employee_access_settings: Record<string, any>;
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

export default function AccessSettingsPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const [clubId, setClubId] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setClubId(p.clubId);
      fetchRoles(p.clubId);
    });
  }, [params]);

  const fetchRoles = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/clubs/${id}/settings/permissions`);
      const data = await res.json();
      if (res.ok) {
        setRoles(data.roles || []);
        setCanEdit(!!data.canEdit);
        if (data.roles?.length > 0 && !selectedRoleId) {
          setSelectedRoleId(data.roles[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSetting = async (
    roleId: number,
    key: string,
    value: any,
  ) => {
    if (!canEdit) return;
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;

    const newSettings = { ...role.employee_access_settings, [key]: value };

    // Optimistic update
    setRoles(
      roles.map((r) =>
        r.id === roleId ? { ...r, employee_access_settings: newSettings } : r,
      ),
    );

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/clubs/${clubId}/settings/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId,
          employee_access_settings: newSettings,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        fetchRoles(clubId);
      }
    } catch (error) {
      console.error("Error updating role:", error);
      fetchRoles(clubId);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  if (isLoading && roles.length === 0) {
    return (
      <PageShell maxWidth="4xl">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="5xl">
      <PageHeader
        title="Управление доступом"
        description="Настройте права для кастомизируемых ролей в вашем клубе"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32">
        {/* Roles List */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 px-1">
            Настраиваемые роли
          </h3>

          {roles.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl text-center">
              <Shield className="h-8 w-8 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">
                Нет кастомизируемых ролей. Обратитесь к главному администратору.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={cn(
                    "group cursor-pointer p-4 rounded-2xl border transition-all",
                    selectedRoleId === role.id
                      ? "bg-slate-900 border-slate-900 text-white shadow-lg"
                      : "bg-white border-slate-200 hover:border-slate-300 text-slate-900",
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Shield
                        className={cn(
                          "h-4 w-4",
                          selectedRoleId === role.id
                            ? "text-slate-400"
                            : "text-slate-400",
                        )}
                      />
                      <h3 className="font-bold tracking-tight">{role.name}</h3>
                    </div>
                  </div>
                  {role.employee_access_settings.employee_only && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] border-amber-500/50 text-amber-500",
                        selectedRoleId === role.id &&
                          "border-amber-400 text-amber-400",
                      )}
                    >
                      Только смена
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-3xl space-y-3 mt-8">
            <div className="flex items-center gap-2 text-slate-700">
              <Info className="h-4 w-4" />
              <h4 className="text-sm font-medium">Подсказка</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {!canEdit
                ? "У вас доступ только для просмотра. Изменять права может только владелец."
                : "Эти изменения применяются только к вашему клубу. Глобальные роли не затрагиваются."}
            </p>
          </div>
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
                        Локальная матрица прав доступа к модулям
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
                        disabled={!canEdit}
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
                        disabled={!canEdit}
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
                          disabled={!canEdit}
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
                            disabled={!canEdit}
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
                          disabled={!canEdit}
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
                            disabled={!canEdit}
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
                          disabled={!canEdit}
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
                            disabled={!canEdit}
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
                            disabled={!canEdit}
                          />
                        ),
                      )}
                    </div>
                  </section>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="hidden h-full min-h-[500px] rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 md:flex flex-col items-center justify-center p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300 mb-4 shadow-sm">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Выберите роль
              </h3>
              <p className="text-sm text-slate-500 max-w-[280px] mt-1">
                Выберите роль из списка слева, чтобы настроить её права для
                вашего клуба
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
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
  disabled = false,
}: {
  roleId: number;
  settingKey: string;
  settings: Record<string, any>;
  onUpdate: (id: number, key: string, val: string) => void;
  disabled?: boolean;
}) {
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
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-colors",
        disabled
          ? "bg-slate-50/50 border-slate-100 opacity-70"
          : "border-slate-200 bg-white shadow-sm hover:border-slate-300",
      )}
    >
      <div>
        <Label className="text-sm font-bold">{config.label}</Label>
        <p className="text-xs text-slate-500 mt-0.5">{config.desc}</p>
      </div>

      <div
        className={cn(
          "flex bg-slate-100 p-1 rounded-xl shrink-0",
          disabled && "opacity-50 pointer-events-none",
        )}
      >
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
  disabled = false,
}: {
  label: string;
  description?: string;
  active: boolean;
  onToggle: (v: boolean) => void;
  variant?: "default" | "warning" | "danger";
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 p-4 rounded-2xl border transition-all",
        disabled
          ? "bg-slate-50/50 border-slate-100 opacity-70"
          : active
            ? "bg-white border-slate-200 shadow-sm"
            : "bg-slate-50/50 border-slate-100 opacity-80",
      )}
    >
      <div className="flex-1 space-y-1">
        <div
          className={cn(
            "flex items-center gap-2",
            disabled && "pointer-events-none",
          )}
        >
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
        disabled={disabled}
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
  disabled = false,
}: {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 rounded-2xl border transition-all",
        disabled
          ? "bg-slate-50/50 border-slate-100 opacity-70"
          : "bg-white border-slate-200 shadow-sm",
      )}
    >
      <div className="flex-1 space-y-1">
        <Label className={cn("text-sm font-bold", disabled && "opacity-70")}>
          {label}
        </Label>
        {description && (
          <p className="text-xs text-slate-500 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
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
