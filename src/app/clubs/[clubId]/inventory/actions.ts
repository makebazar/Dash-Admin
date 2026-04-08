"use server"

import { query, getClient } from "@/db"
import { revalidatePath } from "next/cache"
import { logOperation } from "@/lib/logger"
import { LogAction } from "@/lib/logger"
import { cookies } from "next/headers"
import { notifyInventoryClub } from "@/lib/inventory-events"

// ... existing code ...

export type Product = {
    id: number
    club_id: number
    category_id: number | null
    name: string
    barcode?: string | null
    barcodes?: string[]
    cost_price: number
    selling_price: number
    current_stock: number
    min_stock_level: number
    // Legacy fields (kept for type compatibility but deprecated)
    front_stock?: number
    back_stock?: number
    max_front_stock?: number
    min_front_stock?: number
    
    // New Multi-Warehouse fields
    stocks?: { warehouse_id: number, warehouse_name: string, quantity: number, is_default: boolean }[]
    total_stock?: number
    
    abc_category?: string
    is_active: boolean
    category_name?: string

    // Analytics Fields
    sales_velocity: number
    ideal_stock_days: number
    units_per_box: number
    last_restock_date?: string
    
    // Calculated Runway (Days left)
    days_of_stock?: number
    price_history?: { cost_price: number, created_at: string, supplier_name: string, supply_id: number }[]
}

export type Category = {
    id: number
    name: string
    description?: string
    parent_id?: number | null
    parent_name?: string
    products_count?: number
}

export type Warehouse = {
    id: number
    name: string
    address?: string
    type: string
    shift_zone_key?: 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM' | null
    shift_accountability_enabled?: boolean
    is_default?: boolean
    responsible_user_id?: string
    responsible_name?: string
    contact_info?: string
    characteristics?: any
    is_active: boolean
}

export type ShiftZoneSnapshotType = 'OPEN' | 'CLOSE'

export type ShiftZoneSnapshotDraftItem = {
    warehouse_id: number
    warehouse_name: string
    shift_zone_key: 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM'
    shift_zone_label: string
    product_id: number
    product_name: string
    barcode?: string | null
    barcodes?: string[] | null
    counted_quantity: number
    system_quantity: number
    selling_price: number
}

export type ShiftZoneDiscrepancyRow = {
    warehouse_id: number
    warehouse_name: string
    shift_zone_key: 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM'
    shift_zone_label: string
    product_id: number
    product_name: string
    selling_price: number
    opening_counted_quantity: number | null
    opening_system_quantity: number | null
    inflow_quantity: number
    outflow_quantity: number
    expected_closing_quantity: number | null
    actual_closing_quantity: number | null
    difference_quantity: number | null
    responsibility_type: 'SHIFT_RESPONSIBILITY' | 'INHERITED_FROM_PREVIOUS_SHIFT' | 'PROCESS_GAP'
    responsibility_label: string
    explanation: string
}

export type ShiftAccountabilitySetupStatus = {
    mode: 'DISABLED' | 'WAREHOUSE'
    enabled: boolean
    ready: boolean
    warehouses_count: number
    configured_warehouses: Array<{
        id: number
        name: string
        shift_zone_key: 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM'
        shift_zone_label: string
    }>
    issues: string[]
}

export type ShiftZoneOverviewShift = {
    shift_id: string
    employee_name: string
    check_in: string
    check_out: string | null
    total_zones: number
    open_zones_count: number
    close_zones_count: number
    discrepancy_items_count: number
    discrepancy_total_abs: number
    status: 'COMPLETE' | 'OPEN_ONLY' | 'CLOSE_ONLY' | 'PARTIAL'
    last_snapshot_at: string | null
}

export type ShiftZoneOverviewZone = {
    warehouse_id: number
    warehouse_name: string
    shift_zone_key: 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM'
    shift_zone_label: string
    open_snapshots_count: number
    close_snapshots_count: number
    discrepancy_shifts_count: number
    discrepancy_items_count: number
    discrepancy_total_abs: number
    latest_open_at: string | null
    latest_close_at: string | null
}

export type ShiftZoneOverview = {
    summary: {
        recent_shifts_count: number
        configured_zones_count: number
        complete_shifts_count: number
        discrepancy_shifts_count: number
        discrepancy_total_abs: number
    }
    recent_shifts: ShiftZoneOverviewShift[]
    zones: ShiftZoneOverviewZone[]
}

async function assertSessionUserCanAccessClub(clubId: string, sessionUserId: string) {
    if (!sessionUserId) throw new Error("Недостаточно прав для выполнения операции")

    // Club access: owner, active employee, or super admin.
    const accessRes = await query(
        `
        SELECT 1
        FROM clubs c
        JOIN users u ON u.id = $2
        LEFT JOIN club_employees ce
          ON ce.club_id = c.id
         AND ce.user_id = $2
         AND ce.is_active = true
        WHERE c.id = $1
          AND (u.is_super_admin = true OR c.owner_id = $2 OR ce.id IS NOT NULL)
        LIMIT 1
        `,
        [clubId, sessionUserId]
    )
    if ((accessRes.rowCount || 0) === 0) {
        throw new Error("Недостаточно прав для выполнения операции")
    }
}

async function requireClubAccess(clubId: string) {
    const sessionUserId = await requireSessionUserId()
    await assertSessionUserCanAccessClub(clubId, sessionUserId)
    return sessionUserId
}

async function requireSessionUserId() {
    const sessionUserId = (await cookies()).get("session_user_id")?.value
    if (!sessionUserId) throw new Error("Недостаточно прав для выполнения операции")
    return sessionUserId
}

async function assertUserCanAccessClub(clubId: string, userId: string) {
    if (!userId) throw new Error("Недостаточно прав для выполнения операции")

    const sessionUserId = (await cookies()).get("session_user_id")?.value
    if (!sessionUserId || sessionUserId !== userId) {
        throw new Error("Недостаточно прав для выполнения операции")
    }

    await assertSessionUserCanAccessClub(clubId, userId)
}

type InventoryAccessScope = {
    isFullAccess: boolean
    canManageInventory: boolean
    allowedWarehouseIds: number[]
}

function normalizeAllowedWarehouseIds(raw: any): number[] {
    if (!Array.isArray(raw)) return []
    return Array.from(
        new Set(
            raw
                .map((value) => Number(value))
                .filter((value) => Number.isInteger(value) && value > 0)
        )
    )
}

function normalizeShiftZoneKey(raw: any): 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM' | null {
    if (raw === 'BAR' || raw === 'FRIDGE' || raw === 'SHOWCASE' || raw === 'BACKROOM') return raw
    return null
}

function getShiftZoneLabel(zoneKey: 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM') {
    switch (zoneKey) {
        case 'BAR':
            return 'Бар'
        case 'FRIDGE':
            return 'Холодильник'
        case 'SHOWCASE':
            return 'Витрина'
        case 'BACKROOM':
            return 'Подсобка'
        default:
            return zoneKey
    }
}

async function getInventoryAccessScope(client: any, clubId: string, userId: string): Promise<InventoryAccessScope> {
    const clubRes = await client.query(
        `SELECT owner_id, inventory_settings
         FROM clubs
         WHERE id = $1
         LIMIT 1`,
        [clubId]
    )
    if (clubRes.rowCount === 0) throw new Error("Клуб не найден")

    const roleRes = await client.query(
        `SELECT ce.role as club_role, u.role_id, r.name as role_name
         FROM club_employees ce
         LEFT JOIN users u ON u.id = ce.user_id
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE ce.club_id = $1
           AND ce.user_id = $2
           AND ce.is_active = true
           AND ce.dismissed_at IS NULL
         LIMIT 1`,
        [clubId, userId]
    )

    const clubRole = roleRes.rows[0]?.club_role || null
    const roleId = roleRes.rows[0]?.role_id || null
    const roleName = roleRes.rows[0]?.role_name || null
    const isFullAccess =
        String(clubRes.rows[0]?.owner_id) === String(userId) ||
        clubRole === "Владелец" ||
        clubRole === "Админ" ||
        clubRole === "Управляющий" ||
        roleName === "Админ" ||
        roleName === "Управляющий"

    let canManageInventory = isFullAccess
    if (!canManageInventory && roleId) {
        const permissionRes = await client.query(
            `SELECT is_allowed
             FROM role_permissions
             WHERE club_id = $1
               AND role_id = $2
               AND permission_key = 'manage_inventory'
             LIMIT 1`,
            [clubId, roleId]
        )
        canManageInventory = permissionRes.rows[0]?.is_allowed === true
    }

    return {
        isFullAccess,
        canManageInventory,
        allowedWarehouseIds: normalizeAllowedWarehouseIds(clubRes.rows[0]?.inventory_settings?.employee_allowed_warehouse_ids),
    }
}

async function assertUserCanUseWarehouses(client: any, clubId: string, userId: string, warehouseIds: Array<number | null | undefined>) {
    const scope = await getInventoryAccessScope(client, clubId, userId)
    if (scope.canManageInventory) return scope

    const normalizedWarehouseIds = Array.from(
        new Set(
            warehouseIds
                .map((warehouseId) => Number(warehouseId))
                .filter((warehouseId) => Number.isInteger(warehouseId) && warehouseId > 0)
        )
    )

    if (normalizedWarehouseIds.length === 0) return scope
    if (scope.allowedWarehouseIds.length === 0) {
        throw new Error("Для вашего профиля не настроены доступные склады")
    }

    const disallowedWarehouseId = normalizedWarehouseIds.find((warehouseId) => !scope.allowedWarehouseIds.includes(warehouseId))
    if (disallowedWarehouseId) {
        throw new Error(`У вас нет доступа к складу #${disallowedWarehouseId}`)
    }

    return scope
}

export type Supply = {
    id: number
    supplier_name: string
    supplier_id?: number | null
    notes: string
    total_cost: number
    status: 'DRAFT' | 'COMPLETED'
    warehouse_id?: number | null
    created_at: string
    created_by_name?: string
    items_count?: number
}

export type SupplyItem = {
    id: number
    supply_id: number
    product_id: number
    product_name: string
    quantity: number
    cost_price: number
    total_cost: number
}

export type Inventory = {
    id: number
    status: 'OPEN' | 'CLOSED' | 'CANCELED'
    started_at: string
    closed_at: string | null
    canceled_at?: string | null
    shift_id?: string | null
    sales_capture_mode?: 'INVENTORY' | 'SHIFT' | null
    target_metric_key: string | null
    warehouse_id: number | null
    warehouse_name?: string
    reported_revenue: number
    calculated_revenue: number
    revenue_difference: number
    created_by: string // Added field
    created_by_name?: string
    notes?: string
}

export type InventoryItem = {
    id: number
    product_id: number
    product_name: string
    barcode?: string | null
    barcodes?: string[] | null
    category_name?: string
    expected_stock: number
    actual_stock: number | null
    difference: number | null
    cost_price_snapshot: number
    selling_price_snapshot: number
    calculated_revenue: number | null
    adjusted_expected_stock?: number | null
    stock_before_close?: number | null
    applied_stock_delta?: number | null
    added_manually?: boolean
    counted_by?: string | null
    counted_at?: string | null
    last_modified?: number
}

export type InventoryPostCloseCorrection = {
    id: number
    inventory_id: number
    product_id: number
    product_name: string
    old_actual_stock: number
    new_actual_stock: number
    difference_before: number | null
    difference_after: number
    stock_delta: number
    reason: string | null
    created_by: string
    created_by_name: string | null
    created_at: string
}

// --- CATEGORIES ---

export async function getCategories(clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT c.*, p.name as parent_name,
        (SELECT COUNT(*) FROM warehouse_products WHERE category_id = c.id) as products_count
        FROM warehouse_categories c
        LEFT JOIN warehouse_categories p ON c.parent_id = p.id
        WHERE c.club_id = $1 
        ORDER BY c.name
    `, [clubId])
    return res.rows as Category[]
}

export async function createCategory(clubId: string, userId: string, data: { name: string, description?: string, parent_id?: number | null }) {
    await assertUserCanAccessClub(clubId, userId)
    // Validation: Unique Name
    const existing = await query(`SELECT 1 FROM warehouse_categories WHERE club_id = $1 AND name = $2`, [clubId, data.name])
    if (existing.rowCount && existing.rowCount > 0) {
        throw new Error("Категория с таким названием уже существует")
    }

    const res = await query(`
        INSERT INTO warehouse_categories (club_id, name, description, parent_id) 
        VALUES ($1, $2, $3, $4)
        RETURNING id
    `, [clubId, data.name, data.description, data.parent_id])
    
    await logOperation(clubId, userId, 'CREATE_CATEGORY', 'CATEGORY', res.rows[0].id, data)
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function updateCategory(id: number, clubId: string, userId: string, data: { name: string, description?: string, parent_id?: number | null }) {
    await assertUserCanAccessClub(clubId, userId)
    // Validation: Unique Name (excluding self)
    const existing = await query(`SELECT 1 FROM warehouse_categories WHERE club_id = $1 AND name = $2 AND id != $3`, [clubId, data.name, id])
    if (existing.rowCount && existing.rowCount > 0) {
        throw new Error("Категория с таким названием уже существует")
    }

    // Validation: Circular Dependency
    if (data.parent_id === id) {
        throw new Error("Категория не может быть родительской для самой себя")
    }

    await query(`
        UPDATE warehouse_categories 
        SET name = $1, description = $2, parent_id = $3
        WHERE id = $4
    `, [data.name, data.description, data.parent_id, id])

    await logOperation(clubId, userId, 'UPDATE_CATEGORY', 'CATEGORY', id, data)
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function deleteCategory(id: number, clubId: string, userId: string) {
    await assertUserCanAccessClub(clubId, userId)
    // Check if has products
    const products = await query(`SELECT 1 FROM warehouse_products WHERE category_id = $1`, [id])
    if (products.rowCount && products.rowCount > 0) {
        throw new Error("Нельзя удалить категорию, к которой привязаны товары")
    }

    await query(`DELETE FROM warehouse_categories WHERE id = $1`, [id])
    await logOperation(clubId, userId, 'DELETE_CATEGORY', 'CATEGORY', id)
    revalidatePath(`/clubs/${clubId}/inventory`)
}


// --- WAREHOUSES ---

export async function getWarehouses(clubId: string) {
    const userId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        const scope = await getInventoryAccessScope(client, clubId, userId)
        if (!scope.canManageInventory && scope.allowedWarehouseIds.length === 0) {
            return []
        }

        const params: any[] = [clubId]
        let warehouseFilter = ""
        if (!scope.canManageInventory) {
            params.push(scope.allowedWarehouseIds)
            warehouseFilter = " AND w.id = ANY($2)"
        }

        const res = await client.query(
            `
            SELECT w.*, u.full_name as responsible_name
            FROM warehouses w
            LEFT JOIN users u ON w.responsible_user_id = u.id
            WHERE w.club_id = $1${warehouseFilter}
            ORDER BY w.name
            `,
            params
        )
        return res.rows as Warehouse[]
    } finally {
        client.release()
    }
}

export async function createWarehouse(clubId: string, userId: string, data: {
    name: string
    address?: string
    type: string
    contact_info?: string
    characteristics?: any
    shift_zone_key?: 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM' | null
    shift_accountability_enabled?: boolean
}) {
    await assertUserCanAccessClub(clubId, userId)
    const shiftZoneKey = normalizeShiftZoneKey(data.shift_zone_key)
    const res = await query(`
        INSERT INTO warehouses (club_id, name, address, type, shift_zone_key, shift_accountability_enabled, contact_info, characteristics)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
    `, [clubId, data.name, data.address, data.type, shiftZoneKey, Boolean(data.shift_accountability_enabled && shiftZoneKey), data.contact_info, data.characteristics || {}])

    await logOperation(clubId, userId, 'CREATE_WAREHOUSE', 'WAREHOUSE', res.rows[0].id, data)
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function updateWarehouse(id: number, clubId: string, userId: string, data: {
    name: string
    address?: string
    type: string
    contact_info?: string
    characteristics?: any
    is_active: boolean
    shift_zone_key?: 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM' | null
    shift_accountability_enabled?: boolean
}) {
    await assertUserCanAccessClub(clubId, userId)
    const shiftZoneKey = normalizeShiftZoneKey(data.shift_zone_key)
    await query(`
        UPDATE warehouses
        SET name = $1, address = $2, type = $3, shift_zone_key = $4, shift_accountability_enabled = $5, contact_info = $6, characteristics = $7, is_active = $8
        WHERE id = $9
    `, [data.name, data.address, data.type, shiftZoneKey, Boolean(data.shift_accountability_enabled && shiftZoneKey), data.contact_info, data.characteristics || {}, data.is_active, id])

    await logOperation(clubId, userId, 'UPDATE_WAREHOUSE', 'WAREHOUSE', id, data)
    revalidatePath(`/clubs/${clubId}/inventory`)
}

async function getShiftAccountabilityWarehousesInternal(client: any, clubId: string, userId: string) {
    const scope = await getInventoryAccessScope(client, clubId, userId)
    if (!scope.canManageInventory && scope.allowedWarehouseIds.length === 0) {
        return []
    }

    const params: any[] = [clubId]
    let warehouseFilter = ""
    if (!scope.canManageInventory) {
        params.push(scope.allowedWarehouseIds)
        warehouseFilter = " AND w.id = ANY($2)"
    }

    const res = await client.query(
        `
        SELECT w.*
        FROM warehouses w
        WHERE w.club_id = $1
          AND w.is_active = true
          AND w.shift_accountability_enabled = true
          AND w.shift_zone_key IS NOT NULL
          ${warehouseFilter}
        ORDER BY
          CASE w.shift_zone_key
            WHEN 'BAR' THEN 1
            WHEN 'FRIDGE' THEN 2
            WHEN 'SHOWCASE' THEN 3
            WHEN 'BACKROOM' THEN 4
            ELSE 99
          END,
          w.name
        `,
        params
    )

    return res.rows
        .map((row: any) => ({
            ...row,
            shift_zone_key: normalizeShiftZoneKey(row.shift_zone_key)
        }))
        .filter((row: any) => row.shift_zone_key) as Array<Warehouse & { shift_zone_key: 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM' }>
}

async function getShiftForZoneAccountability(client: any, clubId: string, shiftId: string, sessionUserId: string) {
    const shiftRes = await client.query(
        `
        SELECT s.id, s.user_id, s.club_id, s.check_in, s.check_out, s.status
        FROM shifts s
        WHERE s.id = $1 AND s.club_id = $2
        LIMIT 1
        `,
        [shiftId, clubId]
    )
    if (shiftRes.rowCount === 0) throw new Error("Смена не найдена")

    const shift = shiftRes.rows[0]
    const scope = await getInventoryAccessScope(client, clubId, sessionUserId)
    if (!scope.canManageInventory && String(shift.user_id) !== String(sessionUserId)) {
        throw new Error("Недостаточно прав для работы с этой сменой")
    }

    return shift
}

export async function getShiftAccountabilityWarehouses(clubId: string) {
    const sessionUserId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        const warehouses = await getShiftAccountabilityWarehousesInternal(client, clubId, sessionUserId)
        return warehouses.map((warehouse) => ({
            ...warehouse,
            shift_zone_label: getShiftZoneLabel(warehouse.shift_zone_key!)
        }))
    } finally {
        client.release()
    }
}

export async function getShiftAccountabilitySetupStatus(clubId: string): Promise<ShiftAccountabilitySetupStatus> {
    const sessionUserId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        const clubRes = await client.query(
            `SELECT inventory_settings FROM clubs WHERE id = $1 LIMIT 1`,
            [clubId]
        )
        const settings = clubRes.rows[0]?.inventory_settings || {}
        const mode: ShiftAccountabilitySetupStatus["mode"] =
            settings?.shift_accountability_mode === 'WAREHOUSE' ? 'WAREHOUSE' : 'DISABLED'

        const warehouses = await getShiftAccountabilityWarehousesInternal(client, clubId, sessionUserId)
        const issues: string[] = []

        if (mode === 'WAREHOUSE') {
            if (warehouses.length === 0) {
                issues.push("Не настроены склады со сменной ответственностью.")
            }

            const configuredZoneKeys = new Set(warehouses.map((warehouse) => warehouse.shift_zone_key))
            const hasBarZone = configuredZoneKeys.has('BAR')
            const hasLegacyBarPair = configuredZoneKeys.has('FRIDGE') && configuredZoneKeys.has('SHOWCASE')
            if (!hasBarZone && !hasLegacyBarPair) {
                issues.push("Настрой барную зону: либо один или несколько складов с типом 'Бар', либо пару 'Холодильник' + 'Витрина'.")
            }

            const enabledIds = new Set(warehouses.map((warehouse) => Number(warehouse.id)))
            const allowedWarehouseIds = normalizeAllowedWarehouseIds(settings?.employee_allowed_warehouse_ids)
            const inaccessible = warehouses.filter((warehouse) => !allowedWarehouseIds.includes(Number(warehouse.id)))
            if (allowedWarehouseIds.length === 0) {
                issues.push("Для сотрудников не выбраны доступные склады инвентаризации.")
            } else if (inaccessible.length > 0) {
                issues.push("Не все accountability-склады включены в доступные сотрудникам склады.")
            }

            if ((settings?.inventory_timing || 'END_SHIFT') === 'START_SHIFT' && settings?.inventory_required) {
                issues.push("Обязательная стартовая ревизия включена одновременно с системой сменной ответственности.")
            }

            // Extra safety: configuration should not be empty after access filtering.
            if (enabledIds.size === 0) {
                issues.push("Для текущего профиля не видно ни одной настроенной зоны ответственности.")
            }
        }

        return {
            mode,
            enabled: mode === 'WAREHOUSE',
            ready: mode === 'WAREHOUSE' ? issues.length === 0 : true,
            warehouses_count: warehouses.length,
            configured_warehouses: warehouses.map((warehouse) => ({
                id: Number(warehouse.id),
                name: warehouse.name,
                shift_zone_key: warehouse.shift_zone_key!,
                shift_zone_label: getShiftZoneLabel(warehouse.shift_zone_key!)
            })),
            issues
        }
    } finally {
        client.release()
    }
}

export async function getShiftZoneSnapshotDraft(clubId: string, shiftId: string, snapshotType: ShiftZoneSnapshotType) {
    const sessionUserId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        const shift = await getShiftForZoneAccountability(client, clubId, shiftId, sessionUserId)
        const warehouses = await getShiftAccountabilityWarehousesInternal(client, clubId, sessionUserId)
        if (warehouses.length === 0) return [] as ShiftZoneSnapshotDraftItem[]

        const shiftWindowEnd = shift.check_out || new Date().toISOString()
        const result: ShiftZoneSnapshotDraftItem[] = []

        for (const warehouse of warehouses) {
            const rows = await client.query(
                `
                WITH relevant_products AS (
                    SELECT product_id
                    FROM warehouse_stock
                    WHERE warehouse_id = $2
                      AND quantity <> 0

                    UNION

                    SELECT sii.product_id
                    FROM shift_zone_snapshot_items sii
                    JOIN shift_zone_snapshots ss ON ss.id = sii.snapshot_id
                    WHERE ss.shift_id = $1
                      AND ss.warehouse_id = $2
                      AND ss.snapshot_type IN ('OPEN', $3)

                    UNION

                    SELECT DISTINCT m.product_id
                    FROM warehouse_stock_movements m
                    WHERE m.club_id = $4
                      AND m.warehouse_id = $2
                      AND m.created_at >= $5
                      AND m.created_at <= $6
                )
                SELECT
                    p.id as product_id,
                    p.name as product_name,
                    p.barcode,
                    p.barcodes,
                    COALESCE(ws.quantity, 0) as system_quantity,
                    COALESCE(sii.counted_quantity, COALESCE(ws.quantity, 0)) as counted_quantity,
                    COALESCE(p.selling_price, 0) as selling_price
                FROM relevant_products rp
                JOIN warehouse_products p ON p.id = rp.product_id AND p.club_id = $4
                LEFT JOIN warehouse_stock ws
                    ON ws.warehouse_id = $2
                   AND ws.product_id = p.id
                LEFT JOIN shift_zone_snapshots ss
                    ON ss.shift_id = $1
                   AND ss.warehouse_id = $2
                   AND ss.snapshot_type = $3
                LEFT JOIN shift_zone_snapshot_items sii
                    ON sii.snapshot_id = ss.id
                   AND sii.product_id = p.id
                WHERE p.is_active = true
                ORDER BY p.name
                `,
                [shiftId, warehouse.id, snapshotType, clubId, shift.check_in, shiftWindowEnd]
            )

            for (const row of rows.rows) {
                result.push({
                    warehouse_id: warehouse.id,
                    warehouse_name: warehouse.name,
                    shift_zone_key: warehouse.shift_zone_key!,
                    shift_zone_label: getShiftZoneLabel(warehouse.shift_zone_key!),
                    product_id: Number(row.product_id),
                    product_name: row.product_name,
                    barcode: row.barcode,
                    barcodes: row.barcodes,
                    counted_quantity: Number(row.counted_quantity || 0),
                    system_quantity: Number(row.system_quantity || 0),
                    selling_price: Number(row.selling_price || 0),
                })
            }
        }

        return result
    } finally {
        client.release()
    }
}

export async function hasSavedShiftZoneSnapshot(clubId: string, shiftId: string, snapshotType: ShiftZoneSnapshotType) {
    const sessionUserId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await getShiftForZoneAccountability(client, clubId, shiftId, sessionUserId)
        const res = await client.query(
            `
            SELECT 1
            FROM shift_zone_snapshots
            WHERE club_id = $1
              AND shift_id = $2
              AND snapshot_type = $3
            LIMIT 1
            `,
            [clubId, shiftId, snapshotType]
        )
        return (res.rowCount || 0) > 0
    } finally {
        client.release()
    }
}

export type HandoverSourceCandidate = {
    shift_id: string
    employee_id: string | null
    employee_name: string
    check_in: string
    check_out: string
    is_self_handover: boolean
}

export async function getHandoverSourceCandidates(clubId: string, shiftId: string) {
    const sessionUserId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        const shift = await getShiftForZoneAccountability(client, clubId, shiftId, sessionUserId)
        await ensurePreviousShiftClosureCompleted(client, clubId, shiftId, new Date(shift.check_in).toISOString())
        const referenceTime = new Date().toISOString()
        const currentShiftUserId = shift.user_id ? String(shift.user_id) : null
        const res = await client.query(
            `
            SELECT
                s.id as shift_id,
                s.user_id as employee_id,
                COALESCE(u.full_name, 'Неизвестный сотрудник') as employee_name,
                s.check_in,
                s.check_out,
                CASE
                    WHEN $4::text IS NOT NULL AND s.user_id::text = $4::text THEN true
                    ELSE false
                END as is_self_handover
            FROM shifts s
            LEFT JOIN users u ON u.id = s.user_id
            WHERE s.club_id = $1
              AND s.id <> $2
              AND s.check_out IS NOT NULL
              AND s.check_out <= $3
            ORDER BY
                CASE
                    WHEN $4::text IS NOT NULL AND s.user_id::text = $4::text THEN 1
                    ELSE 0
                END ASC,
                s.check_out DESC,
                s.check_in DESC,
                s.id DESC
            LIMIT 20
            `,
            [clubId, shiftId, referenceTime, currentShiftUserId]
        )

        return res.rows.map((row: any) => ({
            shift_id: String(row.shift_id),
            employee_id: row.employee_id ? String(row.employee_id) : null,
            employee_name: String(row.employee_name || 'Неизвестный сотрудник'),
            check_in: String(row.check_in),
            check_out: String(row.check_out),
            is_self_handover: Boolean(row.is_self_handover),
        })) as HandoverSourceCandidate[]
    } finally {
        client.release()
    }
}

export async function saveShiftZoneSnapshot(
    clubId: string,
    shiftId: string,
    snapshotType: ShiftZoneSnapshotType,
    payload: Array<{ warehouse_id: number, items: Array<{ product_id: number, counted_quantity: number }> }>,
    options?: { accepted_from_shift_id?: string | null }
) {
    const sessionUserId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        const shift = await getShiftForZoneAccountability(client, clubId, shiftId, sessionUserId)
        const warehouses = await getShiftAccountabilityWarehousesInternal(client, clubId, sessionUserId)
        const allowedWarehouseIds = new Set(warehouses.map(warehouse => Number(warehouse.id)))
        const normalizedPayload = payload
            .map((warehouse) => ({
                warehouse_id: Number(warehouse.warehouse_id),
                items: (warehouse.items || [])
                    .map((item) => ({
                        product_id: Number(item.product_id),
                        counted_quantity: Math.max(0, Math.trunc(Number(item.counted_quantity) || 0))
                    }))
                    .filter((item) => Number.isInteger(item.product_id) && item.product_id > 0)
            }))
            .filter((warehouse) => allowedWarehouseIds.has(warehouse.warehouse_id))

        if (normalizedPayload.length === 0) {
            throw new Error("Нет зон для сохранения приемки/сдачи")
        }

        const touchedProductIds = new Set<number>()
        const snapshotReferenceTime = new Date().toISOString()
        if (snapshotType === 'OPEN') {
            await ensurePreviousShiftClosureCompleted(client, clubId, shiftId, new Date(shift.check_in).toISOString())
        }
        const acceptedFrom = snapshotType === 'OPEN'
            ? await findAcceptedFromShift(
                client,
                clubId,
                shiftId,
                shift.user_id ? String(shift.user_id) : null,
                snapshotReferenceTime,
                options?.accepted_from_shift_id || null
            )
            : { accepted_from_shift_id: null as string | null, accepted_from_employee_id: null as string | null }

        const shouldSyncStock = snapshotType === 'OPEN' || snapshotType === 'CLOSE'

        for (const warehousePayload of normalizedPayload) {
            const snapshotRes = await client.query(
                `
                INSERT INTO shift_zone_snapshots (
                    club_id,
                    shift_id,
                    employee_id,
                    warehouse_id,
                    snapshot_type,
                    accepted_from_shift_id,
                    accepted_from_employee_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (shift_id, warehouse_id, snapshot_type)
                DO UPDATE SET
                    employee_id = EXCLUDED.employee_id,
                    accepted_from_shift_id = EXCLUDED.accepted_from_shift_id,
                    accepted_from_employee_id = EXCLUDED.accepted_from_employee_id,
                    created_at = NOW()
                RETURNING id
                `,
                [
                    clubId,
                    shiftId,
                    shift.user_id,
                    warehousePayload.warehouse_id,
                    snapshotType,
                    acceptedFrom.accepted_from_shift_id,
                    acceptedFrom.accepted_from_employee_id,
                ]
            )
            const snapshotId = Number(snapshotRes.rows[0].id)

            if (shouldSyncStock) {
                const existingAdjustmentRes = await client.query(
                    `
                    SELECT id, product_id, change_amount
                    FROM warehouse_stock_movements
                    WHERE club_id = $1
                      AND warehouse_id = $2
                      AND related_entity_type = 'SHIFT_ZONE_SNAPSHOT'
                      AND related_entity_id = $3
                    ORDER BY id
                    `,
                    [clubId, warehousePayload.warehouse_id, snapshotId]
                )

                for (const movement of existingAdjustmentRes.rows) {
                    await applyWarehouseStockDelta(
                        client,
                        warehousePayload.warehouse_id,
                        Number(movement.product_id),
                        -Number(movement.change_amount || 0)
                    )
                    touchedProductIds.add(Number(movement.product_id))
                }

                if (existingAdjustmentRes.rowCount) {
                    await client.query(
                        `
                        DELETE FROM warehouse_stock_movements
                        WHERE club_id = $1
                          AND warehouse_id = $2
                          AND related_entity_type = 'SHIFT_ZONE_SNAPSHOT'
                          AND related_entity_id = $3
                        `,
                        [clubId, warehousePayload.warehouse_id, snapshotId]
                    )
                }
            }

            await client.query(`DELETE FROM shift_zone_snapshot_items WHERE snapshot_id = $1`, [snapshotId])

            if (warehousePayload.items.length === 0) continue

            const productIds = warehousePayload.items.map(item => item.product_id)
            const productRes = await client.query(
                `
                SELECT
                    p.id,
                    COALESCE(ws.quantity, 0) as system_quantity
                FROM warehouse_products p
                LEFT JOIN warehouse_stock ws
                    ON ws.warehouse_id = $2
                   AND ws.product_id = p.id
                WHERE p.club_id = $1
                  AND p.id = ANY($3)
                `,
                [clubId, warehousePayload.warehouse_id, productIds]
            )
            if (productRes.rowCount !== productIds.length) {
                throw new Error("Некоторые товары для снимка зоны не найдены")
            }
            const systemMap = new Map<number, number>(
                productRes.rows.map((row: any) => [Number(row.id), Number(row.system_quantity || 0)])
            )

            for (const item of warehousePayload.items) {
                const systemQuantity = systemMap.get(item.product_id) || 0
                touchedProductIds.add(item.product_id)
                await client.query(
                    `
                    INSERT INTO shift_zone_snapshot_items (snapshot_id, product_id, counted_quantity, system_quantity)
                    VALUES ($1, $2, $3, $4)
                    `,
                    [snapshotId, item.product_id, item.counted_quantity, systemQuantity]
                )

                if (shouldSyncStock) {
                    const stockDelta = item.counted_quantity - systemQuantity
                    if (stockDelta !== 0) {
                        const { previousStock, newStock } = await applyWarehouseStockDelta(
                            client,
                            warehousePayload.warehouse_id,
                            item.product_id,
                            stockDelta
                        )

                        await logStockMovement(
                            client,
                            clubId,
                            sessionUserId,
                            item.product_id,
                            stockDelta,
                            previousStock,
                            newStock,
                            stockDelta > 0 ? 'INVENTORY_GAIN' : 'INVENTORY_LOSS',
                            stockDelta > 0
                                ? `${snapshotType === 'OPEN' ? 'Приемка остатков' : 'Сдача остатков'} #${snapshotId}: найден излишек`
                                : `${snapshotType === 'OPEN' ? 'Приемка остатков' : 'Сдача остатков'} #${snapshotId}: подтверждена недостача`,
                            'SHIFT_ZONE_SNAPSHOT',
                            snapshotId,
                            shiftId,
                            warehousePayload.warehouse_id,
                            null
                        )
                    }
                }
            }
        }

        await syncProductsCurrentStock(client, clubId, touchedProductIds)

        await client.query('COMMIT')
        revalidatePath(`/employee/clubs/${clubId}`)
        revalidatePath(`/clubs/${clubId}/shifts/${shiftId}`)
        revalidatePath(`/clubs/${clubId}/inventory`)
        return { ok: true as const }
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}

