"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Wallet, Info, ChevronRight } from "lucide-react";

export interface SalarySummaryStats {
  month_earnings: number;
  total_hours?: number;
  completed_shifts_count?: number;
  is_hourly_rate?: boolean;
  breakdown: {
    base_salary: number;
    additions: Array<{
      name: string;
      amount: number;
      type: string;
      original_type?: string;
    }>;
    deductions: Array<{
      name: string;
      amount: number;
      type: string;
    }>;
    virtual_bonuses?: Array<{
      name: string;
      amount: number;
    }>;
    virtual_total?: number;
  };
}

export interface SalarySummaryWidgetProps {
  stats: SalarySummaryStats;
  formatCurrency: (amount: number) => string;
  clubId?: string | number;
  className?: string;
}

export function SalarySummaryWidget({
  stats,
  formatCurrency,
  clubId,
  className,
}: SalarySummaryWidgetProps) {
  const bd = stats.breakdown;

  // Determine base label
  let baseLabel = "Базовая ставка";
  if (stats.is_hourly_rate !== false && (stats.total_hours || 0) > 0) {
    baseLabel = `Ставка (${Number(stats.total_hours).toFixed(1)} ч)`;
  } else if (stats.completed_shifts_count) {
    baseLabel = `Ставка (${stats.completed_shifts_count} выходов)`;
  }

  return (
    <Card
      className={cn(
        "border-0 shadow-2xl bg-[#111113] text-white overflow-hidden",
        className,
      )}
    >
      <CardContent className="p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Зарплата за месяц
            </h3>
            <p className="text-4xl sm:text-5xl font-black tracking-tighter text-white">
              {formatCurrency(stats.month_earnings)}
            </p>
            <p className="text-xs font-bold text-zinc-500 flex items-center gap-1.5 mt-1">
              <Info className="w-3.5 h-3.5" />
              Ориентировочный расчет
            </p>
          </div>
        </div>

        {/* Breakdown List */}
        <div className="space-y-3 pt-6 border-t border-white/3">
          {/* Base */}
          <div className="flex justify-between items-center text-sm gap-3 w-full min-w-0">
            <span className="text-zinc-500 font-medium truncate" title={baseLabel}>
              {baseLabel}
            </span>
            <span className="font-bold text-white whitespace-nowrap shrink-0">
              {formatCurrency(bd.base_salary)}
            </span>
          </div>

          {/* All Additions (Shift Bonuses, KPIs, Promo, etc.) */}
          {bd.additions?.map((item, idx) => (
            <div
              key={`add-${idx}`}
              className="flex justify-between items-center text-sm gap-3 w-full min-w-0"
            >
              <span className="text-zinc-500 font-medium truncate" title={item.name}>
                {item.name}
              </span>
              <span className="font-black text-emerald-400 whitespace-nowrap shrink-0">
                +{formatCurrency(item.amount)}
              </span>
            </div>
          ))}

          {/* All Deductions (Maintenance Penalty, Bar, Discrepancies) */}
          {bd.deductions?.map((item, idx) => (
            <div
              key={`ded-${idx}`}
              className="flex justify-between items-center text-sm gap-3 w-full min-w-0"
            >
              <span className="text-zinc-500 font-medium truncate" title={item.name}>
                {item.name}
              </span>
              <span className="font-black text-rose-400 whitespace-nowrap shrink-0">
                -{formatCurrency(item.amount)}
              </span>
            </div>
          ))}

          {/* Virtual Balance Info (Optional) */}
          {bd.virtual_total && bd.virtual_total > 0 ? (
            <div className="pt-2 mt-2 border-t border-white/3">
              <div className="flex justify-between items-center text-[9px] uppercase tracking-tighter text-zinc-500 font-black gap-2 w-full min-w-0">
                <span className="truncate" title="На виртуальный баланс">
                  На виртуальный баланс
                </span>
                <span className="text-sky-400 whitespace-nowrap shrink-0 text-right font-black">
                  {formatCurrency(bd.virtual_total)}
                </span>
              </div>
            </div>
          ) : null}

          {/* Link to full salary report page */}
          {clubId && (
            <div className="pt-4 mt-2 border-t border-white/5">
              <Link
                href={`/employee/clubs/${clubId}/salary`}
                className="flex items-center justify-between text-xs font-semibold text-zinc-400 hover:text-white transition-colors group"
              >
                <span>Полный отчет по зарплате</span>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
