export type PermissionMap = Record<string, boolean>;

export type DashboardAccess = {
  clubName: string;
  isFullAccess: boolean;
  permissions: PermissionMap;
  roleName: string | null;
};

export type RevenuePoint = {
  date: string;
  revenue: number;
  receiptsCount: number;
  metrics?: Record<string, number>;
};

export type MetricMeta = Record<string, { category: string; label: string }>;

export type RevenueInsightsSnapshot = {
  insights: Array<{
    title: string;
    value: string;
    description: string;
    tone: "default" | "success" | "warning";
  }>;
};

export type ActiveShift = {
  id: string;
  userName: string;
  role: string;
  shiftType: "DAY" | "NIGHT" | string;
  checkIn: string;
  totalHours: number;
};

export type NextScheduledShift = {
  userName: string;
  shiftType: "DAY" | "NIGHT" | string;
  date: string;
} | null;

export type AdminPerformanceItem = {
  userId: string;
  userName: string;
  roleName: string;
  currentShiftsCount: number;
  currentRevenue: number;
  previousShiftsCount: number;
  previousRevenue: number;
  currentEvalScore: number | null;
  previousEvalScore: number | null;
  currentBarSales: number;
  previousBarSales: number;
  currentReceiptsCount: number;
  previousReceiptsCount: number;
  assignedSpotsCount: number;
  overdueTasksCount: number;
};

export type ZoneIssue = {
  id: string;
  title: string;
  equipmentName: string;
  equipmentType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

export type ZoneMaintenanceTask = {
  id: string;
  taskType: string;
  equipmentName: string;
  equipmentType: string;
  daysOverdue: number;
};

export type AttentionSnapshot = {
  criticalStockCount: number;
  criticalItems: Array<{
    id: string;
    name: string;
    currentStock: number;
    minStockLevel: number;
    abcCategory: string;
    salesVelocity: number;
    daysLeft: number | null;
  }>;
  activeIssuesCount: number;
  zoneIssues: Array<{
    zoneName: string;
    issuesCount: number;
    criticalCount: number;
    issues: ZoneIssue[];
  }>;
  overdueTasksCount: number;
  zoneTasks: Array<{
    zoneName: string;
    tasksCount: number;
    maxDaysOverdue: number;
    tasks: ZoneMaintenanceTask[];
  }>;
};

export const SEVERITY_BADGES: Record<string, { label: string; className: string }> = {
  CRITICAL: { label: "Критично", className: "bg-red-50 text-red-700 border-red-100" },
  HIGH: { label: "Высокий", className: "bg-orange-50 text-orange-700 border-orange-100" },
  MEDIUM: { label: "Средний", className: "bg-amber-50 text-amber-700 border-amber-100" },
  LOW: { label: "Низкий", className: "bg-blue-50 text-blue-700 border-blue-100" },
};