async function getShiftZoneDiscrepancyReportInternal(client: any, clubId: string, shiftId: string, sessionUserId: string) {
    const shift = await getShiftForZoneAccountability(client, clubId, shiftId, sessionUserId)
    const warehouses = await getShiftAccountabilityWarehousesInternal(client, clubId, sessionUserId)
    if (warehouses.length === 0) return [] as ShiftZoneDiscrepancyRow[]

    const warehouseIds = warehouses.map(warehouse => Number(warehouse.id))
    const warehouseById = new Map<number, Warehouse>(
        warehouses.map((warehouse) => [Number(warehouse.id), warehouse as Warehouse])
    )
    const snapshotItemsRes = await client.query(
        `
        SELECT
            ss.warehouse_id,
            ss.snapshot_type,
            sii.product_id,
            sii.counted_quantity,
            sii.system_quantity,
            p.name as product_name,
            p.selling_price
        FROM shift_zone_snapshots ss
        JOIN shift_zone_snapshot_items sii ON sii.snapshot_id = ss.id
        JOIN warehouse_products p ON p.id = sii.product_id
        WHERE ss.shift_id = $1
          AND ss.warehouse_id = ANY($2)
        `,
        [shiftId, warehouseIds]
    )

    const movementRows = await client.query(
        `
            SELECT warehouse_id, product_id, change_amount, type, user_id, shift_id, related_entity_type
        FROM warehouse_stock_movements
        WHERE club_id = $1
          AND warehouse_id = ANY($2)
          AND created_at >= $3
          AND created_at <= $4
        `,
        [clubId, warehouseIds, shift.check_in, shift.check_out || new Date().toISOString()]
    )

    const byKey = new Map<string, any>()
    const ensureEntry = (warehouseId: number, productId: number, defaults?: Partial<any>) => {
        const key = `${warehouseId}:${productId}`
        if (!byKey.has(key)) {
            const warehouse = warehouseById.get(warehouseId)
            byKey.set(key, {
                warehouse_id: warehouseId,
                warehouse_name: warehouse?.name || `Склад #${warehouseId}`,
                shift_zone_key: warehouse?.shift_zone_key || 'BACKROOM',
                shift_zone_label: getShiftZoneLabel((warehouse?.shift_zone_key || 'BACKROOM') as 'BAR' | 'FRIDGE' | 'SHOWCASE' | 'BACKROOM'),
                product_id: productId,
                product_name: defaults?.product_name || `Товар #${productId}`,
                selling_price: Number(defaults?.selling_price || 0),
                opening_counted_quantity: null,
                opening_system_quantity: null,
                closing_counted_quantity: null,
                closing_system_quantity: null,
                inflow_quantity: 0,
                outflow_quantity: 0,
                has_process_gap: false,
            })
        }
        if (defaults) {
            Object.assign(byKey.get(key), defaults)
        }
        return byKey.get(key)
    }

    for (const row of snapshotItemsRes.rows) {
            const entry = ensureEntry(Number(row.warehouse_id), Number(row.product_id), {
                product_name: row.product_name,
                selling_price: Number(row.selling_price || 0)
            })
        if (row.snapshot_type === 'OPEN') {
            entry.opening_counted_quantity = Number(row.counted_quantity)
            entry.opening_system_quantity = Number(row.system_quantity)
        } else if (row.snapshot_type === 'CLOSE') {
            entry.closing_counted_quantity = Number(row.counted_quantity)
            entry.closing_system_quantity = Number(row.system_quantity)
        }
    }

    for (const row of movementRows.rows) {
        const entry = ensureEntry(Number(row.warehouse_id), Number(row.product_id))
        const movementType = String(row.type || '')
            const relatedEntityType = String(row.related_entity_type || '')
        const amount = Number(row.change_amount || 0)
        const isInventoryMovement = ['INVENTORY_GAIN', 'INVENTORY_LOSS', 'INVENTORY_CORRECTION'].includes(movementType)
        const isManualGap = movementType === 'ADJUSTMENT'
            const isShiftZoneSnapshotAdjustment = relatedEntityType === 'SHIFT_ZONE_SNAPSHOT'
            const isOperationalMovement = !isInventoryMovement && !isManualGap && !isShiftZoneSnapshotAdjustment

        if (isOperationalMovement) {
            if (amount > 0) entry.inflow_quantity += amount
            if (amount < 0) entry.outflow_quantity += Math.abs(amount)
        }

        if (
            isInventoryMovement ||
            isManualGap ||
                isShiftZoneSnapshotAdjustment ||
            !row.shift_id ||
            String(row.shift_id) !== String(shiftId) ||
            (row.user_id && String(row.user_id) !== String(shift.user_id))
        ) {
                if (isShiftZoneSnapshotAdjustment) continue
            entry.has_process_gap = true
        }
    }

    return Array.from(byKey.values())
        .map((entry) => {
            const openingCounted = entry.opening_counted_quantity
            const closingCounted = entry.closing_counted_quantity
            const hasOpening = openingCounted !== null
            const hasClosing = closingCounted !== null
            let expectedClosing: number | null = null
            let difference: number | null = null

            if (hasOpening) {
                expectedClosing = openingCounted + entry.inflow_quantity - entry.outflow_quantity
            }

            if (hasOpening && hasClosing) {
                difference = closingCounted - expectedClosing!
            } else if (!hasOpening && hasClosing && entry.closing_system_quantity !== null) {
                expectedClosing = Number(entry.closing_system_quantity)
                difference = closingCounted - expectedClosing
            } else if (hasOpening && !hasClosing && entry.opening_system_quantity !== null) {
                expectedClosing = openingCounted
                difference = openingCounted - Number(entry.opening_system_quantity)
            }

            let responsibilityType: ShiftZoneDiscrepancyRow['responsibility_type'] = 'SHIFT_RESPONSIBILITY'
            let responsibilityLabel = 'Ответственность смены'
            let explanation = 'Расхождение возникло внутри этой смены при чистой приемке зоны.'

            if (!hasOpening && hasClosing) {
                responsibilityType = 'PROCESS_GAP'
                responsibilityLabel = 'Сдача без приемки'
                explanation = `Зона сдана без стартовой приемки. Сравнение идет с системным остатком ${entry.closing_system_quantity ?? 0}.`
            } else if (hasOpening && !hasClosing) {
                responsibilityType = 'PROCESS_GAP'
                responsibilityLabel = 'Только приемка'
                explanation = `Есть стартовая приемка, но нет сдачи зоны. На старте уже было отклонение: по системе ${entry.opening_system_quantity ?? 0}, принято ${openingCounted}.`
            } else if (openingCounted === null || closingCounted === null) {
                responsibilityType = 'PROCESS_GAP'
                responsibilityLabel = 'Сбой процесса'
                explanation = 'Не хватает приемки или сдачи зоны, поэтому привязать расхождение к смене нельзя.'
            } else if (entry.opening_system_quantity !== null && openingCounted !== entry.opening_system_quantity) {
                responsibilityType = 'INHERITED_FROM_PREVIOUS_SHIFT'
                responsibilityLabel = 'Наследовано со старта'
                explanation = `На старте уже было расхождение: по системе ${entry.opening_system_quantity}, принято ${openingCounted}.`
            } else if (entry.has_process_gap) {
                responsibilityType = 'PROCESS_GAP'
                responsibilityLabel = 'Сбой процесса'
                explanation = 'Во время смены были внешние или неразмеченные движения по этой зоне.'
            } else if ((difference ?? 0) > 0) {
                explanation = 'В конце смены обнаружен излишек при чистой приемке зоны.'
            }

            return {
                warehouse_id: entry.warehouse_id,
                warehouse_name: entry.warehouse_name,
                shift_zone_key: entry.shift_zone_key,
                shift_zone_label: entry.shift_zone_label,
                product_id: entry.product_id,
                product_name: entry.product_name,
                selling_price: Number(entry.selling_price || 0),
                opening_counted_quantity: openingCounted,
                opening_system_quantity: entry.opening_system_quantity,
                inflow_quantity: entry.inflow_quantity,
                outflow_quantity: entry.outflow_quantity,
                expected_closing_quantity: expectedClosing,
                actual_closing_quantity: closingCounted,
                difference_quantity: difference,
                responsibility_type: responsibilityType,
                responsibility_label: responsibilityLabel,
                explanation
            } satisfies ShiftZoneDiscrepancyRow
        })
        .filter(row => (row.difference_quantity ?? 0) !== 0)
        .sort((a, b) => (a.difference_quantity ?? 0) - (b.difference_quantity ?? 0))
}

export async function getShiftZoneDiscrepancyReport(clubId: string, shiftId: string) {
    const sessionUserId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        return await getShiftZoneDiscrepancyReportInternal(client, clubId, shiftId, sessionUserId)
    } finally {
        client.release()
    }
}

export async function getShiftZoneOverview(clubId: string, limit: number = 30) {
    const sessionUserId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        const warehouses = await getShiftAccountabilityWarehousesInternal(client, clubId, sessionUserId)
        if (warehouses.length === 0) {
            return {
                summary: {
                    recent_shifts_count: 0,
                    configured_zones_count: 0,
                    complete_shifts_count: 0,
                    discrepancy_shifts_count: 0,
                    discrepancy_total_abs: 0,
                },
                recent_shifts: [],
                zones: [],
            } satisfies ShiftZoneOverview
        }

        const totalZones = warehouses.length
        const warehouseById = new Map<number, Warehouse>(
            warehouses.map((warehouse) => [Number(warehouse.id), warehouse as Warehouse])
        )

        const recentShiftRows = await client.query(
            `
            SELECT DISTINCT ON (ss.shift_id)
                ss.shift_id,
                s.check_in,
                s.check_out,
                u.full_name as employee_name
            FROM shift_zone_snapshots ss
            JOIN shifts s ON s.id = ss.shift_id
            LEFT JOIN users u ON u.id = s.user_id
            WHERE ss.club_id = $1
            ORDER BY ss.shift_id, s.check_in DESC
            `,
            [clubId]
        )

        const sortedRecentShifts = recentShiftRows.rows
            .sort((a: any, b: any) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime())
            .slice(0, Math.max(1, Math.trunc(limit)))

        const shiftIds = sortedRecentShifts.map((row: any) => String(row.shift_id))
        if (shiftIds.length === 0) {
            return {
                summary: {
                    recent_shifts_count: 0,
                    configured_zones_count: totalZones,
                    complete_shifts_count: 0,
                    discrepancy_shifts_count: 0,
                    discrepancy_total_abs: 0,
                },
                recent_shifts: [],
                zones: warehouses.map((warehouse) => ({
                    warehouse_id: Number(warehouse.id),
                    warehouse_name: warehouse.name,
                    shift_zone_key: normalizeShiftZoneKey(warehouse.shift_zone_key) || 'BACKROOM',
                    shift_zone_label: getShiftZoneLabel((normalizeShiftZoneKey(warehouse.shift_zone_key) || 'BACKROOM')),
                    open_snapshots_count: 0,
                    close_snapshots_count: 0,
                    discrepancy_shifts_count: 0,
                    discrepancy_items_count: 0,
                    discrepancy_total_abs: 0,
                    latest_open_at: null,
                    latest_close_at: null,
                })),
            } satisfies ShiftZoneOverview
        }

        const snapshotsRes = await client.query(
            `
            SELECT
                ss.shift_id,
                ss.warehouse_id,
                ss.snapshot_type,
                ss.created_at
            FROM shift_zone_snapshots ss
            WHERE ss.club_id = $1
              AND ss.shift_id = ANY($2)
            ORDER BY ss.created_at DESC
            `,
            [clubId, shiftIds]
        )

        const shiftMap = new Map<string, ShiftZoneOverviewShift>()
        for (const row of sortedRecentShifts) {
            shiftMap.set(String(row.shift_id), {
                shift_id: String(row.shift_id),
                employee_name: row.employee_name || "Неизвестно",
                check_in: row.check_in,
                check_out: row.check_out,
                total_zones: totalZones,
                open_zones_count: 0,
                close_zones_count: 0,
                discrepancy_items_count: 0,
                discrepancy_total_abs: 0,
                status: 'PARTIAL',
                last_snapshot_at: null,
            })
        }

        const zoneMap = new Map<number, ShiftZoneOverviewZone>()
        for (const warehouse of warehouses) {
            const zoneKey = normalizeShiftZoneKey(warehouse.shift_zone_key) || 'BACKROOM'
            zoneMap.set(Number(warehouse.id), {
                warehouse_id: Number(warehouse.id),
                warehouse_name: warehouse.name,
                shift_zone_key: zoneKey,
                shift_zone_label: getShiftZoneLabel(zoneKey),
                open_snapshots_count: 0,
                close_snapshots_count: 0,
                discrepancy_shifts_count: 0,
                discrepancy_items_count: 0,
                discrepancy_total_abs: 0,
                latest_open_at: null,
                latest_close_at: null,
            })
        }

        const shiftOpenZones = new Map<string, Set<number>>()
        const shiftCloseZones = new Map<string, Set<number>>()

        for (const row of snapshotsRes.rows) {
            const shiftId = String(row.shift_id)
            const warehouseId = Number(row.warehouse_id)
            const shiftEntry = shiftMap.get(shiftId)
            const zoneEntry = zoneMap.get(warehouseId)
            if (!shiftEntry || !zoneEntry) continue

            const createdAt = row.created_at ? new Date(row.created_at).toISOString() : null
            shiftEntry.last_snapshot_at = shiftEntry.last_snapshot_at && createdAt
                ? (new Date(shiftEntry.last_snapshot_at).getTime() > new Date(createdAt).getTime() ? shiftEntry.last_snapshot_at : createdAt)
                : (shiftEntry.last_snapshot_at || createdAt)

            if (row.snapshot_type === 'OPEN') {
                if (!shiftOpenZones.has(shiftId)) shiftOpenZones.set(shiftId, new Set<number>())
                shiftOpenZones.get(shiftId)!.add(warehouseId)
                zoneEntry.open_snapshots_count += 1
                if (!zoneEntry.latest_open_at || (createdAt && new Date(createdAt).getTime() > new Date(zoneEntry.latest_open_at).getTime())) {
                    zoneEntry.latest_open_at = createdAt
                }
            }

            if (row.snapshot_type === 'CLOSE') {
                if (!shiftCloseZones.has(shiftId)) shiftCloseZones.set(shiftId, new Set<number>())
                shiftCloseZones.get(shiftId)!.add(warehouseId)
                zoneEntry.close_snapshots_count += 1
                if (!zoneEntry.latest_close_at || (createdAt && new Date(createdAt).getTime() > new Date(zoneEntry.latest_close_at).getTime())) {
                    zoneEntry.latest_close_at = createdAt
                }
            }
        }

        let discrepancyShiftsCount = 0
        let discrepancyTotalAbs = 0

        for (const shiftId of shiftIds) {
            const shiftEntry = shiftMap.get(shiftId)
            if (!shiftEntry) continue

            shiftEntry.open_zones_count = shiftOpenZones.get(shiftId)?.size || 0
            shiftEntry.close_zones_count = shiftCloseZones.get(shiftId)?.size || 0

            if (shiftEntry.open_zones_count >= totalZones && shiftEntry.close_zones_count >= totalZones) {
                shiftEntry.status = 'COMPLETE'
            } else if (shiftEntry.open_zones_count >= totalZones && shiftEntry.close_zones_count === 0) {
                shiftEntry.status = 'OPEN_ONLY'
            } else if (shiftEntry.close_zones_count > 0 && shiftEntry.open_zones_count === 0) {
                shiftEntry.status = 'CLOSE_ONLY'
            } else {
                shiftEntry.status = 'PARTIAL'
            }

            const discrepancyRows = await getShiftZoneDiscrepancyReportInternal(client, clubId, shiftId, sessionUserId)
            const discrepancyItemsCount = discrepancyRows.length
            const discrepancyAbs = discrepancyRows.reduce((sum, row) => sum + Math.abs(Number(row.difference_quantity || 0)), 0)

            shiftEntry.discrepancy_items_count = discrepancyItemsCount
            shiftEntry.discrepancy_total_abs = discrepancyAbs

            if (discrepancyItemsCount > 0) {
                discrepancyShiftsCount += 1
                discrepancyTotalAbs += discrepancyAbs
            }

            const discrepancyWarehouses = new Set<number>()
            for (const row of discrepancyRows) {
                const zoneEntry = zoneMap.get(Number(row.warehouse_id)) || warehouseById.get(Number(row.warehouse_id))
                if (!zoneEntry || !("discrepancy_items_count" in zoneEntry)) continue
                zoneEntry.discrepancy_items_count += 1
                zoneEntry.discrepancy_total_abs += Math.abs(Number(row.difference_quantity || 0))
                discrepancyWarehouses.add(Number(row.warehouse_id))
            }
            for (const warehouseId of discrepancyWarehouses) {
                const zoneEntry = zoneMap.get(warehouseId)
                if (zoneEntry) {
                    zoneEntry.discrepancy_shifts_count += 1
                }
            }
        }

        const recent_shifts = Array.from(shiftMap.values()).sort(
            (a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime()
        )
        const zones = Array.from(zoneMap.values()).sort((a, b) => a.warehouse_name.localeCompare(b.warehouse_name, 'ru'))

        return {
            summary: {
                recent_shifts_count: recent_shifts.length,
                configured_zones_count: totalZones,
                complete_shifts_count: recent_shifts.filter((shift) => shift.status === 'COMPLETE').length,
                discrepancy_shifts_count: discrepancyShiftsCount,
                discrepancy_total_abs: discrepancyTotalAbs,
            },
            recent_shifts,
            zones,
        } satisfies ShiftZoneOverview
    } finally {
        client.release()
    }
}

export async function deleteWarehouse(id: number, clubId: string, userId: string) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // 1. Check if warehouse has stock
        const stockRes = await client.query('SELECT SUM(quantity) as total FROM warehouse_stock WHERE warehouse_id = $1', [id])
        const totalStock = parseFloat(stockRes.rows[0]?.total || '0')
        
        if (totalStock > 0) {
            throw new Error('Нельзя удалить склад, на котором есть товары. Сначала переместите их или спишите.')
        }

        // 2. Check if it's default warehouse
        const whRes = await client.query('SELECT is_default FROM warehouses WHERE id = $1', [id])
        if (whRes.rows[0]?.is_default) {
            throw new Error('Нельзя удалить основной склад клуба.')
        }

        // 3. Delete replenishment rules where this warehouse is source or target
        await client.query('DELETE FROM warehouse_replenishment_rules WHERE source_warehouse_id = $1 OR target_warehouse_id = $2', [id, id])

        // 4. Delete the warehouse
        await client.query('DELETE FROM warehouses WHERE id = $1', [id])

        await logOperation(clubId, userId, 'DELETE_WAREHOUSE', 'WAREHOUSE', id)
        await client.query('COMMIT')
        
        revalidatePath(`/clubs/${clubId}/inventory`)
        return { success: true }
    } catch (e: any) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

