export interface Shift {
  id: string;
  user_id: string;
  employee_name: string;
  check_in: string;
  check_out: string | null;
  total_hours: number;
  cash_income: number;
  card_income: number;
  expenses: number;
  report_comment: string;
  report_data: Record<string, any>;
  report_mode?: "FULL_REPORT" | "NO_REPORT";
  actor_role_name_snapshot?: string | null;
  status: string;
  shift_type: "DAY" | "NIGHT";
  has_owner_corrections?: boolean;
  owner_notes?: string;
}

export interface ShiftDetails {
  shift: Shift;
  checklists: any[];
  transactions: any[];
  inventory_checks: any[];
  maintenance_tasks: any[];
  product_sales?: any[];
  inventory_discrepancies?: any[];
  metric_labels?: Record<string, string>;
}
