import { ShieldAlert } from "lucide-react";
import { WarehouseColumn } from "./WarehouseColumn";
import { EquipmentIssuesColumn } from "./EquipmentIssuesColumn";
import { MaintenanceColumn } from "./MaintenanceColumn";
import type { AttentionSnapshot } from "../_types";

interface AttentionSectionProps {
  snapshot: AttentionSnapshot;
  clubId: string;
}

export function AttentionSection({ snapshot, clubId }: AttentionSectionProps) {
  return (
    <section className="w-full">
      <div className="flex items-baseline justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-500 fill-red-50" />
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Обратить внимание
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <WarehouseColumn
          snapshot={{
            criticalStockCount: snapshot.criticalStockCount,
            criticalItems: snapshot.criticalItems,
          }}
          clubId={clubId}
        />
        <EquipmentIssuesColumn
          snapshot={{
            activeIssuesCount: snapshot.activeIssuesCount,
            zoneIssues: snapshot.zoneIssues,
          }}
          clubId={clubId}
        />
        <MaintenanceColumn
          snapshot={{
            overdueTasksCount: snapshot.overdueTasksCount,
            zoneTasks: snapshot.zoneTasks,
          }}
          clubId={clubId}
        />
      </div>
    </section>
  );
}
