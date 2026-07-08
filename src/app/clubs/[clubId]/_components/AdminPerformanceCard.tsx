import { formatCurrency, formatSignedPercent } from "../_formatters";
import type { AdminPerformanceItem } from "../_types";

interface AdminPerformanceCardProps {
  admin: AdminPerformanceItem;
}

export function AdminPerformanceCard({ admin }: AdminPerformanceCardProps) {
  const currentAvg =
    admin.currentShiftsCount > 0
      ? admin.currentRevenue / admin.currentShiftsCount
      : 0;
  const previousAvg =
    admin.previousShiftsCount > 0
      ? admin.previousRevenue / admin.previousShiftsCount
      : 0;
  const avgChange =
    previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;

  const currentBarAvg =
    admin.currentShiftsCount > 0
      ? admin.currentBarSales / admin.currentShiftsCount
      : 0;
  const previousBarAvg =
    admin.previousShiftsCount > 0
      ? admin.previousBarSales / admin.previousShiftsCount
      : 0;
  const barChange =
    previousBarAvg > 0
      ? ((currentBarAvg - previousBarAvg) / previousBarAvg) * 100
      : 0;

  const currentAvgCheck =
    admin.currentReceiptsCount > 0
      ? admin.currentRevenue / admin.currentReceiptsCount
      : 0;
  const previousAvgCheck =
    admin.previousReceiptsCount > 0
      ? admin.previousRevenue / admin.previousReceiptsCount
      : 0;
  const checkChange =
    previousAvgCheck > 0
      ? ((currentAvgCheck - previousAvgCheck) / previousAvgCheck) * 100
      : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-slate-900 text-sm">{admin.userName}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{admin.roleName}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-slate-900 text-sm">
            {formatCurrency(admin.currentRevenue)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {admin.currentShiftsCount} смен •{" "}
            {formatCurrency(Math.round(currentAvg))}/см.
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px]">
        {/* 1. Revenue Comparison */}
        {admin.previousShiftsCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">
              Ср. выручка за смену:
            </span>
            <div className="flex items-center gap-1.5 font-semibold">
              <span
                className={avgChange >= 0 ? "text-emerald-600" : "text-rose-600"}
              >
                {formatSignedPercent(avgChange)}
              </span>
              <span className="text-slate-400 font-medium">
                ({formatCurrency(Math.round(currentAvg))}/см. против{" "}
                {formatCurrency(Math.round(previousAvg))}/см.)
              </span>
            </div>
          </div>
        )}

        {/* 2. Bar Sales Comparison */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-medium">Ср. бар за смену:</span>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span>{formatCurrency(Math.round(currentBarAvg))}</span>
            {admin.previousShiftsCount > 0 && previousBarAvg > 0 && (
              <div className="flex items-center gap-1 font-semibold">
                <span
                  className={
                    barChange >= 0 ? "text-emerald-600" : "text-rose-600"
                  }
                >
                  {formatSignedPercent(barChange)}
                </span>
                <span className="text-slate-400 font-medium font-normal">
                  (было {formatCurrency(Math.round(previousBarAvg))})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Average Check Comparison */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-medium">Средний чек:</span>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span>{formatCurrency(Math.round(currentAvgCheck))}</span>
            {admin.previousShiftsCount > 0 && previousAvgCheck > 0 && (
              <div className="flex items-center gap-1 font-semibold">
                <span
                  className={
                    checkChange >= 0 ? "text-emerald-600" : "text-rose-600"
                  }
                >
                  {formatSignedPercent(checkChange)}
                </span>
                <span className="text-slate-400 font-medium font-normal">
                  (было {formatCurrency(Math.round(previousAvgCheck))})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Checklist Evaluations */}
        {admin.currentEvalScore !== null && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">
              Оценка чек-листов:
            </span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span>{admin.currentEvalScore.toFixed(1)}%</span>
              {admin.previousEvalScore !== null && (
                <span className="text-slate-400 font-medium font-normal">
                  (было {admin.previousEvalScore.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )}

        {/* 5. Overdue Maintenance Tasks */}
        {admin.assignedSpotsCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">
              Обслуживание мест:
            </span>
            {admin.overdueTasksCount > 0 ? (
              <span className="font-semibold text-rose-600">
                {admin.overdueTasksCount} просрочено
              </span>
            ) : (
              <span className="font-semibold text-emerald-600">
                без просрочек
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
