"use client";

import React, { useState } from "react";
import {
  MapPin,
  Users,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QRCode } from "@/components/qr/QRCode";

interface HallZone {
  id: string;
  title: string;
  description?: string;
  source?: "custom" | "smartshell";
}

interface GeneralTabProps {
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
  clubId: string | string[];
  zones?: any[];
  onZonesUpdated?: () => void;
}

export function GeneralTab({
  settings,
  saveSettings,
  clubId,
  zones = [],
  onZonesUpdated,
}: GeneralTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "general" | "zones" | "limits" | "groups" | "qr"
  >("general");

  const [copiedLink, setCopiedLink] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  if (!settings) return null;

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://game.mydashadmin.ru";

  const qrUrl = `${origin}/promo?clubId=${clubId}&action=checkin`;

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(qrUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Зоны зала
  // ─────────────────────────────────────────────────────────
  const customZones: HallZone[] = settings.zones || [];

  const handleAddZone = async (titleToAdd?: string) => {
    const title = (titleToAdd || newZoneName).trim();
    if (!title) return;

    if (customZones.some((z) => z.title.toLowerCase() === title.toLowerCase())) {
      alert("Зона с таким названием уже существует");
      return;
    }

    const newZone: HallZone = {
      id: "zone_" + Math.random().toString(36).substring(2, 9),
      title,
      source: "custom",
    };

    const updated = [...customZones, newZone];
    await saveSettings({
      ...settings,
      zones: updated,
    });
    setNewZoneName("");
    onZonesUpdated?.();
  };

  const handleRemoveZone = async (id: string) => {
    if (!confirm("Удалить эту зону зала?")) return;
    const updated = customZones.filter((z) => z.id !== id);
    await saveSettings({
      ...settings,
      zones: updated,
    });
    onZonesUpdated?.();
  };

  // ─────────────────────────────────────────────────────────
  // Группы лимитов
  // ─────────────────────────────────────────────────────────
  const limitGroups: Array<{ id: string; name: string }> =
    settings.limit_groups || [];

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;

    if (limitGroups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      alert("Группа с таким названием уже существует");
      return;
    }

    const newGroup = {
      id: "group_" + Math.random().toString(36).substring(2, 9),
      name,
    };

    await saveSettings({
      ...settings,
      limit_groups: [...limitGroups, newGroup],
    });
    setNewGroupName("");
  };

  const handleRemoveGroup = async (id: string) => {
    if (!confirm("Удалить эту группу пользователей?")) return;
    const updated = limitGroups.filter((g) => g.id !== id);
    await saveSettings({
      ...settings,
      limit_groups: updated,
    });
  };

  // ─────────────────────────────────────────────────────────
  // Ступени лимитов вывода
  // ─────────────────────────────────────────────────────────
  const withdrawSteps: Array<{
    id: string;
    amount: number;
    percent: number;
    group_amounts?: Record<string, number>;
  }> = settings.withdraw_limit_steps || [];

  const handleAddStep = async () => {
    const newStep = {
      id: "step_" + Math.random().toString(36).substring(2, 9),
      amount: 1000,
      percent: 50,
      group_amounts: {},
    };
    await saveSettings({
      ...settings,
      withdraw_limit_steps: [...withdrawSteps, newStep],
    });
  };

  const handleRemoveStep = async (id: string) => {
    const updated = withdrawSteps.filter((s) => s.id !== id);
    await saveSettings({
      ...settings,
      withdraw_limit_steps: updated,
    });
  };

  interface SubTabItem {
    id: "general" | "zones" | "limits" | "groups" | "qr";
    label: string;
    count?: number;
  }

  const SUB_TABS: SubTabItem[] = [
    { id: "general", label: "Основные" },
    { id: "zones", label: "Зоны зала", count: zones?.length || customZones.length },
    { id: "limits", label: "Лимиты на вывод" },
    { id: "groups", label: "Группы клиентов", count: limitGroups.length },
    { id: "qr", label: "QR и ссылка" },
  ];

  const ZONE_PRESETS = [
    "VIP зал",
    "Bootcamp",
    "Общий зал (Standart)",
    "PS5 Lounge",
    "Стримерская",
    "Автосимуляторы",
  ];

  return (
    <div className="space-y-6">
      {/* Sub Tabs Navigation */}
      <div className="flex items-center bg-white p-1 sm:p-1.5 rounded-xl border border-slate-200 shadow-xs gap-1 overflow-x-auto scrollbar-hide">
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={cn(
                "px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
                isActive
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.2 rounded-md font-bold",
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 1. ОСНОВНЫЕ НАСТРОЙКИ */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeSubTab === "general" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Базовые правила промо
              </h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Глобальные переключатели активности и начислений
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Промо активно */}
              <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-xl border border-slate-200/60">
                <div>
                  <div className="font-semibold text-sm text-slate-900">
                    Промо-система активна
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Глобальный переключатель работы всей системы в клубе
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      is_promo_active: settings.is_promo_active !== false ? false : true,
                    })
                  }
                  className={cn(
                    "w-11 h-6 rounded-full relative transition-colors duration-200 cursor-pointer shrink-0",
                    settings.is_promo_active !== false ? "bg-slate-900" : "bg-slate-300"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200",
                      settings.is_promo_active !== false ? "left-6" : "left-1"
                    )}
                  />
                </button>
              </div>

              {/* Начисление за пополнения */}
              <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-xl border border-slate-200/60">
                <div>
                  <div className="font-semibold text-sm text-slate-900">
                    Начисление билетов за пополнение
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Автоматическая выдача билетов при пополнении баланса гостя
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      topup_accrual_enabled:
                        settings.topup_accrual_enabled !== false ? false : true,
                    })
                  }
                  className={cn(
                    "w-11 h-6 rounded-full relative transition-colors duration-200 cursor-pointer shrink-0",
                    settings.topup_accrual_enabled !== false ? "bg-slate-900" : "bg-slate-300"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200",
                      settings.topup_accrual_enabled !== false ? "left-6" : "left-1"
                    )}
                  />
                </button>
              </div>

              {/* Welcome билеты */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-slate-900">
                      Welcome-билеты новым гостям
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Стартовый бонус билетов при первой авторизации игрока
                    </div>
                  </div>
                </div>
                <div className="pt-1">
                  <input
                    type="number"
                    min="0"
                    value={settings.welcome_bonus_tickets ?? 0}
                    onChange={(e) =>
                      saveSettings({
                        ...settings,
                        welcome_bonus_tickets: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl h-10 px-3.5 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none"
                    placeholder="Количество билетов (например, 3)"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick link & QR preview */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-5 sm:p-6 space-y-5">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Приложение для гостей
              </h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Ссылка и QR-код для гостей вашего клуба
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Прямая ссылка
              </span>
              <div className="text-xs font-mono text-slate-700 bg-white border border-slate-200 p-2.5 rounded-lg break-all select-all">
                {qrUrl}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-all shadow-xs cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Скопировано!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Скопировать ссылку</span>
                    </>
                  )}
                </button>
                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-xs"
                >
                  <span>Открыть</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50/70 border border-slate-200/60 rounded-xl">
              <span className="text-xs text-slate-600 font-medium">
                QR-код для ресепшена и столов
              </span>
              <button
                type="button"
                onClick={() => setActiveSubTab("qr")}
                className="text-xs font-semibold text-slate-900 hover:underline cursor-pointer"
              >
                Открыть QR-код →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 2. ЗОНЫ ЗАЛА */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeSubTab === "zones" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Игровые зоны зала
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Настройка зон клуба для раздельного начисления билетов и программ лояльности
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              {/* Пресеты быстрого добавления */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700">
                  Быстрое добавление зоны:
                </span>
                <div className="flex flex-wrap gap-2">
                  {ZONE_PRESETS.map((preset) => {
                    const alreadyExists = customZones.some(
                      (z) => z.title.toLowerCase() === preset.toLowerCase()
                    );
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={alreadyExists}
                        onClick={() => handleAddZone(preset)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer",
                          alreadyExists
                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-xs"
                        )}
                      >
                        + {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Форма добавления кастомной зоны */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddZone()}
                  placeholder="Введите название зоны (например: VIP 2 или Автосимуляторы)"
                  className="flex-1 bg-white border border-slate-200 rounded-xl h-10 px-3.5 text-sm font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddZone()}
                  className="h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-medium transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить зону</span>
                </button>
              </div>

              {/* Список зон */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Активные зоны ({zones.length || customZones.length})
                  </span>
                </div>

                {(zones.length === 0 && customZones.length === 0) ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                    <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">Зоны еще не настроены</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Добавьте зоны вручную кнопками сверху или синхронизируйте со SmartShell.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Объединяем зоны: SmartShell + custom */}
                    {(zones.length > 0 ? zones : customZones).map((zone: any) => {
                      const isSmartShell = zone.source === "smartshell";
                      const canDelete = !isSmartShell || customZones.some((z) => z.id === zone.id);

                      return (
                        <div
                          key={zone.id}
                          className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900 truncate">
                                {zone.title}
                              </h4>
                              {isSmartShell && (
                                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200/60 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                  SmartShell
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                              ID: {zone.id}
                            </span>
                          </div>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleRemoveZone(zone.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Удалить зону"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 3. ЛИМИТЫ НА ВЫВОД */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeSubTab === "limits" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Лимиты на вывод бонусов
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Ограничение суммы перевода выигранных бонусов на игровой баланс ПК
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  saveSettings({
                    ...settings,
                    withdraw_limit_enabled: settings.withdraw_limit_enabled !== true,
                  })
                }
                className={cn(
                  "w-11 h-6 rounded-full relative transition-colors duration-200 cursor-pointer shrink-0",
                  settings.withdraw_limit_enabled === true ? "bg-slate-900" : "bg-slate-300"
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200",
                    settings.withdraw_limit_enabled === true ? "left-6" : "left-1"
                  )}
                />
              </button>
            </div>

            {settings.withdraw_limit_enabled !== true ? (
              <div className="p-8 text-center bg-slate-50/50 text-slate-400 text-xs sm:text-sm">
                Лимиты на вывод отключены. Игроки могут выводить бонусы без ограничений по сумме пополнений.
              </div>
            ) : (
              <div className="p-5 sm:p-6 space-y-6">
                {/* Режим лимитов */}
                <div className="p-4 bg-slate-50/70 border border-slate-200/60 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-slate-900">
                        Ступенчатый лимит вывода
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Позволяет увеличивать % вывода при росте суммарных пополнений за месяц
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        saveSettings({
                          ...settings,
                          withdraw_limit_step_enabled:
                            settings.withdraw_limit_step_enabled !== true,
                        })
                      }
                      className={cn(
                        "w-11 h-6 rounded-full relative transition-colors duration-200 cursor-pointer shrink-0",
                        settings.withdraw_limit_step_enabled === true
                          ? "bg-slate-900"
                          : "bg-slate-300"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200",
                          settings.withdraw_limit_step_enabled === true ? "left-6" : "left-1"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {settings.withdraw_limit_step_enabled !== true ? (
                  /* Фиксированный процент */
                  <div className="max-w-md space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Разрешенный процент от пополнений за месяц (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={settings.withdraw_limit_percent ?? 50}
                      onChange={(e) =>
                        saveSettings({
                          ...settings,
                          withdraw_limit_percent: parseInt(e.target.value) || 50,
                        })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl h-10 px-3.5 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Пример: при пополнении на 1 000 ₽ игрок сможет вывести до{" "}
                      {Math.round(1000 * ((settings.withdraw_limit_percent ?? 50) / 100))} ₽ бонусов.
                    </p>
                  </div>
                ) : (
                  /* Ступенчатая шкала */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Шкала порогов пополнения
                      </span>
                      <button
                        type="button"
                        onClick={handleAddStep}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Добавить шаг</span>
                      </button>
                    </div>

                    {withdrawSteps.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl text-slate-400 font-medium text-xs">
                        Пороги пока не настроены. Нажмите «Добавить шаг».
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {withdrawSteps.map((step, idx) => (
                          <div
                            key={step.id || idx}
                            className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3"
                          >
                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                              <span className="text-xs font-bold text-slate-800">
                                Ступень {idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveStep(step.id)}
                                className="text-xs font-medium text-rose-500 hover:text-rose-600 cursor-pointer"
                              >
                                Удалить
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500">
                                  Сумма пополнений от (₽)
                                </label>
                                <input
                                  type="number"
                                  value={step.amount || 0}
                                  onChange={(e) => {
                                    const updated = [...withdrawSteps];
                                    updated[idx] = {
                                      ...updated[idx],
                                      amount: parseFloat(e.target.value) || 0,
                                    };
                                    saveSettings({
                                      ...settings,
                                      withdraw_limit_steps: updated,
                                    });
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-sm text-slate-900 outline-none focus:border-slate-900"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500">
                                  Лимит на вывод (%)
                                </label>
                                <input
                                  type="number"
                                  value={step.percent || 0}
                                  onChange={(e) => {
                                    const updated = [...withdrawSteps];
                                    updated[idx] = {
                                      ...updated[idx],
                                      percent: parseFloat(e.target.value) || 0,
                                    };
                                    saveSettings({
                                      ...settings,
                                      withdraw_limit_steps: updated,
                                    });
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-sm text-slate-900 outline-none focus:border-slate-900"
                                />
                              </div>
                            </div>

                            {/* Group overrides */}
                            {limitGroups.length > 0 && (
                              <div className="border-t border-slate-200/60 pt-2.5 space-y-2">
                                <span className="text-[11px] font-semibold text-slate-600 block">
                                  Переопределение для групп клиентов
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                  {limitGroups.map((group) => (
                                    <div key={group.id} className="space-y-1">
                                      <label className="text-[10px] text-slate-500 truncate block">
                                        {group.name} (₽)
                                      </label>
                                      <input
                                        type="number"
                                        placeholder="Сумма"
                                        value={step.group_amounts?.[group.id] ?? ""}
                                        onChange={(e) => {
                                          const updated = [...withdrawSteps];
                                          const grpAmts = { ...(updated[idx].group_amounts || {}) };
                                          if (e.target.value.trim() === "") {
                                            delete grpAmts[group.id];
                                          } else {
                                            grpAmts[group.id] = parseFloat(e.target.value) || 0;
                                          }
                                          updated[idx] = { ...updated[idx], group_amounts: grpAmts };
                                          saveSettings({
                                            ...settings,
                                            withdraw_limit_steps: updated,
                                          });
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-900 outline-none focus:border-slate-900"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 4. ГРУППЫ КЛИЕНТОВ */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeSubTab === "groups" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Группы клиентов
                </h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Сегментация пользователей (VIP, постоянные, студенты) для особых условий вывода
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              {/* Форма добавления */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                  placeholder="Название группы (например, VIP или Постоянные)"
                  className="flex-1 bg-white border border-slate-200 rounded-xl h-10 px-3.5 text-sm font-medium text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddGroup}
                  className="h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-medium transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить группу</span>
                </button>
              </div>

              {/* Список групп */}
              <div className="space-y-2.5">
                {limitGroups.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">Нет созданных групп</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Все игроки используют общий расчет лимитов вывода.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {limitGroups.map((group) => (
                      <div
                        key={group.id}
                        className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {group.name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            ID: {group.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveGroup(group.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Удалить группу"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* 5. QR-КОД И ГОСТЕВАЯ ССЫЛКА */}
      {/* ──────────────────────────────────────────────────────── */}
      {activeSubTab === "qr" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  QR-код и активация для гостей
                </h3>
                <p className="text-slate-500 text-xs sm:text-sm font-normal mt-1 leading-relaxed max-w-xl">
                  Разместите этот QR-код на ресепшене или игровых местах. Отсканировав его смартфоном, гость сразу попадает в промо-раздел своего клуба.
                </p>
              </div>

              <div className="space-y-2 max-w-lg">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Адрес промо-страницы гостя
                </span>
                <div className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-xl break-all select-all">
                  {qrUrl}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 h-10 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 transition-all shadow-xs cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Ссылка скопирована!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Скопировать ссылку</span>
                    </>
                  )}
                </button>

                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-medium transition-all shadow-xs"
                >
                  <span>Открыть приложение гостя</span>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 shrink-0 text-center space-y-3">
              <QRCode
                value={qrUrl}
                size={200}
                downloadable
                filename={`promo-club-${clubId}-qr`}
              />
              <span className="text-[11px] font-medium text-slate-400 block">
                Готово для печати на стойку или наклейки
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
