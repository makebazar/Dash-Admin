"use server";


export type SupplyItem = {
  id: number;
  supply_id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  cost_price: number;
  total_cost: number;
  created_at: string;
};

export type Product = {
  id: number;
  club_id: number;
  category_id: number | null;
  name: string;
  barcode?: string | null;
  barcodes?: string[];
  cost_price: number;
  selling_price: number;
  current_stock: number;
  min_stock_level: number;
  deleted_at?: string | null;
  // Legacy fields (kept for type compatibility but deprecated)
  front_stock?: number;
  back_stock?: number;
  max_front_stock?: number;
  min_front_stock?: number;

  // New Multi-Warehouse fields
  stocks?: {
    warehouse_id: number;
    warehouse_name: string;
    quantity: number;
    is_default: boolean;
  }[];
  total_stock?: number;

  abc_category?: string;
  is_active: boolean;
  category_name?: string;

  // Analytics Fields
  sales_velocity: number;
  ideal_stock_days: number;
  units_per_box: number;
  last_restock_date?: string;

  // Calculated Runway (Days left)
  days_of_stock?: number;
  price_history?: {
    cost_price: number;
    created_at: string;
    supplier_name: string;
    supply_id: number;
  }[];
};

export type Supply = {
  id: number;
  club_id: string;
  created_by: string;
  created_by_name?: string;
  supplier_name: string;
  total_cost: number;
  notes: string | null;
  status: "DRAFT" | "COMPLETED";
  warehouse_id: number | null;
  created_at: string;
  updated_at: string;
  items_count?: number;
};

export type Category = {
  id: number;
  name: string;
  description?: string;
  parent_id?: number | null;
  parent_name?: string;
  products_count?: number;
};

export type Warehouse = {
  id: number;
  name: string;
  address?: string;
  type: string;
  shift_zone_key?: "BAR" | "FRIDGE" | "SHOWCASE" | "BACKROOM" | null;
  shift_accountability_enabled?: boolean;
  is_default?: boolean;
  responsible_user_id?: string;
  responsible_name?: string;
  contact_info?: string;
  characteristics?: any;
  is_active: boolean;
};

export type ShiftZoneSnapshotType = "OPEN" | "CLOSE";

export type ShiftZoneSnapshotDraftItem = {
  warehouse_id: number;
  warehouse_name: string;
  shift_zone_key: "BAR" | "FRIDGE" | "SHOWCASE" | "BACKROOM";
  shift_zone_label: string;
  product_id: number;
  product_name: string;
  category_name?: string | null;
  barcode?: string | null;
  barcodes?: string[] | null;
  counted_quantity: number | null;
  saved_counted_quantity: number | null;
  system_quantity: number;
  selling_price: number;
};

export type ShiftZoneDiscrepancyRow = {
  warehouse_id: number;
  warehouse_name: string;
  shift_zone_key: "BAR" | "FRIDGE" | "SHOWCASE" | "BACKROOM";
  shift_zone_label: string;
  product_id: number;
  product_name: string;
  selling_price: number;
  opening_counted_quantity: number | null;
  opening_system_quantity: number | null;
  inflow_quantity: number;
  outflow_quantity: number;
  expected_closing_quantity: number | null;
  actual_closing_quantity: number | null;
  difference_quantity: number | null;
  responsibility_type:
    | "SHIFT_RESPONSIBILITY"
    | "INHERITED_FROM_PREVIOUS_SHIFT"
    | "PROCESS_GAP";
  responsibility_label: string;
  explanation: string;
  movement_window_started_at: string | null;
  movement_window_ended_at: string | null;
  movements: Array<{
    created_at: string;
    type: string;
    change_amount: number;
    reason: string | null;
    related_entity_type: string | null;
    related_entity_id: string | number | null;
    shift_id: string | null;
    user_id: string | null;
  }>;
};

export type ShiftAccountabilitySetupStatus = {
  mode: "DISABLED" | "WAREHOUSE";
  enabled: boolean;
  ready: boolean;
  warehouses_count: number;
  configured_warehouses: Array<{
    id: number;
    name: string;
    shift_zone_key: "BAR" | "FRIDGE" | "SHOWCASE" | "BACKROOM";
    shift_zone_label: string;
  }>;
  issues: string[];
};

export type ShiftZoneOverviewShift = {
  shift_id: string;
  employee_name: string;
  check_in: string;
  check_out: string | null;
  total_zones: number;
  open_zones_count: number;
  close_zones_count: number;
  discrepancy_items_count: number;
  discrepancy_total_abs: number;
  unresolved_discrepancy_count: number;
  status: "COMPLETE" | "OPEN_ONLY" | "CLOSE_ONLY" | "PARTIAL";
  last_snapshot_at: string | null;
};

export type ShiftZoneOverviewZone = {
  warehouse_id: number;
  warehouse_name: string;
  shift_zone_key: "BAR" | "FRIDGE" | "SHOWCASE" | "BACKROOM";
  shift_zone_label: string;
  open_snapshots_count: number;
  close_snapshots_count: number;
  discrepancy_shifts_count: number;
  discrepancy_items_count: number;
  discrepancy_total_abs: number;
  latest_open_at: string | null;
  latest_close_at: string | null;
};

