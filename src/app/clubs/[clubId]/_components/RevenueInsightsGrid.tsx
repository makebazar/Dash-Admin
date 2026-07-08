import type { RevenueInsightsSnapshot } from "../_types";

interface RevenueInsightsGridProps {
  insights: RevenueInsightsSnapshot["insights"];
}

export function RevenueInsightsGrid({ insights }: RevenueInsightsGridProps) {
  if (insights.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-4">
        <h3 className="text-lg font-bold tracking-tight text-slate-900">
          Инсайты по выручке
        </h3>
        <p className="text-xs text-slate-500">
          Автоматические выводы и оценка трендов на основе исторических данных
          клуба за последние 12 недель
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {insights.map((insight, index) => {
          const toneStyles =
            insight.tone === "success"
              ? "bg-emerald-50/40 border-emerald-100/80 text-emerald-800"
              : insight.tone === "warning"
                ? "bg-amber-50/40 border-amber-100/80 text-amber-800"
                : "bg-slate-50/40 border-slate-100 text-slate-800";

          const titleColor =
            insight.tone === "success"
              ? "text-emerald-600/90"
              : insight.tone === "warning"
                ? "text-amber-600/90"
                : "text-slate-400";

          return (
            <div
              key={index}
              className={`rounded-xl border p-4 flex flex-col justify-between transition-all hover:shadow-sm ${toneStyles}`}
            >
              <div>
                <p
                  className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 ${titleColor}`}
                >
                  {insight.title}
                </p>
                <p className="text-base font-bold leading-tight mb-1 text-slate-900">
                  {insight.value}
                </p>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {insight.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
