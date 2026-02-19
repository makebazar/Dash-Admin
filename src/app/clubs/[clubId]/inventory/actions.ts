"use server"

import { query } from "@/db"
import { revalidatePath } from "next/cache"
import { logOperation } from "@/lib/logger"

export type Product = {
    id: number
    club_id: number
    category_id: number | null
    name: string
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
    responsible_user_id?: string
    responsible_name?: string
    contact_info?: string
    characteristics?: any
    is_active: boolean
}

export type Supply = {
    id: number
    supplier_name: string
    notes: string
    total_cost: number
    created_at: string
    created_by_name?: string
    items_count?: number
}

export type Inventory = {
    id: number
    status: 'OPEN' | 'CLOSED'
    started_at: string
    closed_at: string | null
    target_metric_key: string
    reported_revenue: number
    calculated_revenue: number
    revenue_difference: number
    created_by_name?: string
    notes?: string
}

export type InventoryItem = {
    id: number
    product_id: number
    product_name: string
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

export async function createWarehouse(clubId: string, userId: string, data: { name: string, address?: string, type: string, responsible_user_id?: string, contact_info?: string, characteristics?: any }) {
    const res = await query(`
        INSERT INTO warehouses (club_id, name, address, type, responsible_user_id, contact_info, characteristics)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
    `, [clubId, data.name, data.address, data.type, data.responsible_user_id, data.contact_info, data.characteristics || {}])

    await logOperation(clubId, userId, 'CREATE_WAREHOUSE', 'WAREHOUSE', res.rows[0].id, data)
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function updateWarehouse(id: number, clubId: string, userId: string, data: { name: string, address?: string, type: string, responsible_user_id?: string, contact_info?: string, characteristics?: any, is_active: boolean }) {
    await query(`
        UPDATE warehouses
        SET name = $1, address = $2, type = $3, responsible_user_id = $4, contact_info = $5, characteristics = $6, is_active = $7
        WHERE id = $8
    `, [data.name, data.address, data.type, data.responsible_user_id, data.contact_info, data.characteristics || {}, data.is_active, id])

    await logOperation(clubId, userId, 'UPDATE_WAREHOUSE', 'WAREHOUSE', id, data)
    revalidatePath(`/clubs/${clubId}/inventory`)
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

    // Analytics Fields
    sales_velocity: number
    ideal_stock_days: number
    last_restock_date?: string
    
    // Calculated Runway (Days left)
    days_of_stock?: number
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
    relatedEntityId: number | null = null
) {
    await client.query(`
        INSERT INTO warehouse_stock_movements 
        (club_id, product_id, user_id, change_amount, previous_stock, new_stock, type, reason, related_entity_type, related_entity_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [clubId, productId, userId, changeAmount, previousStock, newStock, type, reason, relatedEntityType, relatedEntityId])
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

export async function completeTask(taskId: number, userId: string, clubId: string) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // Get task info
        const taskRes = await client.query('SELECT * FROM club_tasks WHERE id = $1', [taskId])
        const task = taskRes.rows[0]
        
        if (!task) throw new Error('Задача не найдена')

        if (task.type === 'RESTOCK' && task.related_entity_type === 'PRODUCT') {
            const productId = task.related_entity_id
            
            // Get product info
            const prodRes = await client.query('SELECT * FROM warehouse_products WHERE id = $1', [productId])
            const product = prodRes.rows[0]
            
            if (product) {
                // Calculate restock amount: fill up to max_front_stock
                const amountNeeded = product.max_front_stock - product.front_stock
                const amountAvailable = Math.min(amountNeeded, product.back_stock)
                
                if (amountAvailable > 0) {
                    // Move from Back to Front
                    const newBack = product.back_stock - amountAvailable
                    const newFront = product.front_stock + amountAvailable
                    
                    await client.query(`
                        UPDATE warehouse_products 
                        SET back_stock = $1, front_stock = $2
                        WHERE id = $3
                    `, [newBack, newFront, productId])
                    
                    // Log movement? It's internal move, maybe specific type?
                    // Let's log as 'INTERNAL_MOVE' or similar, but our table tracks TOTAL stock.
                    // Total stock doesn't change here!
                    // But we might want to track this event.
                    // For now, let's assume stock movements track TOTAL stock changes.
                    // If we want detailed tracking of front/back, we need to expand movements table or rely on tasks history.
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
    revalidatePath(`/clubs/${clubId}`) // Revalidate dashboard where tasks might be shown
}

// --- PRODUCTS ---

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
            ) as stocks
            FROM warehouse_products p 
            LEFT JOIN warehouse_categories c ON p.category_id = c.id 
            WHERE p.club_id = $1 
            ORDER BY p.name
        `, [clubId])
        
        return res.rows.map(row => ({
            ...row,
            current_stock: Number(row.total_stock) || 0, // Override with sum from warehouse_stock
            stocks: row.stocks || []
        })) as Product[]
    } finally {
        client.release()
    }
}

export async function createProduct(clubId: string, userId: string, data: { name: string, category_id: number | null, cost_price: number, selling_price: number, current_stock: number, min_stock_level?: number }) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // 1. Create Product
        const res = await client.query(`
            INSERT INTO warehouse_products (club_id, category_id, name, cost_price, selling_price, current_stock, min_stock_level)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [clubId, data.category_id, data.name, data.cost_price, data.selling_price, data.current_stock, data.min_stock_level || 0])
        
        const productId = res.rows[0].id

        // 2. Add Stock to Default Warehouse
        if (data.current_stock > 0) {
            const defaultWh = await client.query('SELECT id FROM warehouses WHERE club_id = $1 AND is_default = true LIMIT 1', [clubId])
            const warehouseId = defaultWh.rows[0]?.id
            
            if (warehouseId) {
                await client.query(`
                    INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                    VALUES ($1, $2, $3)
                `, [warehouseId, productId, data.current_stock])
                
                await logStockMovement(client, clubId, userId, productId, data.current_stock, 0, data.current_stock, 'SUPPLY', 'Initial Stock', 'WAREHOUSE', warehouseId)
            }
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

export async function updateProduct(id: number, clubId: string, userId: string, data: { name: string, category_id: number | null, cost_price: number, selling_price: number, min_stock_level?: number, is_active: boolean }) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        await client.query(`
            UPDATE warehouse_products 
            SET name = $1, category_id = $2, cost_price = $3, selling_price = $4, min_stock_level = $5, is_active = $6
            WHERE id = $7
        `, [data.name, data.category_id, data.cost_price, data.selling_price, data.min_stock_level || 0, data.is_active, id])
        
        await client.query('COMMIT')
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

// --- SUPPLIES ---

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

export async function createSupply(clubId: string, userId: string, data: { supplier_name: string, notes: string, items: { product_id: number, quantity: number, cost_price: number }[] }) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // 1. Create Supply
        const totalCost = data.items.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0)
        const supplyRes = await client.query(`
            INSERT INTO warehouse_supplies (club_id, supplier_name, notes, total_cost, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [clubId, data.supplier_name, data.notes, totalCost, userId])
        const supplyId = supplyRes.rows[0].id

            // 2. Add Items & Update Stock (Default Warehouse)
            const defaultWh = await client.query('SELECT id FROM warehouses WHERE club_id = $1 AND is_default = true LIMIT 1', [clubId])
            const warehouseId = defaultWh.rows[0]?.id

            for (const item of data.items) {
                await client.query(`
                    INSERT INTO warehouse_supply_items (supply_id, product_id, quantity, cost_price, total_cost)
                    VALUES ($1, $2, $3, $4, $5)
                `, [supplyId, item.product_id, item.quantity, item.cost_price, item.quantity * item.cost_price])

                // Update product stock and cost price (last price)
                // Supplies usually go to Main Warehouse
                if (warehouseId) {
                    await client.query(`
                        INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
                    `, [warehouseId, item.product_id, item.quantity])
                    
                    // Update cache
                    await client.query(`
                        UPDATE warehouse_products
                        SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = $1),
                            cost_price = $2
                        WHERE id = $1
                    `, [item.product_id, item.cost_price])
                    
                    await logStockMovement(client, clubId, userId, item.product_id, item.quantity, 0, 0, 'SUPPLY', `Supply #${supplyId}`, 'SUPPLY', supplyId)
                }
            }

        await client.query('COMMIT')
        await logOperation(clubId, userId, 'CREATE_SUPPLY', 'SUPPLY', supplyId, { itemsCount: data.items.length, totalCost })
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}

// --- INVENTORIES ---

export async function getInventories(clubId: string) {
    const res = await query(`
        SELECT i.*, u.full_name as created_by_name
        FROM warehouse_inventories i
        LEFT JOIN users u ON i.created_by = u.id
        WHERE i.club_id = $1
        ORDER BY i.started_at DESC
    `, [clubId])
    return res.rows as Inventory[]
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
        SELECT ii.*, p.name as product_name
        FROM warehouse_inventory_items ii
        JOIN warehouse_products p ON ii.product_id = p.id
        WHERE ii.inventory_id = $1
        ORDER BY p.name
    `, [inventoryId])
    return res.rows as InventoryItem[]
}

export async function getMetrics() {
    const res = await query(`SELECT key, label FROM system_metrics WHERE type = 'MONEY' ORDER BY label`)
    return res.rows as { key: string, label: string }[]
}

export async function createInventory(clubId: string, userId: string, targetMetricKey: string, categoryId?: number | null) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // 1. Create Inventory Header
        const invRes = await client.query(`
            INSERT INTO warehouse_inventories (club_id, created_by, status, target_metric_key)
            VALUES ($1, $2, 'OPEN', $3)
            RETURNING id
        `, [clubId, userId, targetMetricKey])
        const inventoryId = invRes.rows[0].id

        // 2. Snapshot current stock (Sum of all warehouses for now)
        // TODO: Support Per-Warehouse Inventory
        // Filter by category if provided
        let query = `SELECT id, current_stock, cost_price, selling_price FROM warehouse_products WHERE club_id = $1 AND is_active = true`
        const params: any[] = [clubId]
        
        if (categoryId) {
            query += ` AND category_id = $2`
            params.push(categoryId)
        }

        const productsRes = await client.query(query, params)
        
        for (const p of productsRes.rows) {
            await client.query(`
                INSERT INTO warehouse_inventory_items (inventory_id, product_id, expected_stock, cost_price_snapshot, selling_price_snapshot)
                VALUES ($1, $2, $3, $4, $5)
            `, [inventoryId, p.id, p.current_stock, p.cost_price, p.selling_price])
        }

        await client.query('COMMIT')
        await logOperation(clubId, userId, 'CREATE_INVENTORY', 'INVENTORY', inventoryId, { categoryId })
        return inventoryId
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

export async function updateInventoryItem(itemId: number, actualStock: number) {
    // Just update the actual count
    await query(`
        UPDATE warehouse_inventory_items
        SET actual_stock = $1
        WHERE id = $2
    `, [actualStock, itemId])
}

export async function closeInventory(inventoryId: number, clubId: string, reportedRevenue: number) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')

        // 1. Calculate stats for all items
        await client.query(`
            UPDATE warehouse_inventory_items
            SET difference = expected_stock - actual_stock,
                calculated_revenue = (expected_stock - actual_stock) * selling_price_snapshot
            WHERE inventory_id = $1
        `, [inventoryId])

        // 2. Calculate total revenue
        const sumRes = await client.query(`
            SELECT SUM(calculated_revenue) as total_rev
            FROM warehouse_inventory_items
            WHERE inventory_id = $1
        `, [inventoryId])
        
        const calculatedRevenue = sumRes.rows[0].total_rev || 0
        const diff = reportedRevenue - calculatedRevenue 
        
        // 3. Update Stock Levels to Actual and Log Movements
        // For Multi-Warehouse: Update Default Warehouse
        // Strategy: Adjust stock in the Default Warehouse to match the new total.
        // This is a simplification. Ideally, inventory should be per-warehouse.
        
        const defaultWh = await client.query('SELECT id FROM warehouses WHERE club_id = $1 AND is_default = true LIMIT 1', [clubId])
        const warehouseId = defaultWh.rows[0]?.id

        if (!warehouseId) throw new Error("Не найден основной склад для корректировки остатков")

        const diffItems = await client.query(`
            SELECT ii.product_id, ii.expected_stock, ii.actual_stock
            FROM warehouse_inventory_items ii
            WHERE ii.inventory_id = $1 AND ii.actual_stock IS NOT NULL AND ii.actual_stock != ii.expected_stock
        `, [inventoryId])

        for (const item of diffItems.rows) {
            const diff = item.actual_stock - item.expected_stock
            
            await client.query(`
                INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = warehouse_stock.quantity + $3
            `, [warehouseId, item.product_id, diff])

            await logStockMovement(client, clubId, null, item.product_id, diff, item.expected_stock, item.actual_stock, 'INVENTORY_ADJUSTMENT', `Inventory #${inventoryId}`, 'INVENTORY', inventoryId)
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
        `, [inventoryId, reportedRevenue, calculatedRevenue, diff])

        await client.query('COMMIT')
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
    revalidatePath(`/clubs/${clubId}/inventory`)
}
