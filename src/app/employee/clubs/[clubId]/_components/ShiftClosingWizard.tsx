"use client";

import {
  useState,
  useTransition,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Wrench,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs";
import { cn } from "@/lib/utils";
import { ShiftOpeningWizard } from "./ShiftOpeningWizard";

interface ShiftClosingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (reportData: any) => void;
  clubId: string;
  userId: string;
  reportTemplate: any;
  activeShiftId: string | number;
  checklistTemplates?: any[];
}

function normalizeExpenseEntries(value: any) {
  if (Array.isArray(value)) return value;
  const amount = Number(value);
  if (Number.isFinite(amount) && amount > 0) {
    return [{ amount: String(amount), comment: "" }];
  }
  return [];
}

function hasReportValue(value: any) {
  if (Array.isArray(value)) {
    return value.some((item) => {
      const raw = item?.amount;
      if (raw === null || raw === undefined) return false;
      const s = String(raw).trim();
      if (s === "") return false;
      const n = Number(s);
      return Number.isFinite(n);
    });
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const s = value.trim();
    if (s === "") return false;
    const n = Number(s);
    if (Number.isFinite(n)) return true;
    return true;
  }
  return Boolean(value);
}

export function ShiftClosingWizard({
  isOpen,
  onClose,
  onComplete,
  clubId,
  userId,
  reportTemplate,
  activeShiftId,
  checklistTemplates = [],
}: ShiftClosingWizardProps) {
  const { showMessage, Dialogs } = useUiDialogs();
  const [step, setStep] = useState<1 | 2>(1);
  const [reportData, setReportData] = useState<any>({});
  const [isPending, startTransition] = useTransition();
  const [requiredChecklist, setRequiredChecklist] = useState<any>(null);
  const [checklistResponses, setChecklistResponses] = useState<
    Record<number, any>
  >({});
  const [isChecklistWizardOpen, setIsChecklistWizardOpen] = useState(false);
  const [shiftIndicators, setShiftIndicators] = useState<any>(null);
  const [isLoadingIndicators, setIsLoadingIndicators] = useState(false);
  const [payoutSuggestion, setPayoutSuggestion] = useState<{
    amount: number;
    isAvailable: boolean;
  } | null>(null);

  const persistenceKey = `shift_closing_${activeShiftId}`;

  const fetchIndicators = useCallback(() => {
    if (!activeShiftId) return;
    setIsLoadingIndicators(true);
    fetch(`/api/employee/shifts/${activeShiftId}/indicators?_t=${Date.now()}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        setShiftIndicators(data);
        if (data.projected_instant_payout > 0) {
          setPayoutSuggestion({
            amount: data.projected_instant_payout,
            isAvailable: true,
          });
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingIndicators(false));
  }, [activeShiftId]);

  useEffect(() => {
    if (isOpen && activeShiftId) {
      fetchIndicators();
    }
  }, [isOpen, activeShiftId, fetchIndicators]);

  useEffect(() => {
    if (isOpen && activeShiftId) {
      const saved = localStorage.getItem(persistenceKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setStep(Number(data.step || 1) as 1 | 2);
          setReportData(data.reportData || {});
          setChecklistResponses(data.checklistResponses || {});
        } catch (e) {
          console.error("Failed to restore state", e);
        }
      }
    }
  }, [isOpen, activeShiftId, persistenceKey]);

  useEffect(() => {
    if (isOpen && activeShiftId) {
      localStorage.setItem(
        persistenceKey,
        JSON.stringify({
          step,
          reportData,
          checklistResponses,
        }),
      );
    }
  }, [
    step,
    reportData,
    checklistResponses,
    isOpen,
    activeShiftId,
    persistenceKey,
  ]);

  useEffect(() => {
    if (isOpen) {
      const mandatory = checklistTemplates?.find(
        (t: any) =>
          t.type === "shift_handover" && t.settings?.block_shift_close,
      );
      setRequiredChecklist(mandatory || null);
    }
  }, [isOpen, checklistTemplates]);

  const isRequiredChecklistComplete = useMemo(() => {
    if (!requiredChecklist?.items?.length) return true;
    for (const item of requiredChecklist.items) {
      const response = checklistResponses[item.id];
      if (!response || response.score === -1 || response.score === undefined)
        return false;
      if (item.is_photo_required) {
        const uploaded = response.photo_urls?.length || 0;
        const minRequired = item.min_photos || 1;
        if (uploaded < minRequired) return false;
      }
    }
    return true;
  }, [checklistResponses, requiredChecklist?.items]);

  const stepOneMissingFields = useMemo(() => {
    const requiredFields =
      reportTemplate?.schema
        ?.filter((f: any) => f.is_required)
        ?.map((f: any) => f.metric_key) || [];
    return requiredFields.filter(
      (key: string) => !hasReportValue(reportData[key]),
    );
  }, [reportData, reportTemplate?.schema]);

  const handleStep1Submit = () => {
    if (stepOneMissingFields.length > 0) {
      showMessage({
        title: "Проверьте данные",
        description: "Заполните обязательные поля отчета",
      });
      return;
    }
    if (requiredChecklist?.items?.length && !isRequiredChecklistComplete) {
      setIsChecklistWizardOpen(true);
      return;
    }

    startTransition(async () => {
      try {
        await fetch(`/api/employee/shifts/${activeShiftId}/indicators`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ indicators: reportData }),
          cache: "no-store",
        });
        fetchIndicators();
        setStep(2);
      } catch (e) {
        console.error("Failed to update indicators", e);
        setStep(2);
      }
    });
  };

  const handleFinalize = () => {
    startTransition(() => {
      localStorage.removeItem(persistenceKey);
      onComplete({
        ...reportData,
        checklistResponses,
        checklistId: requiredChecklist?.id,
        templateId: reportTemplate?.id,
      });
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 h-dvh bg-black text-zinc-100 flex flex-col z-9999 overflow-hidden font-sans">
      <header className="px-6 py-5 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-white uppercase italic tracking-tight leading-none">
              {step === 1 ? "Финансовый отчет" : "Завершение смены"}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge
                variant="outline"
                className="border-zinc-700 text-zinc-500 text-[9px] font-mono px-1.5 py-0 h-4 bg-zinc-900/50"
              >
                ШАГ {step} ИЗ 2
              </Badge>
              {step === 1 && stepOneMissingFields.length > 0 && (
                <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider animate-pulse">
                  Нужно заполнить: {stepOneMissingFields.length}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onClose}
          className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white h-12 w-12 rounded-2xl transition-all active:scale-90"
        >
          <X className="h-6 w-6" />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-6xl mx-auto pb-32">
          {step === 1 ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="lg:col-span-5 space-y-8">
                {requiredChecklist && (
                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] space-y-5 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <CheckCircle2 className="h-24 w-24 text-white" />
                    </div>
                    <div className="flex items-start justify-between gap-4 relative z-10">
                      <div className="space-y-1">
                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">
                          Обязательный этап
                        </div>
                        <h4 className="text-lg font-black text-white uppercase italic tracking-tight">
                          {requiredChecklist.name}
                        </h4>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 rounded-xl border-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                          isRequiredChecklistComplete
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-400",
                        )}
                      >
                        {isRequiredChecklistComplete ? "ГОТОВО" : "НУЖЕН"}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => setIsChecklistWizardOpen(true)}
                      className={cn(
                        "w-full h-14 rounded-2xl font-black uppercase italic tracking-tighter transition-all active:scale-[0.98]",
                        isRequiredChecklistComplete
                          ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
                          : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.2)]",
                      )}
                    >
                      {isRequiredChecklistComplete
                        ? "Проверить ответы"
                        : "Заполнить чеклист"}
                    </Button>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-1">
                    <div className="h-px flex-1 bg-zinc-800" />
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">
                      Основные показатели
                    </span>
                    <div className="h-px flex-1 bg-zinc-800" />
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    {reportTemplate?.schema
                      .filter(
                        (f: any) =>
                          f.field_type === "INCOME" ||
                          (f.is_required &&
                            f.field_type !== "EXPENSE" &&
                            f.field_type !== "EXPENSE_LIST"),
                      )
                      .map((field: any, idx: number) => (
                        <div key={idx} className="space-y-2 group">
                          <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 group-focus-within:text-emerald-500 transition-colors">
                            {field.custom_label || field.metric_key}
                            {field.is_required && (
                              <span className="text-emerald-500 ml-1">*</span>
                            )}
                          </Label>
                          <div className="relative">
                            <Input
                              type={
                                field.metric_key.includes("comment")
                                  ? "text"
                                  : "number"
                              }
                              className="bg-zinc-900 h-16 rounded-2xl border-zinc-800 text-lg font-black text-white focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
                              placeholder="0.00"
                              value={reportData[field.metric_key] || ""}
                              onChange={(e) =>
                                setReportData({
                                  ...reportData,
                                  [field.metric_key]: e.target.value,
                                })
                              }
                            />
                            {!field.metric_key.includes("comment") && (
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-black italic uppercase text-xs">
                                RUB
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-8">
                {shiftIndicators?.inventory_settings
                  ?.report_reconciliation_enabled && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 px-1">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">
                        Сверка кассы
                      </span>
                      <div className="h-px flex-1 bg-zinc-800" />
                    </div>
                    <div className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 overflow-hidden shadow-xl">
                      <div className="p-8 grid grid-cols-2 gap-10">
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none">
                            Введено вами
                          </span>
                          <div className="text-2xl font-black text-white italic">
                            {(() => {
                              const key =
                                shiftIndicators?.inventory_settings
                                  ?.employee_default_metric_key;
                              const val =
                                key && reportData[key] !== undefined
                                  ? reportData[key]
                                  : key === "Bar" &&
                                      reportData["bar_revenue"] !== undefined
                                    ? reportData["bar_revenue"]
                                    : Number(reportData.cash_income || 0) +
                                      Number(reportData.card_income || 0);
                              return Number(val || 0).toLocaleString();
                            })()}{" "}
                            ₽
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none">
                            Касса DashAdmin
                          </span>
                          <div className="text-2xl font-black text-white italic">
                            {(
                              shiftIndicators.calculated_revenue || 0
                            ).toLocaleString()}{" "}
                            ₽
                          </div>
                        </div>
                      </div>
                      {(() => {
                        const key =
                          shiftIndicators?.inventory_settings
                            ?.employee_default_metric_key;
                        const reported =
                          key && reportData[key] !== undefined
                            ? Number(reportData[key] || 0)
                            : key === "Bar" &&
                                reportData["bar_revenue"] !== undefined
                              ? Number(reportData["bar_revenue"] || 0)
                              : Number(reportData.cash_income || 0) +
                                Number(reportData.card_income || 0);
                        const calculated =
                          shiftIndicators.calculated_revenue || 0;
                        const diff = reported - calculated;
                        return (
                          <div
                            className={cn(
                              "px-8 py-6 border-t border-zinc-800 flex items-center justify-between",
                              diff === 0
                                ? "bg-emerald-500/5"
                                : diff > 0
                                  ? "bg-amber-500/5"
                                  : "bg-rose-500/5",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "h-10 w-10 rounded-xl flex items-center justify-center border",
                                  diff === 0
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                    : diff > 0
                                      ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                      : "bg-rose-500/10 border-rose-500/20 text-rose-500",
                                )}
                              >
                                {diff === 0 ? (
                                  <CheckCircle2 className="h-5 w-5" />
                                ) : (
                                  <AlertTriangle className="h-5 w-5" />
                                )}
                              </div>
                              <div>
                                <div
                                  className={cn(
                                    "text-xs font-black uppercase italic tracking-tight",
                                    diff === 0
                                      ? "text-emerald-500"
                                      : diff > 0
                                        ? "text-amber-500"
                                        : "text-rose-500",
                                  )}
                                >
                                  {diff === 0
                                    ? "Касса сходится"
                                    : diff > 0
                                      ? "Излишек по кассе"
                                      : "Недостача по кассе"}
                                </div>
                                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                                  Разница между фактом и учетом
                                </div>
                              </div>
                            </div>
                            <div
                              className={cn(
                                "text-xl font-black tabular-nums italic",
                                diff === 0
                                  ? "text-emerald-500"
                                  : diff > 0
                                    ? "text-amber-500"
                                    : "text-rose-500",
                              )}
                            >
                              {diff > 0 ? "+" : ""}
                              {diff.toLocaleString()} ₽
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-1">
                    <div className="h-px flex-1 bg-zinc-800" />
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">
                      Дополнительно и Расходы
                    </span>
                    <div className="h-px flex-1 bg-zinc-800" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
                    {reportTemplate?.schema
                      .filter(
                        (f: any) =>
                          f.field_type === "EXPENSE" ||
                          f.field_type === "EXPENSE_LIST",
                      )
                      .map((field: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] space-y-6"
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                                {field.custom_label || field.metric_key}
                              </Label>
                              <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">
                                Все зафиксированные траты из кассы
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const current = normalizeExpenseEntries(
                                  reportData[field.metric_key],
                                );
                                setReportData({
                                  ...reportData,
                                  [field.metric_key]: [
                                    ...current,
                                    { amount: "", comment: "" },
                                  ],
                                });
                              }}
                              className="h-10 rounded-xl bg-zinc-950 border-zinc-800 text-emerald-500 font-bold uppercase italic text-[10px]"
                            >
                              <Plus className="h-3 w-3 mr-1.5" /> Добавить
                            </Button>
                          </div>

                          <div className="space-y-4">
                            {normalizeExpenseEntries(
                              reportData[field.metric_key],
                            ).length === 0 ? (
                              <div className="py-8 text-center border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 text-[11px] font-bold uppercase tracking-widest">
                                Список расходов пуст
                              </div>
                            ) : (
                              normalizeExpenseEntries(
                                reportData[field.metric_key],
                              ).map((item: any, itemIdx: number) => (
                                <div
                                  key={itemIdx}
                                  className="flex gap-3 animate-in zoom-in-95 duration-200"
                                >
                                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <Input
                                      type="number"
                                      placeholder="Сумма"
                                      value={item.amount}
                                      onChange={(e) => {
                                        const newList = [
                                          ...normalizeExpenseEntries(
                                            reportData[field.metric_key],
                                          ),
                                        ];
                                        newList[itemIdx].amount =
                                          e.target.value;
                                        setReportData({
                                          ...reportData,
                                          [field.metric_key]: newList,
                                        });
                                      }}
                                      className="bg-zinc-950 h-12 border-zinc-800 rounded-xl font-black text-emerald-500"
                                    />
                                    <Input
                                      placeholder="Что купили?"
                                      value={item.comment}
                                      onChange={(e) => {
                                        const newList = [
                                          ...normalizeExpenseEntries(
                                            reportData[field.metric_key],
                                          ),
                                        ];
                                        newList[itemIdx].comment =
                                          e.target.value;
                                        setReportData({
                                          ...reportData,
                                          [field.metric_key]: newList,
                                        });
                                      }}
                                      className="sm:col-span-2 bg-zinc-950 h-12 border-zinc-800 rounded-xl text-xs font-medium text-zinc-300"
                                    />
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                      const newList = [
                                        ...normalizeExpenseEntries(
                                          reportData[field.metric_key],
                                        ),
                                      ];
                                      newList.splice(itemIdx, 1);
                                      setReportData({
                                        ...reportData,
                                        [field.metric_key]: newList,
                                      });
                                    }}
                                    className="h-12 w-12 rounded-xl border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-rose-500 active:scale-90"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}

                    {reportTemplate?.schema
                      .filter(
                        (f: any) =>
                          f.field_type !== "EXPENSE" &&
                          f.field_type !== "EXPENSE_LIST" &&
                          f.field_type !== "INCOME" &&
                          !f.is_required,
                      )
                      .map((field: any, idx: number) => (
                        <div key={idx} className="space-y-2 group">
                          <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 group-focus-within:text-emerald-500 transition-colors">
                            {field.custom_label || field.metric_key}
                          </Label>
                          <Input
                            type={
                              field.metric_key.includes("comment")
                                ? "text"
                                : "number"
                            }
                            className="bg-zinc-900 h-14 rounded-2xl border-zinc-800 text-base font-bold text-zinc-200 focus:border-zinc-700 placeholder:text-zinc-700"
                            placeholder={
                              field.metric_key.includes("comment")
                                ? "Ваш комментарий..."
                                : "0"
                            }
                            value={reportData[field.metric_key] || ""}
                            onChange={(e) =>
                              setReportData({
                                ...reportData,
                                [field.metric_key]: e.target.value,
                              })
                            }
                          />
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in zoom-in-95 duration-500">
              {isLoadingIndicators && !shiftIndicators ? (
                <div className="flex flex-col items-center justify-center py-40 gap-6">
                  <div className="h-20 w-20 rounded-full border-4 border-zinc-800 border-t-white animate-spin" />
                  <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">
                    Вычисляем показатели...
                  </div>
                </div>
              ) : (
                <div className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-10">
                      <section className="space-y-6">
                        <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3">
                          <span className="text-emerald-500">01</span>{" "}
                          Начисления
                        </h2>
                        <div className="space-y-1">
                          <div className="p-6 bg-zinc-900/50 rounded-3xl border border-zinc-800">
                            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                              Ставка за смену
                            </div>
                            <div className="text-2xl font-black text-white italic">
                              {(
                                shiftIndicators?.shift_earnings || 0
                              ).toLocaleString()}{" "}
                              ₽
                            </div>
                            {shiftIndicators?.breakdown?.total_hours && (
                              <div className="text-[9px] font-medium text-zinc-600 uppercase tracking-tighter">
                                {Number(
                                  shiftIndicators.breakdown.total_hours,
                                ).toFixed(1)}
                                ч ×{" "}
                                {(
                                  Number(shiftIndicators.breakdown.base || 0) /
                                  Number(
                                    shiftIndicators.breakdown.total_hours || 1,
                                  )
                                ).toFixed(0)}{" "}
                                ₽
                              </div>
                            )}
                          </div>
                          <div className="space-y-1 pt-4">
                            {(shiftIndicators?.breakdown?.bonuses || []).map(
                              (bonus: any, i: number) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between p-5 bg-zinc-950 border border-zinc-900 rounded-2xl"
                                >
                                  <div className="space-y-0.5">
                                    <div className="text-xs font-black text-white uppercase italic tracking-tight">
                                      {bonus.name}
                                    </div>
                                    <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                                      {bonus.type === "CHECKLIST_BONUS"
                                        ? `Счет: ${bonus.source_value}%`
                                        : bonus.source_key === "total_revenue"
                                          ? `Факт: ${bonus.source_value.toLocaleString()}`
                                          : bonus.detail ||
                                            "Бонус за показатели"}
                                    </div>
                                  </div>
                                  <div className="text-sm font-black text-emerald-500 italic">
                                    +{bonus.amount.toLocaleString()} ₽
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      </section>

                      <section className="space-y-6">
                        <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3">
                          <span className="text-amber-500">03</span>{" "}
                          Обслуживание
                        </h2>
                        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden">
                          <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Wrench className="h-5 w-5 text-amber-500" />
                                <span className="text-xs font-black text-white uppercase italic tracking-tight">
                                  Задачи по ТХ
                                </span>
                              </div>
                              <div className="text-xs font-black text-zinc-500 tabular-nums">
                                {shiftIndicators?.maintenance?.completed || 0} /{" "}
                                {shiftIndicators?.maintenance?.total || 0}
                              </div>
                            </div>
                            <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 transition-all"
                                style={{
                                  width: `${shiftIndicators?.maintenance?.total > 0 ? (shiftIndicators.maintenance.completed / shiftIndicators.maintenance.total) * 100 : 0}%`,
                                }}
                              />
                            </div>

                            {(shiftIndicators?.maintenance?.details || [])
                              .length === 0 ? (
                              <div className="py-4 text-center border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 text-[11px] font-bold uppercase tracking-widest">
                                Все выполнено
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {(
                                  shiftIndicators?.maintenance?.details || []
                                ).map((task: any, i: number) => (
                                  <div
                                    key={i}
                                    className="flex justify-between items-center text-[10px]"
                                  >
                                    <div className="flex items-center gap-3">
                                      {task.status === "DONE" ? (
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                      ) : (
                                        <AlertCircle className="h-3 w-3 text-rose-500" />
                                      )}
                                      <span
                                        className={cn(
                                          "uppercase font-medium",
                                          task.status === "DONE"
                                            ? "text-zinc-300"
                                            : "text-rose-500",
                                        )}
                                      >
                                        {task.name}
                                      </span>
                                    </div>
                                    {task.reward > 0 &&
                                      task.status === "DONE" && (
                                        <span className="text-emerald-500 font-bold tabular-nums">
                                          +{task.reward} ₽
                                        </span>
                                      )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {(shiftIndicators?.maintenance?.overdue || 0) > 0 && (
                            <div className="px-6 py-4 bg-rose-500/5 border-t border-zinc-900 flex items-center gap-3">
                              <AlertCircle className="h-3 w-3 text-rose-500" />
                              <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">
                                Просрочено задач:{" "}
                                {shiftIndicators.maintenance.overdue}
                              </span>
                            </div>
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="space-y-10">
                      <section className="space-y-6">
                        <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3">
                          <span className="text-rose-500">02</span> Удержания
                        </h2>
                        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-sm">
                          <div className="p-6 space-y-4">
                            <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-zinc-900 pb-2 flex justify-between">
                              <span>Покупки в баре</span>
                              <span>Сумма</span>
                            </div>
                            <div className="space-y-3">
                              {(
                                shiftIndicators?.breakdown?.deductions || []
                              ).map((d: any, i: number) => (
                                <div
                                  key={i}
                                  className="flex justify-between items-center text-[10px]"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-zinc-700 font-mono">
                                      {d.date
                                        ? new Date(d.date).toLocaleTimeString(
                                            [],
                                            {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            },
                                          )
                                        : d.time || "--:--"}
                                    </span>
                                    <span className="text-zinc-400 uppercase font-medium">
                                      {d.name || d.product_name}
                                    </span>
                                  </div>
                                  <span className="text-rose-500 font-black italic">
                                    -{(d.amount || 0).toLocaleString()} ₽
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="p-6 bg-zinc-900/30 border-t border-zinc-900 flex justify-between items-center text-rose-500">
                            <div className="text-[10px] font-black uppercase tracking-widest">
                              Всего вычтено
                            </div>
                            <div className="text-lg font-black italic">
                              -
                              {(shiftIndicators?.breakdown?.deductions || [])
                                .reduce(
                                  (s: number, d: any) =>
                                    s + (Number(d.amount) || 0),
                                  0,
                                )
                                .toLocaleString()}{" "}
                              ₽
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="pt-4">
                        <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 space-y-8 shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[80px]" />
                          <div className="space-y-1 text-center md:text-left relative z-10">
                            <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-2">
                              Чистая прибыль за смену
                            </div>
                            <div className="text-5xl font-black text-white italic tracking-tighter tabular-nums">
                              {(
                                (shiftIndicators?.shift_earnings || 0) +
                                (shiftIndicators?.kpi_bonus || 0) -
                                (shiftIndicators?.breakdown?.deductions?.reduce(
                                  (s: number, d: any) =>
                                    s + (Number(d.amount) || 0),
                                  0,
                                ) || 0)
                              ).toLocaleString()}{" "}
                              ₽
                            </div>
                          </div>
                          <div className="space-y-4 relative z-10">
                            {payoutSuggestion && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Button
                                  onClick={() =>
                                    setReportData({
                                      ...reportData,
                                      auto_payout_amount:
                                        payoutSuggestion.amount,
                                    })
                                  }
                                  className={cn(
                                    "h-14 rounded-2xl font-black uppercase italic tracking-tighter transition-all active:scale-95",
                                    reportData.auto_payout_amount ===
                                      payoutSuggestion.amount
                                      ? "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20"
                                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700",
                                  )}
                                >
                                  Забрать из кассы
                                </Button>
                                <Button
                                  onClick={() =>
                                    setReportData({
                                      ...reportData,
                                      auto_payout_amount: 0,
                                    })
                                  }
                                  className={cn(
                                    "h-14 rounded-2xl font-black uppercase italic tracking-tighter transition-all active:scale-95",
                                    reportData.auto_payout_amount === 0
                                      ? "bg-zinc-100 text-zinc-950"
                                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700",
                                  )}
                                >
                                  На баланс ЛК
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="p-6 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-xl absolute bottom-0 left-0 right-0 z-50">
        <div className="max-w-6xl mx-auto">
          {step === 1 ? (
            <Button
              onClick={handleStep1Submit}
              disabled={
                stepOneMissingFields.length > 0 ||
                !isRequiredChecklistComplete ||
                isPending
              }
              className="w-full h-16 rounded-[2rem] bg-zinc-100 hover:bg-white text-zinc-950 font-black text-xl uppercase italic tracking-tighter shadow-2xl active:scale-[0.98] transition-all disabled:opacity-20 disabled:grayscale"
            >
              Перейти к итогам
              <ArrowRight className="ml-3 h-7 w-7" />
            </Button>
          ) : (
            <div className="flex gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setStep(1)}
                className="h-16 w-16 border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white rounded-[2rem] shrink-0 active:scale-90 transition-all"
              >
                <ArrowLeft className="h-8 w-8" />
              </Button>
              <Button
                onClick={handleFinalize}
                disabled={isPending}
                className="flex-1 h-16 rounded-full bg-white hover:bg-zinc-100 text-black font-black uppercase italic tracking-tighter shadow-2xl active:scale-[0.98] transition-all text-xl"
              >
                {isPending ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-black/20 border-t-black" />
                ) : (
                  <>
                    Завершить смену
                    <CheckCircle2 className="ml-3 h-7 w-7" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </footer>

      {requiredChecklist && (
        <ShiftOpeningWizard
          isOpen={isChecklistWizardOpen}
          onClose={() => setIsChecklistWizardOpen(false)}
          onComplete={(responses) => {
            setChecklistResponses(responses);
            setIsChecklistWizardOpen(false);
          }}
          checklistTemplate={requiredChecklist}
          targetMode="SELF"
          fullscreen
        />
      )}
      {Dialogs}
    </div>,
    document.body,
  );
}
