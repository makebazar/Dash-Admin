export interface Evaluation {
  id: number;
  template_name: string;
  employee_name: string;
  evaluator_name: string;
  reviewer_name?: string;
  total_score: number;
  max_score: number;
  evaluation_date: string;
  created_at: string;
  status?: "pending" | "approved" | "rejected";
  reviewer_note?: string;
}

export interface EvaluationResponse {
  id: number;
  item_content: string;
  score: number;
  comment?: string;
  photo_url?: string;
  photo_urls?: string[];
  is_accepted?: boolean;
  admin_comment?: string;
}

export interface EvaluationDetail extends Evaluation {
  comments?: string;
  responses: EvaluationResponse[];
  reviewed_by?: string;
  reviewer_name?: string;
  reviewed_at?: string;
}

export interface VerificationTask {
  id: string;
  equipment_id: string;
  equipment_name: string;
  equipment_type: string;
  equipment_type_name?: string | null;
  workstation_name: string | null;
  zone_name: string | null;
  task_type: string;
  status: string;
  verification_status: string;
  due_date: string;
  completed_at: string | null;
  verified_at?: string | null;
  rework_days?: number;
  completed_by_name: string | null;
  verified_by_name: string | null;
  photos: string[] | null;
  photos_before?: string[] | null;
  photos_after?: string[] | null;
  notes: string | null;
  verification_note?: string | null;
  rejection_reason?: string | null;
  bonus_earned: number;
  kpi_points: number;
  laundry_request_id?: string | null;
  laundry_status?: string | null;
  history?: VerificationTaskEvent[];
}

export interface VerificationTaskEvent {
  id: number;
  task_id: string;
  cycle_no: number;
  event_type:
    | "SUBMITTED"
    | "RESUBMITTED"
    | "REJECTED"
    | "APPROVED"
    | "REVERTED";
  note?: string | null;
  task_notes?: string | null;
  photos?: string[] | null;
  photos_before?: string[] | null;
  photos_after?: string[] | null;
  created_at: string;
  actor_name?: string | null;
}

export interface ShiftReviewItem {
  id: string;
  user_id: string;
  employee_name: string;
  check_in: string;
  check_out: string | null;
  total_hours: number | string | null;
  cash_income: number | string | null;
  card_income: number | string | null;
  expenses: number | string | null;
  report_comment: string | null;
  report_data?: Record<string, any> | null;
  has_owner_corrections?: boolean;
  owner_correction_changes?: OwnerCorrectionChange[] | null;
  owner_notes?: string | null;
  status: string;
  shift_type: string | null;
}

export interface OwnerCorrectionChange {
  field: string;
  label: string;
  before: any;
  after: any;
}

export interface ShiftReportField {
  metric_key: string;
  custom_label: string;
  field_type: "INCOME" | "EXPENSE" | "EXPENSE_LIST" | "OTHER";
}
