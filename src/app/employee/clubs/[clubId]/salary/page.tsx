"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const PROMO_SOURCE_LABELS: Record<string, string> = {
  promo_new_players: "Новые игроки",
  promo_new_paying_players: "Новые платящие игроки",
  promo_topup_total_sum: "Пополнения по акциям",
  promo_service_count: "Услуги по акциям",
};

export default function EmployeeSalaryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const clubId = params.clubId as string;

  const now = useMemo(() => new Date(), []);
  const initialMonth = useMemo(() => {
    const m = searchParams.get("month");
    const parsed = m ? parseInt(m, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12
      ? parsed
      : now.getMonth() + 1;
  }, [searchParams, now]);

  const initialYear = useMemo(() => {
    const y = searchParams.get("year");
    const parsed = y ? parseInt(y, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 2020 && parsed <= 2100
      ? parsed
      : now.getFullYear();
  }, [searchParams, now]);

  const [month, setMonth] = useState<number>(initialMonth);
  const [year, setYear] = useState<number>(initialYear);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);
  const [expandedShiftId, setExpandedShiftId] = useState<string | number | null>(null);

  const isCurrentMonth = useMemo(() => {
    return month === now.getMonth() + 1 && year === now.getFullYear();
  }, [month, year, now]);

  const formatCurrency = useCallback((amount: number) => {
    return (
      new Intl.NumberFormat("ru-RU", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.round(amount || 0)) + " ₽"
    );
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short",
        weekday: "short",
      });
    } catch {
      return dateStr;
    }
  }, []);

  const formatDateTime = useCallback((dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }, []);

  const fetchSalaryData = useCallback(async (targetMonth: number, targetYear: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/employee/clubs/${clubId}/salary?month=${targetMonth}&year=${targetYear}`,
      );
      if (!res.ok) {
        throw new Error("Не удалось загрузить отчет по зарплате");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch salary data:", err);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchSalaryData(month, year);
  }, [fetchSalaryData, month, year]);

  const handleMonthChange = (delta: number) => {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setMonth(nextMonth);
    setYear(nextYear);
    router.replace(`/employee/clubs/${clubId}/salary?month=${nextMonth}&year=${nextYear}`);
  };

  const handleResetToCurrent = () => {
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    setMonth(curMonth);
    setYear(curYear);
    router.replace(`/employee/clubs/${clubId}/salary?month=${curMonth}&year=${curYear}`);
  };

  const emp = data?.employee;
  const club = data?.club;

  // Real confirmed deductions from salary
  const barDeductionsSum = useMemo(() => {
    if (!emp?.bar_details?.length) return 0;
    return emp.bar_details.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  }, [emp]);

  const confirmedLatenessPenaltySum = useMemo(() => {
    if (!emp?.shifts?.length) return 0;
    return emp.shifts.reduce(
      (s: number, sh: any) =>
        s + (sh.lateness_status === "CONFIRMED" ? sh.lateness_penalty || 0 : 0),
      0
    );
  }, [emp]);

  const inventoryDeductionsSum = useMemo(() => {
    return emp?.breakdown?.salary_deduction || 0;
  }, [emp]);

  const totalDeductions = barDeductionsSum + confirmedLatenessPenaltySum + inventoryDeductionsSum;

  const totals = emp ? {
    accrued: emp.total_accrued || 0,
    paid: emp.total_paid || 0,
    balance: emp.balance || 0,
    virtual: emp.virtual_balance_accrued || 0,
  } : { accrued: 0, paid: 0, balance: 0, virtual: 0 };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 py-4 sm:px-6 sm:py-8 md:px-8 md:py-12 space-y-4 sm:space-y-8 relative z-0">
      {/* Standard Page Header matching history/evaluations */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3 sm:pb-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Зарплата</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
            {emp?.full_name ? `${emp.full_name} • ${emp.role || "Сотрудник"}` : club?.name || "Клуб"}
          </p>
        </div>

        {/* Month Navigator */}
        <div className="flex items-center gap-1.5 sm:gap-2 justify-between sm:justify-end">
          <div className="flex items-center gap-0.5 sm:gap-1 bg-accent/50 rounded-lg p-1 border border-border">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleMonthChange(-1)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
              title="Предыдущий месяц"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-bold w-28 sm:w-36 text-center uppercase tracking-wider text-foreground select-none truncate">
              {isCurrentMonth ? "Текущий месяц" : `${MONTH_NAMES[month - 1]} ${year}`}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleMonthChange(1)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
              title="Следующий месяц"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {!isCurrentMonth && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToCurrent}
              className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs shrink-0"
            >
              Текущий
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Загружаем расчет зарплаты...</p>
        </div>
      ) : !emp ? (
        <Card className="border-border bg-card p-6 sm:p-8 text-center">
          <p className="text-base font-semibold text-foreground">Данные не найдены</p>
          <p className="text-xs text-muted-foreground mt-1">
            Для выбранного месяца отсутствуют начисления или смены.
          </p>
        </Card>
      ) : (
        <>
          {/* Top KPI Cards Grid (2x2 on mobile, 4 in row on desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Card 1: Balance (К выплате) */}
            <Card className="border-border bg-card">
              <CardContent className="p-3 sm:p-5">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground block truncate">
                  К получению
                </span>
                <div className="text-lg sm:text-3xl font-black tracking-tight text-foreground mt-1 sm:mt-2 truncate">
                  {formatCurrency(totals.balance)}
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 sm:mt-1.5 flex items-center justify-between">
                  <span className="truncate">Остаток</span>
                  <span className="text-foreground font-semibold shrink-0">
                    {totals.balance > 0 ? "Ожидает" : "Закрыто"}
                  </span>
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Total Accrued */}
            <Card className="border-border bg-card">
              <CardContent className="p-3 sm:p-5">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground block truncate">
                  Начислено
                </span>
                <div className="text-lg sm:text-3xl font-black tracking-tight text-emerald-400 mt-1 sm:mt-2 truncate">
                  {formatCurrency(totals.accrued)}
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 sm:mt-1.5 truncate">
                  Оклад + Премии
                </p>
              </CardContent>
            </Card>

            {/* Card 3: Total Paid */}
            <Card className="border-border bg-card">
              <CardContent className="p-3 sm:p-5">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground block truncate">
                  Выплачено
                </span>
                <div className="text-lg sm:text-3xl font-black tracking-tight text-foreground mt-1 sm:mt-2 truncate">
                  {formatCurrency(totals.paid)}
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 sm:mt-1.5 truncate">
                  Платежей: {emp.payment_history?.length || 0}
                </p>
              </CardContent>
            </Card>

            {/* Card 4: Shifts & Hours */}
            <Card className="border-border bg-card">
              <CardContent className="p-3 sm:p-5">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground block truncate">
                  Смены
                </span>
                <div className="text-lg sm:text-3xl font-black tracking-tight text-foreground mt-1 sm:mt-2 flex items-baseline gap-1 truncate">
                  <span>{emp.shifts_count || 0}</span>
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
                    / {emp.planned_shifts || 15}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 sm:mt-1.5 truncate">
                  {Number(emp.metrics?.total_hours || 0).toFixed(1)} ч работы
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabs Navigation (2x2 grid on mobile, 4-column on desktop) */}
          <Tabs defaultValue="summary" className="space-y-4 sm:space-y-6">
            <TabsList className="bg-card border border-border p-1 rounded-xl h-auto grid grid-cols-2 sm:grid-cols-4 gap-1 w-full">
              <TabsTrigger
                value="summary"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm font-semibold py-2 px-2 rounded-lg transition-all text-center truncate"
              >
                <span className="sm:hidden">Сводка</span>
                <span className="hidden sm:inline">Сводка и структура</span>
              </TabsTrigger>
              <TabsTrigger
                value="shifts"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm font-semibold py-2 px-2 rounded-lg transition-all text-center truncate"
              >
                <span className="sm:hidden">Смены ({emp.shifts?.length || 0})</span>
                <span className="hidden sm:inline">Посменный расчет ({emp.shifts?.length || 0})</span>
              </TabsTrigger>
              <TabsTrigger
                value="payments"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm font-semibold py-2 px-2 rounded-lg transition-all text-center truncate"
              >
                <span className="sm:hidden">Выплаты ({emp.payment_history?.length || 0})</span>
                <span className="hidden sm:inline">История выплат ({emp.payment_history?.length || 0})</span>
              </TabsTrigger>
              <TabsTrigger
                value="bar"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm font-semibold py-2 px-2 rounded-lg transition-all text-center truncate"
              >
                <span className="sm:hidden">Бар ({emp.bar_details?.length || 0})</span>
                <span className="hidden sm:inline">Покупки в баре ({emp.bar_details?.length || 0})</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: SUMMARY & ACCRUAL BREAKDOWN */}
            <TabsContent value="summary" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Full Financial Breakdown */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Additions Card */}
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <CardTitle className="text-base font-bold text-foreground">
                        Начислено за месяц
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Оклад, надбавки за смены, премии за планы и качество
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
                      {/* Base salary line */}
                      <div className="flex justify-between items-center py-2 border-b border-border/30 gap-2">
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">Базовая ставка</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {emp.is_hourly_rate !== false
                              ? `${Number(emp.metrics?.total_hours || 0).toFixed(1)} ч`
                              : `${emp.shifts_count || 0} смен`}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-foreground shrink-0 whitespace-nowrap">
                          {formatCurrency(emp.breakdown?.base_salary || 0)}
                        </span>
                      </div>

                      {/* Shift bonuses aggregated */}
                      {emp.shift_bonuses_breakdown?.map((b: any, idx: number) => (
                        <div key={`shift-bonus-${idx}`} className="flex justify-between items-center py-2 border-b border-border/30 gap-2">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{b.name || "Бонус смены"}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              Смен с бонусом: {b.count || 0}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-emerald-400 shrink-0 whitespace-nowrap">
                            +{formatCurrency(b.amount || 0)}
                          </span>
                        </div>
                      ))}

                      {/* Period / Monthly Bonuses */}
                      {emp.period_bonuses
                        ?.filter((b: any) => b.is_met && (b.bonus_amount > 0 || b.current_reward_value > 0))
                        .map((b: any, idx: number) => (
                          <div key={`period-bonus-${idx}`} className="flex justify-between items-center py-2 border-b border-border/30 gap-2">
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{b.name || "Премия"}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {b.type === "per_unit"
                                  ? "Сдельные начисления за месяц"
                                  : b.progress_percent
                                    ? `Выполнено на ${Math.round(b.progress_percent)}%`
                                    : "План выполнен"}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-emerald-400 shrink-0 whitespace-nowrap">
                              +{formatCurrency(b.bonus_amount || b.current_reward_value || 0)}
                            </span>
                          </div>
                        ))}

                      {/* Checklist Bonuses */}
                      {emp.checklist_bonuses
                        ?.filter((cb: any) => cb.is_met && cb.bonus_amount > 0)
                        .map((cb: any, idx: number) => (
                          <div key={`checklist-bonus-${idx}`} className="flex justify-between items-center py-2 border-b border-border/30 gap-2">
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{cb.name || "Чек-листы"}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                Средний балл: {Math.round(cb.score || emp.metrics?.evaluation_score || 0)}%
                              </p>
                            </div>
                            <span className="text-sm font-bold text-emerald-400 shrink-0 whitespace-nowrap">
                              +{formatCurrency(cb.bonus_amount || 0)}
                            </span>
                          </div>
                        ))}

                      {/* Maintenance Bonus */}
                      {emp.maintenance_status?.is_met && emp.maintenance_status.bonus_amount > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-border/30 gap-2">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">Обслуживание ПК (ТО)</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {emp.maintenance_status.penalty_amount > 0
                                ? `Базовый бонус ${formatCurrency(emp.maintenance_status.base_bonus_amount)}, удержано ${formatCurrency(emp.maintenance_status.penalty_amount)}`
                                : `Эффективность ТО: ${Math.round(emp.maintenance_status.efficiency || 100)}%`}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-emerald-400 shrink-0 whitespace-nowrap">
                            +{formatCurrency(emp.maintenance_status.bonus_amount || 0)}
                          </span>
                        </div>
                      )}

                      {/* Leaderboard bonus */}
                      {emp.breakdown?.leaderboard_bonuses?.map((lb: any, idx: number) => (
                        <div key={`lb-bonus-${idx}`} className="flex justify-between items-center py-2 border-b border-border/30 gap-2">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{lb.name || "Премия за рейтинг"}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              Место #{lb.rank || emp.leaderboard?.rank} ({lb.score || emp.leaderboard?.score} баллов)
                            </p>
                          </div>
                          <span className="text-sm font-bold text-emerald-400 shrink-0 whitespace-nowrap">
                            +{formatCurrency(lb.amount || lb.bonus_amount || 0)}
                          </span>
                        </div>
                      ))}

                      {/* Total Accrued Line */}
                      <div className="flex justify-between items-center pt-3 font-bold text-base gap-2">
                        <span className="text-foreground shrink-0">Итого начислено</span>
                        <span className="text-emerald-400 text-lg shrink-0 whitespace-nowrap">
                          {formatCurrency(totals.accrued)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Deductions Card */}
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <CardTitle className="text-base font-bold text-foreground">
                        Удержания и вычеты
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Фактические списания из заработной платы
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-4">
                      {/* Bar purchases deduction */}
                      {barDeductionsSum > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-border/30 gap-2">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">Покупки в баре под зарплату</p>
                            <p className="text-xs text-muted-foreground truncate">
                              Позиций: {emp.bar_details.length} шт
                            </p>
                          </div>
                          <span className="text-sm font-bold text-rose-400 shrink-0 whitespace-nowrap">
                            -{formatCurrency(barDeductionsSum)}
                          </span>
                        </div>
                      )}

                      {/* Confirmed Lateness penalties */}
                      {confirmedLatenessPenaltySum > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-border/30 gap-2">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">Штрафы за опоздания</p>
                            <p className="text-xs text-muted-foreground truncate">
                              Утверждено управляющим
                            </p>
                          </div>
                          <span className="text-sm font-bold text-rose-400 shrink-0 whitespace-nowrap">
                            -{formatCurrency(confirmedLatenessPenaltySum)}
                          </span>
                        </div>
                      )}

                      {/* Pending Lateness (Informational only, not deducted) */}
                      {(() => {
                        const pendingMins = emp.shifts?.reduce(
                          (s: number, sh: any) =>
                            s + (sh.lateness_status === "PENDING" ? sh.lateness_minutes || 0 : 0),
                          0
                        ) || 0;
                        if (pendingMins <= 0) return null;
                        return (
                          <div className="flex justify-between items-center py-2 border-b border-border/30 bg-accent/30 px-3 rounded-lg gap-2">
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground truncate">
                                Опоздания на рассмотрении ({pendingMins} мин)
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                Штраф не утвержден управляющим, из зарплаты не списывается
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0 whitespace-nowrap">
                              Не удержано
                            </Badge>
                          </div>
                        );
                      })()}

                      {/* Inventory discrepancies */}
                      {inventoryDeductionsSum > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-border/30 gap-2">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">Штрафы и недостачи</p>
                            <p className="text-xs text-muted-foreground truncate">Инвентаризационные списания</p>
                          </div>
                          <span className="text-sm font-bold text-rose-400 shrink-0 whitespace-nowrap">
                            -{formatCurrency(inventoryDeductionsSum)}
                          </span>
                        </div>
                      )}

                      {/* Empty state if no deductions */}
                      {totalDeductions === 0 && (
                        <div className="py-4 text-center text-xs text-muted-foreground">
                          Удержаний и списаний из зарплаты в этом месяце нет
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: KPIs & Achievements */}
                <div className="space-y-6">
                  {/* Monthly KPI Targets & Piece-rate bonuses */}
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <CardTitle className="text-base font-bold text-foreground">
                        Цели и KPI за месяц
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Выполнение планов и специальные надбавки
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3.5 sm:p-5 space-y-3.5">
                      {/* 1. Period Bonuses (Акции, специальные месячные планы) */}
                      {Array.isArray(emp.period_bonuses) &&
                        emp.period_bonuses.length > 0 &&
                        emp.period_bonuses.map((kpi: any, idx: number) => {
                          const isMet = Boolean(kpi.is_met);
                          const hasTarget = Number(kpi.target_value) > 0;
                          const progress = hasTarget
                            ? Math.min(Math.round(kpi.progress_percent || 0), 100)
                            : null;
                          const hasBreakdown =
                            Array.isArray(kpi.metric_breakdown) && kpi.metric_breakdown.length > 0;

                          return (
                            <div
                              key={`kpi-card-${idx}`}
                              className="space-y-2 p-3 sm:p-3.5 rounded-lg bg-accent/30 border border-border/40"
                            >
                              <div className="flex items-center justify-between text-xs gap-2">
                                <span className="font-semibold text-foreground truncate">{kpi.name || "KPI"}</span>
                                <span
                                  className={cn(
                                    "text-xs font-bold shrink-0 whitespace-nowrap",
                                    isMet ? "text-emerald-400" : "text-zinc-400"
                                  )}
                                >
                                  {isMet
                                    ? `+${formatCurrency(kpi.bonus_amount || kpi.current_reward_value || 0)}`
                                    : "Не выполнено"}
                                </span>
                              </div>

                              {/* Target-based progress bar */}
                              {hasTarget && progress !== null ? (
                                <>
                                  <Progress value={progress} className="h-1.5" />
                                  <div className="flex justify-between items-center text-[11px] text-muted-foreground gap-2">
                                    <span className="truncate">
                                      Факт: {formatCurrency(kpi.current_value || 0)} ({progress}%)
                                    </span>
                                    <span className="shrink-0 whitespace-nowrap">План: {formatCurrency(kpi.target_value || 0)}</span>
                                  </div>
                                </>
                              ) : hasBreakdown ? (
                                /* Piece-rate / Per-unit detailed breakdown */
                                <div className="space-y-1 pt-1 border-t border-border/30">
                                  {kpi.metric_breakdown.map((mb: any, mIdx: number) => (
                                    <div
                                      key={`mb-${mIdx}`}
                                      className="flex justify-between items-center text-[11px] text-muted-foreground gap-2"
                                    >
                                      <span className="truncate">
                                        {PROMO_SOURCE_LABELS[mb.source] || mb.source}: {mb.count}
                                      </span>
                                      <span className="text-foreground font-medium shrink-0 whitespace-nowrap">
                                        +{formatCurrency(mb.earned || 0)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  Начислено по результатам месяца
                                </p>
                              )}
                            </div>
                          );
                        })}

                      {/* 2. Checklist Quality Bonuses */}
                      {Array.isArray(emp.checklist_bonuses) &&
                        emp.checklist_bonuses.length > 0 &&
                        emp.checklist_bonuses.map((cb: any, idx: number) => {
                          const isMet = Boolean(cb.is_met && cb.bonus_amount > 0);
                          const score = Math.round(
                            cb.current_value || cb.score || emp.metrics?.evaluation_score || 0
                          );
                          const minScore = Number(cb.min_score) || 80;

                          return (
                            <div
                              key={`cb-card-${idx}`}
                              className="space-y-2 p-3 sm:p-3.5 rounded-lg bg-accent/30 border border-border/40"
                            >
                              <div className="flex items-center justify-between text-xs gap-2">
                                <span className="font-semibold text-foreground truncate">
                                  {cb.name || "Чек-листы стандартов"}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs font-bold shrink-0 whitespace-nowrap",
                                    isMet ? "text-emerald-400" : "text-zinc-400"
                                  )}
                                >
                                  {isMet
                                    ? `+${formatCurrency(cb.bonus_amount || 0)}`
                                    : "Не выполнено"}
                                </span>
                              </div>
                              <Progress value={Math.min(100, score)} className="h-1.5" />
                              <div className="flex justify-between items-center text-[11px] text-muted-foreground gap-2">
                                <span className="truncate">
                                  Средний балл:{" "}
                                  <span className="text-foreground font-medium">{score}%</span>
                                </span>
                                <span className="shrink-0 whitespace-nowrap">Порог: {minScore}%</span>
                              </div>
                              {cb.count > 0 && (
                                <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/30 truncate">
                                  Проверено смен за месяц: {cb.count}
                                </p>
                              )}
                            </div>
                          );
                        })}

                      {/* 3. Maintenance KPI (ТО ПК) */}
                      {emp.maintenance_status &&
                        (Number(
                          emp.maintenance_status.final_bonus_amount ??
                            emp.maintenance_status.bonus_amount ??
                            0
                        ) > 0 ||
                          Number(emp.maintenance_status.current_value || 0) > 0) &&
                        (() => {
                          const ms = emp.maintenance_status;
                          const isMet = Boolean(
                            ms.is_met &&
                              (ms.final_bonus_amount > 0 || ms.bonus_amount > 0)
                          );
                          const efficiency = Math.round(ms.efficiency || 0);

                          return (
                            <div className="space-y-2 p-3 sm:p-3.5 rounded-lg bg-accent/30 border border-border/40">
                              <div className="flex items-center justify-between text-xs gap-2">
                                <span className="font-semibold text-foreground truncate">
                                  {ms.name || "Обслуживание ПК (ТО)"}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs font-bold shrink-0 whitespace-nowrap",
                                    isMet ? "text-emerald-400" : "text-zinc-400"
                                  )}
                                >
                                  {isMet
                                    ? `+${formatCurrency(
                                        ms.final_bonus_amount ?? ms.bonus_amount ?? 0
                                      )}`
                                    : "0 ₽"}
                                </span>
                              </div>
                              {ms.target_value > 0 ? (
                                <>
                                  <Progress value={Math.min(100, efficiency)} className="h-1.5" />
                                  <div className="flex justify-between items-center text-[11px] text-muted-foreground gap-2">
                                    <span className="truncate">
                                      Выполнено:{" "}
                                      <span className="text-foreground font-medium">
                                        {ms.current_value} задач
                                      </span>{" "}
                                      ({efficiency}%)
                                    </span>
                                    <span className="shrink-0 whitespace-nowrap">План: {ms.target_value}</span>
                                  </div>
                                </>
                              ) : (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  Закрыто задач: {ms.current_value || 0}
                                </p>
                              )}
                              {Array.isArray(ms.breakdown) && ms.breakdown.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-border/30">
                                  {ms.breakdown.map((item: any, itemIdx: number) => (
                                    <div
                                      key={`m-breakdown-${itemIdx}`}
                                      className="flex justify-between items-center text-[11px] text-muted-foreground gap-2"
                                    >
                                      <span className="truncate">
                                        {item.type ||
                                          item.equipment_type_name ||
                                          "Оборудование"}
                                        : {item.count} шт
                                      </span>
                                      <span className="text-foreground font-medium shrink-0 whitespace-nowrap">
                                        +{formatCurrency(item.gross || 0)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      {/* 4. Shift Bonuses Breakdown (Бар, Выручка) */}
                      {Array.isArray(emp.shift_bonuses_breakdown) &&
                        emp.shift_bonuses_breakdown.length > 0 &&
                        emp.shift_bonuses_breakdown.map((sb: any, idx: number) => (
                          <div
                            key={`sb-card-${idx}`}
                            className="space-y-2 p-3 sm:p-3.5 rounded-lg bg-accent/30 border border-border/40"
                          >
                            <div className="flex items-center justify-between text-xs gap-2">
                              <span className="font-semibold text-foreground truncate">
                                {sb.name || "Сменный бонус"}
                              </span>
                              <span className="text-xs font-bold text-emerald-400 shrink-0 whitespace-nowrap">
                                +{formatCurrency(sb.amount || 0)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-muted-foreground gap-2">
                              <span className="truncate">Смен с бонусом: {sb.count || 0}</span>
                              {sb.source_value > 0 && (
                                <span className="shrink-0 whitespace-nowrap">Выручка: {formatCurrency(sb.source_value)}</span>
                              )}
                            </div>
                          </div>
                        ))}

                      {/* Empty state when nothing is configured */}
                      {(!emp.period_bonuses || emp.period_bonuses.length === 0) &&
                        (!emp.checklist_bonuses || emp.checklist_bonuses.length === 0) &&
                        (!emp.maintenance_status ||
                          (Number(emp.maintenance_status.bonus_amount || 0) === 0 &&
                            Number(emp.maintenance_status.current_value || 0) === 0)) &&
                        (!emp.shift_bonuses_breakdown ||
                          emp.shift_bonuses_breakdown.length === 0) && (
                          <div className="py-6 text-center text-xs text-muted-foreground">
                            Специальные месячные KPI не назначены
                          </div>
                        )}
                    </CardContent>
                  </Card>

                  {/* Leaderboard Position */}
                  {emp.leaderboard && (
                    <Card className="border-border bg-card">
                      <CardHeader className="pb-3 border-b border-border/40">
                        <CardTitle className="text-base font-bold text-foreground">
                          Рейтинг сотрудников
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-black text-amber-400">
                              #{emp.leaderboard.rank || "-"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              из {emp.leaderboard.total_participants || 1} участников
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-foreground">
                              {Number(emp.leaderboard.score || 0).toFixed(1)}
                            </p>
                            <p className="text-xs text-muted-foreground">баллов рейтинга</p>
                          </div>
                        </div>
                        {emp.leaderboard.breakdown && (
                          <div className="pt-3 border-t border-border/30 grid grid-cols-2 gap-2 text-xs">
                            <div className="text-muted-foreground">
                              Выручка:{" "}
                              <span className="text-foreground font-medium">
                                {Number(emp.leaderboard.breakdown.revenue || 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="text-muted-foreground">
                              Чек-листы:{" "}
                              <span className="text-foreground font-medium">
                                {Number(emp.leaderboard.breakdown.checklist || 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="text-muted-foreground">
                              ТО ПК:{" "}
                              <span className="text-foreground font-medium">
                                {Number(emp.leaderboard.breakdown.maintenance || 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="text-muted-foreground">
                              График:{" "}
                              <span className="text-foreground font-medium">
                                {Number(emp.leaderboard.breakdown.schedule || 0).toFixed(1)}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: PER-SHIFT BREAKDOWN */}
            <TabsContent value="shifts" className="space-y-4">
              <Card className="border-border bg-card">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base font-bold text-foreground">
                    Посменный расчет заработка
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Все смены в {MONTH_NAMES[month - 1].toLowerCase()} {year} с детальным расчетом начислений
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {!emp.shifts || emp.shifts.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      В этом месяце нет отработанных смен
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {emp.shifts.map((shift: any) => {
                        const isExpanded = expandedShiftId === shift.id;
                        const shiftBonusesTotal = shift.bonuses?.reduce(
                          (sum: number, b: any) => sum + (parseFloat(b.amount) || 0),
                          0
                        ) || 0;

                        const isLatenessConfirmed = shift.lateness_status === "CONFIRMED";
                        const isLatenessPending = shift.lateness_status === "PENDING";
                        const isLatenessCancelled = shift.lateness_status === "CANCELLED";
                        const confirmedPenalty = isLatenessConfirmed ? shift.lateness_penalty || 0 : 0;
                        const shiftDeductionsTotal = (shift.bar_deduction || 0) + confirmedPenalty;

                        return (
                          <div key={`shift-row-${shift.id}`} className="transition-colors hover:bg-accent/20">
                            <div
                              onClick={() => setExpandedShiftId(isExpanded ? null : shift.id)}
                              className="p-3.5 sm:p-5 flex items-center justify-between gap-2.5 sm:gap-4 cursor-pointer select-none"
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-foreground text-xs sm:text-sm whitespace-nowrap">
                                    {formatDate(shift.date)}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0">
                                    {shift.shift_type === "NIGHT" ? "Ночь" : "День"}
                                  </Badge>
                                  {isLatenessPending && (
                                    <span className="text-[10px] text-amber-400 font-medium whitespace-nowrap">
                                      • Опоздание
                                    </span>
                                  )}
                                  {isLatenessCancelled && (
                                    <span className="text-[10px] text-emerald-400 font-medium whitespace-nowrap">
                                      • Штраф снят
                                    </span>
                                  )}
                                  {shift.role_name && (
                                    <span className="text-[11px] text-muted-foreground hidden md:inline truncate">
                                      • {shift.role_name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap truncate">
                                  {Number(shift.total_hours || 0).toFixed(1)} ч • Выручка: {formatCurrency(shift.total_revenue || 0)}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-right">
                                <div>
                                  <div className="text-base sm:text-lg font-black text-emerald-400 whitespace-nowrap">
                                    +{formatCurrency(shift.calculated_salary || 0)}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:block">
                                    Оклад: {formatCurrency(shift.base_salary || 0)}
                                    {shiftBonusesTotal > 0 && ` • Премии: +${formatCurrency(shiftBonusesTotal)}`}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            {/* Accordion Expanded Details */}
                            {isExpanded && (
                              <div className="px-3 pb-4 pt-2 sm:px-5 sm:pb-5 bg-accent/10 border-t border-border/30 space-y-2.5 text-xs">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3">
                                  {/* Column 1: Base */}
                                  <div className="p-3.5 rounded-lg bg-card border border-border/40 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground uppercase text-[10px] font-bold">
                                        Базовая ставка
                                      </span>
                                      <span className="text-xs font-bold text-foreground">
                                        {formatCurrency(shift.base_salary || 0)}
                                      </span>
                                    </div>
                                    <div className="space-y-1.5 pt-1 border-t border-border/30 text-[11px]">
                                      <div className="flex justify-between text-muted-foreground">
                                        <span>Отработано:</span>
                                        <span className="text-foreground font-medium">
                                          {Number(shift.total_hours || 0).toFixed(1)} ч
                                        </span>
                                      </div>
                                      {Number(shift.total_hours) > 0 && (
                                        <div className="flex justify-between text-muted-foreground">
                                          <span>Часовая ставка:</span>
                                          <span className="text-foreground font-medium">
                                            ~{Math.round((shift.base_salary || 0) / (shift.total_hours || 1))} ₽/ч
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex justify-between text-muted-foreground">
                                        <span>Смена / роль:</span>
                                        <span className="text-foreground font-medium">
                                          {shift.shift_type === "NIGHT" ? "Ночь" : "День"} • {shift.role_name || "Сотрудник"}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-muted-foreground/80 font-mono pt-1 border-t border-border/20 flex justify-between items-center gap-1.5">
                                        <span className="shrink-0">Расчет:</span>
                                        <span className="text-foreground font-semibold shrink-0 whitespace-nowrap text-right">
                                          {Number(shift.total_hours || 0).toFixed(1)} ч × {Math.round((shift.base_salary || 0) / (shift.total_hours || 1))} ₽/ч
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Column 2: Shift Bonuses (Full KPI details) */}
                                  <div className="p-3.5 rounded-lg bg-card border border-border/40 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground uppercase text-[10px] font-bold">
                                        Детализация бонусов (KPI)
                                      </span>
                                      <span className="text-xs font-bold text-emerald-400">
                                        +{formatCurrency(shiftBonusesTotal)}
                                      </span>
                                    </div>

                                    {shift.bonuses && shift.bonuses.length > 0 ? (
                                      <div className="space-y-2 pt-1 border-t border-border/30">
                                        {shift.bonuses.map((b: any, bIdx: number) => {
                                          const isBar =
                                            b.source_key === "Bar" ||
                                            b.name?.toLowerCase().includes("бар");
                                          const isRev =
                                            b.source_key === "total_revenue" ||
                                            b.source_key === "total" ||
                                            b.name?.toLowerCase().includes("выручка");
                                          const isMaint =
                                            b.type === "MAINTENANCE_KPI" ||
                                            b.name?.toLowerCase().includes("обслуживание");
                                          const isChecklist =
                                            b.type === "CHECKLIST_BONUS" ||
                                            b.name?.toLowerCase().includes("чек-лист");
                                          const isOverplan = b.type === "PERSONAL_OVERPLAN";

                                          let metricTitle = "Показатель смены";
                                          let metricValueStr = "";
                                          let formula = "";
                                          const badge = b.met_threshold_label || null;

                                          if (isBar) {
                                            metricTitle = "Выручка бара";
                                            const barVal = Number(
                                              b.source_value || shift.metrics?.Bar || 0
                                            );
                                            metricValueStr = formatCurrency(barVal);
                                            const rate =
                                              b.applied_rate ??
                                              (barVal > 0 ? (b.amount / barVal) * 100 : 0);
                                            const rateFormatted = Number(rate)
                                              .toFixed(1)
                                              .replace(/\.0$/, "");
                                            formula = `${formatCurrency(barVal)} × ${rateFormatted}%`;
                                          } else if (isRev) {
                                            metricTitle = "Выручка смены";
                                            const revVal = Number(
                                              b.source_value || shift.total_revenue || 0
                                            );
                                            metricValueStr = formatCurrency(revVal);
                                            const rate =
                                              b.applied_rate ??
                                              (revVal > 0 ? (b.amount / revVal) * 100 : 0);
                                            const rateFormatted = Number(rate)
                                              .toFixed(1)
                                              .replace(/\.0$/, "");
                                            formula = `${formatCurrency(revVal)} × ${rateFormatted}%`;
                                          } else if (isMaint) {
                                            metricTitle = "Задачи ТО";
                                            metricValueStr = b.detail || "Техническое обслуживание";
                                            formula = "Сдельная оплата по регламенту";
                                          } else if (isChecklist) {
                                            metricTitle = "Чек-лист смены";
                                            metricValueStr = `Оценка: ${b.source_value}%`;
                                            formula = "Норматив соблюдения стандартов";
                                          } else if (isOverplan) {
                                            metricTitle = "Личный план";
                                            metricValueStr = `План: ${formatCurrency(b.plan_per_shift || 0)} (${b.kpi_percent || 0}%)`;
                                            formula = `Бонус ${b.bonus_percent}% от ставки (${formatCurrency(b.base_amount || 0)})`;
                                          } else {
                                            if (b.source_value && b.source_value > 0) {
                                              metricTitle = b.source_key || "База расчета";
                                              metricValueStr = formatCurrency(b.source_value);
                                              const rate =
                                                b.applied_rate ??
                                                ((b.amount / b.source_value) * 100);
                                              const rateFormatted = Number(rate)
                                                .toFixed(1)
                                                .replace(/\.0$/, "");
                                              formula = `${formatCurrency(b.source_value)} × ${rateFormatted}%`;
                                            }
                                          }

                                          return (
                                            <div
                                              key={`b-${bIdx}`}
                                              className="p-2 rounded-md bg-accent/20 border border-border/30 space-y-1"
                                            >
                                              <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                  <span className="font-bold text-foreground text-xs truncate">
                                                    {b.name || "Бонус"}
                                                  </span>
                                                  {badge && (
                                                    <span className="text-[10px] text-muted-foreground font-medium shrink-0 whitespace-nowrap">
                                                      • {badge}
                                                    </span>
                                                  )}
                                                </div>
                                                <span className="font-bold text-emerald-400 text-xs shrink-0 whitespace-nowrap">
                                                  +{formatCurrency(b.amount || 0)}
                                                </span>
                                              </div>

                                              <div className="flex items-center justify-between text-[11px] text-muted-foreground gap-2">
                                                <span className="truncate">{metricTitle}:</span>
                                                <span className="text-foreground font-medium shrink-0 whitespace-nowrap">
                                                  {metricValueStr}
                                                </span>
                                              </div>

                                              {formula && (
                                                <div className="text-[10px] text-muted-foreground/80 font-mono pt-1 border-t border-border/20 flex justify-between items-center gap-1.5">
                                                  <span className="shrink-0">Расчет:</span>
                                                  <span className="text-foreground font-semibold shrink-0 whitespace-nowrap text-right">
                                                    {formula} = +{formatCurrency(b.amount || 0)}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground pt-1 border-t border-border/30">
                                        Бонусов на смене нет
                                      </p>
                                    )}
                                  </div>

                                  {/* Column 3: Shift Deductions */}
                                  <div className="p-3.5 rounded-lg bg-card border border-border/40 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground uppercase text-[10px] font-bold">
                                        Удержания на смене
                                      </span>
                                      <span
                                        className={cn(
                                          "text-xs font-bold",
                                          shiftDeductionsTotal > 0
                                            ? "text-rose-400"
                                            : "text-muted-foreground"
                                        )}
                                      >
                                        {shiftDeductionsTotal > 0
                                          ? `-${formatCurrency(shiftDeductionsTotal)}`
                                          : "0 ₽"}
                                      </span>
                                    </div>

                                    <div className="space-y-2 pt-1 border-t border-border/30">
                                      {shift.bar_deduction > 0 && (
                                        <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/20 space-y-0.5">
                                          <div className="flex justify-between items-center text-[11px]">
                                            <span className="text-foreground font-medium">
                                              Покупки в баре
                                            </span>
                                            <span className="font-bold text-rose-400">
                                              -{formatCurrency(shift.bar_deduction)}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-muted-foreground">
                                            Удержано в счет зарплаты
                                          </p>
                                        </div>
                                      )}

                                      {isLatenessConfirmed && shift.lateness_penalty > 0 && (
                                        <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/20 space-y-0.5">
                                          <div className="flex justify-between items-center text-[11px]">
                                            <span className="text-rose-300 font-medium">
                                              Штраф за опоздание
                                            </span>
                                            <span className="font-bold text-rose-400">
                                              -{formatCurrency(shift.lateness_penalty)}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-rose-300/80">
                                            Опоздание на {shift.lateness_minutes} мин (подтверждено управляющим)
                                          </p>
                                        </div>
                                      )}

                                      {isLatenessPending && (
                                        <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 space-y-0.5">
                                          <div className="flex justify-between items-center text-[11px]">
                                            <span className="text-amber-300 font-medium">
                                              Опоздание ({shift.lateness_minutes} мин)
                                            </span>
                                            <span className="text-[10px] text-amber-400 font-bold">
                                              0 ₽
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-amber-300/80">
                                            На рассмотрении. До подтверждения управляющим сумма не вычитается.
                                          </p>
                                        </div>
                                      )}

                                      {isLatenessCancelled && (
                                        <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 space-y-0.5">
                                          <div className="flex justify-between items-center text-[11px]">
                                            <span className="line-through text-muted-foreground">
                                              Опоздание ({shift.lateness_minutes} мин)
                                            </span>
                                            <span className="text-[10px] text-emerald-400 font-bold">
                                              Штраф снят
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-muted-foreground">
                                            Управляющий аннулировал штраф
                                          </p>
                                        </div>
                                      )}

                                      {!shift.bar_deduction &&
                                        !isLatenessConfirmed &&
                                        !isLatenessPending &&
                                        !isLatenessCancelled && (
                                          <p className="text-xs text-muted-foreground">
                                            Удержаний на этой смене нет
                                          </p>
                                        )}
                                    </div>
                                  </div>
                                </div>

                                {/* Shift Financial Metrics Strip */}
                                <div className="p-3 rounded-lg bg-card/60 border border-border/30 space-y-2">
                                  <div className="flex items-center justify-between text-[11px] gap-2">
                                    <span className="font-bold text-muted-foreground uppercase text-[10px] truncate">
                                      Кассовые показатели смены
                                    </span>
                                    <span className="font-bold text-foreground shrink-0 whitespace-nowrap">
                                      Всего: {formatCurrency(shift.total_revenue || 0)}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    <div className="p-2 rounded bg-accent/20 border border-border/20">
                                      <span className="text-[10px] text-muted-foreground block">
                                        Наличные
                                      </span>
                                      <span className="font-semibold text-foreground">
                                        {formatCurrency(
                                          shift.revenue_cash || shift.metrics?.cash_income || 0
                                        )}
                                      </span>
                                    </div>
                                    <div className="p-2 rounded bg-accent/20 border border-border/20">
                                      <span className="text-[10px] text-muted-foreground block">
                                        Карта / Терминал
                                      </span>
                                      <span className="font-semibold text-foreground">
                                        {formatCurrency(
                                          shift.revenue_card || shift.metrics?.card_income || 0
                                        )}
                                      </span>
                                    </div>
                                    {Number(shift.metrics?.sbp || 0) > 0 && (
                                      <div className="p-2 rounded bg-accent/20 border border-border/20">
                                        <span className="text-[10px] text-muted-foreground block">
                                          СБП
                                        </span>
                                        <span className="font-semibold text-foreground">
                                          {formatCurrency(shift.metrics?.sbp || 0)}
                                        </span>
                                      </div>
                                    )}
                                    {Number(shift.metrics?.Bar || 0) > 0 && (
                                      <div className="p-2 rounded bg-accent/20 border border-border/20">
                                        <span className="text-[10px] text-muted-foreground block">
                                          Выручка бара
                                        </span>
                                        <span className="font-semibold text-foreground">
                                          {formatCurrency(shift.metrics?.Bar || 0)}
                                        </span>
                                      </div>
                                    )}
                                    {shift.metrics?.receipts_count && (
                                      <div className="p-2 rounded bg-accent/20 border border-border/20">
                                        <span className="text-[10px] text-muted-foreground block">
                                          Чеков пробито
                                        </span>
                                        <span className="font-semibold text-foreground">
                                          {shift.metrics?.receipts_count} шт
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: PAYMENT HISTORY */}
            <TabsContent value="payments" className="space-y-4">
              <Card className="border-border bg-card">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base font-bold text-foreground">
                    История выплат от руководства
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Зарплата, авансы и выданные премии в выбранном месяце
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {!emp.payment_history || emp.payment_history.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      В этом месяце выплат еще не зарегистрировано
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {emp.payment_history.map((pay: any, idx: number) => {
                        const paymentTypeLabel =
                          pay.payment_type === "advance"
                            ? "Аванс"
                            : pay.payment_type === "bonus"
                              ? "Премия"
                              : "Зарплата";
                        const methodLabel =
                          pay.method === "CASH"
                            ? "Наличными"
                            : pay.method === "CARD"
                              ? "Банковской картой"
                              : pay.method || "Выплата";

                        return (
                          <div key={`payment-${idx}`} className="p-3.5 sm:p-5 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-foreground text-xs sm:text-sm whitespace-nowrap">
                                  {paymentTypeLabel}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                                  • {methodLabel}
                                </span>
                              </div>
                              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                                {formatDateTime(pay.date)}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-sm sm:text-lg font-black text-foreground whitespace-nowrap">
                                {formatCurrency(pay.amount || 0)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: BAR DETAILS */}
            <TabsContent value="bar" className="space-y-4">
              <Card className="border-border bg-card">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base font-bold text-foreground">
                    Покупки в баре под зарплату
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Детализация товаров из бара, списанных в счет заработной платы
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {!emp.bar_details || emp.bar_details.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      В этом месяце покупок в баре под зарплату не зафиксировано
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {emp.bar_details.map((item: any, idx: number) => (
                        <div key={`bar-item-${idx}`} className="p-3.5 sm:p-5 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="font-bold text-foreground text-xs sm:text-sm truncate">
                              {item.product_name || "Товар бара"}
                            </p>
                            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                              {formatDateTime(item.date)} • {item.quantity} шт
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-sm sm:text-base font-bold text-rose-400 whitespace-nowrap">
                              -{formatCurrency(item.amount || 0)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