export async function getEmployees(clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT u.id, u.full_name, COALESCE(ce.role, 'Сотрудник') as role 
        FROM club_employees ce
        JOIN users u ON ce.user_id = u.id
        WHERE ce.club_id = $1 AND ce.is_active = true
        ORDER BY u.full_name
    `, [clubId])
    return res.rows as { id: string, full_name: string, role: string }[]
}

export type SalarySaleCandidate = {
    id: string
    full_name: string
    role: string
    reference_shift_id: string
    shifts_in_month: number
    available_amount: number
}

async function getSalarySaleCandidatesInternal(client: any, clubId: string) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const res = await client.query(
        `
        WITH month_shifts AS (
            SELECT
                s.user_id,
                s.id,
                s.check_in,
                COALESCE(s.calculated_salary, 0) as calculated_salary,
                COALESCE(s.bar_purchases, 0) as bar_purchases
            FROM shifts s
            WHERE s.club_id = $1
              AND s.check_in >= $2
              AND s.check_in <= $3
              AND s.status IN ('CLOSED', 'PAID', 'VERIFIED', 'ACTIVE')
        ),
        latest_shift AS (
            SELECT DISTINCT ON (user_id)
                user_id,
                id as reference_shift_id,
                check_in
            FROM month_shifts
            ORDER BY user_id, check_in DESC, id DESC
        ),
        shift_agg AS (
            SELECT
                user_id,
                COUNT(*)::int as shifts_in_month,
                SUM(calculated_salary)::numeric as earned_amount,
                SUM(bar_purchases)::numeric as bar_purchases_amount
            FROM month_shifts
            GROUP BY user_id
        ),
        payments_agg AS (
            SELECT
                p.user_id,
                SUM(p.amount) FILTER (WHERE p.payment_type != 'bonus')::numeric as paid_amount
            FROM payments p
            WHERE p.club_id = $1
              AND p.month = $4
              AND p.year = $5
            GROUP BY p.user_id
        )
        SELECT
            u.id,
            u.full_name,
            COALESCE(ce.role, 'Сотрудник') as role,
            ls.reference_shift_id,
            sa.shifts_in_month,
            GREATEST(
                COALESCE(sa.earned_amount, 0) - COALESCE(pa.paid_amount, 0) - COALESCE(sa.bar_purchases_amount, 0),
                0
            )::numeric as available_amount
        FROM club_employees ce
        JOIN users u ON u.id = ce.user_id
        JOIN shift_agg sa ON sa.user_id = ce.user_id
        JOIN latest_shift ls ON ls.user_id = ce.user_id
        LEFT JOIN payments_agg pa ON pa.user_id = ce.user_id
        WHERE ce.club_id = $1
          AND ce.is_active = true
          AND ce.dismissed_at IS NULL
        ORDER BY
            CASE WHEN COALESCE(ce.role, '') IN ('Админ', 'Управляющий', 'Владелец') THEN 0 ELSE 1 END,
            u.full_name
        `,
        [clubId, monthStart.toISOString(), monthEnd.toISOString(), now.getMonth() + 1, now.getFullYear()]
    )

    return res.rows.map((row: any) => ({
        id: String(row.id),
        full_name: String(row.full_name),
        role: String(row.role || 'Сотрудник'),
        reference_shift_id: String(row.reference_shift_id),
        shifts_in_month: Number(row.shifts_in_month || 0),
        available_amount: Number(row.available_amount || 0),
    })) as SalarySaleCandidate[]
}

export async function getSalarySaleCandidates(clubId: string) {
    await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        return await getSalarySaleCandidatesInternal(client, clubId)
    } finally {
        client.release()
    }
}

export async function transferStock(clubId: string, userId: string, data: { source_warehouse_id: number, target_warehouse_id: number, product_id: number, quantity: number, notes?: string }) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        const { source_warehouse_id, target_warehouse_id, product_id, quantity } = data
        if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
            throw new Error("Количество для перемещения должно быть целым положительным числом")
        }
        await assertWarehouseBelongsToClub(client, clubId, source_warehouse_id)
        await assertWarehouseBelongsToClub(client, clubId, target_warehouse_id)
        await assertProductBelongsToClub(client, clubId, product_id)
        await assertUserCanUseWarehouses(client, clubId, userId, [source_warehouse_id, target_warehouse_id])

        if (source_warehouse_id === target_warehouse_id) {
            throw new Error('Склады отправления и назначения должны быть разными')
        }

        // 1. Check source stock
        const sourceStockRes = await client.query('SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE', [source_warehouse_id, product_id])
        const sourcePrevStock = sourceStockRes.rows[0]?.quantity || 0
        
        if (sourcePrevStock < quantity) {
            throw new Error(`Недостаточно товара на складе отправления. Доступно: ${sourcePrevStock}`)
        }

        // 2. Update source stock
        const { previousStock: sourcePrev, newStock: sourceNewStock } = await applyWarehouseStockDelta(
            client,
            source_warehouse_id,
            product_id,
            -quantity
        )

        // 3. Update target stock
        const { previousStock: targetPrevStock, newStock: targetNewStock } = await applyWarehouseStockDelta(
            client,
            target_warehouse_id,
            product_id,
            quantity
        )

        // 4. Log movements
        const notes = data.notes ? `: ${data.notes}` : ''
        
        // Log out from source
        await logStockMovement(
            client, clubId, userId, product_id, -quantity, sourcePrev, sourceNewStock, 
            'ADJUSTMENT', `Перемещение на склад #${target_warehouse_id}${notes}`, 
            'TRANSFER', null, null, source_warehouse_id
        )
        
        // Log in to target
        await logStockMovement(
            client, clubId, userId, product_id, quantity, targetPrevStock, targetNewStock, 
            'ADJUSTMENT', `Перемещение со склада #${source_warehouse_id}${notes}`, 
            'TRANSFER', null, null, target_warehouse_id
        )

        await client.query('COMMIT')
        revalidatePath(`/clubs/${clubId}/inventory`)
        revalidatePath(`/clubs/${clubId}/inventory`, 'layout')
        return { success: true }
    } catch (e: any) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

export async function createTransfer(clubId: string, userId: string, data: { source_warehouse_id: number, target_warehouse_id: number, items: { product_id: number, quantity: number }[], notes?: string, shift_id?: string }) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        const { source_warehouse_id, target_warehouse_id, items, notes, shift_id } = data
        if (!items || items.length === 0) throw new Error("Нужно выбрать товары для перемещения")
        for (const i of items) {
            if (!Number.isFinite(i.quantity) || !Number.isInteger(i.quantity) || i.quantity <= 0) {
                throw new Error("Количество для перемещения должно быть целым положительным числом")
            }
        }
        await assertWarehouseBelongsToClub(client, clubId, source_warehouse_id)
        await assertWarehouseBelongsToClub(client, clubId, target_warehouse_id)
        await assertProductsBelongToClub(client, clubId, items.map(i => i.product_id))
        await assertUserCanUseWarehouses(client, clubId, userId, [source_warehouse_id, target_warehouse_id])

        if (source_warehouse_id === target_warehouse_id) {
            throw new Error('Склады отправления и назначения должны быть разными')
        }

        for (const item of items) {
            const { product_id, quantity } = item

            // 1. Check source stock
            const sourceStockRes = await client.query('SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE', [source_warehouse_id, product_id])
            const sourcePrevStock = sourceStockRes.rows[0]?.quantity || 0
            
            if (sourcePrevStock < quantity) {
                const prodRes = await client.query('SELECT name FROM warehouse_products WHERE id = $1 AND club_id = $2', [product_id, clubId])
                throw new Error(`Недостаточно товара "${prodRes.rows[0]?.name || `#${product_id}`}" на складе отправления. Доступно: ${sourcePrevStock}`)
            }

            // 2. Update source stock
            const { previousStock: sourcePrev, newStock: sourceNewStock } = await applyWarehouseStockDelta(
                client,
                source_warehouse_id,
                product_id,
                -quantity
            )

            // 3. Update target stock
            const { previousStock: targetPrevStock, newStock: targetNewStock } = await applyWarehouseStockDelta(
                client,
                target_warehouse_id,
                product_id,
                quantity
            )

            // 4. Log movements
            const notesStr = notes ? `: ${notes}` : ''
            
            // Log out from source
            await logStockMovement(
                client, clubId, userId, product_id, -quantity, sourcePrev, sourceNewStock,
                'TRANSFER', `Перемещение на склад #${target_warehouse_id}${notesStr}`,
                'TRANSFER', null, shift_id || null, source_warehouse_id
            )
            
            // Log in to target
            await logStockMovement(
                client, clubId, userId, product_id, quantity, targetPrevStock, targetNewStock,
                'TRANSFER', `Перемещение со склада #${source_warehouse_id}${notesStr}`,
                'TRANSFER', null, shift_id || null, target_warehouse_id
            )

            // 5. Update product cache
            await client.query(`
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1 AND club_id = $2
            `, [product_id, clubId])

            // 6. AUTO-CLOSE RESTOCK TASKS
            // If we are moving TO a warehouse that is a Target in some RESTOCK rule,
            // we check if that rule's requirements are now met.
            await client.query(`
                UPDATE club_tasks 
                SET status = 'COMPLETED', 
                    completed_by = $1, 
                    completed_at = NOW(),
                    description = description || ' (Закрыто автоматически: ручное перемещение)'
                WHERE club_id = $2 
                  AND type = 'RESTOCK' 
                  AND status != 'COMPLETED'
                  AND related_entity_type = 'PRODUCT' 
                  AND related_entity_id = $3
                  AND EXISTS (
                      SELECT 1 FROM warehouse_replenishment_rules r
                      JOIN warehouses tw ON r.target_warehouse_id = tw.id
                      WHERE r.product_id = $3
                        AND r.target_warehouse_id = $4
                        AND r.is_active = true
                        AND (
                            -- Task is related to this warehouse
                            club_tasks.description LIKE '%' || tw.name || '%'
                        )
                  )
            `, [userId, clubId, product_id, target_warehouse_id])
        }

        await client.query('COMMIT')
        revalidatePath(`/clubs/${clubId}/inventory`)
        revalidatePath(`/employee/clubs/${clubId}`)
        return { success: true }
    } catch (e: any) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

export async function getStockMovements(clubId: string, limit: number = 100) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT m.*, p.name as product_name, u.full_name as user_name, w.name as warehouse_name
        FROM warehouse_stock_movements m
        JOIN warehouse_products p ON m.product_id = p.id
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN warehouses w ON m.warehouse_id = w.id
        WHERE m.club_id = $1
        ORDER BY m.created_at DESC
        LIMIT $2
    `, [clubId, limit])
    return res.rows
}

export interface ReplenishmentRule {
    id: number
    source_warehouse_id: number
    target_warehouse_id: number
    product_id: number
    min_stock_level: number
    max_stock_level: number
    source_warehouse_name?: string
    target_warehouse_name?: string
}

export async function getReplenishmentRulesForProduct(clubId: string, productId: number) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT r.*, 
               sw.name as source_warehouse_name, 
               tw.name as target_warehouse_name
        FROM warehouse_replenishment_rules r
        JOIN warehouses sw ON r.source_warehouse_id = sw.id
        JOIN warehouses tw ON r.target_warehouse_id = tw.id
        WHERE r.product_id = $2
          AND sw.club_id = $1
          AND tw.club_id = $1
    `, [clubId, productId])
    return res.rows as ReplenishmentRule[]
}

// --- REPLENISHMENT RULES ---

export async function getReplenishmentRules(clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT r.*, 
               sw.name as source_warehouse_name, 
               tw.name as target_warehouse_name,
               p.name as product_name
        FROM warehouse_replenishment_rules r
        JOIN warehouses sw ON r.source_warehouse_id = sw.id
        JOIN warehouses tw ON r.target_warehouse_id = tw.id
        JOIN warehouse_products p ON r.product_id = p.id
        WHERE sw.club_id = $1
    `, [clubId])
    return res.rows
}

export async function createReplenishmentRule(clubId: string, data: { source_warehouse_id: number, target_warehouse_id: number, product_id: number, min_stock_level: number, max_stock_level: number }) {
    await requireClubAccess(clubId)
    const checks = await query(
        `
        SELECT
          (SELECT 1 FROM warehouses WHERE id = $2 AND club_id = $1) as source_ok,
          (SELECT 1 FROM warehouses WHERE id = $3 AND club_id = $1) as target_ok,
          (SELECT 1 FROM warehouse_products WHERE id = $4 AND club_id = $1) as product_ok
        `,
        [clubId, data.source_warehouse_id, data.target_warehouse_id, data.product_id]
    )
    const row = checks.rows[0] || {}
    if (!row.source_ok || !row.target_ok) throw new Error("Склад не найден или не принадлежит клубу")
    if (!row.product_ok) throw new Error("Товар не найден или не принадлежит клубу")

    await query(`
        INSERT INTO warehouse_replenishment_rules (source_warehouse_id, target_warehouse_id, product_id, min_stock_level, max_stock_level)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (source_warehouse_id, target_warehouse_id, product_id) 
        DO UPDATE SET min_stock_level = $4, max_stock_level = $5, is_active = true
    `, [data.source_warehouse_id, data.target_warehouse_id, data.product_id, data.min_stock_level, data.max_stock_level])
    
    // Check if task needed immediately
    await checkReplenishmentNeeds(clubId)
    
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function deleteReplenishmentRule(id: number, clubId: string) {
    await requireClubAccess(clubId)
    await query(
        `
        DELETE FROM warehouse_replenishment_rules r
        USING warehouses sw, warehouses tw
        WHERE r.id = $1
          AND r.source_warehouse_id = sw.id
          AND r.target_warehouse_id = tw.id
          AND sw.club_id = $2
          AND tw.club_id = $2
        `,
        [id, clubId]
    )
    revalidatePath(`/clubs/${clubId}/inventory`)
}

// Check and generate tasks
async function checkReplenishmentNeeds(clubId: string) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // Find rules where Target Stock <= Min Level
        const needs = await client.query(`
            SELECT r.*, 
                   COALESCE(ws_target.quantity, 0) as current_target_stock,
                   COALESCE(ws_source.quantity, 0) as current_source_stock,
                   p.name as product_name,
                   tw.name as target_warehouse_name
            FROM warehouse_replenishment_rules r
            JOIN warehouses tw ON r.target_warehouse_id = tw.id
            JOIN warehouses sw ON r.source_warehouse_id = sw.id
            JOIN warehouse_products p ON r.product_id = p.id
            LEFT JOIN warehouse_stock ws_target ON r.target_warehouse_id = ws_target.warehouse_id AND r.product_id = ws_target.product_id
            LEFT JOIN warehouse_stock ws_source ON r.source_warehouse_id = ws_source.warehouse_id AND r.product_id = ws_source.product_id
            WHERE r.is_active = true
              AND tw.club_id = $1
              AND sw.club_id = $1
              AND p.club_id = $1
        `, [clubId])
        
        for (const rule of needs.rows) {
            const current = rule.current_target_stock || 0
            const source = rule.current_source_stock || 0
            
            if (current <= rule.min_stock_level && source > 0) {
                // Need restock
                const amountNeeded = rule.max_stock_level - current
                if (amountNeeded <= 0) {
                    // If current is enough but task exists, close it
                    await client.query(`
                        UPDATE club_tasks 
                        SET status = 'COMPLETED', 
                            completed_at = NOW(),
                            description = description || ' (Закрыто автоматически: товара достаточно)'
                        WHERE club_id = $1 AND type = 'RESTOCK' AND related_entity_id = $2 AND status != 'COMPLETED'
                        AND description LIKE $3
                    `, [clubId, rule.product_id, `%${rule.target_warehouse_name}%`])
                    continue
                }
                
                // Check if task exists
                const existing = await client.query(`
                    SELECT 1 FROM club_tasks 
                    WHERE club_id = $1 AND type = 'RESTOCK' AND related_entity_id = $2 AND status != 'COMPLETED'
                    AND description LIKE $3
                `, [clubId, rule.product_id, `%${rule.target_warehouse_name}%`])
                
                if (existing.rowCount === 0) {
                    await client.query(`
                        INSERT INTO club_tasks (club_id, type, title, description, priority, related_entity_type, related_entity_id)
                        VALUES ($1, 'RESTOCK', $2, $3, 'HIGH', 'PRODUCT', $4)
                    `, [
                        clubId, 
                        `Пополнить: ${rule.product_name}`, 
                        `Из: ${rule.source_warehouse_name} → В: ${rule.target_warehouse_name}. Пополнить до ${rule.max_stock_level} шт. (Сейчас: ${current})`, 
                        rule.product_id
                    ])
                }
            } else if (current > rule.min_stock_level) {
                // If stock is already above min level, any existing restock task for this product/target should be closed
                await client.query(`
                    UPDATE club_tasks 
                    SET status = 'COMPLETED', 
                        completed_at = NOW(),
                        description = description || ' (Закрыто автоматически: товара достаточно)'
                    WHERE club_id = $1 AND type = 'RESTOCK' AND related_entity_id = $2 AND status != 'COMPLETED'
                    AND description LIKE $3
                `, [clubId, rule.product_id, `%${rule.target_warehouse_name}%`])
            }
        }
        
        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        console.error("Error checking replenishment:", e)
    } finally {
        client.release()
    }
}

// Override completeTask to handle warehouse transfers
export async function completeTask(taskId: number, userId: string, clubId: string) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        const taskRes = await client.query('SELECT * FROM club_tasks WHERE id = $1 AND club_id = $2', [taskId, clubId])
        const task = taskRes.rows[0]
        if (!task) throw new Error('Задача не найдена')

        if (task.type === 'RESTOCK' && task.related_entity_type === 'PRODUCT') {
            const productId = task.related_entity_id
            
            // Try to find matching rule to execute transfer
            // We parse target warehouse name from description or find active rule for this product
            // Simplest: Find ANY active rule for this product where condition is met
            
            const rules = await client.query(`
                SELECT r.*, ws_target.quantity as current
                FROM warehouse_replenishment_rules r
                LEFT JOIN warehouse_stock ws_target ON r.target_warehouse_id = ws_target.warehouse_id AND r.product_id = ws_target.product_id
                JOIN warehouses tw ON r.target_warehouse_id = tw.id
                JOIN warehouses sw ON r.source_warehouse_id = sw.id
                WHERE r.product_id = $1 AND r.is_active = true
                  AND tw.club_id = $2 AND sw.club_id = $2
            `, [productId, clubId])
            
            for (const rule of rules.rows) {
                const current = rule.current || 0
                if (current <= rule.min_stock_level) {
                    const amountNeeded = rule.max_stock_level - current
                    
                    // Check source stock
                    const sourceRes = await client.query(
                        'SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
                        [rule.source_warehouse_id, productId]
                    )
                    const sourceStock = Number(sourceRes.rows[0]?.quantity || 0)
                    
                    const transferAmount = Math.min(amountNeeded, sourceStock)
                    
                    if (transferAmount > 0) {
                        const { previousStock: sourcePrev, newStock: sourceNew } = await applyWarehouseStockDelta(
                            client,
                            rule.source_warehouse_id,
                            productId,
                            -transferAmount
                        )
                        const { previousStock: targetPrev, newStock: targetNew } = await applyWarehouseStockDelta(
                            client,
                            rule.target_warehouse_id,
                            productId,
                            transferAmount
                        )

                        await logStockMovement(
                            client,
                            clubId,
                            userId,
                            productId,
                            -transferAmount,
                            sourcePrev,
                            sourceNew,
                            'INTERNAL_MOVE',
                            `To ${rule.target_warehouse_id}`,
                            'WAREHOUSE',
                            rule.source_warehouse_id,
                            null,
                            rule.source_warehouse_id
                        )
                        await logStockMovement(
                            client,
                            clubId,
                            userId,
                            productId,
                            transferAmount,
                            targetPrev,
                            targetNew,
                            'INTERNAL_MOVE',
                            `From ${rule.source_warehouse_id}`,
                            'WAREHOUSE',
                            rule.target_warehouse_id,
                            null,
                            rule.target_warehouse_id
                        )
                    }
                }
            }
        }

        await client.query(`
            UPDATE club_tasks 
            SET status = 'COMPLETED', completed_by = $1, completed_at = NOW()
            WHERE id = $2
        `, [userId, taskId])

        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}`)
}

// --- ANALYTICS & PROCUREMENT ---

export async function calculateAnalytics(clubId: string) {
    await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        await client.query(`
            UPDATE warehouse_products p
            SET sales_velocity = COALESCE((
                WITH FirstSale AS (
                    SELECT product_id, MIN(created_at) as first_sale_date
                    FROM warehouse_stock_movements
                    WHERE type = 'SALE'
                      AND COALESCE(related_entity_type, '') != 'SHIFT_RECEIPT_VOID'
                    GROUP BY product_id
                ),
                NetSales AS (
                    SELECT
                        m.product_id,
                        SUM(
                            CASE
                                WHEN m.type = 'SALE' AND COALESCE(m.related_entity_type, '') = 'SHIFT_RECEIPT_VOID' THEN -ABS(m.change_amount)
                                WHEN m.type = 'RETURN' THEN -ABS(m.change_amount)
                                WHEN m.type = 'SALE' THEN ABS(m.change_amount)
                                ELSE 0
                            END
                        )::numeric as net_units
                    FROM warehouse_stock_movements m
                    LEFT JOIN shift_receipts sr ON m.related_entity_type = 'SHIFT_RECEIPT' AND m.related_entity_id = sr.id
                    WHERE m.created_at > NOW() - INTERVAL '30 days'
                      AND m.type IN ('SALE', 'RETURN')
                      AND COALESCE(sr.counts_in_revenue, true) = true
                    GROUP BY m.product_id
                )
                SELECT 
                    GREATEST(0, ns.net_units) / 
                    GREATEST(1, LEAST(30, CEIL(EXTRACT(EPOCH FROM (NOW() - fs.first_sale_date)) / 86400.0)))
                FROM FirstSale fs
                JOIN NetSales ns ON ns.product_id = fs.product_id
                WHERE fs.product_id = p.id
                GROUP BY fs.first_sale_date, ns.net_units
            ), 0)
            WHERE club_id = $1
        `, [clubId])

        const revenueData = await client.query(`
            WITH ProductRevenue AS (
                SELECT 
                    p.id as product_id,
                    COALESCE(SUM(
                        CASE
                            WHEN m.type = 'SALE' AND COALESCE(m.related_entity_type, '') = 'SHIFT_RECEIPT_VOID'
                                THEN -ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            WHEN m.type = 'RETURN'
                                THEN -ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            WHEN m.type = 'SALE'
                                THEN ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            ELSE 0
                        END
                    ), 0) as total_revenue
                FROM warehouse_products p
                LEFT JOIN warehouse_stock_movements m ON p.id = m.product_id 
                    AND m.type IN ('SALE', 'RETURN')
                    AND m.created_at > NOW() - INTERVAL '30 days'
                LEFT JOIN shift_receipts sr ON m.related_entity_type = 'SHIFT_RECEIPT' AND m.related_entity_id = sr.id
                WHERE p.club_id = $1 AND p.is_active = true
                  AND COALESCE(sr.counts_in_revenue, true) = true
                GROUP BY p.id
            ),
            TotalStats AS (
                SELECT SUM(total_revenue) as grand_total FROM ProductRevenue
            ),
            RankedProducts AS (
                SELECT 
                    product_id,
                    total_revenue,
                    SUM(total_revenue) OVER (ORDER BY total_revenue DESC) as running_total,
                    (SELECT grand_total FROM TotalStats) as grand_total
                FROM ProductRevenue
            )
            SELECT 
                product_id,
                total_revenue,
                CASE 
                    WHEN grand_total = 0 THEN 'C'
                    WHEN (running_total - total_revenue) < grand_total * 0.8 THEN 'A'
                    WHEN (running_total - total_revenue) < grand_total * 0.95 THEN 'B'
                    ELSE 'C'
                END as new_abc_category
            FROM RankedProducts
        `, [clubId])

        for (const row of revenueData.rows) {
            await client.query(`
                UPDATE warehouse_products 
                SET abc_category = $1 
                WHERE id = $2
            `, [row.new_abc_category, row.product_id])
        }
        
        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        console.error(e)
    } finally {
        client.release()
    }
}

export async function generateProcurementList(clubId: string, userId: string, mode: ProcurementMode = "optimized") {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // 1. Update Analytics first to have fresh data
        await calculateAnalytics(clubId)
        
        // 2. Create Draft List
        const listRes = await client.query(`
            INSERT INTO warehouse_procurement_lists (club_id, created_by, status, name)
            VALUES (
                $1,
                $2,
                'DRAFT',
                CASE
                    WHEN $3 = 'full' THEN 'Полное пополнение ' || TO_CHAR(NOW(), 'DD.MM.YYYY')
                    ELSE 'Оптимизированная закупка ' || TO_CHAR(NOW(), 'DD.MM.YYYY')
                END
            )
            RETURNING id
        `, [clubId, userId, mode])
        const listId = listRes.rows[0].id
        
        const products = await client.query(`
            SELECT 
                id, name, current_stock, min_stock_level, sales_velocity, ideal_stock_days, abc_category, units_per_box
            FROM warehouse_products
            WHERE club_id = $1 AND is_active = true
        `, [clubId])

        const procurementCandidates = products.rows
            .map((product) => ({
                product,
                candidate: getProcurementCandidate(product, mode)
            }))
            .filter((entry): entry is { product: any, candidate: ProcurementCandidate } => Boolean(entry.candidate))
            .sort((a, b) => {
                const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 }
                const priorityDiff = priorityOrder[a.candidate.priority] - priorityOrder[b.candidate.priority]
                if (priorityDiff !== 0) return priorityDiff

                const abcOrder = { A: 0, B: 1, C: 2 }
                const abcDiff = (abcOrder[String(a.product.abc_category || "C") as keyof typeof abcOrder] ?? 2)
                    - (abcOrder[String(b.product.abc_category || "C") as keyof typeof abcOrder] ?? 2)
                if (abcDiff !== 0) return abcDiff

                const aDays = a.candidate.days_left ?? Number.POSITIVE_INFINITY
                const bDays = b.candidate.days_left ?? Number.POSITIVE_INFINITY
                if (aDays !== bDays) return aDays - bDays

                return String(a.product.name).localeCompare(String(b.product.name))
            })

        for (const { product: p } of procurementCandidates) {
            const boxSize = normalizeProcurementBoxSize(p.units_per_box)
            const suggested = calculateSuggestedProcurementQuantity(p, mode)
            if (suggested <= 0) continue
            
            await client.query(`
                INSERT INTO warehouse_procurement_items (list_id, product_id, current_stock, suggested_quantity, actual_quantity, units_per_box)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [listId, p.id, p.current_stock, suggested, suggested, boxSize])
        }
        
        await client.query('COMMIT')
        revalidatePath(`/clubs/${clubId}/inventory`)
        return listId
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

export async function getProcurementLists(clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT l.*, u.full_name as creator_name,
               (SELECT COUNT(*) FROM warehouse_procurement_items WHERE list_id = l.id) as items_count
        FROM warehouse_procurement_lists l
        LEFT JOIN users u ON l.created_by = u.id
        WHERE l.club_id = $1
        ORDER BY l.created_at DESC
    `, [clubId])
    return res.rows
}

