import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  CalendarDays,
  Clock,
  CheckCircle,
  Wallet,
  DollarSign,
  TrendingUp,
  FileText,
  Edit,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Shift, ShiftDetails } from "../_types";
import {
  formatDate,
  formatTime,
  formatMoney,
  getMetricValue,
} from "../_utils";

interface ShiftDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift | null;
  shiftDetails: ShiftDetails | null;
  isLoadingDetails: boolean;
  timezone: string;
  calculateShiftTotalIncome: (s: Shift) => number;
}

export function ShiftDetailDialog({
  isOpen,
  onOpenChange,
  shift,
  shiftDetails,
  isLoadingDetails,
  timezone,
  calculateShiftTotalIncome,
}: ShiftDetailDialogProps) {
  const [expandedInventories, setExpandedInventories] = useState<
    Record<string, boolean>
  >({});

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden bg-background rounded-none fixed inset-0 w-screen h-dvh max-w-none flex flex-col min-h-0 left-0 top-0 translate-x-0 translate-y-0 sm:rounded-xl sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[95vw] sm:h-[85vh] sm:max-w-5xl">
        {/* Header Section */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 md:px-6 py-4 md:pr-16 border-b bg-card shrink-0">
          <div className="flex items-start gap-4 min-w-0">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {shift?.employee_name}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {shift && formatDate(shift.check_in, timezone)}
                </span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {shift && formatTime(shift.check_in, timezone)} —{" "}
                  {shift?.check_out
                    ? formatTime(shift.check_out, timezone)
                    : "..."}
                </span>
                <span className="text-border">|</span>
                <Badge
                  variant={shift?.shift_type === "NIGHT" ? "secondary" : "outline"}
                  className="font-normal"
                >
                  {shift?.shift_type === "NIGHT" ? "Ночная смена" : "Дневная смена"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1 pr-10 md:pr-0">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Итоговая выручка
            </div>
            <div className="text-2xl font-bold text-primary tabular-nums">
              +
              {shift
                ? formatMoney(calculateShiftTotalIncome(shift)).replace(
                    /[\u00A0\s]?₽/,
                    "",
                  )
                : "0"}{" "}
              ₽
            </div>
            {shift?.status === "VERIFIED" && (
              <Badge
                variant="outline"
                className="text-green-600 border-green-200 bg-green-50"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Подтверждена
              </Badge>
            )}
          </div>
        </div>

        {isLoadingDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
            <p className="text-muted-foreground">Загрузка данных смены...</p>
          </div>
        ) : (
          <Tabs
            defaultValue="overview"
            className="flex-1 flex flex-col overflow-hidden min-h-0"
          >
            <div className="px-4 md:px-6 border-b bg-muted/30 shrink-0">
              <TabsList className="h-12 w-full justify-start bg-transparent p-0 gap-4 md:gap-8 overflow-x-auto">
                <TabsTrigger
                  value="overview"
                  className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-medium"
                >
                  Обзор
                </TabsTrigger>
                <TabsTrigger
                  value="checklists"
                  className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-medium gap-2"
                >
                  Чек-листы
                  <Badge
                    variant="secondary"
                    className="rounded-full px-1.5 h-5 min-w-5 justify-center text-[10px]"
                  >
                    {shiftDetails?.checklists?.length || 0}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="products"
                  className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-medium gap-2"
                >
                  Продажи
                  <Badge
                    variant="secondary"
                    className="rounded-full px-1.5 h-5 min-w-5 justify-center text-[10px]"
                  >
                    {shiftDetails?.product_sales?.length || 0}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="inventory"
                  className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-medium gap-2"
                >
                  Инвентаризация
                  <Badge
                    variant="secondary"
                    className="rounded-full px-1.5 h-5 min-w-5 justify-center text-[10px]"
                  >
                    {shiftDetails?.inventory_checks?.length || 0}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="maintenance"
                  className="h-full rounded-none border-b-2 border-transparent px-0 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none bg-transparent font-medium gap-2"
                >
                  Обслуживание
                  <Badge
                    variant="secondary"
                    className="rounded-full px-1.5 h-5 min-w-5 justify-center text-[10px]"
                  >
                    {shiftDetails?.maintenance_tasks?.length || 0}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/5 min-h-0">
              <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 pb-62.5 md:pb-24">
                <TabsContent value="overview" className="mt-0 space-y-6">
                  {/* Key Metrics Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Наличные
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold tabular-nums">
                          {formatMoney(getMetricValue(shift, "cash_income"))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Терминал
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold tabular-nums">
                          {formatMoney(getMetricValue(shift, "card_income"))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Расходы
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground rotate-180" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600 tabular-nums">
                          -{formatMoney(getMetricValue(shift, "expenses"))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Часы
                        </CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold tabular-nums">
                          {Number(shift?.total_hours || 0).toFixed(1)} ч
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Detailed Metrics Table */}
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle className="text-base">
                          Детальные показатели
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableBody>
                            {shift?.report_data &&
                              Object.entries(shift.report_data).map(([key, value]) => {
                                const label = shiftDetails?.metric_labels?.[key] || key;
                                if (key.startsWith("_")) return null;

                                const renderValue = () => {
                                  if (Array.isArray(value)) {
                                    const total = value.reduce(
                                      (sum, item: any) => sum + (Number(item.amount) || 0),
                                      0,
                                    );
                                    if (total === 0 && value.length === 0) return "-";
                                    return (
                                      <div className="flex flex-col items-end gap-1">
                                        <span className="font-bold">
                                          {total.toLocaleString()} ₽
                                        </span>
                                        {value.map((item: any, i: number) => (
                                          <span
                                            key={i}
                                            className="text-[10px] text-muted-foreground leading-none"
                                          >
                                            {item.amount}₽: {item.comment}
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  }
                                  if (typeof value === "object" && value !== null) {
                                    return JSON.stringify(value);
                                  }
                                  return String(value);
                                };

                                return (
                                  <TableRow key={key} className="hover:bg-muted/30">
                                    <TableCell className="font-medium text-muted-foreground w-[40%]">
                                      {label}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-medium">
                                      {renderValue()}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            {(!shift?.report_data ||
                              Object.keys(shift.report_data).length === 0) && (
                              <TableRow>
                                <TableCell
                                  colSpan={2}
                                  className="text-center text-muted-foreground h-24"
                                >
                                  Нет дополнительных показателей
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    {/* Comments Section */}
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          Комментарий сотрудника
                        </h3>
                        <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground min-h-25">
                          {shift?.report_comment ? (
                            <p className="whitespace-pre-wrap">
                              {shift.report_comment}
                            </p>
                          ) : (
                            <span className="italic opacity-50">
                              Комментарий отсутствует
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <Edit className="h-4 w-4 text-muted-foreground" />
                          Заметки владельца
                        </h3>
                        <div className="p-4 rounded-lg border bg-blue-50/30 border-blue-100 text-sm text-muted-foreground min-h-25">
                          {shift?.owner_notes ? (
                            <p className="whitespace-pre-wrap">
                              {shift.owner_notes}
                            </p>
                          ) : (
                            <span className="italic opacity-50">Заметок нет</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="checklists" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Выполненные чек-листы
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {shiftDetails?.checklists?.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          Нет данных о чек-листах
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Название</TableHead>
                              <TableHead>Время</TableHead>
                              <TableHead>Проверил</TableHead>
                              <TableHead className="text-right">Результат</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {shiftDetails?.checklists.map((check, i) => {
                              const percent =
                                check.max_score > 0
                                  ? Math.round((check.total_score / check.max_score) * 100)
                                  : 0;

                              return (
                                <TableRow key={i}>
                                  <TableCell className="font-medium">
                                    {check.template_name || "Чек-лист"}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {formatTime(check.created_at, timezone)}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {check.evaluator_name || "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge
                                      variant={percent >= 80 ? "default" : "destructive"}
                                      className={percent >= 80 ? "bg-green-600 hover:bg-green-700" : ""}
                                    >
                                      {percent}%
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="products" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Проданные товары</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Время</TableHead>
                            <TableHead>Товар</TableHead>
                            <TableHead>Кол-во</TableHead>
                            <TableHead className="text-right">Цена</TableHead>
                            <TableHead className="text-right">Сумма</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shiftDetails?.product_sales?.map((sale: any) => (
                            <TableRow key={sale.id}>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {formatTime(sale.created_at, timezone)}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{sale.product_name}</div>
                                {sale.reason && (
                                  <div className="text-xs text-muted-foreground">{sale.reason}</div>
                                )}
                              </TableCell>
                              <TableCell>{Math.abs(Number(sale.change_amount))} шт.</TableCell>
                              <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                                {sale.price_at_time ? formatMoney(sale.price_at_time) : "-"}
                              </TableCell>
                              <TableCell className="text-right font-medium whitespace-nowrap">
                                {formatMoney(
                                  Math.abs(Number(sale.change_amount)) *
                                    (Number(sale.price_at_time) || 0),
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!shiftDetails?.product_sales ||
                            shiftDetails.product_sales.length === 0) && (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="text-center py-12 text-muted-foreground"
                              >
                                Продаж товаров не найдено
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="inventory" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Инвентаризации</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 bg-muted/5">
                      {!shiftDetails?.inventory_checks ||
                      shiftDetails.inventory_checks.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          Инвентаризаций не проводилось
                        </div>
                      ) : (
                        <div className="p-4 space-y-3">
                          {shiftDetails.inventory_checks.map((inv) => {
                            const isExpanded = expandedInventories[inv.id] || false;
                            const diff = Number(inv.revenue_difference || 0);
                            const reported = Number(inv.reported_revenue || 0);
                            const calculated = Number(inv.calculated_revenue || 0);
                            const discrepancies =
                              shiftDetails.inventory_discrepancies?.filter(
                                (d: any) => d.inventory_id === inv.id,
                              ) || [];

                            return (
                              <div
                                key={inv.id}
                                className={cn(
                                  "border rounded-xl overflow-hidden transition-all bg-white",
                                  isExpanded
                                    ? "shadow-md ring-1 ring-slate-200"
                                    : "hover:border-slate-300 shadow-sm",
                                )}
                              >
                                <div
                                  className={cn(
                                    "px-4 py-3 flex items-center justify-between cursor-pointer select-none gap-2",
                                    isExpanded ? "border-b bg-slate-50/50" : "",
                                  )}
                                  onClick={() =>
                                    setExpandedInventories((prev) => ({
                                      ...prev,
                                      [inv.id]: !prev[inv.id],
                                    }))
                                  }
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                                    <div
                                      className={cn(
                                        "p-2 rounded-lg transition-all shrink-0 bg-blue-50 text-blue-600",
                                        isExpanded ? "rotate-90" : "",
                                      )}
                                    >
                                      <ChevronRight className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-sm font-bold text-slate-900 truncate">
                                        {inv.warehouse_name || "Склад"}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400 mt-0.5">
                                        <span className="whitespace-nowrap">
                                          {formatDate(inv.started_at, timezone)}{" "}
                                          {formatTime(inv.started_at, timezone)}
                                        </span>
                                        {discrepancies.length > 0 && (
                                          <span className="bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-600 font-medium whitespace-nowrap">
                                            {discrepancies.length} расхожд.
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="ml-3 flex-none flex flex-col items-start gap-2 text-left w-37.5 sm:w-47.5">
                                    <div className="flex items-baseline gap-3 w-full">
                                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none w-18.5 shrink-0">
                                        Расчет
                                      </span>
                                      <span className="text-sm font-black text-blue-600 leading-none whitespace-nowrap tabular-nums">
                                        {calculated.toLocaleString()} ₽
                                      </span>
                                    </div>
                                    <div className="flex items-baseline gap-3 w-full">
                                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none w-18.5 shrink-0">
                                        Факт
                                      </span>
                                      <span className="text-sm font-black text-slate-700 leading-none whitespace-nowrap tabular-nums">
                                        {reported.toLocaleString()} ₽
                                      </span>
                                    </div>
                                    <div className="flex items-baseline gap-3 w-full">
                                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none w-18.5 shrink-0">
                                        Разница
                                      </span>
                                      <span
                                        className={cn(
                                          "text-sm font-black leading-none whitespace-nowrap tabular-nums",
                                          diff === 0
                                            ? "text-green-500"
                                            : diff > 0
                                              ? "text-green-600"
                                              : "text-red-500",
                                        )}
                                      >
                                        {diff > 0 ? "+" : ""}
                                        {diff.toLocaleString()} ₽
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="bg-white">
                                    {discrepancies.length > 0 ? (
                                      <Table>
                                        <TableHeader className="bg-slate-50/50">
                                          <TableRow className="hover:bg-transparent h-9">
                                            <TableHead className="text-[10px] uppercase font-bold text-slate-400 h-9">
                                              Товар
                                            </TableHead>
                                            <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400 h-9">
                                              Ожидалось
                                            </TableHead>
                                            <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400 h-9">
                                              Факт
                                            </TableHead>
                                            <TableHead className="text-right text-[10px] uppercase font-bold text-slate-400 h-9">
                                              Разница
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {discrepancies.map((item: any) => (
                                            <TableRow
                                              key={item.id}
                                              className="hover:bg-slate-50/50 h-10 border-b border-slate-100 last:border-0"
                                            >
                                              <TableCell className="py-2 font-medium text-sm text-slate-700">
                                                {item.product_name}
                                              </TableCell>
                                              <TableCell className="py-2 text-right text-sm text-slate-500 tabular-nums">
                                                {item.expected_stock}
                                              </TableCell>
                                              <TableCell className="py-2 text-right text-sm text-slate-900 font-bold tabular-nums">
                                                {item.actual_stock}
                                              </TableCell>
                                              <TableCell className="py-2 text-right">
                                                <Badge
                                                  variant={Number(item.difference) > 0 ? "default" : "destructive"}
                                                  className={cn(
                                                    "font-mono h-5 px-1.5 text-[10px]",
                                                    Number(item.difference) > 0
                                                      ? "bg-green-100 text-green-700 hover:bg-green-200 border-0"
                                                      : "bg-red-100 text-red-700 hover:bg-red-200 border-0",
                                                  )}
                                                >
                                                  {Number(item.difference) > 0 ? "+" : ""}
                                                  {item.difference}
                                                </Badge>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    ) : (
                                      <div className="p-8 text-center text-sm text-slate-400 italic">
                                        Расхождений не найдено
                                      </div>
                                    )}
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

                <TabsContent value="maintenance" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Обслуживание оборудования</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Время</TableHead>
                            <TableHead>Оборудование</TableHead>
                            <TableHead>Тип</TableHead>
                            <TableHead>Статус</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shiftDetails?.maintenance_tasks?.map((task) => {
                            const taskTypeMap: Record<string, string> = {
                              CLEANING: "Чистка",
                              REPAIR: "Ремонт",
                              INSPECTION: "Осмотр",
                              REPLACEMENT: "Замена",
                              SOFTWARE: "ПО",
                            };

                            const statusMap: Record<string, string> = {
                              COMPLETED: "Выполнено",
                              PENDING: "В ожидании",
                              IN_PROGRESS: "В процессе",
                              SKIPPED: "Пропущено",
                            };

                            return (
                              <TableRow key={task.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {formatTime(task.completed_at, timezone)}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium">{task.equipment_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {task.workstation_name}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="font-normal">
                                    {taskTypeMap[task.task_type] || task.task_type}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                                  >
                                    {statusMap[task.status] || task.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {(!shiftDetails?.maintenance_tasks ||
                            shiftDetails.maintenance_tasks.length === 0) && (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center py-12 text-muted-foreground"
                              >
                                Нет записей об обслуживании
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
