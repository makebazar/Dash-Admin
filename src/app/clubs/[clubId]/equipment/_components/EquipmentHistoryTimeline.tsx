"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  Loader2,
  RefreshCw,
  Shirt,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EquipmentHistoryActionType =
  | "MAINTENANCE"
  | "REWORK"
  | "MOVE"
  | "ISSUE"
  | "LAUNDRY";

export type EquipmentHistoryFilter =
  | "all"
  | "maintenance"
  | "move"
  | "issue"
  | "laundry";

export interface EquipmentHistoryLog {
  id: string;
  action_type: EquipmentHistoryActionType;
  action: string;
  date: string;
  user_name: string | null;
  details: string | null;
  photos?: string[];
  equipment_id?: string;
  equipment_name?: string;
  equipment_type?: string;
}

interface EquipmentHistoryTimelineProps {
  title: string;
  description: string;
  history: EquipmentHistoryLog[];
  isLoading: boolean;
  showLaundryFilter?: boolean;
  showEquipmentFilter?: boolean;
  onOpenPhotos: (images: string[], index: number) => void;
}

const getMaintenanceActionLabel = (action: string) => {
  switch (action) {
    case "CLEANING":
      return "Плановое обслуживание";
    case "REPAIR":
      return "Ремонт";
    case "INSPECTION":
      return "Проверка";
    case "REPLACEMENT":
      return "Замена";
    case "PERFORMANCE_CHECK":
      return "Проверка производительности";
    default:
      return action;
  }
};

const getHistoryPresentation = (log: EquipmentHistoryLog) => {
  if (log.action_type === "MAINTENANCE") {
    return {
      icon: <Wrench className="h-4 w-4" />,
      badgeLabel: "Обслуживание",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      title: getMaintenanceActionLabel(log.action),
      description:
        log.details?.trim() ||
        "Задача обслуживания выполнена без дополнительного комментария.",
    };
  }

  if (log.action_type === "MOVE") {
    return {
      icon: <ArrowRightLeft className="h-4 w-4" />,
      badgeLabel: "Перемещение",
      badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
      title: "Перемещение оборудования",
      description:
        log.details?.trim() ||
        "Оборудование было перемещено без указанной причины.",
    };
  }

  if (log.action_type === "REWORK") {
    return {
      icon: <RefreshCw className="h-4 w-4" />,
      badgeLabel: "Доработка",
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
      title: `Отправлено на доработку: ${getMaintenanceActionLabel(log.action)}`,
      description:
        log.details?.trim() ||
        "Задача возвращена на доработку без указанного комментария.",
    };
  }

  if (log.action_type === "LAUNDRY") {
    return {
      icon: <Shirt className="h-4 w-4" />,
      badgeLabel: "Стирка",
      badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
      title: log.action,
      description:
        log.details?.trim() ||
        "Событие по стирке зафиксировано без дополнительного описания.",
    };
  }

  return {
    icon: <AlertCircle className="h-4 w-4" />,
    badgeLabel: "Инцидент",
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
    title: log.action,
    description:
      log.details?.trim() || "Инцидент зафиксирован без подробного описания.",
  };
};

const formatHistoryTime = (date: string) =>
  new Date(date).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

