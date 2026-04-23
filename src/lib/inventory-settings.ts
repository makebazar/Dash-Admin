export type RawInventorySettings = {
    employee_allowed_warehouse_ids?: number[]
    employee_default_metric_key?: string
    blind_inventory_enabled?: boolean
    supplies_enabled?: boolean
    stock_enabled?: boolean
    cashbox_enabled?: boolean
    employee_stock_operations_enabled?: boolean
    employee_writeoff_enabled?: boolean
    employee_transfer_enabled?: boolean
    report_reconciliation_enabled?: boolean
    cashbox_warehouse_id?: number | null
    handover_warehouse_id?: number | null
    sales_capture_mode?: 'INVENTORY' | 'SHIFT' | null
    inventory_timing?: 'END_SHIFT' | 'START_SHIFT' | null
    shift_accountability_mode?: 'DISABLED' | 'WAREHOUSE' | null
    allow_salary_deduction?: boolean
    employee_discount_percent?: number
    employee_discount_overrides?: Record<string, number>
    allow_cost_price_sale?: boolean
    price_tag_settings?: any
}

export type InventorySettings = Omit<RawInventorySettings, 'sales_capture_mode' | 'inventory_timing' | 'shift_accountability_mode'> & {
    supplies_enabled: boolean
    stock_enabled: boolean
    cashbox_enabled: boolean
    employee_stock_operations_enabled: boolean
    employee_writeoff_enabled: boolean
    employee_transfer_enabled: boolean
    report_reconciliation_enabled: boolean
    cashbox_warehouse_id: number | null
    handover_warehouse_id: number | null
    sales_capture_mode: 'SHIFT'
    inventory_timing: 'END_SHIFT'
    shift_accountability_mode: 'DISABLED' | 'WAREHOUSE'
}

export function normalizeInventorySettings(raw: RawInventorySettings | null | undefined): InventorySettings {
    const source = raw && typeof raw === "object" ? raw : {}
    const allowedWarehouseIds = Array.isArray(source.employee_allowed_warehouse_ids)
        ? source.employee_allowed_warehouse_ids
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
        : []
    const employeeDiscountPercentRaw = Number(source.employee_discount_percent ?? 0)
    const employeeDiscountPercent = Number.isFinite(employeeDiscountPercentRaw)
        ? Math.min(100, Math.max(0, employeeDiscountPercentRaw))
        : 0
    const rawDiscountOverrides = source.employee_discount_overrides
    const discountOverridesSource =
        rawDiscountOverrides && typeof rawDiscountOverrides === "object" && !Array.isArray(rawDiscountOverrides)
            ? rawDiscountOverrides
            : {}
    const employeeDiscountOverrides: Record<string, number> = {}
    for (const [key, value] of Object.entries(discountOverridesSource)) {
        const num = Number(value)
        if (!Number.isFinite(num)) continue
        employeeDiscountOverrides[String(key)] = Math.min(100, Math.max(0, num))
    }
    const suppliesEnabled = source.supplies_enabled ?? true
    const stockEnabled = source.stock_enabled ?? true
    const cashboxEnabled = stockEnabled ? (source.cashbox_enabled ?? true) : false
    const employeeStockOperationsEnabled = stockEnabled ? (source.employee_stock_operations_enabled ?? true) : false
    const employeeWriteoffEnabled = stockEnabled ? (source.employee_writeoff_enabled ?? employeeStockOperationsEnabled) : false
    const employeeTransferEnabled = stockEnabled ? (source.employee_transfer_enabled ?? employeeStockOperationsEnabled) : false
    const reportReconciliationEnabled = cashboxEnabled ? (source.report_reconciliation_enabled ?? true) : false
    const cashboxWarehouseId = Number.isInteger(Number(source.cashbox_warehouse_id))
        ? Number(source.cashbox_warehouse_id)
        : null
    const handoverWarehouseId = Number.isInteger(Number(source.handover_warehouse_id))
        ? Number(source.handover_warehouse_id)
        : null
    const shiftAccountabilityMode =
        stockEnabled && cashboxEnabled && source.shift_accountability_mode === "WAREHOUSE"
            ? "WAREHOUSE"
            : "DISABLED"

    return {
        ...source,
        employee_allowed_warehouse_ids: allowedWarehouseIds,
        employee_discount_percent: employeeDiscountPercent,
        employee_discount_overrides: employeeDiscountOverrides,
        blind_inventory_enabled: source.blind_inventory_enabled ?? true,
        supplies_enabled: suppliesEnabled,
        stock_enabled: stockEnabled,
        cashbox_enabled: cashboxEnabled,
        employee_stock_operations_enabled: employeeStockOperationsEnabled,
        employee_writeoff_enabled: employeeWriteoffEnabled,
        employee_transfer_enabled: employeeTransferEnabled,
        report_reconciliation_enabled: reportReconciliationEnabled,
        cashbox_warehouse_id: cashboxEnabled ? cashboxWarehouseId : null,
        handover_warehouse_id: shiftAccountabilityMode === "WAREHOUSE" ? (handoverWarehouseId ?? cashboxWarehouseId) : null,
        sales_capture_mode: "SHIFT",
        inventory_timing: "END_SHIFT",
        shift_accountability_mode: shiftAccountabilityMode,
    }
}