export async function getProcurementListItems(clubId: string, listId: number) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT i.*, p.name as product_name, p.cost_price, p.sales_velocity, p.ideal_stock_days, p.abc_category,
               i.units_per_box as units_per_box,
               CASE 
                   WHEN p.sales_velocity > 0 THEN p.current_stock / p.sales_velocity 
                   ELSE NULL 
               END as days_left,
               CASE
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'A' AND (p.current_stock < COALESCE(p.min_stock_level, 0) OR (COALESCE(p.sales_velocity, 0) > 0 AND p.current_stock / p.sales_velocity < 2))
                       THEN 'CRITICAL'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'A'
                       THEN 'HIGH'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') IN ('B', 'C')
                       THEN 'MEDIUM'
                   WHEN COALESCE(p.abc_category, 'C') = 'C' AND p.current_stock <= 0 AND COALESCE(p.sales_velocity, 0) > 0
                       THEN 'CRITICAL'
                   WHEN COALESCE(p.abc_category, 'C') = 'A' AND (p.current_stock < COALESCE(p.min_stock_level, 0) OR (COALESCE(p.sales_velocity, 0) > 0 AND p.current_stock / p.sales_velocity < 2))
                       THEN 'CRITICAL'
                   WHEN COALESCE(p.abc_category, 'C') = 'A'
                       THEN 'HIGH'
                   WHEN COALESCE(p.abc_category, 'C') = 'B' AND (p.current_stock < COALESCE(p.min_stock_level, 0) OR (COALESCE(p.sales_velocity, 0) > 0 AND p.current_stock / p.sales_velocity < 2))
                       THEN 'HIGH'
                   WHEN COALESCE(p.abc_category, 'C') = 'B'
                       THEN 'MEDIUM'
                   ELSE 'MANUAL'
               END as procurement_priority,
               CASE
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'A' AND p.current_stock < COALESCE(p.min_stock_level, 0)
                       THEN 'Полное пополнение: категория A ниже минимального остатка'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'A'
                       THEN 'Полное пополнение: категория A подходит к точке дозаказа'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'B' AND p.current_stock < COALESCE(p.min_stock_level, 0)
                       THEN 'Полное пополнение: категория B ниже минимального остатка'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'B'
                       THEN 'Полное пополнение: категория B подходит к точке дозаказа'
                   WHEN l.name ILIKE 'Полное пополнение%' AND COALESCE(p.abc_category, 'C') = 'C'
                       THEN 'Полное пополнение: категория C включена для широкого запаса'
                   WHEN COALESCE(p.abc_category, 'C') = 'C' AND p.current_stock <= 0 AND COALESCE(p.sales_velocity, 0) > 0
                       THEN 'Категория C, но остаток обнулился по продаваемому товару'
                   WHEN COALESCE(p.abc_category, 'C') = 'A' AND p.current_stock < COALESCE(p.min_stock_level, 0)
                       THEN 'Категория A ниже минимального остатка'
                   WHEN COALESCE(p.abc_category, 'C') = 'A'
                       THEN 'Категория A подходит к точке дозаказа'
                   WHEN COALESCE(p.abc_category, 'C') = 'B' AND p.current_stock < COALESCE(p.min_stock_level, 0)
                       THEN 'Категория B ниже минимального остатка'
                   WHEN COALESCE(p.abc_category, 'C') = 'B'
                       THEN 'Категория B подходит к точке дозаказа'
                   ELSE 'Добавлено вручную'
               END as procurement_reason
        FROM warehouse_procurement_items i
        JOIN warehouse_procurement_lists l ON i.list_id = l.id
        JOIN warehouse_products p ON i.product_id = p.id
        WHERE l.club_id = $1 AND i.list_id = $2
        ORDER BY 
            CASE
                WHEN COALESCE(p.abc_category, 'C') = 'C' AND p.current_stock <= 0 AND COALESCE(p.sales_velocity, 0) > 0 THEN 0
                WHEN COALESCE(p.abc_category, 'C') = 'A' AND (p.current_stock < COALESCE(p.min_stock_level, 0) OR (COALESCE(p.sales_velocity, 0) > 0 AND p.current_stock / p.sales_velocity < 2)) THEN 1
                WHEN COALESCE(p.abc_category, 'C') = 'A' THEN 2
                WHEN COALESCE(p.abc_category, 'C') = 'B' AND (p.current_stock < COALESCE(p.min_stock_level, 0) OR (COALESCE(p.sales_velocity, 0) > 0 AND p.current_stock / p.sales_velocity < 2)) THEN 3
                WHEN COALESCE(p.abc_category, 'C') = 'B' THEN 4
                ELSE 5
            END,
            p.name
    `, [clubId, listId])
    return res.rows
}

export async function updateProcurementItem(itemId: number, data: { quantity?: number, units_per_box?: number }, clubId: string) {
    await requireClubAccess(clubId)
    if (data.quantity !== undefined) {
        await query(
            `
            UPDATE warehouse_procurement_items i
            SET actual_quantity = $1
            FROM warehouse_procurement_lists l
            WHERE i.id = $2 AND i.list_id = l.id AND l.club_id = $3
            `,
            [data.quantity, itemId, clubId]
        )
    }
    if (data.units_per_box !== undefined) {
        await query(
            `
            UPDATE warehouse_procurement_items i
            SET units_per_box = $1
            FROM warehouse_procurement_lists l
            WHERE i.id = $2 AND i.list_id = l.id AND l.club_id = $3
            `,
            [data.units_per_box, itemId, clubId]
        )
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function bulkUpdateProcurementItems(items: { id: number, quantity: number }[], clubId: string) {
    await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        for (const item of items) {
            await client.query(
                `
                UPDATE warehouse_procurement_items i
                SET actual_quantity = $1
                FROM warehouse_procurement_lists l
                WHERE i.id = $2 AND i.list_id = l.id AND l.club_id = $3
                `,
                [item.quantity, item.id, clubId]
            )
        }
        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function deleteProcurementItem(itemId: number, clubId: string) {
    await requireClubAccess(clubId)
    await query(
        `
        DELETE FROM warehouse_procurement_items i
        USING warehouse_procurement_lists l
        WHERE i.id = $1 AND i.list_id = l.id AND l.club_id = $2
        `,
        [itemId, clubId]
    )
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function addProductToProcurementList(listId: number, productId: number, clubId: string) {
    await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // Check if already in list
        const existing = await client.query(
            `
            SELECT i.id
            FROM warehouse_procurement_items i
            JOIN warehouse_procurement_lists l ON i.list_id = l.id
            WHERE i.list_id = $1 AND i.product_id = $2 AND l.club_id = $3
            `,
            [listId, productId, clubId]
        )
        if (existing.rowCount && existing.rowCount > 0) {
            throw new Error("Товар уже есть в списке")
        }

        // Get product data for initial suggestion
        const productRes = await client.query(
            'SELECT current_stock, sales_velocity, ideal_stock_days, min_stock_level, units_per_box FROM warehouse_products WHERE id = $1 AND club_id = $2',
            [productId, clubId]
        )
        const p = productRes.rows[0]
        if (!p) throw new Error("Товар не найден")

        let suggested = 0
        const boxSize = normalizeProcurementBoxSize(p.units_per_box)
        suggested = calculateSuggestedProcurementQuantity(p)
        if (suggested <= 0) suggested = boxSize

        await client.query(`
            INSERT INTO warehouse_procurement_items (list_id, product_id, current_stock, suggested_quantity, actual_quantity, units_per_box)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [listId, productId, p.current_stock, suggested, suggested, boxSize])

        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function deleteProcurementList(listId: number, clubId: string) {
    await requireClubAccess(clubId)
    await query('DELETE FROM warehouse_procurement_lists WHERE id = $1 AND club_id = $2', [listId, clubId])
    revalidatePath(`/clubs/${clubId}/inventory`)
}

// --- HELPER: Stock Movement Logging ---
async function logStockMovement(
    client: any, 
    clubId: string, 
    userId: string | null, 
    productId: number, 
    changeAmount: number, 
    previousStock: number, 
    newStock: number, 
    type: string, 
    reason: string | null = null,
    relatedEntityType: string | null = null,
    relatedEntityId: number | null = null,
    shiftId: string | null = null,
    warehouseId: number | null = null,
    priceAtTime: number | null = null
) {
    const res = await client.query(`
        INSERT INTO warehouse_stock_movements 
        (club_id, product_id, user_id, change_amount, previous_stock, new_stock, type, reason, related_entity_type, related_entity_id, shift_id, warehouse_id, price_at_time)
        SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, selling_price)
        FROM warehouse_products
        WHERE id = $2 AND club_id = $1
        RETURNING id
    `, [clubId, productId, userId, changeAmount, previousStock, newStock, type, reason, relatedEntityType, relatedEntityId, shiftId, warehouseId, priceAtTime])
    return (res.rows[0]?.id ?? null) as number | null
}

async function assertWarehouseBelongsToClub(db: { query: (sql: string, params?: any[]) => Promise<any> }, clubId: string, warehouseId: number) {
    const res = await db.query('SELECT 1 FROM warehouses WHERE id = $1 AND club_id = $2 LIMIT 1', [warehouseId, clubId])
    if ((res.rowCount || 0) === 0) throw new Error("Склад не найден или не принадлежит клубу")
}

async function assertProductBelongsToClub(db: { query: (sql: string, params?: any[]) => Promise<any> }, clubId: string, productId: number) {
    const res = await db.query('SELECT 1 FROM warehouse_products WHERE id = $1 AND club_id = $2 LIMIT 1', [productId, clubId])
    if ((res.rowCount || 0) === 0) throw new Error("Товар не найден или не принадлежит клубу")
}

async function assertProductsBelongToClub(db: { query: (sql: string, params?: any[]) => Promise<any> }, clubId: string, productIds: number[]) {
    const unique = Array.from(new Set(productIds.filter((id) => Number.isFinite(id)))) as number[]
    if (unique.length === 0) return
    const res = await db.query(
        'SELECT COUNT(*)::int as cnt FROM warehouse_products WHERE club_id = $1 AND id = ANY($2)',
        [clubId, unique]
    )
    const cnt = Number(res.rows?.[0]?.cnt || 0)
    if (cnt !== unique.length) throw new Error("Список товаров содержит позиции, которые не принадлежат клубу")
}

async function syncProductsCurrentStock(client: any, clubId: string, productIds: Iterable<number>) {
    const uniqueProductIds = Array.from(new Set(Array.from(productIds).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)))
    if (uniqueProductIds.length === 0) return
    await client.query(
        `
        UPDATE warehouse_products p
        SET current_stock = (
            SELECT COALESCE(SUM(quantity), 0)
            FROM warehouse_stock ws
            WHERE ws.product_id = p.id
        )
        WHERE p.club_id = $1
          AND p.id = ANY($2)
        `,
        [clubId, uniqueProductIds]
    )
}

async function findAcceptedFromShift(
    client: any,
    clubId: string,
    currentShiftId: string,
    currentShiftUserId: string | null,
    referenceTime: string,
    selectedShiftId: string | null
) {
    const selectedShiftRes = selectedShiftId
        ? await client.query(
            `
            SELECT id, user_id
            FROM shifts
            WHERE club_id = $1
              AND id = $2
              AND id <> $3
              AND check_out IS NOT NULL
              AND check_out <= $4
            LIMIT 1
            `,
            [clubId, selectedShiftId, currentShiftId, referenceTime]
        )
        : { rows: [] }

    const selectedShift = selectedShiftRes.rows[0] || null
    const selectedShiftUserId = selectedShift?.user_id ? String(selectedShift.user_id) : null
    if (selectedShift && (!currentShiftUserId || selectedShiftUserId !== currentShiftUserId)) {
        return {
            accepted_from_shift_id: String(selectedShift.id),
            accepted_from_employee_id: selectedShiftUserId,
        }
    }

    const preferredPreviousShiftRes = await client.query(
        `
        SELECT id, user_id
        FROM shifts
        WHERE club_id = $1
          AND id <> $2
          AND check_out IS NOT NULL
          AND check_out <= $3
          AND ($4::text IS NULL OR user_id::text <> $4::text)
        ORDER BY check_out DESC, check_in DESC, id DESC
        LIMIT 1
        `,
        [clubId, currentShiftId, referenceTime, currentShiftUserId]
    )

    const previousShift = preferredPreviousShiftRes.rows[0] || selectedShift
    if (!previousShift) {
        return {
            accepted_from_shift_id: null as string | null,
            accepted_from_employee_id: null as string | null,
        }
    }

    return {
        accepted_from_shift_id: String(previousShift.id),
        accepted_from_employee_id: previousShift.user_id ? String(previousShift.user_id) : null,
    }
}

async function ensurePreviousShiftClosureCompleted(
    client: any,
    clubId: string,
    currentShiftId: string,
    currentShiftCheckIn: string
) {
    const blockingShiftRes = await client.query(
        `
        SELECT
            s.id,
            s.user_id,
            s.check_in,
            u.full_name
        FROM shifts s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.club_id = $1
          AND s.id <> $2
          AND s.check_out IS NULL
          AND s.check_in <= $3
        ORDER BY s.check_in DESC, s.id DESC
        LIMIT 1
        `,
        [clubId, currentShiftId, currentShiftCheckIn]
    )

    const blockingShift = blockingShiftRes.rows[0]
    if (!blockingShift) return

    const employeeName = blockingShift.full_name || 'предыдущего сотрудника'
    throw new Error(
        `Нельзя начать приемку остатков, пока не завершено закрытие предыдущей смены (${employeeName}). Сначала закройте прошлую смену, затем начните приемку.`
    )
}

async function applyWarehouseStockDelta(
    client: any,
    warehouseId: number,
    productId: number,
    delta: number
): Promise<{ previousStock: number, newStock: number }> {
    if (!Number.isFinite(delta)) throw new Error("Некорректное количество")
    if (!Number.isInteger(delta)) throw new Error("Количество должно быть целым числом")

    if (delta === 0) {
        const stockRes = await client.query(
            'SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2',
            [warehouseId, productId]
        )
        const q = Number(stockRes.rows[0]?.quantity || 0)
        return { previousStock: q, newStock: q }
    }

    // Atomic upsert that works even when the row does not exist.
    const res = await client.query(
        `
        INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (warehouse_id, product_id)
        DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity
        RETURNING quantity
        `,
        [warehouseId, productId, delta]
    )
    const newStock = Number(res.rows[0]?.quantity || 0)
    const previousStock = newStock - delta
    return { previousStock, newStock }
}

function normalizeInventoryActualStock(actualStock: number | null) {
    if (actualStock === null) return null
    if (!Number.isFinite(actualStock)) throw new Error("Фактический остаток должен быть числом")
    if (!Number.isInteger(actualStock)) throw new Error("Фактический остаток должен быть целым числом")
    if (actualStock < 0) throw new Error("Фактический остаток не может быть отрицательным")
    return actualStock
}

function calculateInventoryDelta(expectedStock: number, movementDuringInventory: number, actualStock: number) {
    const adjustedExpected = Math.max(0, Number(expectedStock) + Number(movementDuringInventory || 0))
    const difference = actualStock - adjustedExpected
    return { adjustedExpected, difference }
}

async function getInventoryMovementDuringCount(
    client: any,
    inventoryId: number,
    productId: number,
    warehouseId: number,
    clubId: string,
    startedAt: string,
    closedAt?: string | null
) {
    const movementRes = await client.query(
        `
        SELECT COALESCE(SUM(change_amount), 0) as total
        FROM warehouse_stock_movements
        WHERE product_id = $1
          AND warehouse_id = $2
          AND club_id = $3
          AND created_at > $4
          AND ($5::timestamp IS NULL OR created_at <= $5::timestamp)
          AND NOT (
              COALESCE(related_entity_type, '') = 'INVENTORY'
              AND COALESCE(related_entity_id, -1) = $6
          )
        `,
        [productId, warehouseId, clubId, startedAt, closedAt || null, inventoryId]
    )
    return Number(movementRes.rows[0]?.total || 0)
}

async function getLockedWarehouseStock(client: any, warehouseId: number, productId: number) {
    const stockRes = await client.query(
        `
        SELECT quantity
        FROM warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2
        FOR UPDATE
        `,
        [warehouseId, productId]
    )
    return Number(stockRes.rows[0]?.quantity || 0)
}

// --- TASKS ---
export async function getClubTasks(clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT t.*, u.full_name as assignee_name, p.name as product_name,
               sw.name as source_warehouse_name,
               tw.name as target_warehouse_name
        FROM club_tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN warehouse_products p ON t.related_entity_type = 'PRODUCT' AND t.related_entity_id = p.id
        LEFT JOIN warehouse_replenishment_rules r ON t.type = 'RESTOCK' AND t.related_entity_id = r.product_id AND r.is_active = true
        LEFT JOIN warehouses sw ON r.source_warehouse_id = sw.id
        LEFT JOIN warehouses tw ON r.target_warehouse_id = tw.id
        WHERE t.club_id = $1 AND t.status != 'COMPLETED'
        ORDER BY t.priority DESC, t.created_at ASC
    `, [clubId])
    return res.rows
}



// --- PRODUCTS ---

export async function manualTriggerReplenishment(clubId: string) {
    await requireClubAccess(clubId)
    try {
        await calculateAnalytics(clubId)
        await checkReplenishmentNeeds(clubId)
        revalidatePath(`/clubs/${clubId}/inventory`)
        return { success: true }
    } catch (e) {
        console.error('Manual trigger failed:', e)
        throw e
    }
}

function normalizeProcurementBoxSize(unitsPerBox: number | null | undefined) {
    const normalized = Number(unitsPerBox || 1)
    return Number.isFinite(normalized) && normalized > 0 ? Math.max(1, Math.round(normalized)) : 1
}

type ProcurementMode = "optimized" | "full"

type ProcurementCandidate = {
    priority: "CRITICAL" | "HIGH" | "MEDIUM"
    reason: string
    reorder_point: number
    days_left: number | null
}

function calculateSuggestedProcurementQuantity(product: {
    current_stock: number | string | null
    sales_velocity: number | string | null
    ideal_stock_days?: number | string | null
    min_stock_level?: number | string | null
    units_per_box?: number | string | null
    abc_category?: string | null
}, mode: ProcurementMode = "optimized") {
    const currentStock = Number(product.current_stock || 0)
    const salesVelocity = Number(product.sales_velocity || 0)
    const idealStockDays = Math.max(1, Number(product.ideal_stock_days || 14))
    const minStockLevel = Math.max(0, Number(product.min_stock_level || 0))
    const boxSize = normalizeProcurementBoxSize(Number(product.units_per_box || 1))
    const abcCategory = String(product.abc_category || "C").toUpperCase()

    const targetDays = mode === "optimized"
        ? abcCategory === "A"
            ? Math.min(idealStockDays, 7)
            : abcCategory === "B"
                ? Math.min(idealStockDays, 4)
                : 0
        : abcCategory === "A"
            ? idealStockDays
            : abcCategory === "B"
                ? Math.max(5, Math.min(idealStockDays, 10))
                : Math.max(2, Math.min(idealStockDays, 5))

    const targetStock = targetDays > 0 && salesVelocity > 0
        ? Math.max(Math.ceil(salesVelocity * targetDays), minStockLevel)
        : mode === "full"
            ? Math.max(minStockLevel, boxSize)
            : 0
    const needed = Math.max(0, targetStock - currentStock)
    if (needed <= 0) return 0

    return Math.ceil(needed / boxSize) * boxSize
}

function getProcurementCoverDays(abcCategory: string, mode: ProcurementMode) {
    if (mode === "optimized") {
        if (abcCategory === "A") return 7
        if (abcCategory === "B") return 4
        return 0
    }

    if (abcCategory === "A") return 10
    if (abcCategory === "B") return 6
    return 3
}

function getProcurementPriority(abcCategory: string, daysLeft: number | null, belowMin: boolean, mode: ProcurementMode) {
    if (mode === "optimized") {
        if (abcCategory === "A") return belowMin || (daysLeft !== null && daysLeft < 2) ? "CRITICAL" : "HIGH"
        if (abcCategory === "B") return belowMin || (daysLeft !== null && daysLeft < 2) ? "HIGH" : "MEDIUM"
        return null
    }

    if (abcCategory === "A") return belowMin || (daysLeft !== null && daysLeft < 2) ? "CRITICAL" : "HIGH"
    if (abcCategory === "B") return belowMin || (daysLeft !== null && daysLeft < 2) ? "HIGH" : "MEDIUM"
    return "MEDIUM"
}

function getProcurementReason(abcCategory: string, belowMin: boolean, mode: ProcurementMode) {
    if (mode === "optimized") {
        return belowMin
            ? `Оптимизированная закупка: категория ${abcCategory} ниже минимального остатка`
            : `Оптимизированная закупка: категория ${abcCategory} подходит к точке дозаказа`
    }

    return belowMin
        ? `Полное пополнение: категория ${abcCategory} ниже минимального остатка`
        : `Полное пополнение: категория ${abcCategory} подходит к точке дозаказа`
}

function getProcurementCandidate(product: {
    current_stock: number | string | null
    sales_velocity: number | string | null
    min_stock_level?: number | string | null
    abc_category?: string | null
}, mode: ProcurementMode = "optimized") {
    const currentStock = Number(product.current_stock || 0)
    const salesVelocity = Math.max(0, Number(product.sales_velocity || 0))
    const minStockLevel = Math.max(0, Number(product.min_stock_level || 0))
    const abcCategory = String(product.abc_category || "C").toUpperCase()
    const daysLeft = salesVelocity > 0 ? currentStock / salesVelocity : null
    const coverDays = getProcurementCoverDays(abcCategory, mode)
    const adaptiveReorderPoint = coverDays > 0 && salesVelocity > 0
        ? Math.max(minStockLevel, Math.ceil(salesVelocity * coverDays))
        : minStockLevel

    if (mode === "optimized" && abcCategory === "C") return null

    const belowMin = currentStock < minStockLevel
    const belowCover = coverDays > 0 && salesVelocity > 0 && currentStock < adaptiveReorderPoint
    if (!belowMin && !belowCover) return null

    const priority = getProcurementPriority(abcCategory, daysLeft, belowMin, mode)
    if (!priority) return null
    return {
        priority,
        reason: getProcurementReason(abcCategory, belowMin, mode),
        reorder_point: adaptiveReorderPoint,
        days_left: daysLeft,
    } satisfies ProcurementCandidate
}

export async function getSalesAnalytics(clubId: string, limit: number = 500) {
    await requireClubAccess(clubId)
    let preferredMetricKey: string | null = null
    try {
        const s = await query(`SELECT inventory_settings FROM clubs WHERE id = $1`, [clubId])
        preferredMetricKey = s.rows[0]?.inventory_settings?.employee_default_metric_key || null
    } catch {
        // Best effort: fall back to legacy keys.
    }
    // Get both sales and returns
    const res = await query(`
        SELECT 
            sm.*,
            p.name as product_name,
            p.selling_price as current_price,
            COALESCE(sm.price_at_time, p.selling_price) as price_at_time,
            u.full_name as user_name,
            su.full_name as shift_employee_name,
            s.check_in as shift_start,
            s.check_out as shift_end,
            s.id as shift_id_raw,
            COALESCE(
                CASE
                    WHEN (s.report_data ->> $3::text) ~ '^[0-9]+(\\.[0-9]+)?$' THEN (s.report_data ->> $3::text)::numeric
                    ELSE NULL
                END,
                CASE
                    WHEN (s.report_data ->> 'bar_revenue') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (s.report_data ->> 'bar_revenue')::numeric
                    ELSE NULL
                END,
                CASE
                    WHEN (s.report_data ->> 'total_revenue') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (s.report_data ->> 'total_revenue')::numeric
                    ELSE NULL
                END,
                inv.reported_revenue,
                0
            ) as shift_reported_revenue,
            inv.calculated_revenue as shift_calculated_revenue,
            inv.revenue_difference as shift_revenue_difference,
            -- Mark returns
            CASE WHEN sm.type = 'RETURN' THEN true ELSE false END as is_return,
            sm.reason as return_reason
        FROM warehouse_stock_movements sm
        JOIN warehouse_products p ON sm.product_id = p.id
        LEFT JOIN users u ON sm.user_id = u.id
        LEFT JOIN shifts s ON sm.shift_id = s.id
        LEFT JOIN users su ON s.user_id = su.id
        LEFT JOIN LATERAL (
            SELECT
                wi.reported_revenue,
                wi.calculated_revenue,
                wi.revenue_difference
            FROM warehouse_inventories wi
            WHERE wi.shift_id = s.id
              AND wi.club_id = $1
            ORDER BY
                CASE WHEN wi.status = 'CLOSED' THEN 0 ELSE 1 END,
                wi.closed_at DESC NULLS LAST,
                wi.started_at DESC,
                wi.id DESC
            LIMIT 1
        ) inv ON TRUE
        -- Join for voided and non-revenue receipts
        LEFT JOIN shift_receipts sr ON sm.related_entity_type = 'SHIFT_RECEIPT' AND sm.related_entity_id = sr.id
        WHERE sm.club_id = $1 
          AND sm.type IN ('SALE', 'RETURN')  -- Include both sales and returns
          AND COALESCE(sm.related_entity_type, '') != 'SHIFT_RECEIPT_VOID'
          AND (sr.id IS NULL OR (sr.voided_at IS NULL AND COALESCE(sr.counts_in_revenue, true) = true))
        ORDER BY sm.created_at DESC
        LIMIT $2
    `, [clubId, limit, preferredMetricKey])
    return res.rows
}

export async function getActiveShiftsForClub(clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT id, check_in, check_out, 
               (SELECT full_name FROM users WHERE id = user_id) as employee_name
        FROM shifts 
        WHERE club_id = $1
        ORDER BY check_in DESC 
        LIMIT 20
    `, [clubId])
    return res.rows
}

