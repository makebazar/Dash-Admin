"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronRight, LucideIcon } from "lucide-react";

export interface KpiStat {
  label: string;
  value: string | number;
  subValue?: string;
  color?: "default" | "emerald" | "rose" | "amber" | "blue";
}

export interface UnifiedKpiCardProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  mainValue: string | number;
  mainLabel: string;
  mainSubLabel?: string;
  secondaryInfo?: string;
  currentLevelBadge?: string;
  stats: KpiStat[];
  progress?: {
    label: string;
    percent: number;
    displayValue?: string;
  };
  alert?: {
    message: string;
    subMessage?: string;
    type: "info" | "warning" | "success" | "error";
  };
  footerLabel?: string;
  onFooterClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const colorMap = {
  default: "text-white",
  emerald: "text-emerald-400",
  rose: "text-rose-400",
  amber: "text-amber-400",
  blue: "text-blue-400",
};

const alertStyles = {
  info: "bg-blue-500/10 border-blue-500/20 text-blue-200",
  warning: "bg-orange-500/10 border-orange-500/20 text-orange-200",
  success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
  error: "bg-rose-500/10 border-rose-500/20 text-rose-200",
};

const alertDotStyles = {
  info: "bg-blue-400",
  warning: "bg-orange-400",
  success: "bg-emerald-400",
  error: "bg-rose-400",
};

export function UnifiedKpiCard({
  title,
  subtitle,
  icon: Icon,
  mainValue,
  mainLabel,
  mainSubLabel,
  secondaryInfo,
  currentLevelBadge,
  stats,
  progress,
  alert,
  footerLabel,
  onFooterClick,
  className,
  children,
}: UnifiedKpiCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleFooterClick = () => {
    if (children) {
      setIsExpanded(!isExpanded);
    }
    onFooterClick?.();
  };

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
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl border border-white/[0.03] bg-[#1a1a1d]">
              <Icon className="h-6 w-6 text-zinc-500" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm font-bold text-zinc-400">{subtitle}</p>
              )}
            </div>
          </div>
          {secondaryInfo && (
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-0.5">
                Осталось
              </p>
              <p className="text-lg font-black text-white leading-none">
                {secondaryInfo}
              </p>
            </div>
          )}
        </div>

        {/* Level Badge */}
        {currentLevelBadge && (
          <div className="flex justify-center">
            <div className="px-4 py-1.5 rounded-full bg-[#1a1a1d] border border-white/[0.03] text-[11px] font-bold text-zinc-400 shadow-xs">
              {currentLevelBadge}
            </div>
          </div>
        )}

        {/* Main Value Box */}
        <div className="rounded-3xl border border-white/[0.03] bg-[#1a1a1d] p-8 flex flex-col items-center justify-center text-center space-y-2">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            {mainLabel}
          </p>
          <p className="text-5xl font-black tracking-tighter text-white">
            {mainValue}
          </p>
          {mainSubLabel && (
            <p className="text-sm font-bold text-zinc-500">{mainSubLabel}</p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/[0.03] bg-[#1a1a1d] p-4 space-y-1"
            >
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest truncate">
                {stat.label}
              </p>
              <p
                className={cn(
                  "text-lg font-black tracking-tight",
                  colorMap[stat.color || "default"],
                )}
              >
                {stat.value}
              </p>
              {stat.subValue && (
                <p className="text-[10px] text-zinc-500 font-bold">
                  {stat.subValue}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        {progress && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <span>{progress.label}</span>
              <span className="text-white">
                {progress.displayValue || `${progress.percent}%`}
              </span>
            </div>
            <div className="h-2.5 w-full bg-[#1a1a1d] rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Alert Message */}
        {alert && (
          <div
            className={cn(
              "rounded-2xl border p-4 flex gap-3",
              alertStyles[alert.type],
            )}
          >
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full mt-2 shrink-0",
                alertDotStyles[alert.type],
              )}
            />
            <div className="space-y-1">
              <p className="text-sm font-bold leading-tight text-white/90">
                {alert.message}
              </p>
              {alert.subMessage && (
                <p className="text-xs font-medium opacity-60">
                  {alert.subMessage}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Expandable Content */}
        {children && isExpanded && (
          <div className="pt-6 border-t border-white/[0.03] animate-in fade-in slide-in-from-top-2 duration-300">
            {children}
          </div>
        )}

        {/* Footer */}
        {footerLabel && (
          <button
            onClick={handleFooterClick}
            className="w-full pt-4 border-t border-white/[0.03] flex items-center justify-center gap-2 text-sm font-bold text-zinc-500 hover:text-white transition-colors"
          >
            {isExpanded ? "Скрыть детали" : footerLabel}
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform text-zinc-600",
                isExpanded && "rotate-90",
              )}
            />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