export function EquipmentHistoryTimeline({
  title,
  description,
  history,
  isLoading,
  showLaundryFilter = false,
  showEquipmentFilter = false,
  onOpenPhotos,
}: EquipmentHistoryTimelineProps) {
  const [historyFilter, setHistoryFilter] =
    useState<EquipmentHistoryFilter>("all");
  const [historyEquipmentFilter, setHistoryEquipmentFilter] =
    useState<string>("all");

  const filterOptions = useMemo(() => {
    const base: Array<{ value: EquipmentHistoryFilter; label: string }> = [
      { value: "all", label: "Все" },
      { value: "maintenance", label: "Обслуживание" },
      { value: "move", label: "Перемещения" },
      { value: "issue", label: "Инциденты" },
    ];
    if (showLaundryFilter) {
      base.push({ value: "laundry", label: "Стирка" });
    }
    return base;
  }, [showLaundryFilter]);

  const historyEquipmentOptions = useMemo(() => {
    if (!showEquipmentFilter) return [];
    const seen = new Map<string, { id: string; name: string; type: string }>();
    for (const item of history) {
      if (item.equipment_id && !seen.has(item.equipment_id)) {
        seen.set(item.equipment_id, {
          id: item.equipment_id,
          name: item.equipment_name || "Устройство",
          type: item.equipment_type || "",
        });
      }
    }
    return Array.from(seen.values());
  }, [history, showEquipmentFilter]);

  const filteredHistory = useMemo(() => {
    const byType =
      historyFilter === "all"
        ? history
        : history.filter((log) => {
            if (historyFilter === "maintenance") {
              return (
                log.action_type === "MAINTENANCE" ||
                log.action_type === "REWORK"
              );
            }
            if (historyFilter === "move") return log.action_type === "MOVE";
            if (historyFilter === "laundry")
              return log.action_type === "LAUNDRY";
            return log.action_type === "ISSUE";
          });

    if (!showEquipmentFilter || historyEquipmentFilter === "all") return byType;
    return byType.filter((log) => log.equipment_id === historyEquipmentFilter);
  }, [history, historyEquipmentFilter, historyFilter, showEquipmentFilter]);

  const groupedHistory = useMemo(() => {
    return filteredHistory.reduce<
      Array<{ label: string; items: EquipmentHistoryLog[] }>
    >((groups, log) => {
      const itemDate = new Date(log.date);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

      const label = isSameDay(itemDate, today)
        ? "Сегодня"
        : isSameDay(itemDate, yesterday)
          ? "Вчера"
          : itemDate.toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year:
                today.getFullYear() === itemDate.getFullYear()
                  ? undefined
                  : "numeric",
            });

      const existingGroup = groups.find((group) => group.label === label);
      if (existingGroup) {
        existingGroup.items.push(log);
      } else {
        groups.push({ label, items: [log] });
      }

      return groups;
    }, []);
  }, [filteredHistory]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterOptions.map((filterOption) => (
            <Button
              key={filterOption.value}
              type="button"
              variant={
                historyFilter === filterOption.value ? "default" : "outline"
              }
              size="sm"
              className={cn(
                "h-8 rounded-full px-3 text-xs",
                historyFilter === filterOption.value &&
                  "bg-slate-900 hover:bg-slate-800 text-white",
              )}
              onClick={() => setHistoryFilter(filterOption.value)}
            >
              {filterOption.label}
            </Button>
          ))}
        </div>
      </div>

      {showEquipmentFilter && historyEquipmentOptions.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={historyEquipmentFilter === "all" ? "default" : "outline"}
            className={cn(
              "h-8 rounded-full px-3 text-xs",
              historyEquipmentFilter === "all" &&
                "bg-slate-900 hover:bg-slate-800 text-white",
            )}
            onClick={() => setHistoryEquipmentFilter("all")}
          >
            Все устройства
          </Button>
          {historyEquipmentOptions.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={
                historyEquipmentFilter === item.id ? "default" : "outline"
              }
              className={cn(
                "h-8 max-w-full rounded-full px-3 text-xs",
                historyEquipmentFilter === item.id &&
                  "bg-slate-900 hover:bg-slate-800 text-white",
              )}
              onClick={() => setHistoryEquipmentFilter(item.id)}
              title={`${item.name} • ${item.type}`}
            >
              <span className="max-w-55 truncate">{item.name}</span>
            </Button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted px-4 py-10 text-center text-sm italic text-muted-foreground">
          История изменений пуста
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted px-4 py-10 text-center text-sm italic text-muted-foreground">
          Для выбранного фильтра событий пока нет
        </div>
      ) : (
        groupedHistory.map((group) => (
          <div key={group.label} className="space-y-3">
            <div className="px-1 py-1">
              <div className="inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                {group.label}
              </div>
            </div>

            <div className="space-y-3">
              {group.items.map((log) => {
                const presentation = getHistoryPresentation(log);

                return (
                  <div
                    key={`${log.equipment_id || "eq"}-${log.id}-${log.date}`}
                    className="relative pl-12"
                  >
                    <div className="absolute top-0 bottom-0 left-4.5 w-px bg-slate-200" />
                    <div
                      className={cn(
                        "absolute left-0 top-5 flex h-9 w-9 items-center justify-center rounded-xl border bg-card",
                        presentation.badgeClassName,
                      )}
                    >
                      {presentation.icon}
                    </div>

                    <div className="rounded-2xl border bg-card p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full border text-[10px] font-semibold",
                                presentation.badgeClassName,
                              )}
                            >
                              {presentation.badgeLabel}
                            </Badge>
                            {log.equipment_name ? (
                              <Badge
                                variant="secondary"
                                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                              >
                                {log.equipment_name}
                              </Badge>
                            ) : null}
                            <span className="text-xs text-muted-foreground/70">
                              {formatHistoryTime(log.date)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {presentation.title}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {presentation.description}
                            </p>
                          </div>

                          {Array.isArray(log.photos) &&
                            log.photos.length > 0 && (
                              <div className="space-y-2 pt-1">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Прикреплённые фото
                                  </p>
                                  <span className="text-[11px] text-muted-foreground/70">
                                    {log.photos.length} шт.
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                  {log.photos.map((photo, photoIndex) => (
                                    <button
                                      key={`${log.id}-photo-${photoIndex}`}
                                      type="button"
                                      onClick={() =>
                                        onOpenPhotos(
                                          log.photos || [],
                                          photoIndex,
                                        )
                                      }
                                      className="relative aspect-4/3 overflow-hidden rounded-xl border bg-accent"
                                    >
                                      <img
                                        src={photo}
                                        alt={`Фото события ${presentation.title} ${photoIndex + 1}`}
                                        className="h-full w-full object-cover"
                                      />
                                      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent px-2 py-1 text-left text-[10px] font-medium text-primary-foreground">
                                        Открыть
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>

                        <div className="shrink-0 rounded-xl bg-muted px-3 py-2 text-right">
                          <p className="text-[11px] font-semibold text-foreground">
                            {log.user_name || "Система"}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                            {new Date(log.date).toLocaleDateString("ru-RU")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
