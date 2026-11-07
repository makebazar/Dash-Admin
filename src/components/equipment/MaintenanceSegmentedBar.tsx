"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { MaintenanceProgressInfo } from "@/lib/maintenance-progress";

interface MaintenanceSegmentedBarProps {
  progress: MaintenanceProgressInfo;
  className?: string;
  showLabels?: boolean;
}

export function MaintenanceSegmentedBar({
  progress,
  className,
  showLabels = true,
}: MaintenanceSegmentedBarProps) {
  if (progress.stage === "disabled" || progress.stage === "unknown") {
    return (
      <span className="text-[10px] text-muted-foreground font-medium">
        {progress.label}
      </span>
    );
  }

  const { stage, normProgress, graceProgress, penaltyProgress, label } = progress;

  return (
    <div className={cn("w-full space-y-1 mt-1", className)}>
      {showLabels && (
        <div className="flex items-center justify-between text-[10px] font-medium leading-none">
          <span
            className={cn(
              stage === "normal" &&
                "text-emerald-500 dark:text-emerald-400 font-medium",
              stage === "grace" &&
                "text-amber-500 dark:text-amber-400 font-semibold",
              stage === "penalty" &&
                "text-rose-500 dark:text-rose-400 font-semibold",
            )}
          >
            {label}
          </span>
        </div>
      )}

      {/* Адаптивный сегментный прогресс-бар: активный сегмент становится широким, пройденные скрываются */}
      <div
        className="flex items-center gap-1.5 w-full h-2 rounded-full overflow-hidden"
        title={label}
      >
        {/* 1. Если Норма: Зеленая широкая + маленькие маркеры будущих зон (Желтый и Красный) */}
        {stage === "normal" && (
          <>
            <div className="flex-1 h-full bg-muted dark:bg-slate-800/90 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-300 bg-emerald-500"
                style={{ width: `${normProgress}%` }}
              />
            </div>
            <div className="w-2.5 shrink-0 h-full bg-muted dark:bg-slate-800/90 rounded-full" />
            <div className="w-2.5 shrink-0 h-full bg-muted dark:bg-slate-800/90 rounded-full" />
          </>
        )}

        {/* 2. Если Льгота: Зеленая пропала, Желтая стала широкой + маленький маркер Красной зоны */}
        {stage === "grace" && (
          <>
            <div className="flex-1 h-full bg-muted dark:bg-slate-800/90 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-300 bg-amber-400 animate-pulse"
                style={{ width: `${graceProgress}%` }}
              />
            </div>
            <div className="w-2.5 shrink-0 h-full bg-muted dark:bg-slate-800/90 rounded-full" />
          </>
        )}

        {/* 3. Если Штраф: Зеленая и Желтая пропали, Красная стала широкой на всю длину */}
        {stage === "penalty" && (
          <div className="flex-1 h-full bg-muted dark:bg-slate-800/90 rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-300 bg-rose-500 animate-pulse"
              style={{ width: `${penaltyProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