export type ShiftZoneOverview = {
  summary: {
    recent_shifts_count: number;
    configured_zones_count: number;
    complete_shifts_count: number;
    discrepancy_shifts_count: number;
    discrepancy_total_abs: number;
  };
  recent_shifts: ShiftZoneOverviewShift[];
  zones: ShiftZoneOverviewZone[];
};

export type InventoryAccessScope = {
  isFullAccess: boolean;
  canManageInventory: boolean;
  allowedWarehouseIds: number[];
};

export type Inventory = {
  id: number;
  status: "OPEN" | "CLOSED" | "CANCELED";
  started_at: string;
  closed_at: string | null;
  canceled_at?: string | null;
  shift_id?: string | null;
  sales_capture_mode?: "INVENTORY" | "SHIFT" | null;
  target_metric_key: string | null;
  warehouse_id: number | null;
  warehouse_name?: string;
  reported_revenue: number;
  calculated_revenue: number;
  revenue_difference: number;
  created_by: string; // Added field
  created_by_name?: string;
  notes?: string;
};

export type InventoryItem = {
  id: number;
  product_id: number;
  product_name: string;
  barcode?: string | null;
  barcodes?: string[] | null;
  category_name?: string;
  expected_stock: number;
  actual_stock: number | null;
  difference: number | null;
  cost_price_snapshot: number;
  selling_price_snapshot: number;
  calculated_revenue: number | null;
  adjusted_expected_stock?: number | null;
  stock_before_close?: number | null;
  applied_stock_delta?: number | null;
  added_manually?: boolean;
  counted_by?: string | null;
  counted_at?: string | null;
  last_modified?: number;
};

export type InventoryPostCloseCorrection = {
  id: number;
  inventory_id: number;
  product_id: number;
  product_name: string;
  old_actual_stock: number;
  new_actual_stock: number;
  difference_before: number | null;
  difference_after: number;
  stock_delta: number;
  reason: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
};

// --- CATEGORIES ---

export type HandoverSourceCandidate = {
  shift_id: string;
  employee_id: string | null;
  employee_name: string;
  check_in: string;
  check_out: string;
  is_self_handover: boolean;
  shift_type?: "DAY" | "NIGHT" | string;
  is_counting_finished?: boolean;
};

export type SalarySaleCandidate = {
  id: string;
  full_name: string;
  role: string;
  reference_shift_id: string;
  shifts_in_month: number;
  available_amount: number;
  discount_percent: number;
  price_mode: "SELLING" | "COST";
};

export interface ReplenishmentRule {
  id: number;
  source_warehouse_id: number;
  target_warehouse_id: number;
  product_id: number;
  min_stock_level: number;
  max_stock_level: number;
  source_warehouse_name?: string;
  target_warehouse_name?: string;
}

export type ProcurementMode = "optimized" | "full";

export type ProcurementCandidate = {
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  reason: string;
  reorder_point: number;
  days_left: number | null;
};

export type ShiftSaleItem = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  warehouse_id: number;
  warehouse_name: string;
  selling_price_snapshot: number;
  cost_price_snapshot: number;
  notes?: string | null;
  created_at: string;
  committed_at?: string | null;
};

// ============================================================================
// ПРИМЕЧАНИЕ: Функции shift_sales (getOpenShiftSales, addShiftSaleItem, и т.д.)
// удалены как неиспользуемые. POS-система использует только shift_receipts.
// ============================================================================

export type ShiftReceiptPaymentType =
  | "cash"
  | "card"
  | "mixed"
  | "other"
  | "salary"
  | "bonus";

export type ShiftReceiptItem = {
  id: number;
  receipt_id: number;
  product_id: number;
  product_name: string;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  quantity: number;
  returned_qty?: number;
  available_qty?: number;
  selling_price_snapshot: number;
  cost_price_snapshot: number;
};

export type ShiftReceipt = {
  id: number;
  club_id: number;
  shift_id: string;
  created_by: string;
  warehouse_id: number | null;
  warehouse_name: string;
  payment_type: ShiftReceiptPaymentType;
  counts_in_revenue?: boolean;
  salary_target_user_id?: string | null;
  salary_target_shift_id?: string | null;
  cash_amount: number;
  card_amount: number;
  total_amount: number;
  total_refund_amount?: number;
  notes?: string | null;
  created_at: string;
  voided_at?: string | null;
  committed_at?: string | null;
  items: ShiftReceiptItem[];
};

export type Supplier = {
  id: number;
  club_id: number;
  name: string;
  contact_info?: string;
  is_active: boolean;
  created_at: string;
};

// --- SUPPLIERS ---

export type PriceTagTemplate = {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  background_image_url?: string;
  background_color?: string;
  font_family?: string;
  font_url?: string;
  show_decimals?: boolean;
  elements: {
    id: string;
    type: "text" | "barcode" | "price";
    x: number; // in mm
    y: number; // in mm
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    font_family?: string;
    font_url?: string;
    currency_font_family?: string;
    currency_font_url?: string;
    content?: string;
    field?: "name" | "price" | "barcode";
    width?: number; // in mm
    height?: number; // in mm
    wrap_text?: boolean;
    auto_scale?: boolean;
  }[];
};

export type PriceTagSettings = {
  active_template_id?: string;
  templates: PriceTagTemplate[];
};