export async function correctInventoryItem(inventoryId: number, productId: number, newActualStock: number, clubId: string, userId: string) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await getClient()
    try {
        await client.query('BEGIN')

        // 1. Get current inventory and item info
        const invRes = await client.query('SELECT * FROM warehouse_inventories WHERE id = $1 AND club_id = $2', [inventoryId, clubId])
        if (invRes.rows.length === 0) throw new Error("Инвентаризация не найдена")
        const inventory = invRes.rows[0]

        const itemRes = await client.query(`
            SELECT * FROM warehouse_inventory_items 
            WHERE inventory_id = $1 AND product_id = $2
        `, [inventoryId, productId])
        if (itemRes.rows.length === 0) throw new Error("Позиция не найдена")
        const item = itemRes.rows[0]

        const normalizedActualStock = normalizeInventoryActualStock(newActualStock)
        if (normalizedActualStock === null) throw new Error("Фактический остаток обязателен")

        const oldActualStock = item.actual_stock !== null ? Number(item.actual_stock) : null
        const expectedStock = Number(item.expected_stock)
        const price = Number(item.selling_price_snapshot)
        let warehouseId = inventory.warehouse_id
        if (!warehouseId) {
            const whRes = await client.query('SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1', [clubId])
            warehouseId = whRes.rows[0]?.id
        }
        if (!warehouseId) throw new Error("Не найден склад для корректировки остатков")
        await assertUserCanUseWarehouses(client, clubId, userId, [warehouseId])

        if (inventory.status !== 'CLOSED') {
            throw new Error("Для открытой инвентаризации используйте обычное редактирование остатков")
        }
        if (inventory.shift_id || inventory.target_metric_key) {
            throw new Error("Закрытую сменную инвентаризацию нельзя корректировать постфактум. Создайте новую ревизию.")
        }
        if (oldActualStock === null) {
            throw new Error("Нельзя корректировать позицию без зафиксированного фактического остатка")
        }

        const movementDuringInventory = await getInventoryMovementDuringCount(
            client,
            inventoryId,
            productId,
            Number(warehouseId),
            clubId,
            inventory.started_at,
            inventory.closed_at || null
        )
        const { difference: newDifference } = calculateInventoryDelta(expectedStock, movementDuringInventory, normalizedActualStock)
        const newCalculatedRevenue = 0

        // 2. Update inventory item
        await client.query(`
            UPDATE warehouse_inventory_items 
            SET actual_stock = $1::integer, 
                difference = $2::integer, 
                calculated_revenue = $3::numeric,
                counted_at = COALESCE(counted_at, NOW()),
                counted_by = COALESCE(counted_by, $6::uuid)
            WHERE inventory_id = $4 AND product_id = $5
        `, [normalizedActualStock, newDifference, newCalculatedRevenue, inventoryId, productId, userId])

        // 3. Apply only the compensating delta to current stock.
        const stockDelta = normalizedActualStock - oldActualStock
        if (stockDelta !== 0) {
            const { previousStock, newStock } = await applyWarehouseStockDelta(client, Number(warehouseId), productId, stockDelta)

            await client.query(`
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1 AND club_id = $2
            `, [productId, clubId])

            await logStockMovement(
                client,
                clubId,
                userId,
                productId,
                stockDelta,
                previousStock,
                newStock,
                'INVENTORY_CORRECTION',
                `Пост-корректировка ревизии #${inventoryId}`,
                'INVENTORY',
                inventoryId,
                null,
                Number(warehouseId),
                price
            )
        }

        await client.query(
            `
            INSERT INTO inventory_post_close_corrections (
                inventory_id,
                product_id,
                old_actual_stock,
                new_actual_stock,
                difference_before,
                difference_after,
                stock_delta,
                reason,
                created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
            [
                inventoryId,
                productId,
                oldActualStock,
                normalizedActualStock,
                item.difference !== null ? Number(item.difference) : null,
                newDifference,
                stockDelta,
                'Пост-корректировка закрытой ревизии',
                userId
            ]
        )

        await client.query('COMMIT')
        revalidatePath(`/clubs/${clubId}/inventory`)
        return { success: true }
    } catch (e: any) {
        await client.query('ROLLBACK')
        console.error('Inventory correction error:', e)
        throw e
    } finally {
        client.release()
    }
}

export async function correctStockMovement(movementId: number, clubId: string, userId: string, newAmount: number, newReason?: string) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await getClient()
    try {
        await client.query('BEGIN')

        // 1. Находим само движение
        const mRes = await client.query('SELECT * FROM warehouse_stock_movements WHERE id = $1 AND club_id = $2', [movementId, clubId])
        if (mRes.rows.length === 0) throw new Error("Движение не найдено")
        const movement = mRes.rows[0]
        const { club_id, product_id, warehouse_id, change_amount: oldAmount, type, related_entity_type, related_entity_id } = movement

        // Если это продажа, то change_amount обычно отрицательный. 
        // Мы ожидаем, что пользователь вводит положительное число "сколько продано", 
        // поэтому конвертируем его в отрицательное для БД.
        const normalizedNewAmount = type === 'SALE' ? -Math.abs(newAmount) : newAmount
        const diff = normalizedNewAmount - oldAmount

        if (diff === 0 && newReason === movement.reason) {
            await client.query('COMMIT')
            return { success: true }
        }

        // 2. Обновляем саму запись движения
        await client.query(`
            UPDATE warehouse_stock_movements 
            SET change_amount = $1, reason = $2, new_stock = previous_stock + $1
            WHERE id = $3
        `, [normalizedNewAmount, newReason || movement.reason, movementId])

        // 3. Проверяем, были ли инвентаризации ПОСЛЕ этого движения по этому товару
        const laterInvRes = await client.query(`
            SELECT id FROM warehouse_inventories 
            WHERE club_id = $1 AND status = 'CLOSED' AND closed_at > $2
            LIMIT 1
        `, [club_id, movement.created_at])

        const hasLaterInventory = laterInvRes.rows.length > 0

        // 4. Корректируем склад ТОЛЬКО если не было инвентаризаций после
        if (!hasLaterInventory && warehouse_id) {
            await client.query(`
                INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
            `, [warehouse_id, product_id, diff])
            
            // Обновляем общий кэш остатка в таблице продуктов
            await client.query(`
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1 AND club_id = $2
            `, [product_id, clubId])
        }

        // 5. Если движение было частью инвентаризации, правим её финансовые итоги
        let inventoryId = (related_entity_type === 'INVENTORY') ? related_entity_id : null
        
        if (inventoryId && type === 'SALE') {
            const invItemRes = await client.query(`
                SELECT selling_price_snapshot FROM warehouse_inventory_items 
                WHERE inventory_id = $1 AND product_id = $2
            `, [inventoryId, product_id])
            
            const price = invItemRes.rows[0]?.selling_price_snapshot || 0
            const actualRevenueDiff = diff * price

            // В инвентаризации: 
            // calculated_revenue уменьшается на разницу (так как мы продали больше/меньше)
            // revenue_difference (расхождение) увеличивается на эту же сумму
            await client.query(`
                UPDATE warehouse_inventories 
                SET calculated_revenue = calculated_revenue - $1,
                    revenue_difference = revenue_difference + $1
                WHERE id = $2
            `, [actualRevenueDiff, inventoryId])
        }

        await client.query('COMMIT')
        revalidatePath(`/clubs/${clubId}/inventory`)
        return { success: true, wasStockAdjusted: !hasLaterInventory }
    } catch (e: any) {
        await client.query('ROLLBACK')
        console.error('Error correcting movement:', e)
        return { success: false, error: e.message }
    } finally {
        client.release()
    }
}

export async function deleteStockMovement(id: number, clubId: string, options?: { revertToWarehouseId?: number }) {
    await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // 1. Get movement info
        const moveRes = await client.query('SELECT * FROM warehouse_stock_movements WHERE id = $1 AND club_id = $2', [id, clubId])
        if (moveRes.rowCount === 0) throw new Error("Запись не найдена")
        
        const move = moveRes.rows[0]
        
        // 2. Revert stock if warehouse specified
        if (options?.revertToWarehouseId) {
            const revertAmount = -move.change_amount // If was sale (-5), revert +5
            
            await client.query(`
                INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
            `, [options.revertToWarehouseId, move.product_id, revertAmount])
            
            // Update cache
            await client.query(`
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1 AND club_id = $2
            `, [move.product_id, clubId])
        }

        // 3. If it was an inventory sale, update the inventory header's calculated revenue (to fix differences)
        if (move.related_entity_type === 'INVENTORY' && move.type === 'SALE') {
            const invItemRes = await client.query(`
                SELECT selling_price_snapshot FROM warehouse_inventory_items 
                WHERE inventory_id = $1 AND product_id = $2
            `, [move.related_entity_id, move.product_id])
            
            const price = invItemRes.rows[0]?.selling_price_snapshot || 0
            const revenueToRevert = move.change_amount * price // e.g. -5 * 100 = -500

            await client.query(`
                UPDATE warehouse_inventories 
                SET calculated_revenue = calculated_revenue + $1,
                    revenue_difference = revenue_difference - $1
                WHERE id = $2
            `, [revenueToRevert, move.related_entity_id])
        }

        // 4. Delete movement
        await client.query('DELETE FROM warehouse_stock_movements WHERE id = $1', [id])
        
        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function createManualSale(clubId: string, userId: string, data: { product_id: number, quantity: number, warehouse_id: number, shift_id?: string, notes?: string }) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        const { product_id, quantity, warehouse_id, shift_id, notes } = data
        if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
            throw new Error("Количество должно быть целым положительным числом")
        }
        await assertWarehouseBelongsToClub(client, clubId, warehouse_id)
        await assertProductBelongsToClub(client, clubId, product_id)
        await assertUserCanUseWarehouses(client, clubId, userId, [warehouse_id])

        // 1. Update stock
        const { previousStock: prevStock, newStock } = await applyWarehouseStockDelta(client, warehouse_id, product_id, -quantity)

        // 2. Update product cache
        await client.query(`
            UPDATE warehouse_products
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
            WHERE id = $1 AND club_id = $2
        `, [product_id, clubId])

        // 3. Log movement
        const reason = `Ручная продажа (Админ): ${notes || ''}`
        await logStockMovement(
            client, clubId, userId, product_id, -quantity, prevStock, newStock, 
            'SALE', reason, 'MANUAL', null, shift_id || null, warehouse_id
        )

        await client.query('COMMIT')
        revalidatePath(`/clubs/${clubId}/inventory`)
        return { success: true }
    } catch (e: any) {
        await client.query('ROLLBACK')
        console.error('Manual sale error:', e)
        throw e
    } finally {
        client.release()
    }
}

export type ShiftSaleItem = {
    id: number
    product_id: number
    product_name: string
    quantity: number
    warehouse_id: number
    warehouse_name: string
    selling_price_snapshot: number
    cost_price_snapshot: number
    notes?: string | null
    created_at: string
    committed_at?: string | null
}

// ============================================================================
// ПРИМЕЧАНИЕ: Функции shift_sales (getOpenShiftSales, addShiftSaleItem, и т.д.)
// удалены как неиспользуемые. POS-система использует только shift_receipts.
// ============================================================================

export type ShiftReceiptPaymentType = 'cash' | 'card' | 'mixed' | 'other' | 'salary'

export type ShiftReceiptItem = {
    id: number
    receipt_id: number
    product_id: number
    product_name: string
    quantity: number
    returned_qty?: number
    available_qty?: number
    selling_price_snapshot: number
    cost_price_snapshot: number
}

export type ShiftReceipt = {
    id: number
    club_id: number
    shift_id: string
    created_by: string
    warehouse_id: number
    warehouse_name: string
    payment_type: ShiftReceiptPaymentType
    counts_in_revenue?: boolean
    salary_target_user_id?: string | null
    salary_target_shift_id?: string | null
    cash_amount: number
    card_amount: number
    total_amount: number
    total_refund_amount?: number
    notes?: string | null
    created_at: string
    voided_at?: string | null
    committed_at?: string | null
    items: ShiftReceiptItem[]
}

async function resolveEmployeeDefaultWarehouseId(
    client: any,
    clubId: string,
    userId: string,
    preferredWarehouseId?: number | null
) {
    const scope = await getInventoryAccessScope(client, clubId, userId)
    if (scope.canManageInventory) {
        if (preferredWarehouseId) {
            await assertWarehouseBelongsToClub(client, clubId, preferredWarehouseId)
            return Number(preferredWarehouseId)
        }

        const whRes = await client.query(
            `SELECT id FROM warehouses WHERE club_id = $1 AND is_active = true ORDER BY is_default DESC, created_at ASC LIMIT 1`,
            [clubId]
        )
        const id = whRes.rows[0]?.id
        if (!id) throw new Error("В клубе не создано ни одного склада")
        return Number(id)
    }

    if (scope.allowedWarehouseIds.length === 0) {
        throw new Error("Для вашего профиля не настроены доступные склады")
    }

    if (preferredWarehouseId) {
        await assertUserCanUseWarehouses(client, clubId, userId, [preferredWarehouseId])
        const preferredWarehouseRes = await client.query(
            `SELECT id FROM warehouses WHERE id = $1 AND club_id = $2 AND is_active = true LIMIT 1`,
            [preferredWarehouseId, clubId]
        )
        if (preferredWarehouseRes.rowCount === 0) {
            throw new Error(`Склад #${preferredWarehouseId} недоступен или неактивен`)
        }
        return Number(preferredWarehouseId)
    }

    const whRes = await client.query(
        `SELECT id
         FROM warehouses
         WHERE club_id = $1
           AND is_active = true
           AND id = ANY($2)
         ORDER BY is_default DESC, created_at ASC
         LIMIT 1`,
        [clubId, scope.allowedWarehouseIds]
    )
    const id = whRes.rows[0]?.id
    if (!id) throw new Error("Для вашего профиля не найден доступный активный склад")
    return Number(id)
}

async function resolvePosWarehouseIdForItems(
    client: any,
    clubId: string,
    userId: string,
    items: { product_id: number; quantity: number }[],
    preferredWarehouseId?: number | null
) {
    const scope = await getInventoryAccessScope(client, clubId, userId)

    if (scope.canManageInventory && preferredWarehouseId) {
        await assertWarehouseBelongsToClub(client, clubId, preferredWarehouseId)
    }
    if (!scope.canManageInventory && preferredWarehouseId) {
        await assertUserCanUseWarehouses(client, clubId, userId, [preferredWarehouseId])
    }

    const warehouseQuery = scope.canManageInventory
        ? `
            SELECT id, name, is_default
            FROM warehouses
            WHERE club_id = $1
              AND is_active = true
              AND ($2::int IS NULL OR id = $2)
            ORDER BY CASE WHEN id = $2 THEN 0 ELSE 1 END, is_default DESC, created_at ASC
        `
        : `
            SELECT id, name, is_default
            FROM warehouses
            WHERE club_id = $1
              AND is_active = true
              AND id = ANY($2)
              AND ($3::int IS NULL OR id = $3)
            ORDER BY CASE WHEN id = $3 THEN 0 ELSE 1 END, is_default DESC, created_at ASC
        `

    const warehouseParams = scope.canManageInventory
        ? [clubId, preferredWarehouseId ?? null]
        : [clubId, scope.allowedWarehouseIds, preferredWarehouseId ?? null]

    const warehouseRes = await client.query(warehouseQuery, warehouseParams)
    if (warehouseRes.rowCount === 0) {
        throw new Error("Для POS не найден доступный активный склад")
    }

    const warehouseIds = warehouseRes.rows.map((row: any) => Number(row.id))
    const productIds = Array.from(new Set(items.map(item => Number(item.product_id))))
    const stockRes = await client.query(
        `
        SELECT warehouse_id, product_id, quantity
        FROM warehouse_stock
        WHERE warehouse_id = ANY($1)
          AND product_id = ANY($2)
        `,
        [warehouseIds, productIds]
    )

    const stockMap = new Map<string, number>()
    for (const row of stockRes.rows) {
        stockMap.set(`${row.warehouse_id}:${row.product_id}`, Number(row.quantity || 0))
    }

    const matchingWarehouse = warehouseRes.rows.find((warehouse: any) =>
        items.every(item => {
            const available = stockMap.get(`${warehouse.id}:${item.product_id}`) || 0
            return available >= item.quantity
        })
    )

    if (matchingWarehouse) {
        return Number(matchingWarehouse.id)
    }

    const itemSummaries = await client.query(
        `
        SELECT id, name
        FROM warehouse_products
        WHERE club_id = $1
          AND id = ANY($2)
        `,
        [clubId, productIds]
    )
    const productNames = new Map<number, string>()
    for (const row of itemSummaries.rows) {
        productNames.set(Number(row.id), String(row.name))
    }

    const details = items.map(item => {
        const perWarehouse = warehouseRes.rows
            .map((warehouse: any) => `${warehouse.name}: ${stockMap.get(`${warehouse.id}:${item.product_id}`) || 0}`)
            .join(", ")
        return `${productNames.get(item.product_id) || `Товар #${item.product_id}`} — ${perWarehouse}`
    }).join("; ")

    throw new Error(`Недостаточно товара на доступных POS-складах. ${details}`)
}

export async function createShiftReceipt(
    clubId: string,
    userId: string,
    data: {
        shift_id: string
        payment_type: ShiftReceiptPaymentType
        items: { product_id: number; quantity: number }[]
        cash_amount?: number
        card_amount?: number
        notes?: string
        warehouse_id?: number
        salary_target_user_id?: string
    }
) {
    await assertUserCanAccessClub(clubId, userId)
    if (!data.items?.length) throw new Error("Пустой чек")

    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        const clubSettingsRes = await client.query('SELECT inventory_settings FROM clubs WHERE id = $1', [clubId])
        const salesCaptureMode = clubSettingsRes.rows[0]?.inventory_settings?.sales_capture_mode
        if (salesCaptureMode && salesCaptureMode !== 'SHIFT') {
            throw new Error("Продажи через POS отключены для этого клуба")
        }

        const normalizedItems = data.items
            .map(i => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) }))
            .filter(i => Number.isFinite(i.product_id) && Number.isFinite(i.quantity))

        if (normalizedItems.length === 0) throw new Error("Пустой чек")
        for (const i of normalizedItems) {
            if (!Number.isInteger(i.product_id) || i.product_id <= 0) throw new Error("Некорректный товар в чеке")
            if (!Number.isInteger(i.quantity) || i.quantity <= 0) throw new Error("Количество должно быть целым числом больше 0")
        }

        const shiftCheck = await client.query(
            `SELECT 1 FROM shifts WHERE id = $1 AND club_id = $2 AND user_id = $3 AND check_out IS NULL`,
            [data.shift_id, clubId, userId]
        )
        if (shiftCheck.rowCount === 0) throw new Error("Смена не найдена или уже завершена")

        let salaryTargetUserId: string | null = null
        let salaryTargetShiftId: string | null = null
        let countsInRevenue = data.payment_type !== 'salary'
        if (data.payment_type === 'salary') {
            salaryTargetUserId = data.salary_target_user_id ? String(data.salary_target_user_id) : null
            if (!salaryTargetUserId) {
                throw new Error("Для продажи в счет ЗП нужно выбрать сотрудника")
            }
        }

        const warehouseId = await resolvePosWarehouseIdForItems(client, clubId, userId, normalizedItems, data.warehouse_id ?? null)

        const productIds = Array.from(new Set(normalizedItems.map(i => i.product_id)))
        const pricesRes = await client.query(
            `
            SELECT id, cost_price, selling_price
            FROM warehouse_products
            WHERE club_id = $1 AND id = ANY($2)
            `,
            [clubId, productIds]
        )
        if (pricesRes.rowCount !== productIds.length) throw new Error("Некоторые товары не найдены")
        const priceMap = new Map<number, { cost_price: number; selling_price: number }>()
        for (const r of pricesRes.rows) {
            priceMap.set(Number(r.id), { cost_price: Number(r.cost_price || 0), selling_price: Number(r.selling_price || 0) })
        }

        const itemsTotal = normalizedItems.reduce((acc, i) => {
            const p = priceMap.get(i.product_id)
            if (!p) return acc
            return acc + (Number(i.quantity) * Number(p.selling_price || 0))
        }, 0)

        let cashAmount = Number(data.cash_amount || 0)
        let cardAmount = Number(data.card_amount || 0)
        if (data.payment_type === 'cash') {
            cashAmount = itemsTotal
            cardAmount = 0
        } else if (data.payment_type === 'card') {
            cardAmount = itemsTotal
            cashAmount = 0
        } else if (data.payment_type === 'mixed') {
            if (cashAmount + cardAmount === 0) {
                cashAmount = itemsTotal
            }
        } else if (data.payment_type === 'salary') {
            cashAmount = 0
            cardAmount = 0
        } else {
            cashAmount = cashAmount || 0
            cardAmount = cardAmount || 0
        }

        if (data.payment_type === 'salary') {
            const candidates = await getSalarySaleCandidatesInternal(client, clubId)
            const candidate = candidates.find((item) => item.id === salaryTargetUserId)
            if (!candidate) {
                throw new Error("У выбранного сотрудника нет смен в текущем месяце")
            }
            if (candidate.available_amount < itemsTotal) {
                throw new Error(`Недостаточно доступной суммы. Доступно: ${candidate.available_amount.toLocaleString('ru-RU')} ₽`)
            }
            salaryTargetShiftId = candidate.reference_shift_id
        }

        // Monetary sanity checks
        const totalRounded = Math.round(itemsTotal * 100) / 100
        cashAmount = Math.round(cashAmount * 100) / 100
        cardAmount = Math.round(cardAmount * 100) / 100
        if (data.payment_type === 'mixed') {
            const sumRounded = Math.round((cashAmount + cardAmount) * 100) / 100
            if (sumRounded !== totalRounded) {
                throw new Error("Сумма наличных + карта должна равняться итогу")
            }
        }

        // FIX: Check stock availability BEFORE creating receipt
        for (const item of normalizedItems) {
            const stockRes = await client.query(
                `SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`,
                [warehouseId, item.product_id]
            )
            const prevStock = Number(stockRes.rows[0]?.quantity ?? 0)
            if (prevStock < item.quantity) {
                const prodRes = await client.query(
                    `SELECT name FROM warehouse_products WHERE id = $1 AND club_id = $2`,
                    [item.product_id, clubId]
                )
                const productName = prodRes.rows[0]?.name || `Товар #${item.product_id}`
                await client.query('ROLLBACK')
                throw new Error(`Недостаточно товара "${productName}" на складе. Доступно: ${prevStock}, требуется: ${item.quantity}`)
            }
        }

        const receiptRes = await client.query(
            `
            INSERT INTO shift_receipts (
                club_id, shift_id, created_by, warehouse_id,
                payment_type, cash_amount, card_amount, total_amount, notes, committed_at,
                salary_target_user_id, salary_target_shift_id, counts_in_revenue
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, $12)
            RETURNING id
            `,
            [
                clubId,
                data.shift_id,
                userId,
                warehouseId,
                data.payment_type,
                cashAmount,
                cardAmount,
                itemsTotal,
                data.notes || null,
                salaryTargetUserId,
                salaryTargetShiftId,
                countsInRevenue
            ]
        )
        const receiptId = Number(receiptRes.rows[0].id)

        for (const item of normalizedItems) {
            if (!item.quantity || item.quantity <= 0) continue
            const p = priceMap.get(item.product_id)
            if (!p) continue
            await client.query(
                `
                INSERT INTO shift_receipt_items (receipt_id, product_id, quantity, selling_price_snapshot, cost_price_snapshot)
                VALUES ($1, $2, $3, $4, $5)
                `,
                [receiptId, item.product_id, item.quantity, p.selling_price, p.cost_price]
            )
        }

        // FIX: Immediate stock write-off
        for (const item of normalizedItems) {
            const { previousStock, newStock } = await applyWarehouseStockDelta(
                client,
                warehouseId,
                item.product_id,
                -item.quantity
            )

            const p = priceMap.get(item.product_id)!
            await logStockMovement(
                client,
                clubId,
                userId,
                item.product_id,
                -item.quantity,
                previousStock,
                newStock,
                'SALE',
                data.payment_type === 'salary'
                    ? `В счет ЗП: POS чек #${receiptId}`
                    : `POS чек #${receiptId}`,
                'SHIFT_RECEIPT',
                receiptId,
                data.shift_id,
                warehouseId,
                p.selling_price
            )
        }

        // Update product cache
        if (productIds.length > 0) {
            await client.query(
                `
                UPDATE warehouse_products p
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
                WHERE id = ANY($1) AND club_id = $2
                `,
                [productIds, clubId]
            )
        }

        if (data.payment_type === 'salary' && salaryTargetShiftId) {
            await client.query(
                `
                UPDATE shifts
                SET bar_purchases = COALESCE(bar_purchases, 0) + $1
                WHERE id = $2 AND club_id = $3
                `,
                [itemsTotal, salaryTargetShiftId, clubId]
            )
        }

        await client.query('COMMIT')
        
        // Check if sales triggered new replenishment needs
        await checkReplenishmentNeeds(clubId)
        
        // FIX: Отправляем SSE уведомление всем клиентам клуба
        try {
            notifyInventoryClub(clubId, {
                type: 'RECEIPT_CREATED',
                receipt: { id: receiptId, total_amount: itemsTotal, created_at: new Date().toISOString() },
                timestamp: Date.now()
            })
        } catch (e) {
            console.error('[SSE] Failed to send notification:', e)
        }
        
        revalidatePath(`/employee/clubs/${clubId}`)
        return { success: true, id: receiptId }
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

export async function createShiftReceiptSafe(
    clubId: string,
    userId: string,
    data: {
        shift_id: string
        payment_type: ShiftReceiptPaymentType
        items: { product_id: number; quantity: number }[]
        cash_amount?: number
        card_amount?: number
        notes?: string
        warehouse_id?: number
        salary_target_user_id?: string
    }
) {
    try {
        await createShiftReceipt(clubId, userId, data)
        return { ok: true as const }
    } catch (error: any) {
        return {
            ok: false as const,
            error: getActionErrorMessage(error, "Ошибка пробития товара")
        }
    }
}

function getActionErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) {
        const parts = [error.message?.trim()].filter(Boolean) as string[]
        const detail = typeof (error as { detail?: unknown }).detail === "string"
            ? (error as { detail?: string }).detail?.trim()
            : ""
        const hint = typeof (error as { hint?: unknown }).hint === "string"
            ? (error as { hint?: string }).hint?.trim()
            : ""

        if (detail && !parts.includes(detail)) {
            parts.push(detail)
        }
        if (hint && !parts.includes(hint)) {
            parts.push(hint)
        }

        if (parts.length > 0) {
            return parts.join("\n")
        }
    }

    if (typeof error === "string" && error.trim()) {
        return error.trim()
    }

    return fallback
}

export async function voidShiftReceiptSafe(clubId: string, userId: string, receiptId: number) {
    try {
        await voidShiftReceipt(clubId, userId, receiptId)
        return { ok: true as const }
    } catch (error) {
        return {
            ok: false as const,
            error: getActionErrorMessage(error, "Ошибка отмены чека")
        }
    }
}

export async function returnReceiptItemSafe(
    clubId: string,
    userId: string,
    receiptId: number,
    itemId: number,
    returnQuantity: number,
    reason: string
) {
    try {
        const result = await returnReceiptItem(clubId, userId, receiptId, itemId, returnQuantity, reason)
        return {
            ok: true as const,
            refundAmount: result.refundAmount
        }
    } catch (error) {
        return {
            ok: false as const,
            error: getActionErrorMessage(error, "Ошибка возврата")
        }
    }
}

export async function createTransferSafe(
    clubId: string,
    userId: string,
    data: { source_warehouse_id: number, target_warehouse_id: number, items: { product_id: number, quantity: number }[], notes?: string, shift_id?: string }
) {
    try {
        await createTransfer(clubId, userId, data)
        return { ok: true as const }
    } catch (error) {
        return {
            ok: false as const,
            error: getActionErrorMessage(error, "Ошибка при оформлении перемещения")
        }
    }
}

export async function createWriteOffSafe(
    clubId: string,
    userId: string,
    data: { items: { product_id: number, quantity: number, type: 'WASTE' | 'SALARY_DEDUCTION', custom_price?: number }[], notes: string, shift_id?: string, warehouse_id?: number }
) {
    try {
        await createWriteOff(clubId, userId, data)
        return { ok: true as const }
    } catch (error) {
        return {
            ok: false as const,
            error: getActionErrorMessage(error, "Ошибка при оформлении списания")
        }
    }
}

export async function createSupplySafe(
    clubId: string,
    userId: string,
    data: { supplier_name: string, notes: string, items: { product_id: number, quantity: number, cost_price: number }[], warehouse_id?: number, status?: 'DRAFT' | 'COMPLETED', shift_id?: string }
) {
    try {
        await createSupply(clubId, userId, data)
        return { ok: true as const }
    } catch (error) {
        return {
            ok: false as const,
            error: getActionErrorMessage(error, "Ошибка при оформлении поставки")
        }
    }
}

export async function createInventorySafe(
    clubId: string,
    userId: string,
    targetMetricKey: string | null,
    categoryId?: number | null,
    warehouseId?: number | null,
    shiftId: string | null = null
) {
    try {
        const inventoryId = await createInventory(clubId, userId, targetMetricKey, categoryId, warehouseId, shiftId)
        return {
            ok: true as const,
            inventoryId
        }
    } catch (error) {
        return {
            ok: false as const,
            error: getActionErrorMessage(error, "Ошибка запуска инвентаризации")
        }
    }
}

export async function addProductToInventorySafe(inventoryId: number, productId: number) {
    try {
        await addProductToInventory(inventoryId, productId)
        return { ok: true as const }
    } catch (error) {
        return {
            ok: false as const,
            error: getActionErrorMessage(error, "Ошибка добавления товара в инвентаризацию")
        }
    }
}

export async function bulkUpdateInventoryItemsSafe(items: { id: number, actual_stock: number | null }[], clubId: string) {
    try {
        await bulkUpdateInventoryItems(items, clubId)
        return { ok: true as const }
    } catch (error) {
        return {
            ok: false as const,
            error: getActionErrorMessage(error, "Ошибка сохранения инвентаризации")
        }
    }
}

export async function closeInventorySafe(
    inventoryId: number,
    clubId: string,
    reportedRevenue: number,
    unaccountedSales: { product_id: number, quantity: number, selling_price: number, cost_price: number }[] = [],
    options?: { salesRecognition?: 'INVENTORY' | 'NONE' }
) {
    try {
        await closeInventory(inventoryId, clubId, reportedRevenue, unaccountedSales, options)
        return { ok: true as const }
    } catch (error) {
        return {
            ok: false as const,
            error: getActionErrorMessage(error, "Ошибка завершения инвентаризации")
        }
    }
}

async function buildShiftReceiptsFromRows(receiptRows: any[]) {
    const receiptIds = receiptRows.map(r => Number(r.id))
    
    const returnsRes = receiptIds.length > 0 ? await query(
        `
        SELECT receipt_id, item_id, SUM(quantity) as returned_qty
        FROM shift_receipt_returns
        WHERE receipt_id = ANY($1)
        GROUP BY receipt_id, item_id
        `,
        [receiptIds]
    ) : { rows: [] }

    const returnsMap = new Map<string, number>()
    for (const ret of returnsRes.rows) {
        returnsMap.set(`${ret.receipt_id}-${ret.item_id}`, Number(ret.returned_qty))
    }

    const itemsRes = receiptIds.length
        ? await query(
            `
            SELECT
                i.*,
                p.name as product_name
            FROM shift_receipt_items i
            JOIN warehouse_products p ON i.product_id = p.id
            WHERE i.receipt_id = ANY($1)
            ORDER BY i.id ASC
            `,
            [receiptIds]
        )
        : { rows: [] as any[] }

    const itemsByReceipt = new Map<number, ShiftReceiptItem[]>()
    for (const r of itemsRes.rows) {
        const rid = Number(r.receipt_id)
        const itemId = Number(r.id)
        const key = `${rid}-${itemId}`
        const returnedQty = returnsMap.get(key) || 0
        
        const arr = itemsByReceipt.get(rid) || []
        arr.push({
            id: itemId,
            receipt_id: rid,
            product_id: Number(r.product_id),
            product_name: String(r.product_name),
            quantity: Number(r.quantity),
            returned_qty: returnedQty,
            available_qty: Number(r.quantity) - returnedQty,
            selling_price_snapshot: Number(r.selling_price_snapshot || 0),
            cost_price_snapshot: Number(r.cost_price_snapshot || 0)
        })
        itemsByReceipt.set(rid, arr)
    }

    return receiptRows.map((r: any) => ({
        id: Number(r.id),
        club_id: Number(r.club_id),
        shift_id: String(r.shift_id),
        created_by: String(r.created_by),
        warehouse_id: Number(r.warehouse_id),
        warehouse_name: String(r.warehouse_name),
        payment_type: r.payment_type as ShiftReceiptPaymentType,
        counts_in_revenue: typeof r.counts_in_revenue === 'boolean' ? r.counts_in_revenue : true,
        salary_target_user_id: r.salary_target_user_id ? String(r.salary_target_user_id) : null,
        salary_target_shift_id: r.salary_target_shift_id ? String(r.salary_target_shift_id) : null,
        cash_amount: Number(r.cash_amount || 0),
        card_amount: Number(r.card_amount || 0),
        total_amount: Number(r.total_amount || 0),
        total_refund_amount: Number(r.total_refund_amount || 0),
        notes: r.notes,
        created_at: r.created_at,
        voided_at: r.voided_at,
        committed_at: r.committed_at,
        items: itemsByReceipt.get(Number(r.id)) || []
    })) as ShiftReceipt[]
}

export async function getShiftReceipts(clubId: string, userId: string, shiftId: string, options?: { includeVoided?: boolean }) {
    await assertUserCanAccessClub(clubId, userId)
    const includeVoided = options?.includeVoided ?? false

    const res = await query(
        `
        SELECT
            r.*,
            w.name as warehouse_name
        FROM shift_receipts r
        JOIN warehouses w ON r.warehouse_id = w.id
        WHERE r.club_id = $1
          AND r.shift_id = $2
          AND r.created_by = $3
          AND ($4::boolean = true OR r.voided_at IS NULL)
        ORDER BY r.created_at DESC
        LIMIT 100
        `,
        [clubId, shiftId, userId, includeVoided]
    )

    return buildShiftReceiptsFromRows(res.rows)
}

export async function getInventoryShiftReceipts(clubId: string, inventoryId: number, options?: { includeVoided?: boolean }) {
    await requireClubAccess(clubId)
    const includeVoided = options?.includeVoided ?? false

    const inventoryRes = await query(
        `
        SELECT shift_id, created_by
        FROM warehouse_inventories
        WHERE id = $1 AND club_id = $2
        LIMIT 1
        `,
        [inventoryId, clubId]
    )

    const inventory = inventoryRes.rows[0]
    if (!inventory?.shift_id || !inventory?.created_by) {
        return [] as ShiftReceipt[]
    }

    const receiptsRes = await query(
        `
        SELECT
            r.*,
            w.name as warehouse_name
        FROM shift_receipts r
        JOIN warehouses w ON r.warehouse_id = w.id
        WHERE r.club_id = $1
          AND r.shift_id = $2
          AND r.created_by = $3
          AND ($4::boolean = true OR r.voided_at IS NULL)
        ORDER BY r.created_at DESC
        LIMIT 100
        `,
        [clubId, inventory.shift_id, inventory.created_by, includeVoided]
    )

    return buildShiftReceiptsFromRows(receiptsRes.rows)
}

export async function voidShiftReceipt(clubId: string, userId: string, receiptId: number) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // Get receipt details (committed_at is now always set for active receipts)
        const receiptRes = await client.query(
            `SELECT * FROM shift_receipts WHERE id = $1 AND club_id = $2 AND created_by = $3 AND voided_at IS NULL`,
            [receiptId, clubId, userId]
        )
        if (receiptRes.rowCount === 0) throw new Error("Чек не найден или уже аннулирован")

        const receipt = receiptRes.rows[0]
        const shiftId = receipt.shift_id

        // FIX #2: Always create reversal movements (receipt is already committed)
        const itemsRes = await client.query(
            `SELECT * FROM shift_receipt_items WHERE receipt_id = $1`,
            [receiptId]
        )

        for (const item of itemsRes.rows) {
            const productId = Number(item.product_id)
            const warehouseId = Number(receipt.warehouse_id)
            const qty = Number(item.quantity)

            // Return stock back
            const { previousStock, newStock } = await applyWarehouseStockDelta(
                client,
                warehouseId,
                productId,
                qty  // Positive = add back
            )

            // Create reversal movement
            await logStockMovement(
                client,
                clubId,
                userId,
                productId,
                qty,
                previousStock,
                newStock,
                'SALE',
                `Сторно: аннулирование чека #${receiptId}`,
                'SHIFT_RECEIPT_VOID',
                receiptId,
                shiftId,
                warehouseId,
                Number(item.selling_price_snapshot || 0)
            )
        }

        // Update product cache
        const productIds = itemsRes.rows.map((i: any) => Number(i.product_id))
        if (productIds.length > 0) {
            await client.query(
                `
                UPDATE warehouse_products p
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
                WHERE id = ANY($1) AND club_id = $2
                `,
                [productIds, clubId]
            )
        }

        // Mark receipt as voided
        await client.query(
            `UPDATE shift_receipts SET voided_at = NOW() WHERE id = $1`,
            [receiptId]
        )

        await client.query('COMMIT')
        
        // FIX: Отправляем SSE уведомление всем клиентам клуба
        try {
            notifyInventoryClub(clubId, {
                type: 'RECEIPT_VOIDED',
                receiptId,
                timestamp: Date.now()
            })
        } catch (e) {
            console.error('[SSE] Failed to send notification:', e)
        }
        
        revalidatePath(`/employee/clubs/${clubId}`)
        return { success: true }
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

// ============================================================================
// ВОЗВРАТ ТОВАРА ИЗ ЧЕКА (ЧАСТИЧНЫЙ ВОЗВРАТ)
// ============================================================================

export async function returnReceiptItem(
    clubId: string,
    userId: string,
    receiptId: number,
    itemId: number,
    returnQuantity: number,
    reason: string
) {
    await assertUserCanAccessClub(clubId, userId)
    
    if (!Number.isInteger(returnQuantity) || returnQuantity <= 0) {
        throw new Error("Количество должно быть целым положительным числом")
    }
    
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // 1. Get receipt and item details
        const receiptRes = await client.query(
            `SELECT * FROM shift_receipts WHERE id = $1 AND club_id = $2 AND created_by = $3 AND voided_at IS NULL`,
            [receiptId, clubId, userId]
        )
        if (receiptRes.rowCount === 0) throw new Error("Чек не найден или уже аннулирован")
        const receipt = receiptRes.rows[0]

        const itemRes = await client.query(
            `SELECT * FROM shift_receipt_items WHERE id = $1 AND receipt_id = $2`,
            [itemId, receiptId]
        )
        if (itemRes.rowCount === 0) throw new Error("Позиция не найдена")
        const item = itemRes.rows[0]

        const productId = Number(item.product_id)
        const warehouseId = Number(receipt.warehouse_id)
        const originalQty = Number(item.quantity)
        const price = Number(item.selling_price_snapshot || 0)

        // Check if already returned
        const existingReturnRes = await client.query(
            `SELECT COALESCE(SUM(quantity), 0) as returned_qty 
             FROM shift_receipt_returns 
             WHERE receipt_id = $1 AND item_id = $2`,
            [receiptId, itemId]
        )
        const returnedQty = Number(existingReturnRes.rows[0]?.returned_qty || 0)
        const availableQty = originalQty - returnedQty

        if (returnQuantity > availableQty) {
            throw new Error(`Нельзя вернуть больше чем ${availableQty} шт. (доступно из ${originalQty})`)
        }

        // 2. Return stock back to warehouse
        const { previousStock, newStock } = await applyWarehouseStockDelta(
            client,
            warehouseId,
            productId,
            returnQuantity  // Positive = add back
        )

        // 3. Log return movement
        await logStockMovement(
            client,
            clubId,
            userId,
            productId,
            returnQuantity,
            previousStock,
            newStock,
            'RETURN',  // Changed from 'SALE' to 'RETURN'
            `Возврат из чека #${receiptId}: ${reason}`,
            'SHIFT_RECEIPT_RETURN',
            receiptId,
            receipt.shift_id,
            warehouseId,
            price
        )

        // 4. Record return in database
        const refundAmount = returnQuantity * price
        await client.query(
            `
            INSERT INTO shift_receipt_returns (receipt_id, item_id, quantity, refund_amount, reason, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [receiptId, itemId, returnQuantity, refundAmount, reason, userId]
        )

        // 4.1 Update receipt total refund amount
        await client.query(
            `UPDATE shift_receipts SET total_refund_amount = COALESCE(total_refund_amount, 0) + $1 WHERE id = $2`,
            [refundAmount, receiptId]
        )

        // 5. Update product cache
        await client.query(
            `
            UPDATE warehouse_products p
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
            WHERE id = $1 AND club_id = $2
            `,
            [productId, clubId]
        )

        await client.query('COMMIT')
        
        // Send SSE notification
        try {
            notifyInventoryClub(clubId, {
                type: 'RECEIPT_ITEM_RETURNED',
                receiptId,
                itemId,
                returnQuantity,
                refundAmount,
                timestamp: Date.now()
            })
        } catch (e) {
            console.error('[SSE] Failed to send return notification:', e)
        }
        
        revalidatePath(`/employee/clubs/${clubId}`)
        return { success: true, refundAmount }
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

// ============================================================================
// ПРИМЕЧАНИЕ: commitShiftReceiptsToMovements удалена как неиспользуемая.
// Теперь списание происходит мгновенно при создании чека (createShiftReceipt).
// ============================================================================

export async function assignShiftToMovement(movementId: number, shiftId: string | null, clubId: string) {
    await requireClubAccess(clubId)
    await query(`
        UPDATE warehouse_stock_movements 
        SET shift_id = $1 
        WHERE id = $2 AND club_id = $3
    `, [shiftId, movementId, clubId])
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function massAssignShiftToMovements(movementIds: number[], shiftId: string | null, clubId: string) {
    await requireClubAccess(clubId)
    await query(`
        UPDATE warehouse_stock_movements 
        SET shift_id = $1 
        WHERE id = ANY($2) AND club_id = $3
    `, [shiftId, movementIds, clubId])
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function createWriteOff(clubId: string, userId: string, data: { items: { product_id: number, quantity: number, type: 'WASTE' | 'SALARY_DEDUCTION', custom_price?: number }[], notes: string, shift_id?: string, warehouse_id?: number }) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        if (!data.items || data.items.length === 0) throw new Error("Не выбраны товары для списания")
        for (const i of data.items) {
            if (!Number.isFinite(i.quantity) || !Number.isInteger(i.quantity) || i.quantity <= 0) {
                throw new Error("Количество должно быть целым положительным числом")
            }
        }
        await assertProductsBelongToClub(client, clubId, data.items.map(i => i.product_id))

        // Find warehouse (passed explicitly, or default, or fallback to first available)
        let warehouseId = data.warehouse_id
        
        if (!warehouseId) {
            // Try to find if there is an OPEN inventory for this shift
            if (data.shift_id) {
                const activeInv = await client.query(`
                    SELECT warehouse_id FROM warehouse_inventories 
                    WHERE shift_id = $1 AND status = 'OPEN' 
                    LIMIT 1
                `, [data.shift_id])
                if (activeInv.rowCount && activeInv.rowCount > 0 && activeInv.rows[0].warehouse_id) {
                    warehouseId = activeInv.rows[0].warehouse_id
                }
            }
        }

        if (!warehouseId) {
            const whRes = await client.query(`
                SELECT id FROM warehouses 
                WHERE club_id = $1 
                ORDER BY is_default DESC, created_at ASC 
                LIMIT 1
            `, [clubId])
            warehouseId = whRes.rows[0]?.id
        }
        
        if (!warehouseId) throw new Error("В клубе не создано ни одного склада")
        await assertWarehouseBelongsToClub(client, clubId, warehouseId)
        await assertUserCanUseWarehouses(client, clubId, userId, [warehouseId])

        // 0. Check for existing inventory OR create one if it's a salary deduction
        let inventoryId: number | null = null
        if (data.shift_id) {
            const activeInv = await client.query(`
                SELECT id, warehouse_id FROM warehouse_inventories 
                WHERE shift_id = $1 AND warehouse_id = $2 AND status = 'OPEN' 
                LIMIT 1
            `, [data.shift_id, warehouseId])
            
            if (activeInv.rowCount && activeInv.rowCount > 0) {
                inventoryId = activeInv.rows[0].id
            } else if (data.items.some(i => i.type === 'SALARY_DEDUCTION')) {
                const anyShiftInventory = await client.query(`
                    SELECT id, warehouse_id
                    FROM warehouse_inventories
                    WHERE shift_id = $1 AND club_id = $2 AND status = 'OPEN'
                    ORDER BY started_at ASC
                    LIMIT 1
                `, [data.shift_id, clubId])
                if (anyShiftInventory.rowCount && anyShiftInventory.rowCount > 0) {
                    throw new Error(`Для этой смены уже открыта инвентаризация по складу #${anyShiftInventory.rows[0].warehouse_id}. Закройте её или используйте тот же склад.`)
                }

                // Auto-create inventory if salary deduction is being made and no inventory exists
                // 1. Get default metric key
                const settingsRes = await client.query('SELECT inventory_settings FROM clubs WHERE id = $1', [clubId])
                const settings = settingsRes.rows[0]?.inventory_settings || {}
                const targetMetric = settings.employee_default_metric_key || 'Bar'

                // 2. Create Inventory Header
                const invRes = await client.query(`
                    INSERT INTO warehouse_inventories (club_id, created_by, status, target_metric_key, warehouse_id, shift_id)
                    VALUES ($1, $2, 'OPEN', $3, $4, $5)
                    RETURNING id
                `, [clubId, userId, targetMetric, warehouseId, data.shift_id])
                inventoryId = invRes.rows[0].id

                // 3. Snapshot current stock
                await client.query(`
                    INSERT INTO warehouse_inventory_items (inventory_id, product_id, expected_stock, cost_price_snapshot, selling_price_snapshot)
                    SELECT $1, p.id, COALESCE(ws.quantity, 0), p.cost_price, p.selling_price
                    FROM warehouse_products p
                    LEFT JOIN warehouse_stock ws ON p.id = ws.product_id AND ws.warehouse_id = $2
                    WHERE p.club_id = $3 AND p.is_active = true
                `, [inventoryId, warehouseId, clubId])
            }
        }

        for (const item of data.items) {
            // 1. Update stock
            const { previousStock, newStock } = await applyWarehouseStockDelta(client, warehouseId, item.product_id, -item.quantity)

            // 3. Update product cache
            await client.query(`
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1 AND club_id = $2
            `, [item.product_id, clubId])

            // 4. Log movement
            const reason = item.type === 'SALARY_DEDUCTION' ? `В счет ЗП: ${data.notes}` : `Списание: ${data.notes}`
            const movementType = item.type === 'SALARY_DEDUCTION' ? 'SALE' : 'WRITE_OFF'
            
            // If custom price is provided, we use it for logging the movement
            const priceToUse = item.custom_price ?? null
            await logStockMovement(
                client,
                clubId,
                userId,
                item.product_id,
                -item.quantity,
                previousStock,
                newStock,
                movementType,
                reason,
                'WRITE_OFF',
                null,
                data.shift_id || null,
                warehouseId,
                priceToUse
            )

            // 5. If Salary Deduction, update Shift
            if (item.type === 'SALARY_DEDUCTION') {
                const prodRes = await client.query('SELECT selling_price FROM warehouse_products WHERE id = $1 AND club_id = $2', [item.product_id, clubId])
                const defaultPrice = prodRes.rows[0]?.selling_price || 0
                const price = item.custom_price ?? defaultPrice
                const totalDeduction = price * item.quantity

                if (data.shift_id) {
                    await client.query(`
                        UPDATE shifts 
                        SET bar_purchases = COALESCE(bar_purchases, 0) + $1 
                        WHERE id = $2 AND club_id = $3
                    `, [totalDeduction, data.shift_id, clubId])
                }
            }
        }

        await client.query('COMMIT')
        
        // Check if write-off triggered new replenishment needs
        await checkReplenishmentNeeds(clubId)

        revalidatePath(`/clubs/${clubId}/inventory`)
        revalidatePath(`/employee/clubs/${clubId}`)
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

export async function getProducts(clubId: string) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        const userId = await requireClubAccess(clubId)
        const scope = await getInventoryAccessScope(client, clubId, userId)
        const stockFilter = !scope.canManageInventory && scope.allowedWarehouseIds.length > 0 ? " AND ws.warehouse_id = ANY($2)" : ""
        const stockParams: any[] = [clubId]
        if (!scope.canManageInventory && scope.allowedWarehouseIds.length === 0) {
            return []
        }
        if (!scope.canManageInventory) {
            stockParams.push(scope.allowedWarehouseIds)
        }

        const res = await client.query(`
            SELECT p.*, c.name as category_name,
            (SELECT SUM(quantity) FROM warehouse_stock ws WHERE product_id = p.id${stockFilter}) as total_stock,
            (
                SELECT json_agg(json_build_object(
                    'warehouse_id', ws.warehouse_id,
                    'warehouse_name', w.name,
                    'quantity', ws.quantity,
                    'is_default', w.is_default
                ))
                FROM warehouse_stock ws
                JOIN warehouses w ON ws.warehouse_id = w.id
                WHERE ws.product_id = p.id${stockFilter}
            ) as stocks,
            (
                SELECT json_agg(json_build_object(
                    'cost_price', s.cost_price,
                    'created_at', s.created_at,
                    'supplier_name', s.supplier_name,
                    'supply_id', s.id
                ))
                FROM (
                    SELECT si.cost_price, sup.created_at, sup.supplier_name, sup.id
                    FROM warehouse_supply_items si
                    JOIN warehouse_supplies sup ON si.supply_id = sup.id
                    WHERE si.product_id = p.id AND sup.status = 'COMPLETED'
                    ORDER BY sup.created_at DESC
                    LIMIT 5
                ) s
            ) as price_history
            FROM warehouse_products p 
            LEFT JOIN warehouse_categories c ON p.category_id = c.id 
            WHERE p.club_id = $1 
            ORDER BY CASE WHEN p.abc_category IS NULL THEN 4 WHEN p.abc_category = 'A' THEN 1 WHEN p.abc_category = 'B' THEN 2 ELSE 3 END, p.name
        `, stockParams)
        
        return res.rows.map(row => ({
            ...row,
            current_stock: Number(row.total_stock) || 0,
            units_per_box: row.units_per_box || 1, // Ensure this is mapped
            stocks: row.stocks || [],
            price_history: row.price_history || []
        })) as Product[]
    } finally {
        client.release()
    }
}

export async function createProduct(clubId: string, userId: string, data: { name: string, barcode?: string | null, barcodes?: string[], category_id: number | null, cost_price: number, selling_price: number, current_stock: number, min_stock_level?: number, units_per_box?: number }) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        if (!Number.isFinite(data.current_stock) || !Number.isInteger(data.current_stock) || data.current_stock < 0) {
            throw new Error("Начальный остаток должен быть целым неотрицательным числом")
        }
        
        // 1. Create Product
        const res = await client.query(`
            INSERT INTO warehouse_products (club_id, category_id, name, barcode, barcodes, cost_price, selling_price, current_stock, min_stock_level, units_per_box)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `, [clubId, data.category_id, data.name, data.barcode || null, data.barcodes || [], data.cost_price, data.selling_price, data.current_stock, data.min_stock_level || 0, data.units_per_box || 1])
        
        const productId = res.rows[0].id

        // 2. Add Stock to Warehouse (default or fallback)
        if (data.current_stock > 0) {
            const whRes = await client.query('SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1', [clubId])
            const warehouseId = whRes.rows[0]?.id
            
            if (!warehouseId) {
                throw new Error("Нельзя установить начальный остаток: в клубе не создано ни одного склада")
            }

            await client.query(
                `
                INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity
                `,
                [warehouseId, productId, data.current_stock]
            )

            await logStockMovement(
                client,
                clubId,
                userId,
                productId,
                data.current_stock,
                0,
                data.current_stock,
                'SUPPLY',
                'Initial Stock',
                'WAREHOUSE',
                warehouseId,
                null,
                warehouseId
            )
        }
        
        await client.query('COMMIT')
        await logOperation(clubId, userId, 'CREATE_PRODUCT', 'PRODUCT', productId, data)
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function updateProduct(id: number, clubId: string, userId: string, data: { name: string, barcode?: string | null, barcodes?: string[], category_id: number | null, cost_price: number, selling_price: number, min_stock_level?: number, is_active: boolean, units_per_box?: number }) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        await client.query(`
            UPDATE warehouse_products 
            SET name = $1, barcode = $2, barcodes = $3, category_id = $4, cost_price = $5, selling_price = $6, min_stock_level = $7, is_active = $8, units_per_box = $9
            WHERE id = $10
        `, [data.name, data.barcode || null, data.barcodes || [], data.category_id, data.cost_price, data.selling_price, data.min_stock_level || 0, data.is_active, data.units_per_box || 1, id])
        
        await client.query('COMMIT')
        await logOperation(clubId, userId, 'UPDATE_PRODUCT', 'PRODUCT', id, data)
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

