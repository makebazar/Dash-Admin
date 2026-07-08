import Link from "next/link";
import { Clock, ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEquipmentType, formatTaskType } from "../_formatters";
import type { AttentionSnapshot } from "../_types";

interface MaintenanceColumnProps {
  snapshot: Pick<AttentionSnapshot, "overdueTasksCount" | "zoneTasks">;
  clubId: string;
}

export function MaintenanceColumn({ snapshot, clubId }: MaintenanceColumnProps) {
  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between min-h-[350px]">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-slate-500" />
            <span className="font-bold text-sm text-slate-700">
              Обслуживание
            </span>
          </div>
          {snapshot.overdueTasksCount > 0 ? (
            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {snapshot.overdueTasksCount} просрочено
            </span>
          ) : (
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              В срок
            </span>
          )}
        </div>

        {snapshot.zoneTasks.length > 0 ? (
          <div className="space-y-3">
            {snapshot.zoneTasks.map((zone) => (
              <details
                key={zone.zoneName}
                className="group [&_summary::-webkit-details-marker]:hidden bg-white border border-slate-200/60 rounded-lg shadow-sm overflow-hidden"
              >
                <summary className="flex justify-between items-center p-3 cursor-pointer select-none hover:bg-slate-50 transition-colors">
                  <span className="font-bold text-[11px] text-slate-900 uppercase tracking-wider">
                    {zone.zoneName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                        zone.maxDaysOverdue > 7
                          ? "bg-red-50 text-red-700 border-red-100"
                          : "bg-slate-50 text-slate-600 border-slate-200",
                      )}
                    >
                      {zone.tasksCount}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-90 shrink-0" />
                  </div>
                </summary>
                <div className="px-3 pb-3 pt-2 border-t border-slate-100 space-y-2.5 bg-slate-50/20">
                  {zone.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex justify-between items-center gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 text-[11px] truncate">
                          {task.equipmentName}{" "}
                          <span className="text-[9px] text-slate-400 font-normal">
                            ({formatEquipmentType(task.equipmentType)})
                          </span>
                        </p>
                        <p className="text-slate-600 text-[10px] mt-0.5 font-medium">
                          {formatTaskType(task.taskType)}
                        </p>
                      </div>
                      <span className="text-[9px] text-red-600 font-bold shrink-0 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                        +{task.daysOverdue} дн.
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-xs text-slate-400 font-medium">
              Все регламентные работы выполняются вовремя
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 mt-auto">
        <Link
          href={`/clubs/${clubId}/equipment/workplaces`}
          className="flex items-center justify-center text-xs font-semibold text-slate-500 hover:text-slate-950 transition-colors w-full border border-slate-200 bg-white hover:bg-slate-50 rounded-lg py-2 gap-1"
        >
          Рабочие места
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
