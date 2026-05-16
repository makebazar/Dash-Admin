import {
  TrendingUp,
  ClipboardCheck,
  Wrench,
  Calculator,
  ShieldAlert,
  Trophy,
  Coins,
  Percent,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UnifiedKpiCardProps, KpiStat } from "./UnifiedKpiCard";

export type KpiType =
  | "revenue"
  | "checklist"
  | "maintenance"
  | "promo"
  | "overplan"
  | "rank"
  | "fixed"
  | "percent";

interface KpiMapperContext {
  formatCurrency: (amount: number) => string;
  activeShiftId?: string | number | null;
  remainingShifts: number;
  plannedShifts: number;
  daysRemaining: number;
}

export function mapKpiToUnifiedProps(
  type: KpiType,
  data: any,
  context: KpiMapperContext,
): UnifiedKpiCardProps {
  const { formatCurrency, activeShiftId, remainingShifts, plannedShifts } =
    context;

  switch (type) {
    case "revenue": {
      const nextThreshold = data.all_thresholds?.find((t: any) => !t.is_met);
      const lastMetThreshold = [...(data.all_thresholds || [])]
        .reverse()
        .find((t: any) => t.is_met);
      const requiredPerShift = nextThreshold?.per_shift_to_reach || 0;
      const isShiftActive = !!activeShiftId;

      return {
        title: data.name || "Выручка",
        subtitle: nextThreshold
          ? `Следующая цель: ${nextThreshold.label} ${nextThreshold.percent > 0 ? nextThreshold.percent + "%" : formatCurrency(nextThreshold.amount)}`
          : "Максимальный уровень достигнут!",
        icon: TrendingUp,
        mainValue: isShiftActive
          ? formatCurrency(requiredPerShift)
          : formatCurrency(data.avg_per_shift || 0),
        mainLabel: isShiftActive ? "Цель на сегодня" : "Средняя за смену",
        mainSubLabel: isShiftActive
          ? `Для уровня «${nextThreshold?.label || "След."}»`
          : "Ваш средний результат",
        secondaryInfo: `${remainingShifts} ${getShiftWord(remainingShifts)}`,
        currentLevelBadge:
          data.bonus_amount > 0
            ? `Премия сейчас: ${formatCurrency(data.bonus_amount)}`
            : undefined,
        stats: [
          {
            label: "Выручка",
            value: formatCurrency(data.current_value),
          },
          {
            label: "Цель месяца",
            value: formatCurrency(nextThreshold?.planned_month_threshold || 0),
            subValue: `${plannedShifts} смен`,
          },
          {
            label: "Средняя за смену",
            value: formatCurrency(data.avg_per_shift || 0),
          },
          {
            label: "Премия",
            value: "+" + formatCurrency(data.bonus_amount),
            color: "emerald",
          },
        ],
        progress: {
          label: "Прогресс к цели месяца",
          percent: nextThreshold
            ? Math.min(
                Math.round(
                  (data.current_value /
                    (nextThreshold.planned_month_threshold || 1)) *
                    100,
                ),
                100,
              )
            : 100,
        },
        alert: isShiftActive
          ? {
              message: `Цель на текущую смену: ${formatCurrency(requiredPerShift)}`,
              subMessage:
                "Данные по этой смене появятся в статистике после её закрытия",
              type: "info",
            }
          : undefined,
        footerLabel: "Показать все уровни",
        children: (
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Уровни премии
            </h4>
            <div className="grid gap-2">
              {(data.all_thresholds || []).map((t: any, i: number) => (
                <div
                  key={i}
                  className={cn(
                    "p-3 rounded-xl border transition-all",
                    t.is_met
                      ? "bg-emerald-50 border-emerald-100"
                      : "bg-slate-50 border-slate-100 opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-900">
                      {t.label}
                    </span>
                    {t.is_met && (
                      <span className="text-[10px] font-black text-emerald-600 uppercase">
                        Достигнуто
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-bold">
                      План: {formatCurrency(t.planned_month_threshold)}
                    </span>
                    <span className="text-emerald-700 font-black">
                      +
                      {t.percent > 0
                        ? t.percent + "%"
                        : formatCurrency(t.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      };
    }

    case "overplan": {
      const isShiftActive = !!activeShiftId;
      const nextTier = data.tiers?.find(
        (t: any) => t.bonus_percent > (data.current_bonus_percent || 0),
      );

      return {
        title: "Личный результат",
        subtitle: "Бонус за перевыполнение",
        icon: ShieldAlert,
        mainValue: isShiftActive
          ? "Смена открыта"
          : `${data.performance_percent || 0}%`,
        mainLabel: isShiftActive ? "Ожидаем закрытия" : "Выполнение плана",
        mainSubLabel: isShiftActive
          ? "Статистика будет после смены"
          : "От цели на смену",
        currentLevelBadge: data.current_bonus_percent
          ? `Ставка: +${data.current_bonus_percent}% от выручки`
          : undefined,
        stats: [
          {
            label: "План на смену",
            value: formatCurrency(data.plan_per_shift || 0),
          },
          {
            label: "Факт на смену",
            value: isShiftActive
              ? "—"
              : formatCurrency(data.fact_per_shift || 0),
            color: isShiftActive ? "default" : "emerald",
          },
          {
            label: "Сверх плана",
            value: isShiftActive
              ? "—"
              : formatCurrency(
                  Math.max(
                    0,
                    (data.fact_per_shift || 0) - (data.plan_per_shift || 0),
                  ),
                ),
          },
          {
            label: "Бонус за смену",
            value: isShiftActive
              ? "—"
              : "+" + formatCurrency(data.bonus_amount || 0),
            color: "emerald",
          },
        ],
        progress: !isShiftActive
          ? {
              label: "Уровень перевыполнения",
              percent: Math.min(data.performance_percent || 0, 100),
              displayValue: nextTier
                ? `Цель ${nextTier.from_over_percent}% (+${nextTier.bonus_percent}%)`
                : "Макс. уровень",
            }
          : undefined,
        alert: isShiftActive
          ? {
              message:
                "Данные по личной эффективности рассчитываются в момент закрытия смены.",
              subMessage: `Ваш план на сегодня: ${formatCurrency(data.plan_per_shift || 0)}`,
              type: "info",
            }
          : nextTier
            ? {
                message: `До следующего уровня бонуса (${nextTier.bonus_percent}%) осталось немного поднажать!`,
                type: "info",
              }
            : undefined,
        footerLabel: "Уровни перевыполнения",
        children: (
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Таблица бонусов
            </h4>
            <div className="grid gap-2">
              {(data.tiers || []).map((t: any, i: number) => {
                const isMet =
                  (data.performance_percent || 0) - 100 >=
                  (t.from_over_percent || 0);
                return (
                  <div
                    key={i}
                    className={cn(
                      "p-3 rounded-xl border transition-all",
                      isMet
                        ? "bg-emerald-50 border-emerald-100"
                        : "bg-slate-50 border-slate-100 opacity-60",
                    )}
                  >
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-slate-900">
                        Сверх плана &gt; {t.from_over_percent}%
                      </span>
                      <span className="text-emerald-600">
                        +{t.bonus_percent}% от выручки
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ),
      };
    }
    case "checklist": {
      const nextThreshold = data.thresholds?.find((t: any) => !t.is_met);
      return {
        title: "Качество (Чек-листы)",
        subtitle: nextThreshold
          ? `Цель: ${nextThreshold.from}% → ${formatCurrency(nextThreshold.amount)}`
          : "Макс. балл!",
        icon: ClipboardCheck,
        mainValue: `${Math.round(data.current_value || 0)}%`,
        mainLabel: "Средний балл",
        secondaryInfo: `${data.count} ${getCheckWord(data.count)}`,
        stats: [
          { label: "Всего проверок", value: data.count + " шт." },
          { label: "Проходной балл", value: (nextThreshold?.from || 0) + "%" },
          {
            label: "Бонус",
            value: "+" + formatCurrency(data.bonus_amount),
            color: "emerald",
          },
        ],
        progress: {
          label: "Качество",
          percent: data.current_value || 0,
        },
        footerLabel: "История и пороги",
        children: (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Пороги премии
              </h4>
              <div className="grid gap-2">
                {(data.thresholds || []).map((t: any, i: number) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border text-xs font-bold",
                      t.is_met
                        ? "bg-emerald-50 border-emerald-100 text-emerald-900"
                        : "bg-slate-50 border-slate-100 text-slate-500 opacity-60",
                    )}
                  >
                    <span>От {t.from}%</span>
                    <span>+{formatCurrency(t.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ),
      };
    }

    case "maintenance": {
      return {
        title: "Обслуживание",
        subtitle: `План: ${Math.round(data.total_month_target || 0)} задач`,
        icon: Wrench,
        mainValue: `${Math.round(data.completed_month_value || 0)} / ${Math.round(data.total_month_target || 0)}`,
        mainLabel: "Выполнено задач",
        secondaryInfo: `${Math.round((data.total_month_target || 0) - (data.completed_month_value || 0))} осталось`,
        stats: [
          { label: "За задачи", value: formatCurrency(data.total_gross || 0) },
          {
            label: "Просрочки",
            value: Math.round(data.overdue_open_tasks || 0) + " шт.",
            color: data.overdue_open_tasks > 0 ? "rose" : "default",
          },
          {
            label: "Бонус",
            value: "+" + formatCurrency(data.bonus_amount || 0),
            color: "emerald",
          },
        ],
        progress: {
          label: "Выполнение",
          percent: Math.round(
            ((data.completed_month_value || 0) /
              (data.total_month_target || 1)) *
              100,
          ),
        },
        alert:
          data.overdue_open_tasks > 0
            ? {
                message: `У вас ${data.overdue_open_tasks} просроченных задач!`,
                type: "error",
              }
            : undefined,
        footerLabel: "Детализация по устройствам",
        children: (
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Выполнено по типам
            </h4>
            <div className="grid gap-2">
              {(data.breakdown || [])
                .filter((b: any) => b.count > 0)
                .map((b: any, i: number) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-600">
                          {b.type}
                        </span>
                        {b.rate > 0 && (
                          <span className="text-[10px] font-medium text-slate-400">
                            {formatCurrency(b.rate)} / задача
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-black text-slate-900">
                        {b.count} шт.
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold uppercase tracking-widest">
                        Начислено
                      </span>
                      <div className="flex items-center gap-2">
                        {b.penalty > 0 && (
                          <span className="text-rose-500 font-bold">
                            -{formatCurrency(b.penalty)} штр.
                          </span>
                        )}
                        <span className="text-emerald-600 font-black">
                          +{formatCurrency(b.gross)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              {(!data.breakdown ||
                data.breakdown.filter((b: any) => b.count > 0).length ===
                  0) && (
                <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-xs font-bold">
                  Задач пока не выполнено
                </div>
              )}
            </div>
          </div>
        ),
      };
    }

    case "promo": {
      return {
        title: data.name || "Акции",
        icon: Calculator,
        mainValue: formatCurrency(data.bonus_amount || 0),
        mainLabel: "Ваша премия",
        stats: [
          ...(data.breakdown || []).map((b: any) => ({
            label: getPromoLabel(b.source),
            value:
              b.source === "promo_topup_total_sum"
                ? formatCurrency(b.value)
                : Math.round(b.value),
            subValue: "+" + formatCurrency(b.bonus),
          })),
          {
            label: "Итого премия",
            value: "+" + formatCurrency(data.bonus_amount),
            color: "emerald",
          },
        ].slice(0, 4),
        footerLabel: "Правила начисления",
        children: (
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Действующие правила
            </h4>
            <div className="grid gap-2">
              {(data.rules || []).map((rule: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <span className="text-xs font-bold text-slate-600">
                    {getPromoLabel(rule.source)}
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    {rule.reward_type === "PERCENT"
                      ? `${rule.percent}% от суммы`
                      : `+${formatCurrency(rule.amount || rule.rate || 0)} / ед.`}
                  </span>
                </div>
              ))}
              {(!data.rules || data.rules.length === 0) &&
                data.breakdown?.map((b: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <span className="text-xs font-bold text-slate-600">
                      {getPromoLabel(b.source)}
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      {b.reward_type === "PERCENT"
                        ? `${b.percent}% от суммы`
                        : `+${formatCurrency(b.rate || b.amount || 0)} / ед.`}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ),
      };
    }

    case "percent": {
      const isShiftActive = !!activeShiftId;
      return {
        title: data.name || "Процент продаж",
        subtitle: "Базовый % от чека",
        icon: Percent,
        mainValue: `${data.percent || 0}%`,
        mainLabel: "Ваша ставка",
        mainSubLabel:
          data.source === "total"
            ? "От общей выручки"
            : data.source === "cash"
              ? "От наличных"
              : "От безнала",
        stats: [
          {
            label: "Выручка смены",
            value: isShiftActive
              ? "—"
              : formatCurrency(data.current_shift_value || 0),
          },
          { label: "Выручка", value: formatCurrency(data.current_value || 0) },
          {
            label: "Бонус",
            value: "+" + formatCurrency(data.bonus_amount || 0),
            color: "emerald",
          },
        ],
        alert: isShiftActive
          ? {
              message:
                "Данные по текущей смене будут добавлены в статистику после её закрытия.",
              type: "info",
            }
          : undefined,
        footerLabel: "Подробнее о начислении",
        children: (
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Детализация процента
            </h4>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">Ваша ставка</span>
                <span className="text-slate-900">{data.percent}%</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">Общая выручка</span>
                <span className="text-slate-900">
                  {formatCurrency(data.current_value || 0)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">
                  Итого бонус
                </span>
                <span className="text-sm font-black text-emerald-600">
                  +{formatCurrency(data.bonus_amount || 0)}
                </span>
              </div>
            </div>
          </div>
        ),
      };
    }

    case "fixed": {
      const isShiftActive = !!activeShiftId;
      return {
        title: data.name || "Доплаты",
        subtitle: "Фикс за каждую смену",
        icon: Coins,
        mainValue: formatCurrency(data.amount || 0),
        mainLabel: "За смену",
        mainSubLabel:
          data.payout_timing === "SHIFT" ? "В конце смены" : "В конце месяца",
        stats: [
          {
            label: "Смен отработано",
            value: (data.shifts_count || 0) + " шт.",
          },
          { label: "Ставка фикс", value: formatCurrency(data.amount || 0) },
          {
            label: "Начислено",
            value: "+" + formatCurrency(data.bonus_amount || 0),
            color: "emerald",
          },
        ],
        alert: isShiftActive
          ? {
              message:
                "Фиксированный бонус за эту смену будет начислен при её закрытии.",
              type: "info",
            }
          : undefined,
        footerLabel: "История начислений",
        children: (
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Расчет фикс. части
            </h4>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">Кол-во смен</span>
                <span className="text-slate-900">{data.shifts_count || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">Ставка за смену</span>
                <span className="text-slate-900">
                  {formatCurrency(data.amount || 0)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">
                  Всего начислено
                </span>
                <span className="text-sm font-black text-emerald-600">
                  +{formatCurrency(data.bonus_amount || 0)}
                </span>
              </div>
            </div>
          </div>
        ),
      };
    }

    case "rank": {
      const breakdown = data?.breakdown || {};
      const stats = [
        { label: "Выручка", value: `${breakdown.revenue || 0}%` },
        { label: "Качество", value: `${breakdown.checklist || 0}%` },
        { label: "Сервис", value: `${breakdown.maintenance || 0}%` },
        { label: "Дисциплина", value: `${breakdown.discipline || 0}%` },
      ];

      return {
        title: "Личный рейтинг",
        subtitle: data?.is_frozen ? "Рейтинг заморожен" : "Текущая позиция",
        icon: Trophy,
        mainValue: data?.rank || "—",
        mainLabel: "Ваше место",
        mainSubLabel: `Среди ${data?.total_participants || 0} сотрудников`,
        secondaryInfo: data?.score ? `${data.score} баллов` : undefined,
        stats: stats,
        progress: {
          label: "Ваш балл",
          percent: Math.min(data?.score || 0, 100),
          displayValue: `${data?.score || 0} / 100`,
        },
        footerLabel: "Детализация баллов",
        children: (
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Из чего состоит рейтинг
            </h4>
            <div className="grid gap-2">
              {Object.entries(breakdown).map(([key, value]: [string, any]) => (
                <div
                  key={key}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 capitalize">
                      {key === "revenue"
                        ? "Выручка"
                        : key === "checklist"
                          ? "Чек-листы"
                          : key === "maintenance"
                            ? "Обслуживание"
                            : key === "schedule"
                              ? "График"
                              : "Дисциплина"}
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      {value} / 20
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(value / 20) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      };
    }

    default:
      return {
        title: "KPI",
        icon: TrendingUp,
        mainValue: "0",
        mainLabel: "Показатель",
        stats: [],
      };
  }
}
function getShiftWord(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "смена";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100))
    return "смены";
  return "смен";
}

function getCheckWord(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "проверка";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100))
    return "проверки";
  return "проверок";
}

function getPromoLabel(source: string) {
  const map: any = {
    promo_new_players: "Игроки",
    promo_new_paying_players: "Игроки (оплата)",
    promo_topup_total_sum: "Пополнения",
    promo_service_count: "Услуги",
  };
  return map[source] || source;
}