// Helper to manually adjust stock in a specific warehouse (Admin Override)
export async function adjustWarehouseStock(clubId: string, userId: string, productId: number, warehouseId: number, newQuantity: number, reason: string) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        if (!Number.isFinite(newQuantity) || !Number.isInteger(newQuantity) || newQuantity < 0) {
            throw new Error("Новый остаток должен быть целым неотрицательным числом")
        }
        await assertWarehouseBelongsToClub(client, clubId, warehouseId)
        await assertProductBelongsToClub(client, clubId, productId)
        await assertUserCanUseWarehouses(client, clubId, userId, [warehouseId])
        
        // Get old stock
        const stockRes = await client.query('SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE', [warehouseId, productId])
        const oldQuantity = stockRes.rows[0]?.quantity || 0
        const diff = newQuantity - oldQuantity
        
        if (diff === 0) {
            await client.query('ROLLBACK')
            return
        }

        // Update Stock
        const { previousStock, newStock } = await applyWarehouseStockDelta(client, warehouseId, productId, diff)
        
        // Update Total Cache in Products Table
        await client.query(`
            UPDATE warehouse_products p
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
            WHERE id = $1 AND club_id = $2
        `, [productId, clubId])

        await logStockMovement(client, clubId, userId, productId, diff, previousStock, newStock, 'MANUAL_EDIT', reason, 'WAREHOUSE', warehouseId, null, warehouseId)
        
        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function writeOffProduct(clubId: string, userId: string, productId: number, amount: number, reason: string) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
            throw new Error("Количество для списания должно быть целым положительным числом")
        }
        await assertProductBelongsToClub(client, clubId, productId)
        const accessScope = await getInventoryAccessScope(client, clubId, userId)
        
        // Find warehouse with enough stock
        // Strategy: First Default, then others
        const stocksParams: any[] = [productId, clubId]
        const warehouseRestriction = !accessScope.canManageInventory
            ? ` AND ws.warehouse_id = ANY($3)`
            : ''
        if (!accessScope.canManageInventory && accessScope.allowedWarehouseIds.length === 0) {
            throw new Error("Для вашего профиля не настроены доступные склады")
        }
        if (!accessScope.canManageInventory) {
            stocksParams.push(accessScope.allowedWarehouseIds)
        }

        const stocks = await client.query(`
            SELECT ws.warehouse_id, ws.quantity 
            FROM warehouse_stock ws
            JOIN warehouses w ON ws.warehouse_id = w.id
            WHERE ws.product_id = $1
              AND w.club_id = $2
              ${warehouseRestriction}
            ORDER BY w.is_default DESC, ws.quantity DESC
        `, stocksParams)
        
        let remaining = amount
        const writeOffs: { warehouseId: number, amount: number }[] = []
        
        // Check total availability
        const totalAvailable = stocks.rows.reduce((sum, row) => sum + row.quantity, 0)
        if (totalAvailable < amount) {
            throw new Error(`Недостаточно товара на складе. Текущий остаток: ${totalAvailable}`)
        }
        
        // Calculate write-offs per warehouse
        for (const stock of stocks.rows) {
            if (remaining <= 0) break
            const take = Math.min(stock.quantity, remaining)
            writeOffs.push({ warehouseId: stock.warehouse_id, amount: take })
            remaining -= take
        }
        
        // Apply updates
        for (const wo of writeOffs) {
            const { previousStock, newStock } = await applyWarehouseStockDelta(client, wo.warehouseId, productId, -wo.amount)
            await logStockMovement(
                client,
                clubId,
                userId,
                productId,
                -wo.amount,
                previousStock,
                newStock,
                'WRITE_OFF',
                reason,
                'WAREHOUSE',
                wo.warehouseId,
                null,
                wo.warehouseId
            )
        }
        
        // Update Total Cache
        await client.query(`
            UPDATE warehouse_products p
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
            WHERE id = $1 AND club_id = $2
        `, [productId, clubId])
        
        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function getProductHistory(clubId: string, productId: number) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT m.*, u.full_name as user_name
        FROM warehouse_stock_movements m
        LEFT JOIN users u ON m.user_id = u.id
        WHERE m.club_id = $1 AND m.product_id = $2
        ORDER BY m.created_at DESC
        LIMIT 50
    `, [clubId, productId])
    return res.rows
}

export async function deleteProduct(id: number, clubId: string) {
    await requireClubAccess(clubId)
    await query(`DELETE FROM warehouse_products WHERE id = $1 AND club_id = $2`, [id, clubId])
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function bulkUpdatePrices(ids: number[], clubId: string, type: 'fixed' | 'percent', value: number) {
    await requireClubAccess(clubId)
    if (!ids.length) return
    if (type === 'fixed') {
        await query(`
            UPDATE warehouse_products 
            SET selling_price = $1 
            WHERE id = ANY($2) AND club_id = $3
        `, [value, ids, clubId])
    } else {
        // Percent increase/decrease
        // value is percentage (e.g. 10 for +10%, -10 for -10%)
        // Formula: price * (1 + value/100)
        await query(`
            UPDATE warehouse_products 
            SET selling_price = selling_price * (1 + $1::decimal / 100)
            WHERE id = ANY($2) AND club_id = $3
        `, [value, ids, clubId])
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export type Supplier = {
    id: number
    club_id: number
    name: string
    contact_info?: string
    is_active: boolean
    created_at: string
}

// --- SUPPLIERS ---

export async function getSuppliers(clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT * FROM warehouse_suppliers 
        WHERE club_id = $1 AND is_active = true 
        ORDER BY name
    `, [clubId])
    return res.rows as Supplier[]
}

export async function createSupplier(clubId: string, name: string, contactInfo?: string) {
    await requireClubAccess(clubId)
    // Check if exists (case insensitive)
    const existing = await query(`
        SELECT id FROM warehouse_suppliers 
        WHERE club_id = $1 AND LOWER(name) = LOWER($2)
    `, [clubId, name])
    
    if (existing.rowCount && existing.rowCount > 0) {
        return existing.rows[0].id // Return existing ID if found
    }

    const res = await query(`
        INSERT INTO warehouse_suppliers (club_id, name, contact_info)
        VALUES ($1, $2, $3)
        RETURNING id
    `, [clubId, name, contactInfo])
    
    revalidatePath(`/clubs/${clubId}/inventory`)
    return res.rows[0].id
}

// --- SUPPLIES ---

export async function getSuppliersForSelect(clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`SELECT id, name FROM warehouse_suppliers WHERE club_id = $1 AND is_active = true ORDER BY name`, [clubId])
    return res.rows
}


export async function getSupplies(clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT s.*, u.full_name as created_by_name,
        (SELECT COUNT(*) FROM warehouse_supply_items WHERE supply_id = s.id) as items_count
        FROM warehouse_supplies s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.club_id = $1
        ORDER BY s.created_at DESC
    `, [clubId])
    return res.rows as Supply[]
}

export async function createSupply(clubId: string, userId: string, data: { supplier_name: string, notes: string, items: { product_id: number, quantity: number, cost_price: number }[], warehouse_id?: number, status?: 'DRAFT' | 'COMPLETED', shift_id?: string }) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        if (!data.items || data.items.length === 0) throw new Error("Поставка должна содержать хотя бы один товар")
        for (const i of data.items) {
            if (!Number.isFinite(i.quantity) || !Number.isInteger(i.quantity) || i.quantity <= 0) {
                throw new Error("Количество в поставке должно быть целым положительным числом")
            }
            if (!Number.isFinite(i.cost_price) || i.cost_price < 0) {
                throw new Error("Себестоимость в поставке должна быть неотрицательным числом")
            }
        }
        await assertProductsBelongToClub(client, clubId, data.items.map(i => i.product_id))

        // 1. Get or Create Supplier
        let supplierId: number | null = null
        if (data.supplier_name) {
            // Check if exists
            const existing = await client.query(`SELECT id FROM warehouse_suppliers WHERE club_id = $1 AND LOWER(name) = LOWER($2)`, [clubId, data.supplier_name])
            if (existing.rowCount && existing.rowCount > 0) {
                supplierId = existing.rows[0].id
            } else {
                // Create new
                const newSup = await client.query(`INSERT INTO warehouse_suppliers (club_id, name) VALUES ($1, $2) RETURNING id`, [clubId, data.supplier_name])
                supplierId = newSup.rows[0].id
            }
        }

        // 2. Create Supply
        const status = data.status || 'COMPLETED'
        const totalCost = data.items.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0)

        let warehouseId = data.warehouse_id
        if (!warehouseId) {
            const whRes = await client.query('SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1', [clubId])
            warehouseId = whRes.rows[0]?.id
        }
        if (!warehouseId) throw new Error("В клубе не создано ни одного склада")
        await assertWarehouseBelongsToClub(client, clubId, warehouseId)
        await assertUserCanUseWarehouses(client, clubId, userId, [warehouseId])

        const supplyRes = await client.query(`
            INSERT INTO warehouse_supplies (club_id, supplier_name, supplier_id, notes, total_cost, created_by, status, warehouse_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [clubId, data.supplier_name, supplierId, data.notes, totalCost, userId, status, warehouseId])
        const supplyId = supplyRes.rows[0].id

        // 3. Add Items & Update Stock if COMPLETED
        for (const item of data.items) {
            await client.query(`
                INSERT INTO warehouse_supply_items (supply_id, product_id, quantity, cost_price, total_cost)
                VALUES ($1, $2, $3, $4, $5)
            `, [supplyId, item.product_id, item.quantity, item.cost_price, item.quantity * item.cost_price])

            if (status === 'COMPLETED' && warehouseId) {
                const { previousStock, newStock } = await applyWarehouseStockDelta(client, warehouseId, item.product_id, item.quantity)
                
                await client.query(`
                    UPDATE warehouse_products
                    SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1),
                        cost_price = $2
                    WHERE id = $1 AND club_id = $3
                `, [item.product_id, item.cost_price, clubId])
                
                await logStockMovement(
                    client,
                    clubId,
                    userId,
                    item.product_id,
                    item.quantity,
                    previousStock,
                    newStock,
                    'SUPPLY',
                    `Supply #${supplyId}`,
                    'SUPPLY',
                    supplyId,
                    data.shift_id || null,
                    warehouseId
                )
            }
        }

        await client.query('COMMIT')
        await logOperation(clubId, userId, 'CREATE_SUPPLY', 'SUPPLY', supplyId, { itemsCount: data.items.length, totalCost, warehouseId, status })
        
        // Update tasks
        if (status === 'COMPLETED') {
            await checkReplenishmentNeeds(clubId)
        }
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function getSupplyItems(clubId: string, supplyId: number) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT si.*, p.name as product_name
        FROM warehouse_supply_items si
        JOIN warehouse_supplies s ON si.supply_id = s.id
        JOIN warehouse_products p ON si.product_id = p.id
        WHERE s.club_id = $1 AND si.supply_id = $2
        ORDER BY p.name
    `, [clubId, supplyId])
    return res.rows as SupplyItem[]
}

export async function deleteSupply(supplyId: number, clubId: string, userId: string) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        const supplyRes = await client.query('SELECT * FROM warehouse_supplies WHERE id = $1 AND club_id = $2', [supplyId, clubId])
        if (supplyRes.rows.length === 0) throw new Error('Поставка не найдена')
        const supply = supplyRes.rows[0]
        
        if (supply.status === 'COMPLETED') {
            const itemsRes = await client.query('SELECT * FROM warehouse_supply_items WHERE supply_id = $1', [supplyId])
            const warehouseId = supply.warehouse_id

            for (const item of itemsRes.rows) {
                // Check for later inventories
                const laterInvRes = await client.query(`
                    SELECT id FROM warehouse_inventories 
                    WHERE club_id = $1 AND status = 'CLOSED' AND closed_at > $2
                    LIMIT 1
                `, [clubId, supply.created_at])

                if (laterInvRes.rows.length === 0 && warehouseId) {
                    await client.query(`
                        UPDATE warehouse_stock 
                        SET quantity = GREATEST(0, quantity - $1)
                        WHERE warehouse_id = $2 AND product_id = $3
                    `, [item.quantity, warehouseId, item.product_id])
                    
                    await client.query(`
                        UPDATE warehouse_products
                        SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                        WHERE id = $1 AND club_id = $2
                    `, [item.product_id, clubId])
                }
                
                // Delete movement
                await client.query(`
                    DELETE FROM warehouse_stock_movements 
                    WHERE club_id = $1 AND related_entity_type = 'SUPPLY' AND related_entity_id = $2 AND product_id = $3
                `, [clubId, supplyId, item.product_id])
            }
        }
        
        await client.query('DELETE FROM warehouse_supplies WHERE id = $1 AND club_id = $2', [supplyId, clubId])
        await logOperation(clubId, userId, 'DELETE_SUPPLY', 'SUPPLY', supplyId)
        
        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function getProductPriceHistory(productId: number, clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT si.cost_price, s.created_at, s.supplier_name, s.id as supply_id
        FROM warehouse_supply_items si
        JOIN warehouse_supplies s ON si.supply_id = s.id
        WHERE si.product_id = $1 AND s.club_id = $2 AND s.status = 'COMPLETED'
        ORDER BY s.created_at DESC
        LIMIT 10
    `, [productId, clubId])
    return res.rows as { cost_price: number, created_at: string, supplier_name: string, supply_id: number }[]
}

// --- INVENTORIES ---

export async function getInventories(clubId: string) {
    const userId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        const scope = await getInventoryAccessScope(client, clubId, userId)
        if (!scope.canManageInventory && scope.allowedWarehouseIds.length === 0) {
            return []
        }

        const params: any[] = [clubId]
        let warehouseFilter = ""
        if (!scope.canManageInventory) {
            params.push(scope.allowedWarehouseIds)
            warehouseFilter = " AND i.warehouse_id = ANY($2)"
        }

        const res = await client.query(
            `
            SELECT i.*, u.full_name as created_by_name, w.name as warehouse_name
            FROM warehouse_inventories i
            LEFT JOIN users u ON i.created_by = u.id
            LEFT JOIN warehouses w ON i.warehouse_id = w.id
            WHERE i.club_id = $1${warehouseFilter}
            ORDER BY i.started_at DESC
            `,
            params
        )
        return res.rows.map(row => ({
            ...row,
            created_by: row.created_by?.toString()
        })) as Inventory[]
    } finally {
        client.release()
    }
}

export async function getInventory(id: number) {
    const sessionUserId = await requireSessionUserId()
    const invClubRes = await query('SELECT club_id FROM warehouse_inventories WHERE id = $1', [id])
    if ((invClubRes.rowCount || 0) === 0) throw new Error("Инвентаризация не найдена")
    const clubId = String(invClubRes.rows[0].club_id)
    await assertSessionUserCanAccessClub(clubId, sessionUserId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        const inventoryRes = await client.query(
            `SELECT i.*, u.full_name as created_by_name,
                    COALESCE(i.sales_capture_mode_snapshot, (c.inventory_settings->>'sales_capture_mode')) as sales_capture_mode
             FROM warehouse_inventories i
             LEFT JOIN users u ON i.created_by = u.id
             LEFT JOIN clubs c ON i.club_id = c.id
             WHERE i.id = $1 AND i.club_id = $2`,
            [id, clubId]
        )
        const inventory = inventoryRes.rows[0]
        if (!inventory) throw new Error("Инвентаризация не найдена")
        await assertUserCanUseWarehouses(client, clubId, sessionUserId, [inventory.warehouse_id])
        return {
            ...inventory,
            created_by: inventory.created_by?.toString()
        } as Inventory
    } finally {
        client.release()
    }
}

export async function getInventoryItems(inventoryId: number) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        const sessionUserId = await requireSessionUserId()
        const invHeader = await client.query('SELECT club_id, warehouse_id, started_at, closed_at, status FROM warehouse_inventories WHERE id = $1', [inventoryId])
        const inv = invHeader.rows[0]
        if (!inv) throw new Error("Инвентаризация не найдена")
        await assertSessionUserCanAccessClub(String(inv.club_id), sessionUserId)
        await assertUserCanUseWarehouses(client, String(inv.club_id), sessionUserId, [inv.warehouse_id])

        // Optimized query with movements JOIN (fixes N+1 problem)
        const res = await client.query(`
            SELECT ii.*, 
                   p.name as product_name, 
                   p.barcode as barcode, 
                   p.barcodes as barcodes, 
                   c.name as category_name,
                   COALESCE(movements.total_movement, 0) as movement_during_inventory
            FROM warehouse_inventory_items ii
            JOIN warehouse_products p ON ii.product_id = p.id
            LEFT JOIN warehouse_categories c ON p.category_id = c.id
            LEFT JOIN (
                SELECT 
                    product_id,
                    SUM(change_amount) as total_movement
                FROM warehouse_stock_movements
                WHERE warehouse_id = $2
                  AND created_at > $3
                  AND ($5::timestamp IS NULL OR created_at <= $5)
                  AND club_id = $4
                  AND COALESCE(related_entity_type, '') != 'INVENTORY'
                GROUP BY product_id
            ) movements ON movements.product_id = ii.product_id
            WHERE ii.inventory_id = $1
            ORDER BY c.name NULLS LAST, p.name
        `, [inventoryId, inv.warehouse_id, inv.started_at, inv.club_id, inv.status === 'CLOSED' ? inv.closed_at : null])

        const items = res.rows as (InventoryItem & { movement_during_inventory?: number | string })[]

        // Apply movement adjustments to expected_stock for display
        for (const item of items) {
            const movement = Number(item.movement_during_inventory || 0)
            if (movement !== 0) {
                item.expected_stock = Number(item.expected_stock) + movement
            }
            // Remove helper field
            delete (item as any).movement_during_inventory
        }

        return items
    } finally {
        client.release()
    }
}

export async function getMetrics() {
    await requireSessionUserId()
    const res = await query(`SELECT key, label FROM system_metrics WHERE type = 'MONEY' ORDER BY label`)
    return res.rows as { key: string, label: string }[]
}

export async function getClubSettings(clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT id, owner_id, inventory_required, inventory_settings 
        FROM clubs 
        WHERE id = $1
    `, [clubId])
    return res.rows[0] as { 
        id: number, 
        owner_id: string, 
        inventory_required: boolean,
        inventory_settings: { 
            employee_allowed_warehouse_ids?: number[], 
            employee_default_metric_key?: string,
            blind_inventory_enabled?: boolean,
            sales_capture_mode?: 'INVENTORY' | 'SHIFT',
            inventory_timing?: 'END_SHIFT' | 'START_SHIFT',
            shift_accountability_mode?: 'DISABLED' | 'WAREHOUSE',
            allow_salary_deduction?: boolean,
            employee_discount_percent?: number,
            allow_cost_price_sale?: boolean,
            price_tag_template?: PriceTagTemplate,
            price_tag_settings?: PriceTagSettings
        } 
    }
}

export async function getInventoryPageAccess(clubId: string) {
    const userId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        const scope = await getInventoryAccessScope(client, clubId, userId)
        return {
            userId,
            canManageInventory: scope.canManageInventory,
            isFullAccess: scope.isFullAccess,
            allowedWarehouseIds: scope.allowedWarehouseIds,
        }
    } finally {
        client.release()
    }
}

export type PriceTagTemplate = {
    id: string
    name: string
    width_mm: number
    height_mm: number
    background_image_url?: string
    background_color?: string
    font_family?: string
    font_url?: string
    show_decimals?: boolean
    elements: {
        id: string
        type: 'text' | 'barcode' | 'price'
        x: number // in mm
        y: number // in mm
        fontSize?: number
        fontWeight?: string
        color?: string
        font_family?: string
        font_url?: string
        currency_font_family?: string
        currency_font_url?: string
        content?: string
        field?: 'name' | 'price' | 'barcode'
        width?: number // in mm
        height?: number // in mm
        wrap_text?: boolean
        auto_scale?: boolean
    }[]
}

export type PriceTagSettings = {
    active_template_id?: string
    templates: PriceTagTemplate[]
}

export async function updateInventorySettings(clubId: string, userId: string, settings: any) {
    await assertUserCanAccessClub(clubId, userId)
    await query(`
        UPDATE clubs 
        SET inventory_settings = $1 
        WHERE id = $2
    `, [settings, clubId])
    
    await logOperation(clubId, userId, 'UPDATE_SETTINGS', 'CLUB', Number(clubId), settings)
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function updateInventoryRequired(clubId: string, userId: string, inventoryRequired: boolean) {
    await assertUserCanAccessClub(clubId, userId)
    await query(
        `
        UPDATE clubs
        SET inventory_required = $1
        WHERE id = $2
    `,
        [inventoryRequired, clubId]
    )

    await logOperation(clubId, userId, 'UPDATE_SETTINGS', 'CLUB', Number(clubId), { inventory_required: inventoryRequired })
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function getUserRoleInClub(clubId: string, userId: string) {
    await assertUserCanAccessClub(clubId, userId)
    const res = await query(`
        SELECT role FROM club_employees 
        WHERE club_id = $1 AND user_id = $2 AND is_active = true
    `, [clubId, userId])
    
    if (res.rows.length === 0) return null
    return res.rows[0].role as string
}

export async function createInventory(clubId: string, userId: string, targetMetricKey: string | null, categoryId?: number | null, warehouseId?: number | null, shiftId: string | null = null) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        const accessScope = await getInventoryAccessScope(client, clubId, userId)

        // 1. Resolve warehouse if not provided
        let targetWarehouseId = warehouseId
        if (!targetWarehouseId) {
            const whRes = accessScope.canManageInventory
                ? await client.query('SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1', [clubId])
                : await client.query(
                    `SELECT id
                     FROM warehouses
                     WHERE club_id = $1
                       AND is_active = true
                       AND id = ANY($2)
                     ORDER BY is_default DESC, created_at ASC
                     LIMIT 1`,
                    [clubId, accessScope.allowedWarehouseIds]
                )
            targetWarehouseId = whRes.rows[0]?.id
        }
        await assertUserCanUseWarehouses(client, clubId, userId, [targetWarehouseId])

        // 2. Check if an OPEN inventory already exists
        if (shiftId) {
            const existingInv = await client.query(`
                SELECT id, warehouse_id FROM warehouse_inventories 
                WHERE club_id = $1 AND shift_id = $2 AND status = 'OPEN'
                ORDER BY CASE WHEN warehouse_id = $3 THEN 0 ELSE 1 END, started_at ASC
                LIMIT 1
            `, [clubId, shiftId, targetWarehouseId || null])
            
            if (existingInv.rowCount && existingInv.rowCount > 0) {
                const existingWarehouseId = existingInv.rows[0].warehouse_id
                if (targetWarehouseId && existingWarehouseId && Number(existingWarehouseId) !== Number(targetWarehouseId)) {
                    throw new Error(`Для этой смены уже открыта инвентаризация по складу #${existingWarehouseId}. Закройте её или используйте тот же склад.`)
                }
                await client.query('ROLLBACK')
                return existingInv.rows[0].id
            }
        } else {
            const existingOpen = await client.query(`
                SELECT id, warehouse_id
                FROM warehouse_inventories
                WHERE club_id = $1 AND status = 'OPEN'
                ORDER BY started_at ASC
                LIMIT 1
            `, [clubId])
            if (existingOpen.rowCount && existingOpen.rowCount > 0) {
                const existingWarehouseId = existingOpen.rows[0].warehouse_id
                throw new Error(
                    existingWarehouseId
                        ? `В клубе уже есть открытая инвентаризация по складу #${existingWarehouseId}. Сначала завершите её.`
                        : "В клубе уже есть открытая инвентаризация. Сначала завершите её."
                )
            }
        }

        // 3. Create Inventory Header
        const invRes = await client.query(`
            INSERT INTO warehouse_inventories (club_id, created_by, status, target_metric_key, warehouse_id, shift_id)
            VALUES ($1, $2, 'OPEN', $3, $4, $5)
            RETURNING id
        `, [clubId, userId, targetMetricKey, targetWarehouseId, shiftId])
        const inventoryId = invRes.rows[0].id

        // 4. Snapshot current stock
        let query = ''
        const params: any[] = [clubId]
        
        if (targetWarehouseId) {
            // Specific warehouse snapshot.
            // Include all active club products, even with zero stock, so new clubs
            // can search and count positions immediately after setup.
            query = `
                SELECT p.id,
                       COALESCE(ws.quantity, 0) as current_stock,
                       p.cost_price,
                       p.selling_price
                FROM warehouse_products p
                LEFT JOIN warehouse_stock ws ON p.id = ws.product_id AND ws.warehouse_id = $2
                WHERE p.club_id = $1 AND p.is_active = true
            `
            params.push(targetWarehouseId)
            
            if (categoryId) {
                query += ` AND p.category_id = $3`
                params.push(categoryId)
            }
        } else {
            // Aggregate snapshot across all warehouses.
            // Include all active club products, even when total stock is zero.
            query = `
                SELECT p.id,
                       COALESCE((SELECT SUM(quantity) FROM warehouse_stock WHERE product_id = p.id), 0) as current_stock,
                       p.cost_price,
                       p.selling_price
                FROM warehouse_products p
                WHERE p.club_id = $1 AND p.is_active = true
            `

            if (categoryId) {
                query += ` AND p.category_id = $2`
                params.push(categoryId)
            }
        }

        const productsRes = await client.query(query, params)
        
        for (const p of productsRes.rows) {
            await client.query(`
                INSERT INTO warehouse_inventory_items (inventory_id, product_id, expected_stock, cost_price_snapshot, selling_price_snapshot)
                VALUES ($1, $2, $3, $4, $5)
            `, [inventoryId, p.id, p.current_stock, p.cost_price, p.selling_price])
        }

        await client.query('COMMIT')
        await logOperation(clubId, userId, 'CREATE_INVENTORY', 'INVENTORY', inventoryId, { categoryId, warehouseId })
        return inventoryId
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

