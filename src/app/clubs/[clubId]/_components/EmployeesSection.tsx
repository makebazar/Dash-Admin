import { formatShiftType } from "../_formatters";
import { AdminPerformanceCard } from "./AdminPerformanceCard";
import type { ActiveShift, NextScheduledShift, AdminPerformanceItem } from "../_types";

interface EmployeesSectionProps {
  activeShifts: ActiveShift[];
  nextScheduledShift: NextScheduledShift;
  adminPerformance: AdminPerformanceItem[];
}

export function EmployeesSection({
  activeShifts,
  nextScheduledShift,
  adminPerformance,
}: EmployeesSectionProps) {
  return (
    <section className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Сотрудники
        </h2>
      </div>

      <div className="space-y-8">
        {/* Duty Employees (Compact Layout) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Сейчас на смене
            </p>
            {activeShifts.length > 0 ? (
              <div className="space-y-2">
                {activeShifts.slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-3.5"
                  >
                    <div>
                      <p className="font-semibold text-sm text-slate-900 leading-tight">
                        {item.userName}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.role}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-700">
                        {formatShiftType(item.shiftType)}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-semibold mt-0.5 uppercase tracking-wide">
                        В процессе
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-500 border border-slate-200 border-dashed">
                Сейчас активных смен нет
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Следующая смена
            </p>
            {nextScheduledShift ? (
              <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-3.5">
                <div>
                  <p className="font-semibold text-sm text-slate-900 leading-tight">
                    {nextScheduledShift.userName}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Администратор
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-700">
                    {formatShiftType(nextScheduledShift.shiftType)}
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">
                    Ожидается
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-500 border border-slate-200 border-dashed">
                График не заполнен
              </div>
            )}
          </div>
        </div>

        {/* Admin Performance Comparison List (2-column Grid) */}
        {adminPerformance.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Эффективность администраторов (за период)
              </p>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                сводная эффективность
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {adminPerformance.map((admin) => (
                <AdminPerformanceCard key={admin.userId} admin={admin} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
