"use server"

import { query, getClient } from "@/db"
import { revalidatePath } from "next/cache"
import { logOperation } from "@/lib/logger"
import { LogAction } from "@/lib/logger"
import { cookies } from "next/headers"

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
    is_default?: boolean
    responsible_user_id?: string
    responsible_name?: string
    contact_info?: string
    characteristics?: any
    is_active: boolean
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
    status: 'OPEN' | 'CLOSED'
    started_at: string
    closed_at: string | null
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
    last_modified?: number
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
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT w.*, u.full_name as responsible_name
        FROM warehouses w
        LEFT JOIN users u ON w.responsible_user_id = u.id
        WHERE w.club_id = $1
        ORDER BY w.name
    `, [clubId])
    return res.rows as Warehouse[]
}

export async function createWarehouse(clubId: string, userId: string, data: { name: string, address?: string, type: string, contact_info?: string, characteristics?: any }) {
    await assertUserCanAccessClub(clubId, userId)
    const res = await query(`
        INSERT INTO warehouses (club_id, name, address, type, contact_info, characteristics)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
    `, [clubId, data.name, data.address, data.type, data.contact_info, data.characteristics || {}])

    await logOperation(clubId, userId, 'CREATE_WAREHOUSE', 'WAREHOUSE', res.rows[0].id, data)
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function updateWarehouse(id: number, clubId: string, userId: string, data: { name: string, address?: string, type: string, contact_info?: string, characteristics?: any, is_active: boolean }) {
    await assertUserCanAccessClub(clubId, userId)
    await query(`
        UPDATE warehouses
        SET name = $1, address = $2, type = $3, contact_info = $4, characteristics = $5, is_active = $6
        WHERE id = $7
    `, [data.name, data.address, data.type, data.contact_info, data.characteristics || {}, data.is_active, id])

    await logOperation(clubId, userId, 'UPDATE_WAREHOUSE', 'WAREHOUSE', id, data)
    revalidatePath(`/clubs/${clubId}/inventory`)
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
        SELECT u.id, u.full_name, 'Сотрудник' as role 
        FROM club_employees ce
        JOIN users u ON ce.user_id = u.id
        WHERE ce.club_id = $1 AND ce.is_active = true
        ORDER BY u.full_name
    `, [clubId])
    return res.rows as { id: string, full_name: string, role: string }[]
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
                'ADJUSTMENT', `Перемещение на склад #${target_warehouse_id}${notesStr}`, 
                'TRANSFER', null, shift_id || null, source_warehouse_id
            )
            
            // Log in to target
            await logStockMovement(
                client, clubId, userId, product_id, quantity, targetPrevStock, targetNewStock, 
                'ADJUSTMENT', `Перемещение со склада #${source_warehouse_id}${notesStr}`, 
                'TRANSFER', null, shift_id || null, target_warehouse_id
            )

            // 5. Update product cache
            await client.query(`
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1 AND club_id = $2
            `, [product_id, clubId])
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
                if (amountNeeded <= 0) continue
                
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
                        `Склад: ${rule.target_warehouse_name}. Остаток: ${current}. Пополнить до ${rule.max_stock_level}.`, 
                        rule.product_id
                    ])
                }
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
        
        // 1. Calculate Velocity (Avg Daily Sales)
        // Divisor is the minimum of 30 days OR days since the VERY FIRST SALE recorded in the system
        // This makes it adaptive for when you actually started tracking sales
        
        await client.query(`
            UPDATE warehouse_products p
            SET sales_velocity = COALESCE((
                WITH FirstSale AS (
                    SELECT product_id, MIN(created_at) as first_sale_date
                    FROM warehouse_stock_movements
                    WHERE type = 'SALE'
                    GROUP BY product_id
                )
                SELECT 
                    ABS(SUM(m.change_amount))::numeric / 
                    GREATEST(1, LEAST(30, CEIL(EXTRACT(EPOCH FROM (NOW() - fs.first_sale_date)) / 86400.0)))
                FROM warehouse_stock_movements m
                JOIN FirstSale fs ON m.product_id = fs.product_id
                WHERE m.product_id = p.id 
                  AND m.type = 'SALE' 
                  AND m.created_at > NOW() - INTERVAL '30 days'
                GROUP BY fs.first_sale_date
            ), 0)
            WHERE club_id = $1
        `, [clubId])
        
        // 2. ABC Analysis (By Revenue over last 30 days)
        // Revenue = SUM(ABS(change_amount) * price_at_time)
        const revenueData = await client.query(`
            WITH ProductRevenue AS (
                SELECT 
                    p.id as product_id,
                    COALESCE(SUM(ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)), 0) as total_revenue
                FROM warehouse_products p
                LEFT JOIN warehouse_stock_movements m ON p.id = m.product_id 
                    AND m.type = 'SALE' 
                    AND m.created_at > NOW() - INTERVAL '30 days'
                WHERE p.club_id = $1 AND p.is_active = true
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

export async function generateProcurementList(clubId: string, userId: string) {
    await assertUserCanAccessClub(clubId, userId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // 1. Update Analytics first to have fresh data
        await calculateAnalytics(clubId)
        
        // 2. Create Draft List
        const listRes = await client.query(`
            INSERT INTO warehouse_procurement_lists (club_id, created_by, status, name)
            VALUES ($1, $2, 'DRAFT', 'Закупка ' || TO_CHAR(NOW(), 'DD.MM.YYYY'))
            RETURNING id
        `, [clubId, userId])
        const listId = listRes.rows[0].id
        
        // 3. Find products to restock based on ABC priority and Days Left
        // Logic:
        // A: Restock if < 7 days left
        // B: Restock if < 5 days left
        // C: Restock if < 3 days left
        // All: Restock if current_stock <= min_stock_level
        const products = await client.query(`
            SELECT 
                id, name, current_stock, min_stock_level, sales_velocity, ideal_stock_days, abc_category, units_per_box,
                CASE 
                    WHEN sales_velocity > 0 THEN current_stock / sales_velocity 
                    ELSE 999 
                END as days_left
            FROM warehouse_products
            WHERE club_id = $1 AND is_active = true
            AND current_stock > 0 -- Don't auto-add products with 0 stock as requested
            AND (
                current_stock <= min_stock_level OR
                (abc_category = 'A' AND (sales_velocity > 0 AND current_stock / sales_velocity < 7)) OR
                (abc_category = 'B' AND (sales_velocity > 0 AND current_stock / sales_velocity < 5)) OR
                (abc_category = 'C' AND (sales_velocity > 0 AND current_stock / sales_velocity < 3))
            )
        `, [clubId])
        
        for (const p of products.rows) {
            // Calculate suggested quantity
            // Target = Velocity * Ideal Days (default 14)
            let suggested = 0
            const velocity = Number(p.sales_velocity)
            const idealDays = p.ideal_stock_days || 14
            const boxSize = p.units_per_box || 1
            
            if (velocity > 0) {
                const target = velocity * idealDays
                const needed = Math.ceil(target - p.current_stock)
                // Round to NEAREST box size
                const boxes = Math.round(needed / boxSize)
                suggested = Math.max(boxSize, boxes * boxSize) // At least 1 box
            } else {
                // Fallback for no sales data: Top up to 2x Min Stock
                const needed = Math.max(0, (p.min_stock_level || 5) * 2 - p.current_stock)
                const boxes = Math.round(needed / boxSize)
                suggested = Math.max(boxSize, boxes * boxSize)
            }
            
            if (suggested <= 0) suggested = boxSize // Ensure at least one box if it's on the list
            
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
               END as days_left
        FROM warehouse_procurement_items i
        JOIN warehouse_procurement_lists l ON i.list_id = l.id
        JOIN warehouse_products p ON i.product_id = p.id
        WHERE l.club_id = $1 AND i.list_id = $2
        ORDER BY CASE WHEN p.abc_category = 'A' THEN 1 WHEN p.abc_category = 'B' THEN 2 ELSE 3 END, p.name
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
        const velocity = Number(p.sales_velocity)
        const idealDays = p.ideal_stock_days || 14
        const boxSize = p.units_per_box || 1
        
        if (velocity > 0) {
            const target = velocity * idealDays
            const needed = Math.ceil(target - p.current_stock)
            const boxes = Math.round(needed / boxSize)
            suggested = Math.max(boxSize, boxes * boxSize)
        } else {
            const needed = Math.max(0, (p.min_stock_level || 5) * 2 - p.current_stock)
            const boxes = Math.round(needed / boxSize)
            suggested = Math.max(boxSize, boxes * boxSize)
        }
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

// --- TASKS ---
export async function getClubTasks(clubId: string) {
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT t.*, u.full_name as assignee_name, p.name as product_name
        FROM club_tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN warehouse_products p ON t.related_entity_type = 'PRODUCT' AND t.related_entity_id = p.id
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
        LEFT JOIN warehouse_inventories inv ON s.id = inv.shift_id
        -- Join for voided receipts
        LEFT JOIN shift_receipts sr ON sm.related_entity_type = 'SHIFT_RECEIPT' AND sm.related_entity_id = sr.id AND sr.voided_at IS NOT NULL
        WHERE sm.club_id = $1 
          AND sm.type IN ('SALE', 'RETURN')  -- Include both sales and returns
          AND sr.id IS NULL  -- Exclude voided receipts
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

        const oldActualStock = item.actual_stock !== null ? Number(item.actual_stock) : null
        const expectedStock = Number(item.expected_stock)
        const price = Number(item.selling_price_snapshot)

        // 2. Calculate New Stats for the Item
        const newDifference = newActualStock - expectedStock
        const newCalculatedRevenue = newActualStock < expectedStock ? (expectedStock - newActualStock) * price : 0

        // 3. Calculate Deltas for the Header
        const oldCalculatedRevenue = (oldActualStock !== null && oldActualStock < expectedStock) 
            ? (expectedStock - oldActualStock) * price 
            : 0
        
        const revenueChange = newCalculatedRevenue - oldCalculatedRevenue

        // 4. Update inventory item
        await client.query(`
            UPDATE warehouse_inventory_items 
            SET actual_stock = $1::integer, 
                difference = $2::integer, 
                calculated_revenue = $3::numeric
            WHERE inventory_id = $4 AND product_id = $5
        `, [newActualStock, newDifference, newCalculatedRevenue, inventoryId, productId])

        // 5. Update inventory header totals
        await client.query(`
            UPDATE warehouse_inventories 
            SET calculated_revenue = (calculated_revenue + $1::numeric)::numeric,
                revenue_difference = (revenue_difference - $1::numeric)::numeric
            WHERE id = $2 AND club_id = $3
        `, [revenueChange, inventoryId, clubId])

        // 6. Update physical stock and movements if inventory is closed
        if (inventory.status === 'CLOSED') {
            // Calculate delta to apply to current warehouse stock
            // If item wasn't counted (null), the previous adjustment was 0 (relative to expected)
            // If item was counted, the previous adjustment was (actual - expected)
            const oldAdjustment = oldActualStock !== null ? (oldActualStock - expectedStock) : 0
            const newAdjustment = newActualStock - expectedStock
            const stockDelta = newAdjustment - oldAdjustment

            if (stockDelta !== 0) {
                let warehouseId = inventory.warehouse_id
                if (!warehouseId) {
                    const whRes = await client.query('SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1', [clubId])
                    warehouseId = whRes.rows[0]?.id
                }

                if (!warehouseId) throw new Error("Не найден склад для корректировки остатков")

                const { previousStock, newStock } = await applyWarehouseStockDelta(client, warehouseId, productId, stockDelta)

                // Update product cache (sum of all warehouses)
                await client.query(`
                    UPDATE warehouse_products
                    SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                    WHERE id = $1 AND club_id = $2
                `, [productId, clubId])

                // Log the correction movement
                await logStockMovement(
                    client, 
                    clubId, 
                    userId, 
                    productId, 
                    stockDelta, 
                    previousStock, 
                    newStock, 
                    'ADJUSTMENT', 
                    `Корректировка инвентаризации #${inventoryId}`, 
                    'INVENTORY', 
                    inventoryId, 
                    null, 
                    warehouseId
                )
            }
        }

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