export async function addProductToInventory(inventoryId: number, productId: number) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // Get product details and current stock in that warehouse (even if 0)
        // We need to know which warehouse this inventory is for
        const sessionUserId = await requireSessionUserId()
        const inv = await client.query(`SELECT warehouse_id, club_id, status FROM warehouse_inventories WHERE id = $1`, [inventoryId])
        let warehouseId = inv.rows[0]?.warehouse_id
        const currentClubId = inv.rows[0]?.club_id
        const inventoryStatus = inv.rows[0]?.status

        if (!currentClubId) throw new Error("Инвентаризация не найдена")
        await assertSessionUserCanAccessClub(String(currentClubId), sessionUserId)
        if (inventoryStatus !== 'OPEN') throw new Error("Добавлять товары можно только в открытую инвентаризацию")
        await assertUserCanUseWarehouses(client, String(currentClubId), sessionUserId, [warehouseId])

        // Check if already exists
        const existing = await client.query(`SELECT 1 FROM warehouse_inventory_items WHERE inventory_id = $1 AND product_id = $2`, [inventoryId, productId])
        if (existing.rowCount && existing.rowCount > 0) {
            throw new Error("Этот товар уже есть в списке")
        }

        if (!warehouseId) {
             // Fallback: Use default or any warehouse if not specified
             const whRes = await client.query('SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1', [currentClubId])
             warehouseId = whRes.rows[0]?.id
        }

        if (!warehouseId) throw new Error("Инвентаризация не привязана к складу и склад не найден")

        const productRes = await client.query(`
            SELECT p.cost_price, p.selling_price, COALESCE(ws.quantity, 0) as current_stock
            FROM warehouse_products p
            LEFT JOIN warehouse_stock ws ON p.id = ws.product_id AND ws.warehouse_id = $2
            WHERE p.id = $1 AND p.club_id = $3
        `, [productId, warehouseId, currentClubId])
        
        const product = productRes.rows[0]
        if (!product) throw new Error("Товар не найден")

        // Add item
        await client.query(`
            INSERT INTO warehouse_inventory_items (
                inventory_id,
                product_id,
                expected_stock,
                actual_stock,
                cost_price_snapshot,
                selling_price_snapshot,
                added_manually
            )
            VALUES ($1, $2, $3, NULL, $4, $5, TRUE) 
        `, [inventoryId, productId, product.current_stock, product.cost_price, product.selling_price])

        await client.query('COMMIT')
        revalidatePath(`/clubs/${inv.rows[0].club_id}/inventory`)
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

export async function cancelInventory(inventoryId: number, clubId: string, userId: string) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        const scope = await getInventoryAccessScope(client, clubId, userId)
        const invRes = await client.query(
            `
            SELECT id, status, warehouse_id, created_by
            FROM warehouse_inventories
            WHERE id = $1 AND club_id = $2
            FOR UPDATE
            `,
            [inventoryId, clubId]
        )
        const inventory = invRes.rows[0]
        if (!inventory) throw new Error("Инвентаризация не найдена")
        await assertUserCanUseWarehouses(client, clubId, userId, [inventory.warehouse_id])
        if (inventory.status !== 'OPEN') {
            throw new Error("Отменять можно только открытую инвентаризацию")
        }
        if (!scope.canManageInventory && String(inventory.created_by) !== String(userId)) {
            throw new Error("Отменять чужую инвентаризацию нельзя")
        }

        await client.query(
            `
            UPDATE warehouse_inventories
            SET status = 'CANCELED',
                canceled_at = NOW(),
                canceled_by = $3::uuid
            WHERE id = $1 AND club_id = $2
            `,
            [inventoryId, clubId, userId]
        )
        await logOperation(clubId, userId, 'CANCEL_INVENTORY', 'INVENTORY', inventoryId)
        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function deleteInventory(inventoryId: number, clubId: string, userId: string) {
    return cancelInventory(inventoryId, clubId, userId)
}

export async function getInventoryPostCloseCorrections(inventoryId: number) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        const sessionUserId = await requireSessionUserId()
        const invRes = await client.query(
            `SELECT club_id, warehouse_id FROM warehouse_inventories WHERE id = $1`,
            [inventoryId]
        )
        const inventory = invRes.rows[0]
        if (!inventory) throw new Error("Инвентаризация не найдена")
        await assertSessionUserCanAccessClub(String(inventory.club_id), sessionUserId)
        await assertUserCanUseWarehouses(client, String(inventory.club_id), sessionUserId, [inventory.warehouse_id])

        const res = await client.query(
            `
            SELECT c.*,
                   p.name as product_name,
                   u.full_name as created_by_name
            FROM inventory_post_close_corrections c
            JOIN warehouse_products p ON p.id = c.product_id
            LEFT JOIN users u ON u.id = c.created_by
            WHERE c.inventory_id = $1
            ORDER BY c.created_at DESC, c.id DESC
            `,
            [inventoryId]
        )
        return res.rows as InventoryPostCloseCorrection[]
    } finally {
        client.release()
    }
}

export async function getAbcAnalysisData(clubId: string) {
    await requireClubAccess(clubId)
    const client = await getClient()
    try {
        const res = await client.query(`
            WITH ReceiptCosts AS (
                SELECT receipt_id, product_id, MAX(cost_price_snapshot) as cost_price_snapshot
                FROM shift_receipt_items
                GROUP BY receipt_id, product_id
            ),
            ProductRevenue AS (
                SELECT 
                    p.id as product_id,
                    p.name,
                    p.abc_category,
                    p.current_stock,
                    p.sales_velocity,
                    COALESCE(SUM(
                        CASE
                            WHEN m.type = 'SALE' AND COALESCE(m.related_entity_type, '') = 'SHIFT_RECEIPT_VOID'
                                THEN -ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            WHEN m.type = 'RETURN'
                                THEN -ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            WHEN m.type = 'SALE'
                                THEN ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)
                            ELSE 0
                        END
                    ), 0) as total_revenue,
                    COALESCE(SUM(
                        CASE
                            WHEN m.type = 'SALE' AND COALESCE(m.related_entity_type, '') = 'SHIFT_RECEIPT_VOID' THEN -ABS(m.change_amount)
                            WHEN m.type = 'RETURN' THEN -ABS(m.change_amount)
                            WHEN m.type = 'SALE' THEN ABS(m.change_amount)
                            ELSE 0
                        END
                    ), 0) as total_sold,
                    COALESCE(SUM(
                        CASE
                            WHEN m.type = 'SALE' AND COALESCE(m.related_entity_type, '') = 'SHIFT_RECEIPT_VOID'
                                THEN -ABS(m.change_amount) * (COALESCE(m.price_at_time, p.selling_price) - COALESCE(rc.cost_price_snapshot, p.cost_price))
                            WHEN m.type = 'RETURN'
                                THEN -ABS(m.change_amount) * (COALESCE(m.price_at_time, p.selling_price) - COALESCE(rc.cost_price_snapshot, p.cost_price))
                            WHEN m.type = 'SALE'
                                THEN ABS(m.change_amount) * (COALESCE(m.price_at_time, p.selling_price) - COALESCE(rc.cost_price_snapshot, p.cost_price))
                            ELSE 0
                        END
                    ), 0) as total_profit
                FROM warehouse_products p
                LEFT JOIN warehouse_stock_movements m ON p.id = m.product_id 
                    AND m.type IN ('SALE', 'RETURN')
                    AND m.created_at > NOW() - INTERVAL '30 days'
                LEFT JOIN shift_receipts sr ON m.related_entity_type = 'SHIFT_RECEIPT' AND m.related_entity_id = sr.id
                LEFT JOIN ReceiptCosts rc ON rc.receipt_id = m.related_entity_id AND rc.product_id = p.id
                WHERE p.club_id = $1 AND p.is_active = true
                  AND COALESCE(sr.counts_in_revenue, true) = true
                GROUP BY p.id, p.name, p.abc_category, p.current_stock, p.sales_velocity
            ),
            TotalStats AS (
                SELECT SUM(total_revenue) as grand_total FROM ProductRevenue
            ),
            RankedProducts AS (
                SELECT 
                    product_id,
                    name,
                    abc_category,
                    current_stock,
                    sales_velocity,
                    total_revenue,
                    total_sold,
                    total_profit,
                    (SELECT grand_total FROM TotalStats) as grand_total,
                    SUM(total_revenue) OVER (ORDER BY total_revenue DESC) as running_total
                FROM ProductRevenue
            )
            SELECT 
                product_id,
                name,
                CASE 
                    WHEN grand_total = 0 THEN 'C'
                    WHEN (running_total - total_revenue) < grand_total * 0.8 THEN 'A'
                    WHEN (running_total - total_revenue) < grand_total * 0.95 THEN 'B'
                    ELSE 'C'
                END as abc_category,
                total_revenue,
                total_sold,
                total_profit,
                CASE 
                    WHEN total_revenue = 0 THEN 0
                    ELSE ROUND((total_profit / total_revenue * 100)::numeric, 1)
                END as margin_percent,
                CASE 
                    WHEN sales_velocity = 0 THEN NULL
                    ELSE CEIL(current_stock / sales_velocity)
                END as days_left,
                grand_total,
                CASE 
                    WHEN grand_total = 0 THEN 0
                    ELSE ROUND((total_revenue / NULLIF(grand_total, 0) * 100)::numeric, 2)
                END as revenue_share
            FROM RankedProducts
            WHERE total_revenue > 0
            ORDER BY total_revenue DESC
        `, [clubId])
        
        return res.rows as {
            product_id: number
            name: string
            abc_category: string
            total_revenue: number
            total_sold: number
            total_profit: number
            margin_percent: number
            days_left: number | null
            grand_total: number
            revenue_share: number
        }[]
    } catch (err) {
        console.error(err)
        return []
    } finally {
        client.release()
    }
}

export async function getProductByBarcode(clubId: string, barcode: string) {
    const userId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        const scope = await getInventoryAccessScope(client, clubId, userId)
        if (!scope.canManageInventory && scope.allowedWarehouseIds.length === 0) {
            return null
        }

        const stockFilter = !scope.canManageInventory ? " AND ws.warehouse_id = ANY($3)" : ""
        const params: any[] = [clubId, barcode]
        if (!scope.canManageInventory) {
            params.push(scope.allowedWarehouseIds)
        }

        const res = await client.query(
            `
            SELECT p.*,
            (SELECT SUM(quantity) FROM warehouse_stock ws WHERE ws.product_id = p.id${stockFilter}) as total_stock,
            (
                SELECT json_agg(json_build_object(
                    'warehouse_id', ws.warehouse_id,
                    'warehouse_name', w.name,
                    'quantity', ws.quantity,
                    'is_default', w.is_default
                ))
                FROM warehouse_stock ws
                JOIN warehouses w ON ws.warehouse_id = w.id
                WHERE ws.product_id = p.id${stockFilter}
            ) as stocks
            FROM warehouse_products p
            WHERE p.club_id = $1 AND ($2 = ANY(p.barcodes) OR p.barcode = $2) AND p.is_active = true
            `,
            params
        )
        const row = res.rows[0]
        if (!row) return null
        return {
            ...row,
            current_stock: Number(row.total_stock) || 0,
            stocks: row.stocks || [],
        } as Product
    } finally {
        client.release()
    }
}

export async function updateInventoryItem(itemId: number, actualStock: number | null, clubId: string) {
    const sessionUserId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    const normalizedActualStock = normalizeInventoryActualStock(actualStock)
    try {
        const itemRes = await client.query(
            `
            SELECT i.status, i.warehouse_id
            FROM warehouse_inventory_items ii
            JOIN warehouse_inventories i ON ii.inventory_id = i.id
            WHERE ii.id = $1 AND i.club_id = $2
            LIMIT 1
            `,
            [itemId, clubId]
        )
        const inventory = itemRes.rows[0]
        if (!inventory) throw new Error("Позиция инвентаризации не найдена")
        await assertUserCanUseWarehouses(client, clubId, sessionUserId, [inventory.warehouse_id])
        if (inventory.status !== 'OPEN') {
            throw new Error("Редактировать можно только открытую инвентаризацию")
        }

        await client.query(`
            UPDATE warehouse_inventory_items ii
            SET actual_stock = $1,
                counted_at = CASE WHEN $1 IS NULL THEN NULL ELSE NOW() END,
                counted_by = CASE WHEN $1 IS NULL THEN NULL ELSE $4::uuid END
            FROM warehouse_inventories i
            WHERE ii.id = $2 AND ii.inventory_id = i.id AND i.club_id = $3
        `, [normalizedActualStock, itemId, clubId, sessionUserId])
    } finally {
        client.release()
    }

    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function bulkUpdateInventoryItems(items: { id: number, actual_stock: number | null }[], clubId: string) {
    const sessionUserId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        for (const item of items) {
            const normalizedActualStock = normalizeInventoryActualStock(item.actual_stock)
            const itemRes = await client.query(
                `
                SELECT i.status, i.warehouse_id
                FROM warehouse_inventory_items ii
                JOIN warehouse_inventories i ON ii.inventory_id = i.id
                WHERE ii.id = $1 AND i.club_id = $2
                LIMIT 1
                `,
                [item.id, clubId]
            )
            const inventory = itemRes.rows[0]
            if (!inventory) throw new Error("Позиция инвентаризации не найдена")
            await assertUserCanUseWarehouses(client, clubId, sessionUserId, [inventory.warehouse_id])
            if (inventory.status !== 'OPEN') {
                throw new Error("Редактировать можно только открытую инвентаризацию")
            }
            await client.query(`
                UPDATE warehouse_inventory_items ii
                SET actual_stock = $1,
                    counted_at = CASE WHEN $1 IS NULL THEN NULL ELSE NOW() END,
                    counted_by = CASE WHEN $1 IS NULL THEN NULL ELSE $4::uuid END
                FROM warehouse_inventories i
                WHERE ii.id = $2 AND ii.inventory_id = i.id AND i.club_id = $3
            `, [normalizedActualStock, item.id, clubId, sessionUserId])
        }
        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function getOpenShiftInventory(clubId: string, shiftId: string | number) {
    await requireClubAccess(clubId)
    const res = await query(
        `SELECT id, warehouse_id, started_at
         FROM warehouse_inventories
         WHERE club_id = $1
           AND shift_id = $2
           AND status = 'OPEN'
         ORDER BY started_at ASC
         LIMIT 1`,
        [clubId, String(shiftId)]
    )

    return res.rows[0] as { id: number; warehouse_id: number | null; started_at: string } | null
}

export async function closeInventory(
    inventoryId: number,
    clubId: string,
    reportedRevenue: number,
    unaccountedSales: { product_id: number, quantity: number, selling_price: number, cost_price: number }[] = [],
    options?: { salesRecognition?: 'INVENTORY' | 'NONE' }
) {
    const actorUserId = await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // 0. Get inventory metadata
        const invHeader = await client.query('SELECT warehouse_id, shift_id, created_by, started_at, status FROM warehouse_inventories WHERE id = $1 AND club_id = $2 FOR UPDATE', [inventoryId, clubId])
        const inv = invHeader.rows[0]
        if (!inv) throw new Error("Инвентаризация не найдена")
        if (inv.status === 'CLOSED') throw new Error("Инвентаризация уже закрыта")
        if (inv.status === 'CANCELED') throw new Error("Отмененную инвентаризацию нельзя закрыть")

        let warehouseId = inv.warehouse_id
        const shiftId = inv.shift_id
        const inventoryStartTime = inv.started_at

        if (!warehouseId) {
             const whRes = await client.query('SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1', [clubId])
             warehouseId = whRes.rows[0]?.id
        }
        if (!warehouseId) throw new Error("Не найден склад для корректировки остатков")
        await assertUserCanUseWarehouses(client, clubId, actorUserId, [warehouseId])

        // 1. Fetch items and account for movements that happened DURING the inventory
        const itemsRes = await client.query(`
            SELECT ii.*,
                   p.name as product_name,
                   COALESCE((
                       SELECT SUM(change_amount)
                       FROM warehouse_stock_movements
                       WHERE product_id = ii.product_id
                       AND warehouse_id = $2
                       AND club_id = $4
                       AND created_at > $3
                       AND NOT (COALESCE(related_entity_type, '') = 'INVENTORY' AND COALESCE(related_entity_id, -1) = $1) -- Exclude this inventory's own potential movements
                   ), 0) as movements_during_inventory
            FROM warehouse_inventory_items ii
            JOIN warehouse_products p ON ii.product_id = p.id
            WHERE ii.inventory_id = $1
        `, [inventoryId, warehouseId, inventoryStartTime, clubId])

        // Default sales recognition depends on club settings.
        // If the club is in POS/SHIFT mode, inventory deficits should NOT be recognized as SALES by default.
        let defaultSalesRecognition: 'INVENTORY' | 'NONE' = 'INVENTORY'
        try {
            const settingsRes = await client.query('SELECT inventory_settings FROM clubs WHERE id = $1', [clubId])
            const salesMode = settingsRes.rows[0]?.inventory_settings?.sales_capture_mode
            if (salesMode === 'SHIFT') defaultSalesRecognition = 'NONE'
        } catch {
            // Best effort: fall back to legacy behavior.
        }
        const salesRecognition = options?.salesRecognition ?? defaultSalesRecognition

        // 2. Reconcile counted rows against current stock and store audit deltas.
        const isRevision = !shiftId
        const recognizeAsSales = !isRevision && salesRecognition === 'INVENTORY'
        const reasonPrefix = isRevision
            ? `Ревизия #${inventoryId}`
            : recognizeAsSales
                ? `Закрытие сменной инвентаризации #${inventoryId}`
                : `Корректировка по инвентаризации #${inventoryId}`

        let standardCalculatedRevenue = 0
        let hasNullStock = false

        for (const item of itemsRes.rows) {
            if (item.actual_stock === null) {
                hasNullStock = true
                await client.query(`
                    UPDATE warehouse_inventory_items
                    SET difference = NULL,
                        calculated_revenue = NULL,
                        adjusted_expected_stock = NULL,
                        stock_before_close = NULL,
                        applied_stock_delta = NULL
                    WHERE id = $1
                `, [item.id])
                continue
            }

            const safeAdjustedExpected = Math.max(0, Number(item.expected_stock) + Number(item.movements_during_inventory))
            const diffAmount = item.actual_stock - safeAdjustedExpected
            const itemRevenue = recognizeAsSales && item.actual_stock < safeAdjustedExpected
                ? (safeAdjustedExpected - item.actual_stock) * Number(item.selling_price_snapshot)
                : 0
            standardCalculatedRevenue += itemRevenue

            const currentWarehouseStock = await getLockedWarehouseStock(client, warehouseId, item.product_id)
            const stockDelta = Number(item.actual_stock) - currentWarehouseStock

            // Update item record with calculated results
            await client.query(`
                UPDATE warehouse_inventory_items
                SET difference = $2,
                    calculated_revenue = $3,
                    adjusted_expected_stock = $4,
                    stock_before_close = $5,
                    applied_stock_delta = $6,
                    counted_at = COALESCE(counted_at, NOW()),
                    counted_by = COALESCE(counted_by, $7::uuid)
                WHERE id = $1
            `, [item.id, diffAmount, itemRevenue, safeAdjustedExpected, currentWarehouseStock, stockDelta, actorUserId])
            if (stockDelta !== 0) {
                const { previousStock, newStock } = await applyWarehouseStockDelta(
                    client,
                    warehouseId,
                    item.product_id,
                    stockDelta
                )
                await logStockMovement(
                    client,
                    clubId,
                    actorUserId,
                    item.product_id,
                    stockDelta,
                    previousStock,
                    newStock,
                    stockDelta > 0 ? 'INVENTORY_GAIN' : 'INVENTORY_LOSS',
                    stockDelta > 0
                        ? `${reasonPrefix}: найден излишек`
                        : `${reasonPrefix}: подтверждена недостача`,
                    'INVENTORY',
                    inventoryId,
                    shiftId,
                    warehouseId,
                    Number(item.selling_price_snapshot || 0)
                )
            }
        }

        // FIX #5: Throw error if items have NULL actual_stock
        if (hasNullStock) {
            // Найдем товары которые не посчитаны
            const nullStockItems = itemsRes.rows
                .filter((r: any) => r.actual_stock === null)
                .map((r: any) => `${r.product_name} (ID: ${r.product_id})`)
            throw new Error(
                `Не все товары посчитаны. Заполните фактический остаток для:\n\n` +
                `${nullStockItems.slice(0, 10).join('\n')}` +
                `${nullStockItems.length > 10 ? `\n... и еще ${nullStockItems.length - 10} товаров` : ''}`
            )
        }

        const effectiveUnaccountedSalesRaw = recognizeAsSales ? unaccountedSales : []
        const invProductIds = new Set<number>(itemsRes.rows.map((r: any) => Number(r.product_id)))
        const unaccountedSalesMap = new Map<number, { product_id: number, quantity: number, selling_price: number, cost_price: number }>()
        
        for (const s of effectiveUnaccountedSalesRaw) {
            if (!Number.isFinite(s.quantity) || !Number.isInteger(s.quantity) || s.quantity <= 0) {
                throw new Error("Неучтенные продажи: количество должно быть целым положительным числом")
            }
            if (!Number.isFinite(s.selling_price) || s.selling_price < 0) {
                throw new Error("Неучтенные продажи: цена продажи должна быть неотрицательным числом")
            }
            if (!Number.isFinite(s.cost_price) || s.cost_price < 0) {
                throw new Error("Неучтенные продажи: себестоимость должна быть неотрицательным числом")
            }
            if (invProductIds.has(Number(s.product_id))) {
                throw new Error("Неучтенные продажи содержат товар, который уже есть в инвентаризации. Укажите остаток по нему в основном списке.")
            }
            const productId = Number(s.product_id)
            const existing = unaccountedSalesMap.get(productId)
            if (existing) {
                if (existing.selling_price !== s.selling_price || existing.cost_price !== s.cost_price) {
                    throw new Error("Неучтенные продажи содержат один и тот же товар с разной ценой")
                }
                existing.quantity += Number(s.quantity)
                continue
            }
            unaccountedSalesMap.set(productId, {
                product_id: productId,
                quantity: Number(s.quantity),
                selling_price: Number(s.selling_price),
                cost_price: Number(s.cost_price)
            })
        }
        const effectiveUnaccountedSales = Array.from(unaccountedSalesMap.values())
        
        if (effectiveUnaccountedSales.length > 0) {
            await assertProductsBelongToClub(client, clubId, effectiveUnaccountedSales.map(s => s.product_id))
        }
        
        const unaccountedRevenue = effectiveUnaccountedSales.reduce((acc, s) => acc + (s.quantity * s.selling_price), 0)

        let shiftCalculatedRevenue: number | null = null
        if (!isRevision && salesRecognition === 'NONE') {
            const revRes = await client.query(
                `
                SELECT COALESCE(SUM(
                    CASE
                        WHEN sm.related_entity_type = 'SHIFT_RECEIPT_VOID' THEN -ABS(sm.change_amount) * COALESCE(sm.price_at_time, p.selling_price)
                        WHEN sm.type = 'RETURN' THEN -ABS(sm.change_amount) * COALESCE(sm.price_at_time, p.selling_price)
                        ELSE ABS(sm.change_amount) * COALESCE(sm.price_at_time, p.selling_price)
                    END
                ), 0)::numeric as revenue
                FROM warehouse_stock_movements sm
                JOIN warehouse_products p ON sm.product_id = p.id
                WHERE sm.club_id = $1
                  AND sm.shift_id = $2
                  AND sm.type IN ('SALE', 'RETURN')
                  AND (sm.reason IS NULL OR LOWER(sm.reason) NOT LIKE '%в счет зп%')
                `,
                [clubId, shiftId]
            )
            shiftCalculatedRevenue = Number(revRes.rows[0]?.revenue || 0)
        }

        const totalCalculatedRevenue = recognizeAsSales
            ? (standardCalculatedRevenue + unaccountedRevenue)
            : ((shiftCalculatedRevenue ?? 0) + unaccountedRevenue)
        
        const effectiveReportedRevenue = recognizeAsSales ? reportedRevenue : (!isRevision ? reportedRevenue : 0)
        const diff = effectiveReportedRevenue - totalCalculatedRevenue

        for (const sale of effectiveUnaccountedSales) {
            const currentWarehouseStock = await getLockedWarehouseStock(client, warehouseId, sale.product_id)
            if (currentWarehouseStock < sale.quantity) {
                throw new Error(`Неучтенная продажа "${sale.product_id}" превышает текущий остаток на складе`)
            }
            const { previousStock, newStock } = await applyWarehouseStockDelta(
                client,
                warehouseId,
                sale.product_id,
                -sale.quantity
            )
            await logStockMovement(
                client,
                clubId,
                actorUserId,
                sale.product_id,
                -sale.quantity,
                previousStock,
                newStock,
                'SALE',
                `Неучтенная продажа при закрытии инвентаризации #${inventoryId}`,
                'INVENTORY',
                inventoryId,
                shiftId,
                warehouseId,
                sale.selling_price
            )
        }

        // 4. Update Cache for all involved products
        const allProductIds = [
            ...itemsRes.rows.map(i => i.product_id),
            ...effectiveUnaccountedSales.map(s => s.product_id)
        ]

        if (allProductIds.length > 0) {
            await client.query(
                `
                UPDATE warehouse_products p
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
                WHERE id = ANY($1) AND club_id = $2
                `,
                [allProductIds, clubId]
            )
        }

        // 5. Close Inventory Header
        await client.query(`
            UPDATE warehouse_inventories
            SET status = 'CLOSED', closed_at = NOW(),
                closed_by = $5::uuid,
                sales_capture_mode_snapshot = $6,
                reported_revenue = $2,
                calculated_revenue = $3,
                revenue_difference = $4
            WHERE id = $1
        `, [
            inventoryId,
            effectiveReportedRevenue,
            totalCalculatedRevenue,
            diff,
            actorUserId,
            !isRevision ? (salesRecognition === 'NONE' ? 'SHIFT' : 'INVENTORY') : null
        ])

        await client.query('COMMIT')
        await checkReplenishmentNeeds(clubId)

    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`, 'layout')
}
