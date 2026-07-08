import Link from "next/link";
import { Package, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttentionSnapshot } from "../_types";

interface WarehouseColumnProps {
  snapshot: Pick<
    AttentionSnapshot,
    "criticalStockCount" | "criticalItems"
  >;
  clubId: string;
}

export function WarehouseColumn({ snapshot, clubId }: WarehouseColumnProps) {
  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between min-h-[350px]">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <Package className="h-4.5 w-4.5 text-slate-500" />
            <span className="font-bold text-sm text-slate-700">Склад</span>
          </div>
          {snapshot.criticalStockCount > 0 ? (
            <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {snapshot.criticalStockCount} проблемных
            </span>
          ) : (
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              В норме
            </span>
          )}
        </div>

        {snapshot.criticalItems.length > 0 ? (
          <div className="space-y-2.5">
            {snapshot.criticalItems.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200/60 rounded-lg p-3 flex flex-col gap-2 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1 pr-2">
                    <p
                      className="font-semibold text-xs text-slate-900 truncate"
                      title={item.name}
                    >
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {item.abcCategory === "A" && (
                        <span className="text-[9px] font-bold uppercase px-1 bg-violet-50 text-violet-700 border border-violet-100 rounded-sm">
                          Ходовой
                        </span>
                      )}
                      {item.abcCategory === "B" && (
                        <span className="text-[9px] font-bold uppercase px-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-sm">
                          Популярный
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-medium">
                        Мин: {item.minStockLevel} шт.
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 leading-none">
                      {item.currentStock} шт.
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] border-t border-slate-100/50 pt-1.5 mt-0.5">
                  {item.currentStock <= 0 ? (
                    <span className="text-red-600 font-bold uppercase tracking-wide text-[9px]">
                      Закончился
                    </span>
                  ) : item.daysLeft !== null ? (
                    <span
                      className={cn(
                        "font-bold",
                        item.daysLeft < 1 ? "text-red-600" : "text-amber-600",
                      )}
                    >
                      {item.daysLeft < 1
                        ? "Закончится сегодня"
                        : `Запас: на ${item.daysLeft.toFixed(1)} дн.`}
                    </span>
                  ) : (
                    <span className="text-amber-600 font-bold">
                      Мало на складе
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-xs text-slate-400 font-medium">
              Все критически важные товары в достаточном количестве
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 mt-auto">
        <Link
          href={`/clubs/${clubId}/inventory`}
          className="flex items-center justify-center text-xs font-semibold text-slate-500 hover:text-slate-950 transition-colors w-full border border-slate-200 bg-white hover:bg-slate-50 rounded-lg py-2 gap-1"
        >
          Управление складом
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
