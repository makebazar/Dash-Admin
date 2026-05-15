"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface PayrollManagerKpiCardProps {
  title: string;
  payoutType: "REAL_MONEY" | "VIRTUAL_BALANCE";
  roleName?: string;
  currentValue: string | number;
  targetValue: string | number;
  bonusAmount: number;
  progressPercent: number;
  formatCurrency: (amount: number) => string;

  // Optional detailed info
  tierLabel?: string;
  tierPosition?: string;
  tierReward?: string;

  // Expandable content
  children?: React.ReactNode;
  expandLabel?: string;
  showProgress?: boolean;
}

export function PayrollManagerKpiCard({
  title,
  payoutType,
  roleName,
  currentValue,
  targetValue,
  bonusAmount,
  progressPercent,
  formatCurrency,
  tierLabel,
  tierPosition,
  tierReward,
  children,
  expandLabel = "Детали",
  showProgress = true,
}: PayrollManagerKpiCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const isVirtual = payoutType === "VIRTUAL_BALANCE";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all duration-200 hover:border-slate-300">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {/* Left Side: Info */}
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base font-black text-slate-900 truncate">
                {title}
              </h4>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-2 py-0 h-5 font-black uppercase tracking-widest border-transparent",
                  isVirtual
                    ? "bg-purple-50 text-purple-700"
                    : "bg-emerald-50 text-emerald-700",
                )}
              >
                {isVirtual ? "Депозит" : "Деньги"}
              </Badge>
              {roleName && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0 h-5 font-bold uppercase bg-slate-50 text-slate-500 border-slate-200"
                >
                  {roleName}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              {showProgress && (
                <>
                  <span className="text-slate-500">
                    Факт:{" "}
                    <span className="font-bold text-slate-900">
                      {currentValue}
                    </span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">
                    Цель:{" "}
                    <span className="font-bold text-slate-900">
                      {targetValue}
                    </span>
                  </span>
                </>
              )}

              {tierLabel && tierLabel !== "—" && (
                <>
                  {showProgress && (
                    <span className="text-slate-300 hidden sm:inline">•</span>
                  )}
                  <span className="text-slate-500 w-full sm:w-auto mt-1 sm:mt-0">
                    Ступень:{" "}
                    <span className="font-bold text-slate-900">
                      {tierLabel}
                    </span>{" "}
                    {tierPosition && `(${tierPosition})`}{" "}
                    {tierReward && (
                      <span className="text-emerald-600 font-bold ml-1">
                        +{tierReward}
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Side: Bonus */}
          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 mt-3 sm:mt-0 border-slate-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 sm:text-right">
              Начислено
            </div>
            <div
              className={cn(
                "text-xl font-black whitespace-nowrap",
                isVirtual ? "text-purple-600" : "text-emerald-600",
              )}
            >
              +{formatCurrency(bonusAmount)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Прогресс</span>
              <span className="text-slate-700">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  progressPercent >= 100 ? "bg-emerald-500" : "bg-slate-800",
                )}
                style={{
                  width: `${Math.max(0, Math.min(progressPercent, 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Expand Toggle */}
        {children && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
          >
            {expandLabel}
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {children && isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
