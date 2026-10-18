import type { ClientProfile, ClubPcStat, ClubZoneStat, ClubTariffStat } from "./segmentation";

export interface SnapshotSummary {
  id: string;
  name: string;
  period_start: string | null;
  period_end: string | null;
  file_names: string[];
  summary_metrics: {
    totalRevenueInLog?: number;
    totalGuests?: number;
    totalHoursPlayed?: number;
    avgHourlyYield?: number;
    totalVisits?: number;
    activeCount?: number;
    churnedCount?: number;
    totalPackageRub?: number;
  };
  created_at: string;
  guests_count: number;
  pc_count: number;
}

export interface SnapshotFull {
  id: string;
  club_id: number;
  name: string;
  period_start: string | null;
  period_end: string | null;
  file_names: string[];
  summary_metrics: Record<string, any>;
  guests_data: ClientProfile[];
  pc_data: ClubPcStat[];
  created_at: string;
}
