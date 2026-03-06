"use server"

import { query, getClient } from "@/db"
import { revalidatePath } from "next/cache"
import { logOperation } from "@/lib/logger"
import { LogAction } from "@/lib/logger"

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
    category_name?: string
    expected_stock: number
    actual_stock: number | null
    difference: number | null
    cost_price_snapshot: number
    selling_price_snapshot: number
    calculated_revenue: number | null
}

// --- CATEGORIES ---

export async function getCategories(clubId: string) {
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
    const res = await query(`
        INSERT INTO warehouses (club_id, name, address, type, contact_info, characteristics)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
    `, [clubId, data.name, data.address, data.type, data.contact_info, data.characteristics || {}])

    await logOperation(clubId, userId, 'CREATE_WAREHOUSE', 'WAREHOUSE', res.rows[0].id, data)
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function updateWarehouse(id: number, clubId: string, userId: string, data: { name: string, address?: string, type: string, contact_info?: string, characteristics?: any, is_active: boolean }) {
    await query(`
        UPDATE warehouses
        SET name = $1, address = $2, type = $3, contact_info = $4, characteristics = $5, is_active = $6
        WHERE id = $7
    `, [data.name, data.address, data.type, data.contact_info, data.characteristics || {}, data.is_active, id])

    await logOperation(clubId, userId, 'UPDATE_WAREHOUSE', 'WAREHOUSE', id, data)
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function deleteWarehouse(id: number, clubId: string, userId: string) {
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
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        const { source_warehouse_id, target_warehouse_id, product_id, quantity } = data

        if (source_warehouse_id === target_warehouse_id) {
            throw new Error('Склады отправления и назначения должны быть разными')
        }

        // 1. Check source stock
        const sourceStockRes = await client.query('SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2', [source_warehouse_id, product_id])
        const sourcePrevStock = sourceStockRes.rows[0]?.quantity || 0
        
        if (sourcePrevStock < quantity) {
            throw new Error(`Недостаточно товара на складе отправления. Доступно: ${sourcePrevStock}`)
        }

        // 2. Update source stock
        const sourceNewStock = sourcePrevStock - quantity
        await client.query('UPDATE warehouse_stock SET quantity = $1 WHERE warehouse_id = $2 AND product_id = $3', [sourceNewStock, source_warehouse_id, product_id])

        // 3. Update target stock
        const targetStockRes = await client.query('SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2', [target_warehouse_id, product_id])
        const targetPrevStock = targetStockRes.rows[0]?.quantity || 0
        const targetNewStock = targetPrevStock + quantity
        
        await client.query(`
            INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
        `, [target_warehouse_id, product_id, quantity])

        // 4. Log movements
        const notes = data.notes ? `: ${data.notes}` : ''
        
        // Log out from source
        await logStockMovement(
            client, clubId, userId, product_id, -quantity, sourcePrevStock, sourceNewStock, 
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
        return { success: true }
    } catch (e: any) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
}

export async function getStockMovements(clubId: string, limit: number = 100) {
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

export async function getReplenishmentRulesForProduct(productId: number) {
    const res = await query(`
        SELECT r.*, 
               sw.name as source_warehouse_name, 
               tw.name as target_warehouse_name
        FROM warehouse_replenishment_rules r
        JOIN warehouses sw ON r.source_warehouse_id = sw.id
        JOIN warehouses tw ON r.target_warehouse_id = tw.id
        WHERE r.product_id = $1
    `, [productId])
    return res.rows as ReplenishmentRule[]
}

// --- REPLENISHMENT RULES ---

export async function getReplenishmentRules(clubId: string) {
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
    await query('DELETE FROM warehouse_replenishment_rules WHERE id = $1', [id])
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
                   ws_target.quantity as current_target_stock,
                   ws_source.quantity as current_source_stock,
                   p.name as product_name,
                   tw.name as target_warehouse_name
            FROM warehouse_replenishment_rules r
            LEFT JOIN warehouse_stock ws_target ON r.target_warehouse_id = ws_target.warehouse_id AND r.product_id = ws_target.product_id
            LEFT JOIN warehouse_stock ws_source ON r.source_warehouse_id = ws_source.warehouse_id AND r.product_id = ws_source.product_id
            JOIN warehouse_products p ON r.product_id = p.id
            JOIN warehouses tw ON r.target_warehouse_id = tw.id
            WHERE r.is_active = true
        `)
        
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
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        const taskRes = await client.query('SELECT * FROM club_tasks WHERE id = $1', [taskId])
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
                WHERE r.product_id = $1 AND r.is_active = true
            `, [productId])
            
            for (const rule of rules.rows) {
                const current = rule.current || 0
                if (current <= rule.min_stock_level) {
                    const amountNeeded = rule.max_stock_level - current
                    
                    // Check source stock
                    const sourceRes = await client.query('SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2', [rule.source_warehouse_id, productId])
                    const sourceStock = sourceRes.rows[0]?.quantity || 0
                    
                    const transferAmount = Math.min(amountNeeded, sourceStock)
                    
                    if (transferAmount > 0) {
                        // Execute Transfer
                        // 1. Decrease Source
                        await client.query(`
                            UPDATE warehouse_stock SET quantity = quantity - $1 
                            WHERE warehouse_id = $2 AND product_id = $3
                        `, [transferAmount, rule.source_warehouse_id, productId])
                        
                        // 2. Increase Target
                        await client.query(`
                            INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
                        `, [rule.target_warehouse_id, productId, transferAmount])
                        
                        await logStockMovement(client, clubId, userId, productId, -transferAmount, sourceStock, sourceStock - transferAmount, 'INTERNAL_MOVE', `To ${rule.target_warehouse_id}`, 'WAREHOUSE', rule.source_warehouse_id)
                        await logStockMovement(client, clubId, userId, productId, transferAmount, current, current + transferAmount, 'INTERNAL_MOVE', `From ${rule.source_warehouse_id}`, 'WAREHOUSE', rule.target_warehouse_id)
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
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // 1. Calculate Velocity (Avg Daily Sales for last 30 days)
        // We look at stock movements of type 'SALE'
        // Since we don't have sales yet, let's use a dummy calculation or 0
        // Ideally: SUM(ABS(change_amount)) / 30 WHERE type = 'SALE' AND created_at > NOW() - INTERVAL '30 days'
        
        await client.query(`
            UPDATE warehouse_products p
            SET sales_velocity = COALESCE((
                SELECT ABS(SUM(change_amount))::numeric / 30.0
                FROM warehouse_stock_movements
                WHERE product_id = p.id 
                  AND type = 'SALE' 
                  AND created_at > NOW() - INTERVAL '30 days'
            ), 0)
            WHERE club_id = $1
        `, [clubId])
        
        // 2. ABC Analysis (Simplified)
        // A: Top 20% by revenue (velocity * price)
        // B: Next 30%
        // C: Bottom 50%
        // For now, let's skip complex ABC updates and rely on manual or simple velocity check
        
        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        console.error(e)
    } finally {
        client.release()
    }
}

export async function generateProcurementList(clubId: string, userId: string) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // 1. Update Analytics first
        // (In real app, this might be a scheduled job)
        // For now, we assume velocity is up to date or we rely on min_stock
        
        // 2. Create Draft List
        const listRes = await client.query(`
            INSERT INTO warehouse_procurement_lists (club_id, created_by, status, name)
            VALUES ($1, $2, 'DRAFT', 'Закупка ' || TO_CHAR(NOW(), 'DD.MM.YYYY'))
            RETURNING id
        `, [clubId, userId])
        const listId = listRes.rows[0].id
        
        // 3. Find products to restock
        // Condition: Stock <= Min Stock OR (Velocity > 0 AND Stock < Velocity * 3) (Less than 3 days)
        const products = await client.query(`
            SELECT id, current_stock, min_stock_level, sales_velocity, ideal_stock_days
            FROM warehouse_products
            WHERE club_id = $1 AND is_active = true
            AND (current_stock <= min_stock_level OR (sales_velocity > 0 AND current_stock / NULLIF(sales_velocity, 0) < 3))
        `, [clubId])
        
        for (const p of products.rows) {
            // Calculate suggested quantity
            // Goal: Reach Ideal Stock Days coverage
            // Target = Velocity * Ideal Days
            // Order = Target - Current
            
            let suggested = 0
            if (p.sales_velocity > 0) {
                const target = p.sales_velocity * (p.ideal_stock_days || 14)
                suggested = Math.ceil(target - p.current_stock)
            } else {
                // Fallback if no velocity data: Top up to Min Stock + 20% buffer?
                // Or just arbitrary amount. Let's say Min Stock * 2
                suggested = (p.min_stock_level || 5) * 2 - p.current_stock
            }
            
            if (suggested <= 0) suggested = 1 // Minimum 1 if flagged
            
            await client.query(`
                INSERT INTO warehouse_procurement_items (list_id, product_id, current_stock, suggested_quantity, actual_quantity)
                VALUES ($1, $2, $3, $4, $5)
            `, [listId, p.id, p.current_stock, suggested, suggested])
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

export async function getProcurementListItems(listId: number) {
    const res = await query(`
        SELECT i.*, p.name as product_name, p.cost_price, p.sales_velocity, p.ideal_stock_days
        FROM warehouse_procurement_items i
        JOIN warehouse_products p ON i.product_id = p.id
        WHERE i.list_id = $1
        ORDER BY p.name
    `, [listId])
    return res.rows
}

export async function updateProcurementItem(itemId: number, quantity: number, clubId: string) {
    await query('UPDATE warehouse_procurement_items SET actual_quantity = $1 WHERE id = $2', [quantity, itemId])
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function deleteProcurementList(listId: number, clubId: string) {
    await query('DELETE FROM warehouse_procurement_lists WHERE id = $1', [listId])
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
    warehouseId: number | null = null
) {
    await client.query(`
        INSERT INTO warehouse_stock_movements 
        (club_id, product_id, user_id, change_amount, previous_stock, new_stock, type, reason, related_entity_type, related_entity_id, shift_id, warehouse_id, price_at_time)
        SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, selling_price
        FROM warehouse_products
        WHERE id = $2
    `, [clubId, productId, userId, changeAmount, previousStock, newStock, type, reason, relatedEntityType, relatedEntityId, shiftId, warehouseId])
}

// --- TASKS ---
export async function getClubTasks(clubId: string) {
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
    try {
        await checkReplenishmentNeeds(clubId)
        revalidatePath(`/clubs/${clubId}/inventory`)
        return { success: true }
    } catch (e) {
        console.error('Manual trigger failed:', e)
        throw e
    }
}

export async function getSalesAnalytics(clubId: string, limit: number = 200) {
    const res = await query(`
        SELECT sm.*, 
               p.name as product_name, 
               p.selling_price as current_price,
               COALESCE(sm.price_at_time, p.selling_price) as price_at_time,
               u.full_name as user_name,
               s.check_in as shift_start,
               s.check_out as shift_end,
               s.id as shift_id_raw,
               inv.reported_revenue as shift_reported_revenue,
               inv.calculated_revenue as shift_calculated_revenue,
               inv.revenue_difference as shift_revenue_difference
        FROM warehouse_stock_movements sm
        JOIN warehouse_products p ON sm.product_id = p.id
        LEFT JOIN users u ON sm.user_id = u.id
        LEFT JOIN shifts s ON sm.shift_id = s.id
        LEFT JOIN warehouse_inventories inv ON s.id = inv.shift_id
        WHERE sm.club_id = $1 AND sm.type = 'SALE'
        ORDER BY sm.created_at DESC
        LIMIT $2
    `, [clubId, limit])
    return res.rows
}

export async function getActiveShiftsForClub(clubId: string) {
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

export async function correctInventoryItem(inventoryId: number, productId: number, newActualStock: number, clubId: string) {
    const client = await getClient()
    try {
        await client.query('BEGIN')

        // 1. Get current inventory and item info
        const invRes = await client.query('SELECT * FROM warehouse_inventories WHERE id = $1', [inventoryId])
        if (invRes.rows.length === 0) throw new Error("Инвентаризация не найдена")
        const inventory = invRes.rows[0]

        const itemRes = await client.query(`
            SELECT * FROM warehouse_inventory_items 
            WHERE inventory_id = $1 AND product_id = $2
        `, [inventoryId, productId])
        if (itemRes.rows.length === 0) throw new Error("Позиция не найдена")
        const item = itemRes.rows[0]

        const oldActualStock = item.actual_stock
        const diffInActual = newActualStock - oldActualStock
        if (diffInActual === 0) {
            await client.query('COMMIT')
            return { success: true }
        }

        const newDifference = item.expected_stock - newActualStock
        const oldDifference = item.expected_stock - oldActualStock
        const changeInDifference = newDifference - oldDifference // If we found more stock, difference decreases

        // 2. Update inventory item
        await client.query(`
            UPDATE warehouse_inventory_items 
            SET actual_stock = $1, difference = $2, calculated_revenue = $2 * selling_price_snapshot
            WHERE inventory_id = $3 AND product_id = $4
        `, [newActualStock, newDifference, inventoryId, productId])

        // 3. Update inventory header totals
        const revenueChange = changeInDifference * item.selling_price_snapshot
        await client.query(`
            UPDATE warehouse_inventories 
            SET calculated_revenue = calculated_revenue + $1,
                revenue_difference = revenue_difference - $1
            WHERE id = $2
        `, [revenueChange, inventoryId])

        // 4. Update stock movements if inventory is closed
        if (inventory.status === 'CLOSED') {
            // Find movement created during closure (type SALE or SUPPLY)
            // Inventory closure creates movements with related_entity_type='INVENTORY' and related_entity_id=inventoryId
            const moveRes = await client.query(`
                SELECT * FROM warehouse_stock_movements 
                WHERE related_entity_type = 'INVENTORY' AND related_entity_id = $1 AND product_id = $2
            `, [inventoryId, productId])

            if (moveRes.rows.length > 0) {
                const movement = moveRes.rows[0]
                // change_amount in movement is (actual - expected)
                // If expected=50, actual=40, change=-10 (SALE)
                // If we correct actual to 45, new change=-5
                const newChangeAmount = newActualStock - item.expected_stock
                
                await client.query(`
                    UPDATE warehouse_stock_movements 
                    SET change_amount = $1, new_stock = previous_stock + $1
                    WHERE id = $2
                `, [newChangeAmount, movement.id])

                // 5. Update physical stock if no later inventories
                const laterInvRes = await client.query(`
                    SELECT id FROM warehouse_inventories 
                    WHERE club_id = $1 AND status = 'CLOSED' AND closed_at > $2
                    LIMIT 1
                `, [clubId, inventory.closed_at])

                if (laterInvRes.rows.length === 0) {
                    const stockDiff = newActualStock - oldActualStock
                    await client.query(`
                        INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
                    `, [inventory.warehouse_id, productId, stockDiff])

                    // Update product cache
                    await client.query(`
                        UPDATE warehouse_products
                        SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                        WHERE id = $1
                    `, [productId])
                }
            }
        }

        await client.query('COMMIT')
        revalidatePath(`/clubs/${clubId}/inventory`)
        return { success: true }
    } catch (e: any) {
        await client.query('ROLLBACK')
        console.error('Error correcting inventory item:', e)
        return { success: false, error: e.message }
    } finally {
        client.release()
    }
}

export async function correctStockMovement(movementId: number, newAmount: number, newReason?: string) {
    const client = await getClient()
    try {
        await client.query('BEGIN')

        // 1. Находим само движение
        const mRes = await client.query('SELECT * FROM warehouse_stock_movements WHERE id = $1', [movementId])
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
                WHERE id = $1
            `, [product_id])
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
        revalidatePath(`/clubs/${club_id}/inventory`)
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
                WHERE id = $1
            `, [move.product_id])
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
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        const { product_id, quantity, warehouse_id, shift_id, notes } = data

        // 1. Get product info and current stock
        const prodRes = await client.query('SELECT selling_price, name FROM warehouse_products WHERE id = $1', [product_id])
        if (prodRes.rows.length === 0) throw new Error("Товар не найден")
        const product = prodRes.rows[0]

        const stockRes = await client.query('SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2', [warehouse_id, product_id])
        const prevStock = stockRes.rows[0]?.quantity || 0
        const newStock = prevStock - quantity

        // 2. Update stock
        await client.query(`
            UPDATE warehouse_stock 
            SET quantity = $1 
            WHERE warehouse_id = $2 AND product_id = $3
        `, [newStock, warehouse_id, product_id])

        // 3. Update product cache
        await client.query(`
            UPDATE warehouse_products
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
            WHERE id = $1
        `, [product_id])

        // 4. Log movement
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

export async function assignShiftToMovement(movementId: number, shiftId: number | null, clubId: string) {
    await query(`
        UPDATE warehouse_stock_movements 
        SET shift_id = $1 
        WHERE id = $2 AND club_id = $3
    `, [shiftId, movementId, clubId])
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function massAssignShiftToMovements(movementIds: number[], shiftId: number | null, clubId: string) {
    await query(`
        UPDATE warehouse_stock_movements 
        SET shift_id = $1 
        WHERE id = ANY($2) AND club_id = $3
    `, [shiftId, movementIds, clubId])
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function createWriteOff(clubId: string, userId: string, data: { items: { product_id: number, quantity: number, type: 'WASTE' | 'SALARY_DEDUCTION' }[], notes: string, shift_id?: string, warehouse_id?: number }) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // Find warehouse (passed explicitly, or default, or fallback to first available)
        let warehouseId = data.warehouse_id
        
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

        for (const item of data.items) {
            // 1. Get current stock
            const stockRes = await client.query('SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2', [warehouseId, item.product_id])
            const previousStock = stockRes.rows[0]?.quantity || 0
            const newStock = previousStock - item.quantity

            // 2. Update stock
            await client.query(`
                UPDATE warehouse_stock 
                SET quantity = $1 
                WHERE warehouse_id = $2 AND product_id = $3
            `, [newStock, warehouseId, item.product_id])

            // 3. Update product cache
            await client.query(`
                UPDATE warehouse_products
                SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1)
                WHERE id = $1
            `, [item.product_id])

            // 4. Log movement
            const reason = item.type === 'SALARY_DEDUCTION' ? `В счет ЗП: ${data.notes}` : `Списание: ${data.notes}`
            const movementType = item.type === 'SALARY_DEDUCTION' ? 'SALE' : 'ADJUSTMENT' // SALARY_DEDUCTION is essentially a sale to employee
            
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
                warehouseId
            )

            // 5. If Salary Deduction, update Shift and log
            if (item.type === 'SALARY_DEDUCTION') {
                const prodRes = await client.query('SELECT selling_price FROM warehouse_products WHERE id = $1', [item.product_id])
                const price = prodRes.rows[0]?.selling_price || 0
                const totalDeduction = price * item.quantity

                if (data.shift_id) {
                    await client.query(`
                        UPDATE shifts 
                        SET bar_purchases = COALESCE(bar_purchases, 0) + $1 
                        WHERE id = $2
                    `, [totalDeduction, data.shift_id])
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
                    'cost_price', si.cost_price,
                    'created_at', s.created_at,
                    'supplier_name', s.supplier_name,
                    'supply_id', s.id
                ))
                FROM (
                    SELECT si.cost_price, s.created_at, s.supplier_name, s.id
                    FROM warehouse_supply_items si
                    JOIN warehouse_supplies s ON si.supply_id = s.id
                    WHERE si.product_id = p.id AND s.status = 'COMPLETED'
                    ORDER BY s.created_at DESC
                    LIMIT 5
                ) s
            ) as price_history
            FROM warehouse_products p 
            LEFT JOIN warehouse_categories c ON p.category_id = c.id 
            WHERE p.club_id = $1 
            ORDER BY p.name
        `, [clubId])
        
        return res.rows.map(row => ({
            ...row,
            current_stock: Number(row.total_stock) || 0, // Override with sum from warehouse_stock
            stocks: row.stocks || [],
            price_history: row.price_history || []
        })) as Product[]
    } finally {
        client.release()
    }
}

export async function createProduct(clubId: string, userId: string, data: { name: string, barcode?: string | null, barcodes?: string[], category_id: number | null, cost_price: number, selling_price: number, current_stock: number, min_stock_level?: number }) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // 1. Create Product
        const res = await client.query(`
            INSERT INTO warehouse_products (club_id, category_id, name, barcode, barcodes, cost_price, selling_price, current_stock, min_stock_level)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `, [clubId, data.category_id, data.name, data.barcode || null, data.barcodes || [], data.cost_price, data.selling_price, data.current_stock, data.min_stock_level || 0])
        
        const productId = res.rows[0].id

        // 2. Add Stock to Warehouse (default or fallback)
        if (data.current_stock > 0) {
            const whRes = await client.query('SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1', [clubId])
            const warehouseId = whRes.rows[0]?.id
            
            if (warehouseId) {
                await client.query(`
                    INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                    VALUES ($1, $2, $3)
                `, [warehouseId, productId, data.current_stock])
                
                await logStockMovement(client, clubId, userId, productId, data.current_stock, 0, data.current_stock, 'SUPPLY', 'Initial Stock', 'WAREHOUSE', productId, null, warehouseId)
            }
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

export async function updateProduct(id: number, clubId: string, userId: string, data: { name: string, barcode?: string | null, barcodes?: string[], category_id: number | null, cost_price: number, selling_price: number, min_stock_level?: number, is_active: boolean }) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        await client.query(`
            UPDATE warehouse_products 
            SET name = $1, barcode = $2, barcodes = $3, category_id = $4, cost_price = $5, selling_price = $6, min_stock_level = $7, is_active = $8
            WHERE id = $9
        `, [data.name, data.barcode || null, data.barcodes || [], data.category_id, data.cost_price, data.selling_price, data.min_stock_level || 0, data.is_active, id])
        
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
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // Get old stock
        const stockRes = await client.query('SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2', [warehouseId, productId])
        const oldQuantity = stockRes.rows[0]?.quantity || 0
        const diff = newQuantity - oldQuantity
        
        if (diff === 0) return

        // Update Stock
        await client.query(`
            INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = $3
        `, [warehouseId, productId, newQuantity])
        
        // Update Total Cache in Products Table
        await client.query(`
            UPDATE warehouse_products p
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
            WHERE id = $1
        `, [productId])

        await logStockMovement(client, clubId, userId, productId, diff, oldQuantity, newQuantity, 'MANUAL_EDIT', reason, 'WAREHOUSE', warehouseId)
        
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
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // Find warehouse with enough stock
        // Strategy: First Default, then others
        const stocks = await client.query(`
            SELECT ws.warehouse_id, ws.quantity 
            FROM warehouse_stock ws
            JOIN warehouses w ON ws.warehouse_id = w.id
            WHERE ws.product_id = $1
            ORDER BY w.is_default DESC, ws.quantity DESC
        `, [productId])
        
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
            await client.query(`
                UPDATE warehouse_stock 
                SET quantity = quantity - $1
                WHERE warehouse_id = $2 AND product_id = $3
            `, [wo.amount, wo.warehouseId, productId])
            
            await logStockMovement(client, clubId, userId, productId, -wo.amount, 0, 0, 'WRITE_OFF', reason, 'WAREHOUSE', wo.warehouseId)
        }
        
        // Update Total Cache
        await client.query(`
            UPDATE warehouse_products p
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
            WHERE id = $1
        `, [productId])
        
        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function getProductHistory(productId: number) {
    const res = await query(`
        SELECT m.*, u.full_name as user_name
        FROM warehouse_stock_movements m
        LEFT JOIN users u ON m.user_id = u.id
        WHERE m.product_id = $1
        ORDER BY m.created_at DESC
        LIMIT 50
    `, [productId])
    return res.rows
}

export async function deleteProduct(id: number, clubId: string) {
    await query(`DELETE FROM warehouse_products WHERE id = $1`, [id])
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function bulkUpdatePrices(ids: number[], clubId: string, type: 'fixed' | 'percent', value: number) {
    if (type === 'fixed') {
        await query(`
            UPDATE warehouse_products 
            SET selling_price = $1 
            WHERE id = ANY($2)
        `, [value, ids])
    } else {
        // Percent increase/decrease
        // value is percentage (e.g. 10 for +10%, -10 for -10%)
        // Formula: price * (1 + value/100)
        await query(`
            UPDATE warehouse_products 
            SET selling_price = selling_price * (1 + $1::decimal / 100)
            WHERE id = ANY($2)
        `, [value, ids])
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
    const res = await query(`
        SELECT * FROM warehouse_suppliers 
        WHERE club_id = $1 AND is_active = true 
        ORDER BY name
    `, [clubId])
    return res.rows as Supplier[]
}

export async function createSupplier(clubId: string, name: string, contactInfo?: string) {
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
    const res = await query(`SELECT id, name FROM warehouse_suppliers WHERE club_id = $1 AND is_active = true ORDER BY name`, [clubId])
    return res.rows
}


export async function getSupplies(clubId: string) {
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
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

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
                await client.query(`
                    INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
                `, [warehouseId, item.product_id, item.quantity])
                
                await client.query(`
                    UPDATE warehouse_products
                    SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1),
                        cost_price = $2
                    WHERE id = $1
                `, [item.product_id, item.cost_price])
                
                await logStockMovement(client, clubId, userId, item.product_id, item.quantity, 0, 0, 'SUPPLY', `Supply #${supplyId}`, 'SUPPLY', supplyId, null, warehouseId)
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

export async function getSupplyItems(supplyId: number) {
    const res = await query(`
        SELECT si.*, p.name as product_name
        FROM warehouse_supply_items si
        JOIN warehouse_products p ON si.product_id = p.id
        WHERE si.supply_id = $1
        ORDER BY p.name
    `, [supplyId])
    return res.rows as SupplyItem[]
}

export async function deleteSupply(supplyId: number, clubId: string, userId: string) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        const supplyRes = await client.query('SELECT * FROM warehouse_supplies WHERE id = $1', [supplyId])
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
                        WHERE id = $1
                    `, [item.product_id])
                }
                
                // Delete movement
                await client.query(`
                    DELETE FROM warehouse_stock_movements 
                    WHERE related_entity_type = 'SUPPLY' AND related_entity_id = $1 AND product_id = $2
                `, [supplyId, item.product_id])
            }
        }
        
        await client.query('DELETE FROM warehouse_supplies WHERE id = $1', [supplyId])
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
    const res = await query(`
        SELECT i.*, u.full_name as created_by_name
        FROM warehouse_inventories i
        LEFT JOIN users u ON i.created_by = u.id
        WHERE i.id = $1
    `, [id])
    return res.rows[0] as Inventory
}

export async function getInventoryItems(inventoryId: number) {
    const res = await query(`
        SELECT ii.*, p.name as product_name, p.barcode as barcode, c.name as category_name
        FROM warehouse_inventory_items ii
        JOIN warehouse_products p ON ii.product_id = p.id
        LEFT JOIN warehouse_categories c ON p.category_id = c.id
        WHERE ii.inventory_id = $1
        ORDER BY c.name NULLS LAST, p.name
    `, [inventoryId])
    return res.rows as InventoryItem[]
}

export async function getMetrics() {
    const res = await query(`SELECT key, label FROM system_metrics WHERE type = 'MONEY' ORDER BY label`)
    return res.rows as { key: string, label: string }[]
}

export async function getClubSettings(clubId: string) {
    const res = await query(`
        SELECT id, owner_id, inventory_settings 
        FROM clubs 
        WHERE id = $1
    `, [clubId])
    return res.rows[0] as { 
        id: number, 
        owner_id: string, 
        inventory_settings: { 
            employee_allowed_warehouse_ids?: number[], 
            employee_default_metric_key?: string 
        } 
    }
}

export async function getUserRoleInClub(clubId: string, userId: string) {
    const res = await query(`
        SELECT role FROM club_employees 
        WHERE club_id = $1 AND user_id = $2 AND is_active = true
    `, [clubId, userId])
    
    if (res.rows.length === 0) return null
    return res.rows[0].role as string
}

export async function createInventory(clubId: string, userId: string, targetMetricKey: string | null, categoryId?: number | null, warehouseId?: number | null, shiftId: string | null = null) {
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

        // Check if already exists
        const existing = await client.query(`SELECT 1 FROM warehouse_inventory_items WHERE inventory_id = $1 AND product_id = $2`, [inventoryId, productId])
        if (existing.rowCount && existing.rowCount > 0) {
            throw new Error("Этот товар уже есть в списке")
        }

        // Get product details and current stock in that warehouse (even if 0)
        // We need to know which warehouse this inventory is for
        const inv = await client.query(`SELECT warehouse_id, club_id FROM warehouse_inventories WHERE id = $1`, [inventoryId])
        let warehouseId = inv.rows[0]?.warehouse_id
        const currentClubId = inv.rows[0]?.club_id

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
            WHERE p.id = $1
        `, [productId, warehouseId])
        
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
    await query(`DELETE FROM warehouse_inventories WHERE id = $1`, [inventoryId])
    await logOperation(clubId, userId, 'DELETE_INVENTORY', 'INVENTORY', inventoryId)
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function getProductByBarcode(clubId: string, barcode: string) {
    const res = await query(`
        SELECT id, name, barcode, barcodes, selling_price, current_stock
        FROM warehouse_products
        WHERE club_id = $1 AND ($2 = ANY(barcodes) OR barcode = $2) AND is_active = true
    `, [clubId, barcode])
    return res.rows[0] as { id: number, name: string, barcode: string, barcodes: string[], selling_price: number, current_stock: number } | null
}

export async function updateInventoryItem(itemId: number, actualStock: number | null, clubId: string) {
    // Just update the actual count
    await query(`
        UPDATE warehouse_inventory_items
        SET actual_stock = $1
        WHERE id = $2
    `, [actualStock, itemId])

    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function bulkUpdateInventoryItems(items: { id: number, actual_stock: number | null }[], clubId: string) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        for (const item of items) {
            await client.query(`
                UPDATE warehouse_inventory_items
                SET actual_stock = $1
                WHERE id = $2
            `, [item.actual_stock, item.id])
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
    unaccountedSales: { product_id: number, quantity: number, selling_price: number, cost_price: number }[] = []
) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // 1. Calculate stats for all items
        await client.query(`
            UPDATE warehouse_inventory_items
            SET difference = expected_stock - actual_stock,
                calculated_revenue = CASE 
                    WHEN actual_stock < expected_stock THEN (expected_stock - actual_stock) * selling_price_snapshot 
                    ELSE 0 
                END
            WHERE inventory_id = $1
        `, [inventoryId])

        // 2. Calculate total revenue (Standard Sales + Unaccounted Sales)
        const sumRes = await client.query(`
            SELECT SUM(calculated_revenue) as total_rev
            FROM warehouse_inventory_items
            WHERE inventory_id = $1
        `, [inventoryId])
        
        const standardCalculatedRevenue = Number(sumRes.rows[0].total_rev || 0)
        const unaccountedRevenue = unaccountedSales.reduce((acc, s) => acc + (s.quantity * s.selling_price), 0)
        
        const totalCalculatedRevenue = standardCalculatedRevenue + unaccountedRevenue
        const diff = reportedRevenue - totalCalculatedRevenue 
        
        // 3. Update Stock Levels to Actual and Log Movements
        // Strategy: Adjust stock in the Inventoried Warehouse (or Default if legacy)
        
        // Get inventory info including shift_id
        const invHeader = await client.query('SELECT warehouse_id, shift_id, created_by FROM warehouse_inventories WHERE id = $1', [inventoryId])
        let warehouseId = invHeader.rows[0]?.warehouse_id
        const shiftId = invHeader.rows[0]?.shift_id
        const userId = invHeader.rows[0]?.created_by

        if (!warehouseId) {
             // Fallback: Default or any warehouse
             const whRes = await client.query('SELECT id FROM warehouses WHERE club_id = $1 ORDER BY is_default DESC LIMIT 1', [clubId])
             warehouseId = whRes.rows[0]?.id
        }

        if (!warehouseId) throw new Error("Не найден склад для корректировки остатков")

        // --- PART A: Handle Standard Inventory Items (Sales and Excesses) ---
        const diffItems = await client.query(`
            SELECT ii.product_id, ii.expected_stock, ii.actual_stock, ii.cost_price_snapshot
            FROM warehouse_inventory_items ii
            WHERE ii.inventory_id = $1 AND ii.actual_stock IS NOT NULL AND ii.actual_stock != ii.expected_stock
        `, [inventoryId])

        // Group items for a potential automatic supply (any excess: actual > expected)
        const itemsForAutoSupply: { product_id: number, quantity: number, cost_price: number }[] = []

        // If inventory has no shiftId (owner inventory/revision), we use a different reason
        const isRevision = !shiftId
        const reasonPrefix = isRevision ? `Ревизия (инвентаризация #${inventoryId})` : `Продажа за смену (инвентаризация #${inventoryId})`
        const movementType = isRevision ? 'ADJUSTMENT' : 'SALE'

        for (const item of diffItems.rows) {
            const diffAmount = item.actual_stock - item.expected_stock
            
            // If we found MORE than expected, it's an UNACCOUNTED supply
            if (diffAmount > 0) {
                itemsForAutoSupply.push({
                    product_id: item.product_id,
                    quantity: diffAmount,
                    cost_price: item.cost_price_snapshot || 0
                })
                continue // Skip regular inventory adjustment for these items, we'll create a Supply for the difference
            }

            // If actual < expected, it's an ADJUSTMENT (for revisions) or SALE (for shifts)
            const type = movementType
            const reason = reasonPrefix

            await client.query(`
                INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
            `, [warehouseId, item.product_id, diffAmount])

            await logStockMovement(client, clubId, userId, item.product_id, diffAmount, item.expected_stock, item.actual_stock, type, reason, 'INVENTORY', inventoryId, shiftId, warehouseId)
        }

        // --- PART B: Handle Unaccounted Sales (Sold items that weren't in stock at all) ---
        // For each unaccounted sale:
        // 1. Create a DRAFT Supply (to fix the balance)
        // 2. The SALE is already "calculated" in revenue, and we log it as a sale.
        // Actually, to keep it simple: we add these to the Auto-Supply list as well!
        for (const sale of unaccountedSales) {
            itemsForAutoSupply.push({
                product_id: sale.product_id,
                quantity: sale.quantity,
                cost_price: sale.cost_price
            })
            
            // Also log the movement for these unaccounted items
            const saleReason = isRevision 
                ? `Неучтенный товар (ревизия #${inventoryId})` 
                : `Продажа неучтенного товара (инвентаризация #${inventoryId})`
            
            await logStockMovement(client, clubId, userId, sale.product_id, -sale.quantity, 0, 0, movementType, saleReason, 'INVENTORY', inventoryId, shiftId, warehouseId)
        }

        // Create automatic supply for all excess/unaccounted items
        if (itemsForAutoSupply.length > 0) {
            const totalAutoCost = itemsForAutoSupply.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0)
            const supplyRes = await client.query(`
                INSERT INTO warehouse_supplies (club_id, supplier_name, notes, total_cost, created_by)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [clubId, 'Авто-поступление (Инвентаризация)', `Автоматически создано при закрытии инвентаризации #${inventoryId}. Включает излишки и неучтенные продажи. ТРЕБУЕТ ПРОВЕРКИ ЦЕН.`, totalAutoCost, userId])
            const supplyId = supplyRes.rows[0].id

            // Try to set status to DRAFT if the column exists (resilient approach)
            try {
                await client.query(`UPDATE warehouse_supplies SET status = 'DRAFT' WHERE id = $1`, [supplyId]);
            } catch (statusError) {
                console.warn("Could not set supply status to DRAFT, column might be missing:", statusError);
            }

            for (const item of itemsForAutoSupply) {
                await client.query(`
                    INSERT INTO warehouse_supply_items (supply_id, product_id, quantity, cost_price, total_cost)
                    VALUES ($1, $2, $3, $4, $5)
                `, [supplyId, item.product_id, item.quantity, item.cost_price, item.quantity * item.cost_price])

                // UPDATE warehouse_stock IMMEDIATELY for the supply part
                // This ensures the stock is "reconstituted"
                await client.query(`
                    INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
                `, [warehouseId, item.product_id, item.quantity])

                await logStockMovement(client, clubId, userId, item.product_id, item.quantity, 0, item.quantity, 'SUPPLY', `Авто-поступление #${supplyId} (Инвентаризация #${inventoryId})`, 'SUPPLY', supplyId, shiftId)
            }
        }

        // Update Cache
        await client.query(`
            UPDATE warehouse_products p
            SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
            FROM warehouse_inventory_items ii
            WHERE ii.product_id = p.id AND ii.inventory_id = $1 AND ii.actual_stock IS NOT NULL
        `, [inventoryId])

        // 4. Close Inventory
        await client.query(`
            UPDATE warehouse_inventories
            SET status = 'CLOSED', closed_at = NOW(), 
                reported_revenue = $2, 
                calculated_revenue = $3,
                revenue_difference = $4
            WHERE id = $1
        `, [inventoryId, reportedRevenue, totalCalculatedRevenue, diff])

        await client.query('COMMIT')

        // --- TRIGGER REPLENISHMENT CHECK AFTER INVENTORY ---
        // This will create tasks if stock levels dropped below minimums
        await checkReplenishmentNeeds(clubId)

    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}