export type ShiftReceiptPaymentType = 'cash' | 'card' | 'mixed' | 'other'

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
    cash_amount: number
    card_amount: number
    total_amount: number
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
    if (preferredWarehouseId) return preferredWarehouseId

    const settingsRes = await client.query('SELECT inventory_settings FROM clubs WHERE id = $1', [clubId])
    const settings = settingsRes.rows[0]?.inventory_settings || {}
    const allowed = settings.employee_allowed_warehouse_ids
    if (Array.isArray(allowed) && allowed.length > 0) {
        const candidate = allowed[0]
        const whRes = await client.query(
            `SELECT id FROM warehouses WHERE id = $1 AND club_id = $2 AND is_active = true LIMIT 1`,
            [candidate, clubId]
        )
        if (whRes.rowCount && whRes.rows[0]?.id) return Number(whRes.rows[0].id)
    }

    const whRes = await client.query(
        `SELECT id FROM warehouses WHERE club_id = $1 AND is_active = true ORDER BY is_default DESC, created_at ASC LIMIT 1`,
        [clubId]
    )
    const id = whRes.rows[0]?.id
    if (!id) throw new Error("В клубе не создано ни одного склада")
    return Number(id)
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
    }
) {
    await assertUserCanAccessClub(clubId, userId)
    if (!data.items?.length) throw new Error("Пустой чек")

    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

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

        const warehouseId = await resolveEmployeeDefaultWarehouseId(client, clubId, userId, data.warehouse_id ?? null)

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
        } else {
            cashAmount = cashAmount || 0
            cardAmount = cardAmount || 0
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
                payment_type, cash_amount, card_amount, total_amount, notes, committed_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
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
                data.notes || null
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
                `POS чек #${receiptId}`,
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

        await client.query('COMMIT')
        
        // FIX: Отправляем SSE уведомление всем клиентам клуба
        try {
            const { sendToClub } = await import('@/app/api/inventory-events/route')
            sendToClub(clubId, {
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

    const receiptIds = res.rows.map(r => Number(r.id))
    
    // Get returns for all receipts
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

    return res.rows.map((r: any) => ({
        id: Number(r.id),
        club_id: Number(r.club_id),
        shift_id: String(r.shift_id),
        created_by: String(r.created_by),
        warehouse_id: Number(r.warehouse_id),
        warehouse_name: String(r.warehouse_name),
        payment_type: r.payment_type as ShiftReceiptPaymentType,
        cash_amount: Number(r.cash_amount || 0),
        card_amount: Number(r.card_amount || 0),
        total_amount: Number(r.total_amount || 0),
        notes: r.notes,
        created_at: r.created_at,
        voided_at: r.voided_at,
        committed_at: r.committed_at,
        items: itemsByReceipt.get(Number(r.id)) || []
    })) as ShiftReceipt[]
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
            const { sendToClub } = await import('@/app/api/inventory-events/route')
            sendToClub(clubId, {
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
            const { sendToClub } = await import('@/app/api/inventory-events/route')
            sendToClub(clubId, {
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

        // 0. Check for existing inventory OR create one if it's a salary deduction
        let inventoryId: number | null = null
        if (data.shift_id) {
            const activeInv = await client.query(`
                SELECT id FROM warehouse_inventories 
                WHERE shift_id = $1 AND warehouse_id = $2 AND status = 'OPEN' 
                LIMIT 1
            `, [data.shift_id, warehouseId])
            
            if (activeInv.rowCount && activeInv.rowCount > 0) {
                inventoryId = activeInv.rows[0].id
            } else if (data.items.some(i => i.type === 'SALARY_DEDUCTION')) {
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
            const movementType = item.type === 'SALARY_DEDUCTION' ? 'SALE' : 'ADJUSTMENT' // SALARY_DEDUCTION is essentially a sale to employee
            
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
    await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        const res = await client.query(`
            SELECT p.*, c.name as category_name,
            (SELECT SUM(quantity) FROM warehouse_stock WHERE product_id = p.id) as total_stock,
            (
                SELECT json_agg(json_build_object(
                    'warehouse_id', ws.warehouse_id,
                    'warehouse_name', w.name,
                    'quantity', ws.quantity,
                    'is_default', w.is_default
                ))
                FROM warehouse_stock ws
                JOIN warehouses w ON ws.warehouse_id = w.id
                WHERE ws.product_id = p.id
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
        `, [clubId])
        
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
        
        // Find warehouse with enough stock
        // Strategy: First Default, then others
        const stocks = await client.query(`
            SELECT ws.warehouse_id, ws.quantity 
            FROM warehouse_stock ws
            JOIN warehouses w ON ws.warehouse_id = w.id
            WHERE ws.product_id = $1
              AND w.club_id = $2
            ORDER BY w.is_default DESC, ws.quantity DESC
        `, [productId, clubId])
        
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

export async function createSupply(clubId: string, userId: string, data: { supplier_name: string, notes: string, items: { product_id: number, quantity: number, cost_price: number }[], warehouse_id?: number, status?: 'DRAFT' | 'COMPLETED' }) {
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
                    null,
                    warehouseId
                )
            }
        }

        await client.query('COMMIT')
        await logOperation(clubId, userId, 'CREATE_SUPPLY', 'SUPPLY', supplyId, { itemsCount: data.items.length, totalCost, warehouseId, status })
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
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT i.*, u.full_name as created_by_name, w.name as warehouse_name
        FROM warehouse_inventories i
        LEFT JOIN users u ON i.created_by = u.id
        LEFT JOIN warehouses w ON i.warehouse_id = w.id
        WHERE i.club_id = $1
        ORDER BY i.started_at DESC
    `, [clubId])
    return res.rows.map(row => ({
        ...row,
        created_by: row.created_by?.toString() // Ensure string
    })) as Inventory[]
}

export async function getInventory(id: number) {
    const sessionUserId = await requireSessionUserId()
    const invClubRes = await query('SELECT club_id FROM warehouse_inventories WHERE id = $1', [id])
    if ((invClubRes.rowCount || 0) === 0) throw new Error("Инвентаризация не найдена")
    const clubId = String(invClubRes.rows[0].club_id)
    await assertSessionUserCanAccessClub(clubId, sessionUserId)

    const res = await query(`
        SELECT i.*, u.full_name as created_by_name
        FROM warehouse_inventories i
        LEFT JOIN users u ON i.created_by = u.id
        WHERE i.id = $1 AND i.club_id = $2
    `, [id, clubId])
    return res.rows[0] as Inventory
}

export async function getInventoryItems(inventoryId: number) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        const sessionUserId = await requireSessionUserId()
        const invHeader = await client.query('SELECT club_id, warehouse_id, started_at FROM warehouse_inventories WHERE id = $1', [inventoryId])
        const inv = invHeader.rows[0]
        if (!inv) throw new Error("Инвентаризация не найдена")
        await assertSessionUserCanAccessClub(String(inv.club_id), sessionUserId)

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
                  AND club_id = $4
                  AND COALESCE(related_entity_type, '') != 'INVENTORY'
                GROUP BY product_id
            ) movements ON movements.product_id = ii.product_id
            WHERE ii.inventory_id = $1
            ORDER BY c.name NULLS LAST, p.name
        `, [inventoryId, inv.warehouse_id, inv.started_at, inv.club_id])

        const items = res.rows as InventoryItem[]

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
        allow_salary_deduction?: boolean,
        employee_discount_percent?: number,
        allow_cost_price_sale?: boolean,
        price_tag_template?: PriceTagTemplate,
        price_tag_settings?: PriceTagSettings
    } 
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

        // 1. Resolve warehouse if not provided
        let targetWarehouseId = warehouseId
        if (!targetWarehouseId) {
            const whRes = await client.query('SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1', [clubId])
            targetWarehouseId = whRes.rows[0]?.id
        }

        // 2. Check if an OPEN inventory for this shift already exists
        if (shiftId) {
            const existingInv = await client.query(`
                SELECT id FROM warehouse_inventories 
                WHERE club_id = $1 AND shift_id = $2 AND status = 'OPEN'
                LIMIT 1
            `, [clubId, shiftId])
            
            if (existingInv.rowCount && existingInv.rowCount > 0) {
                await client.query('ROLLBACK')
                return existingInv.rows[0].id
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
            // Specific Warehouse Snapshot
            // Include ALL active products from this club, showing 0 if no stock in this warehouse
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
            // Aggregate Snapshot (Sum of all warehouses)
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
        const inv = await client.query(`SELECT warehouse_id, club_id FROM warehouse_inventories WHERE id = $1`, [inventoryId])
        let warehouseId = inv.rows[0]?.warehouse_id
        const currentClubId = inv.rows[0]?.club_id

        if (!currentClubId) throw new Error("Инвентаризация не найдена")
        await assertSessionUserCanAccessClub(String(currentClubId), sessionUserId)

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
            INSERT INTO warehouse_inventory_items (inventory_id, product_id, expected_stock, actual_stock, cost_price_snapshot, selling_price_snapshot)
            VALUES ($1, $2, $3, 0, $4, $5) 
        `, [inventoryId, productId, product.current_stock, product.cost_price, product.selling_price])
        // Default actual_stock to 0 so it's immediately counted as "found 0" (user can change)

        await client.query('COMMIT')
        revalidatePath(`/clubs/${inv.rows[0].club_id}/inventory`)
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

export async function deleteInventory(inventoryId: number, clubId: string, userId: string) {
    await assertUserCanAccessClub(clubId, userId)
    await query(`DELETE FROM warehouse_inventories WHERE id = $1 AND club_id = $2`, [inventoryId, clubId])
    await logOperation(clubId, userId, 'DELETE_INVENTORY', 'INVENTORY', inventoryId)
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function getAbcAnalysisData(clubId: string) {
    await requireClubAccess(clubId)
    const client = await getClient()
    try {
        const res = await client.query(`
            WITH ProductRevenue AS (
                SELECT 
                    p.id as product_id,
                    p.name,
                    p.abc_category,
                    p.current_stock,
                    p.sales_velocity,
                    COALESCE(SUM(ABS(m.change_amount) * COALESCE(m.price_at_time, p.selling_price)), 0) as total_revenue,
                    COALESCE(SUM(ABS(m.change_amount)), 0) as total_sold,
                    COALESCE(SUM(ABS(m.change_amount) * (COALESCE(m.price_at_time, p.selling_price) - p.cost_price)), 0) as total_profit
                FROM warehouse_products p
                LEFT JOIN warehouse_stock_movements m ON p.id = m.product_id 
                    AND m.type = 'SALE' 
                    AND m.created_at > NOW() - INTERVAL '30 days'
                WHERE p.club_id = $1 AND p.is_active = true
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
    await requireClubAccess(clubId)
    const res = await query(`
        SELECT p.*,
        (
            SELECT json_agg(json_build_object(
                'warehouse_id', ws.warehouse_id,
                'warehouse_name', w.name,
                'quantity', ws.quantity,
                'is_default', w.is_default
            ))
            FROM warehouse_stock ws
            JOIN warehouses w ON ws.warehouse_id = w.id
            WHERE ws.product_id = p.id
        ) as stocks
        FROM warehouse_products p
        WHERE p.club_id = $1 AND ($2 = ANY(p.barcodes) OR p.barcode = $2) AND p.is_active = true
    `, [clubId, barcode])
    return res.rows[0] as Product | null
}

export async function updateInventoryItem(itemId: number, actualStock: number | null, clubId: string) {
    // Just update the actual count
    await requireClubAccess(clubId)
    await query(`
        UPDATE warehouse_inventory_items ii
        SET actual_stock = $1
        FROM warehouse_inventories i
        WHERE ii.id = $2 AND ii.inventory_id = i.id AND i.club_id = $3
    `, [actualStock, itemId, clubId])

    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function bulkUpdateInventoryItems(items: { id: number, actual_stock: number | null }[], clubId: string) {
    await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        for (const item of items) {
            await client.query(`
                UPDATE warehouse_inventory_items ii
                SET actual_stock = $1
                FROM warehouse_inventories i
                WHERE ii.id = $2 AND ii.inventory_id = i.id AND i.club_id = $3
            `, [item.actual_stock, item.id, clubId])
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

export async function closeInventory(
    inventoryId: number,
    clubId: string,
    reportedRevenue: number,
    unaccountedSales: { product_id: number, quantity: number, selling_price: number, cost_price: number }[] = [],
    options?: { salesRecognition?: 'INVENTORY' | 'NONE' }
) {
    await requireClubAccess(clubId)
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // 0. Get inventory metadata
        const invHeader = await client.query('SELECT warehouse_id, shift_id, created_by, started_at FROM warehouse_inventories WHERE id = $1 AND club_id = $2', [inventoryId, clubId])
        const inv = invHeader.rows[0]
        if (!inv) throw new Error("Инвентаризация не найдена")

        let warehouseId = inv.warehouse_id
        const shiftId = inv.shift_id
        const userId = inv.created_by
        const inventoryStartTime = inv.started_at

        if (!warehouseId) {
             const whRes = await client.query('SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1', [clubId])
             warehouseId = whRes.rows[0]?.id
        }
        if (!warehouseId) throw new Error("Не найден склад для корректировки остатков")

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

        // 2. Update Stats & Group for Auto-Supply
        const itemsForAutoSupply: { product_id: number, quantity: number, cost_price: number }[] = []
        const isRevision = !shiftId
        const recognizeAsSales = !isRevision && salesRecognition === 'INVENTORY'
        const reasonPrefix = isRevision
            ? `Ревизия (инвентаризация #${inventoryId})`
            : recognizeAsSales
                ? `Продажа за смену (инвентаризация #${inventoryId})`
                : `Корректировка по инвентаризации #${inventoryId}`
        const movementType = recognizeAsSales ? 'SALE' : 'ADJUSTMENT'

        let standardCalculatedRevenue = 0
        let hasNullStock = false

        for (const item of itemsRes.rows) {
            // FIX #5: Track items with NULL actual_stock
            if (item.actual_stock === null) {
                hasNullStock = true
                // Set difference and revenue to NULL for incomplete items
                await client.query(`
                    UPDATE warehouse_inventory_items
                    SET difference = NULL, calculated_revenue = NULL
                    WHERE id = $1
                `, [item.id])
                continue
            }

            // IMPORTANT: Adjusted Expected Stock = Original Snapshot + Movements during inventory
            // Example: Snapshot was 10. Supply +5 happened. Adjusted Expected is 15.
            // If employee counted 15, then 15 - 15 = 0. Perfect.
            const adjustedExpected = Number(item.expected_stock) + Number(item.movements_during_inventory)
            
            // FIX #6: Protect against negative adjustedExpected
            if (adjustedExpected < 0) {
                console.error(`Negative adjustedExpected for product ${item.product_id}: ${adjustedExpected}. Setting to 0.`)
                // Log warning but continue with 0
            }
            const safeAdjustedExpected = Math.max(0, adjustedExpected)
            
            // FIX #10: Unified difference calculation (actual - expected, consistent throughout)
            const diffAmount = item.actual_stock - safeAdjustedExpected

            // Calculate revenue for this item (only when inventory recognizes deficit as sales)
            const itemRevenue = recognizeAsSales && item.actual_stock < safeAdjustedExpected
                ? (safeAdjustedExpected - item.actual_stock) * Number(item.selling_price_snapshot)
                : 0
            standardCalculatedRevenue += itemRevenue

            // Update item record with calculated results
            await client.query(`
                UPDATE warehouse_inventory_items
                SET difference = $2,
                    calculated_revenue = $3
                WHERE id = $1
            `, [item.id, diffAmount, itemRevenue])

            if (diffAmount === 0) continue

            if (diffAmount > 0) {
                // Excess found
                itemsForAutoSupply.push({
                    product_id: item.product_id,
                    quantity: diffAmount,
                    cost_price: item.cost_price_snapshot || 0
                })
            } else {
                // Deficit found - Update Stock
                const { previousStock, newStock } = await applyWarehouseStockDelta(
                    client,
                    warehouseId,
                    item.product_id,
                    diffAmount
                )
                await logStockMovement(
                    client,
                    clubId,
                    userId,
                    item.product_id,
                    diffAmount,
                    previousStock,
                    newStock,
                    movementType,
                    reasonPrefix,
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
            
            await client.query('ROLLBACK')
            throw new Error(
                `Не все товары посчитаны. Заполните фактический остаток для:\n\n` +
                `${nullStockItems.slice(0, 10).join('\n')}` +
                `${nullStockItems.length > 10 ? `\n... и еще ${nullStockItems.length - 10} товаров` : ''}`
            )
        }

        // FIX #3: Softer validation for unaccounted sales - allow duplicates with warning logged
        const effectiveUnaccountedSales = recognizeAsSales ? unaccountedSales : []
        const invProductIds = new Set<number>(itemsRes.rows.map((r: any) => Number(r.product_id)))
        const seen = new Set<number>()
        
        for (const s of effectiveUnaccountedSales) {
            if (!Number.isFinite(s.quantity) || !Number.isInteger(s.quantity) || s.quantity <= 0) {
                throw new Error("Неучтенные продажи: количество должно быть целым положительным числом")
            }
            if (!Number.isFinite(s.selling_price) || s.selling_price < 0) {
                throw new Error("Неучтенные продажи: цена продажи должна быть неотрицательным числом")
            }
            if (!Number.isFinite(s.cost_price) || s.cost_price < 0) {
                throw new Error("Неучтенные продажи: себестоимость должна быть неотрицательным числом")
            }
            // FIX #3: Changed from error to warning log
            if (invProductIds.has(Number(s.product_id))) {
                console.warn(`Unaccounted sale includes product ${s.product_id} already in inventory. This may cause double-counting.`)
            }
            if (seen.has(Number(s.product_id))) {
                throw new Error("Неучтенные продажи содержат повторяющиеся товары")
            }
            seen.add(Number(s.product_id))
        }
        
        // FIX #7: Verify warehouse has the products for unaccounted sales
        if (effectiveUnaccountedSales.length > 0) {
            await assertProductsBelongToClub(client, clubId, effectiveUnaccountedSales.map(s => s.product_id))
            
            // Check products exist on this warehouse
            const warehouseProductCheck = await client.query(`
                SELECT p.id
                FROM warehouse_products p
                LEFT JOIN warehouse_stock ws ON p.id = ws.product_id AND ws.warehouse_id = $2
                WHERE p.id = ANY($1) AND p.club_id = $3
            `, [effectiveUnaccountedSales.map(s => s.product_id), warehouseId, clubId])
            
            if (warehouseProductCheck.rows.length !== effectiveUnaccountedSales.length) {
                console.warn(`Some unaccounted sale products are not on warehouse ${warehouseId}`)
            }
        }
        
        const unaccountedRevenue = effectiveUnaccountedSales.reduce((acc, s) => acc + (s.quantity * s.selling_price), 0)
        
        // FIX #2: Calculate shift revenue and ADD unaccountedRevenue
        let shiftCalculatedRevenue: number | null = null
        if (!isRevision && salesRecognition === 'NONE') {
            const revRes = await client.query(
                `
                SELECT COALESCE(SUM(ABS(sm.change_amount) * COALESCE(sm.price_at_time, p.selling_price)), 0)::numeric as revenue
                FROM warehouse_stock_movements sm
                JOIN warehouse_products p ON sm.product_id = p.id
                WHERE sm.club_id = $1
                  AND sm.shift_id = $2
                  AND sm.type = 'SALE'
                  AND (sm.reason IS NULL OR LOWER(sm.reason) NOT LIKE '%в счет зп%')
                `,
                [clubId, shiftId]
            )
            shiftCalculatedRevenue = Number(revRes.rows[0]?.revenue || 0)
        }

        // FIX #2: Add unaccountedRevenue to shiftCalculatedRevenue in NONE mode
        const totalCalculatedRevenue = recognizeAsSales
            ? (standardCalculatedRevenue + unaccountedRevenue)
            : ((shiftCalculatedRevenue ?? 0) + unaccountedRevenue)
        
        const effectiveReportedRevenue = recognizeAsSales ? reportedRevenue : (!isRevision ? reportedRevenue : 0)
        const diff = effectiveReportedRevenue - totalCalculatedRevenue

        // --- PART B: Handle Unaccounted Sales ---
        // FIX #1: Only add to auto-supply, don't do net-zero dance
        // Unaccounted sales are ADDED back to inventory (they were sold but not recorded)
        for (const sale of effectiveUnaccountedSales) {
            itemsForAutoSupply.push({
                product_id: sale.product_id,
                quantity: sale.quantity,
                cost_price: sale.cost_price
            })
        }

        // --- PART C: Create Auto-Supply for Excesses and Unaccounted Sales ---
        if (itemsForAutoSupply.length > 0) {
            const totalAutoCost = itemsForAutoSupply.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0)
            const supplyRes = await client.query(`
                INSERT INTO warehouse_supplies (club_id, supplier_name, notes, total_cost, created_by, status, warehouse_id)
                VALUES ($1, 'Авто-поступление (Инвентаризация)', $2, $3, $4, 'DRAFT', $5)
                RETURNING id
            `, [clubId, `Автоматически создано при закрытии инвентаризации #${inventoryId}. Включает излишки и неучтенные продажи.`, totalAutoCost, userId, warehouseId])
            const supplyId = supplyRes.rows[0].id

            for (const item of itemsForAutoSupply) {
                await client.query(`
                    INSERT INTO warehouse_supply_items (supply_id, product_id, quantity, cost_price, total_cost)
                    VALUES ($1, $2, $3, $4, $5)
                `, [supplyId, item.product_id, item.quantity, item.cost_price, item.quantity * item.cost_price])

                const { previousStock, newStock } = await applyWarehouseStockDelta(
                    client,
                    warehouseId,
                    item.product_id,
                    item.quantity
                )

                await logStockMovement(
                    client,
                    clubId,
                    userId,
                    item.product_id,
                    item.quantity,
                    previousStock,
                    newStock,
                    'SUPPLY',
                    `Авто-поступление #${supplyId} (Инвентаризация #${inventoryId})`,
                    'SUPPLY',
                    supplyId,
                    shiftId,
                    warehouseId
                )
            }
        }

        // FIX #1: REMOVED PART D - No longer doing net-zero dance for unaccounted sales
        // The auto-supply above already handles returning the goods to inventory

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
                reported_revenue = $2,
                calculated_revenue = $3,
                revenue_difference = $4
            WHERE id = $1
        `, [inventoryId, effectiveReportedRevenue, totalCalculatedRevenue, diff])

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
