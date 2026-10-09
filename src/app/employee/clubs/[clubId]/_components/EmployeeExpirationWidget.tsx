"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getExpiringProducts,
  writeOffExpiredBatches,
} from "@/app/clubs/[clubId]/inventory/actions/expiration";
import type {
  ExpirationSummary,
  ExpiringBatchItem,
} from "@/app/clubs/[clubId]/inventory/actions/expiration";
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs";
import { cn } from "@/lib/utils";

interface EmployeeExpirationWidgetProps {
  clubId: string;
  userId: string;
  activeShiftId?: string;
  onSuccess?: () => void;
}

export function EmployeeExpirationWidget({
  clubId,
  userId,
  activeShiftId,
  onSuccess,
}: EmployeeExpirationWidgetProps) {
  const { showMessage, confirmAction, Dialogs } = useUiDialogs();
  const [data, setData] = useState<ExpirationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    try {
      const res = await getExpiringProducts(clubId, 3);
      setData(res);
    } catch (err) {
      console.error("Error loading expiring products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [clubId]);

  if (loading || !data) return null;

  const hasExpired = data.expired_count > 0;
  const hasExpiringSoon = data.expiring_soon_count > 0;

  if (!hasExpired && !hasExpiringSoon) {
    return null;
  }

  const expiredBatches = data.items.filter((i) => i.status === "EXPIRED");
  const expiringSoonBatches = data.items.filter(
    (i) => i.status === "EXPIRING_SOON"
  );

  const handleWriteOffAllExpired = async () => {
    if (expiredBatches.length === 0) return;

    const confirmed = await confirmAction({
      title: "Списать просроченные товары?",
      description: `Будет списано ${data.expired_items_qty} шт. товаров на сумму ${data.expired_total_cost} ₽ по причине истечения срока годности.`,
      confirmText: "Да, списать",
      cancelText: "Отмена",
    });

    if (!confirmed) return;

    startTransition(async () => {
      try {
        const batchIds = expiredBatches.map((b) => b.batch_id);
        const res = await writeOffExpiredBatches(
          clubId,
          userId,
          batchIds,
          "Списание просроченного товара сотрудником смены",
          activeShiftId
        );

        if (res.success) {
          showMessage({
            title: "Успешно списано",
            description: `Списано ${expiredBatches.length} позиций (${data.expired_items_qty} шт.)`,
          });
          setIsDialogOpen(false);
          await loadData();
          onSuccess?.();
        }
      } catch (err: any) {
        showMessage({
          title: "Ошибка списания",
          description: err.message || "Не удалось списать товары",
        });
      }
    });
  };

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border p-4 sm:p-5 transition-all shadow-sm space-y-4",
          hasExpired
            ? "bg-rose-950/40 border-rose-800/70 text-rose-100"
            : "bg-amber-950/30 border-amber-800/60 text-amber-100"
        )}
      >
        {/* 1. Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-900/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base font-bold text-white tracking-tight">
                Контроль свежести
              </h4>
            </div>
          </div>

          {hasExpired && (
            <div className="shrink-0 self-stretch sm:self-center">
              <Button
                size="sm"
                onClick={handleWriteOffAllExpired}
                disabled={isPending}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold h-9 px-4 rounded-xl shadow-md shadow-rose-950/40"
              >
                {isPending ? "Списание..." : `Списать просрочку (${data.expired_items_qty} шт)`}
              </Button>
            </div>
          )}
        </div>

        {/* 2. Structured Item Details List */}
        {expiredBatches.length > 0 && (
          <div className="space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-rose-300/80">
              Список просроченных товаров:
            </div>
            <div className="grid grid-cols-1 gap-2">
              {expiredBatches.map((item) => {
                const isPartiallyExpired =
                  item.current_warehouse_stock > item.quantity;
                const expirationDateStr = new Date(
                  item.expiration_date
                ).toLocaleDateString("ru-RU");

                return (
                  <div
                    key={item.batch_id}
                    className="p-4 rounded-xl bg-black/25 border border-rose-900/40 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-white">
                            {item.product_name}
                          </span>
                          <div className="text-xs text-rose-300/80 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-400">{item.warehouse_name}</span>
                            <span className="text-slate-600">·</span>
                            <span>
                              Срок истек:{" "}
                              <span className="font-semibold text-rose-200">
                                {expirationDateStr}
                              </span>
                              {item.days_until_expiration < 0 && (
                                <span className="text-rose-400/80 ml-1">
                                  ({Math.abs(item.days_until_expiration)} дн. назад)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                      <div className="text-left sm:text-right shrink-0">
                        <div className="text-sm font-black text-rose-300 font-mono">
                          {item.quantity} шт. к списанию
                        </div>
                        <div className="text-[11px] text-rose-300/70">
                          {(item.cost_price * item.quantity).toLocaleString(
                            "ru-RU"
                          )}{" "}
                          ₽
                        </div>
                      </div>
                    </div>

                    {/* Stock vs Expired Warning Notice */}
                    {isPartiallyExpired ? (
                      <div className="text-xs rounded-lg px-2.5 py-1.5 bg-amber-950/40 border border-amber-800/50 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div>
                          <span className="font-bold text-amber-300">
                            Проверьте даты на упаковках:
                          </span>{" "}
                          на остатке числится{" "}
                          <span className="font-bold text-white">
                            {item.current_warehouse_stock} шт.
                          </span>
                          , по партии истекла часть (
                          <span className="font-bold text-rose-300">
                            {item.quantity} шт.
                          </span>
                          ).
                        </div>
                        <span className="text-[11px] text-amber-300/80 font-medium">
                          Найдите именно просроченную пачку на витрине
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-rose-300/60">
                        Остаток на складе: {item.current_warehouse_stock} шт. (весь остаток подлежит списанию).
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-2xl max-h-[85vh] flex flex-col rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-slate-800">
            <DialogTitle className="text-lg font-bold">
              Контроль сроков годности
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Проверьте витрину и склады клуба. Просроченные товары подлежат своевременному списанию.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 overflow-y-auto space-y-5 flex-1">
            {/* 1. Expired Items List */}
            {expiredBatches.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    Просрочено ({expiredBatches.length} поз., {data.expired_items_qty} шт.)
                  </span>
                  <span className="text-xs font-mono font-bold text-rose-300">
                    Сумма: {data.expired_total_cost.toLocaleString("ru-RU")} ₽
                  </span>
                </div>

                <div className="space-y-2">
                  {expiredBatches.map((b) => {
                    const isPartiallyExpired =
                      b.current_warehouse_stock > b.quantity;
                    return (
                      <div
                        key={b.batch_id}
                        className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/50 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-100 truncate">
                              {b.product_name}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                              <span>Склад: {b.warehouse_name}</span>
                              <span>•</span>
                              <span className="text-rose-400 font-medium">
                                Истёк{" "}
                                {new Date(b.expiration_date).toLocaleDateString(
                                  "ru-RU"
                                )}{" "}
                                ({Math.abs(b.days_until_expiration)} дн. назад)
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-base font-black text-rose-300 font-mono">
                              {b.quantity} шт
                            </div>
                            <div className="text-xs text-slate-400">
                              {(b.cost_price * b.quantity).toLocaleString(
                                "ru-RU"
                              )}{" "}
                              ₽
                            </div>
                          </div>
                        </div>

                        {isPartiallyExpired && (
                          <div className="text-xs rounded-lg px-2.5 py-1.5 bg-amber-950/40 border border-amber-800/50 text-amber-200">
                            <span className="font-bold text-amber-300">
                              Проверьте даты:
                            </span>{" "}
                            на остатке {b.current_warehouse_stock} шт., просрочено по
                            партии {b.quantity} шт.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Expiring Soon List */}
            {expiringSoonBatches.length > 0 && (
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Истекает в течение 3 дней ({expiringSoonBatches.length} поз.)
                </span>

                <div className="space-y-2">
                  {expiringSoonBatches.map((b) => (
                    <div
                      key={b.batch_id}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-200 truncate">
                          {b.product_name}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                          <span>Склад: {b.warehouse_name}</span>
                          <span>•</span>
                          <span className="text-amber-400 font-medium">
                            Годен до{" "}
                            {new Date(b.expiration_date).toLocaleDateString(
                              "ru-RU"
                            )}{" "}
                            (осталось {b.days_until_expiration} дн.)
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-bold text-slate-100 font-mono">
                          {b.quantity} шт
                        </div>
                        <div className="text-xs text-slate-400">
                          {(b.cost_price * b.quantity).toLocaleString("ru-RU")}{" "}
                          ₽
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-slate-900/60 border-t border-slate-800 flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="flex-1 border-slate-700 h-11 rounded-xl text-slate-300"
              disabled={isPending}
            >
              Закрыть
            </Button>
            {hasExpired && (
              <Button
                onClick={handleWriteOffAllExpired}
                disabled={isPending}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold h-11 rounded-xl shadow-lg shadow-rose-950"
              >
                {isPending
                  ? "Списание..."
                  : `Списать все ${data.expired_items_qty} шт.`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {Dialogs}
    </>
  );
}
