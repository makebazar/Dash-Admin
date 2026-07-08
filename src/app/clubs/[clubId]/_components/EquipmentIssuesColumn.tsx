import Link from "next/link";
import { AlertTriangle, ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEquipmentType } from "../_formatters";
import { SEVERITY_BADGES } from "../_types";
import type { AttentionSnapshot } from "../_types";

interface EquipmentIssuesColumnProps {
  snapshot: Pick<AttentionSnapshot, "activeIssuesCount" | "zoneIssues">;
  clubId: string;
}

export function EquipmentIssuesColumn({
  snapshot,
  clubId,
}: EquipmentIssuesColumnProps) {
  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between min-h-[350px]">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-slate-500" />
            <span className="font-bold text-sm text-slate-700">
              Оборудование
            </span>
          </div>
          {snapshot.activeIssuesCount > 0 ? (
            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {snapshot.activeIssuesCount} поломок
            </span>
          ) : (
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Все ок
            </span>
          )}
        </div>

        {snapshot.zoneIssues.length > 0 ? (
          <div className="space-y-3">
            {snapshot.zoneIssues.map((zone) => (
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
                        zone.criticalCount > 0
                          ? "bg-red-50 text-red-700 border-red-100"
                          : "bg-slate-50 text-slate-600 border-slate-200",
                      )}
                    >
                      {zone.issuesCount}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-90 shrink-0" />
                  </div>
                </summary>
                <div className="px-3 pb-3 pt-2 border-t border-slate-100 space-y-2.5 bg-slate-50/20">
                  {zone.issues.map((issue) => {
                    const badge = SEVERITY_BADGES[issue.severity] || {
                      label: issue.severity,
                      className: "bg-slate-100 text-slate-700 border-slate-200",
                    };
                    return (
                      <div
                        key={issue.id}
                        className="flex justify-between items-start gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 text-[11px] truncate">
                            {issue.equipmentName}{" "}
                            <span className="text-[9px] text-slate-400 font-normal">
                              ({formatEquipmentType(issue.equipmentType)})
                            </span>
                          </p>
                          <p
                            className="text-slate-500 text-[10px] mt-0.5 truncate"
                            title={issue.title}
                          >
                            {issue.title}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-[8px] font-bold uppercase px-1 py-0.5 rounded-sm border shrink-0",
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-xs text-slate-400 font-medium">
              Нет активных инцидентов с оборудованием в клубе
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 mt-auto">
        <Link
          href={`/clubs/${clubId}/equipment/issues`}
          className="flex items-center justify-center text-xs font-semibold text-slate-500 hover:text-slate-950 transition-colors w-full border border-slate-200 bg-white hover:bg-slate-50 rounded-lg py-2 gap-1"
        >
          Все инциденты
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
