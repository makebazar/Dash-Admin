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
    front_stock: number
    back_stock: number
    max_front_stock: number
    min_front_stock: number
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
    const res = await query(`
        SELECT p.*, c.name as category_name 
        FROM warehouse_products p 
        LEFT JOIN warehouse_categories c ON p.category_id = c.id 
        WHERE p.club_id = $1 
        ORDER BY p.name
    `, [clubId])
    return res.rows as Product[]
}

export async function createProduct(clubId: string, userId: string, data: { name: string, category_id: number | null, cost_price: number, selling_price: number, current_stock: number, min_stock_level?: number, front_stock?: number, back_stock?: number, max_front_stock?: number, min_front_stock?: number }) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // Calculate front/back if not provided but capacity is set
        let front = data.front_stock || 0
        let back = data.back_stock || 0
        const total = data.current_stock
        
        if (data.max_front_stock && data.max_front_stock > 0 && !data.front_stock && !data.back_stock) {
            // Auto distribute: fill front first
            front = Math.min(total, data.max_front_stock)
            back = total - front
        } else if (!data.front_stock && !data.back_stock) {
            // Default: all in back (or front? usually back if storage exists)
            // Or simpler: all in front if no capacity set.
            // Let's say if no split specified, put all in back if capacity set, else all in front (simple item)
            // But we track TOTAL current_stock as main source of truth for value.
            // Let's assume if no capacity, it's a simple item -> front_stock = current_stock
            if (!data.max_front_stock) {
                front = total
                back = 0
            } else {
                back = total
                front = 0
            }
        }

        const res = await client.query(`
            INSERT INTO warehouse_products (club_id, category_id, name, cost_price, selling_price, current_stock, min_stock_level, front_stock, back_stock, max_front_stock, min_front_stock)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `, [clubId, data.category_id, data.name, data.cost_price, data.selling_price, total, data.min_stock_level || 0, front, back, data.max_front_stock || 0, data.min_front_stock || 0])
        
        const productId = res.rows[0].id

        if (data.current_stock > 0) {
            await logStockMovement(client, clubId, userId, productId, data.current_stock, 0, data.current_stock, 'SUPPLY', 'Initial Stock', 'PRODUCT', productId)
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

export async function updateProduct(id: number, clubId: string, userId: string, data: { name: string, category_id: number | null, cost_price: number, selling_price: number, current_stock: number, min_stock_level?: number, is_active: boolean, front_stock?: number, back_stock?: number, max_front_stock?: number, min_front_stock?: number }) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // Get current stock for logging if it changes manually
        const currentRes = await client.query('SELECT current_stock, front_stock, back_stock FROM warehouse_products WHERE id = $1', [id])
        const oldStock = currentRes.rows[0]?.current_stock || 0
        const oldFront = currentRes.rows[0]?.front_stock || 0
        const oldBack = currentRes.rows[0]?.back_stock || 0

        // Handle Stock Split Logic if total changed or split changed
        let newFront = data.front_stock !== undefined ? data.front_stock : oldFront
        let newBack = data.back_stock !== undefined ? data.back_stock : oldBack
        
        // If total stock changed but front/back not explicitly set, we need to adjust
        // Strategy: Adjust Back stock by default for manual edits?
        // Or if Front capacity exists, fill front?
        // Let's trust the input. If user edits via UI, they should set splits.
        // If simple edit, we might just update total.
        // BUT we must keep consistency: front + back = current
        
        // If simple product (no capacity), front = current
        if (!data.max_front_stock && !currentRes.rows[0]?.max_front_stock) {
            newFront = data.current_stock
            newBack = 0
        } else {
            // If capacity exists, and only total changed (e.g. from table edit), where to put diff?
            // If we don't receive front/back from UI, we have a problem.
            // Let's assume UI sends front/back if advanced mode.
            // If simplified mode, we might need to calc.
            
            // Validation: newFront + newBack should equal data.current_stock
            // If not, we force it.
            if (newFront + newBack !== data.current_stock) {
                 // Prioritize Front fill if capacity allows?
                 // or just dump to back?
                 // Let's put difference in Back
                 newBack = data.current_stock - newFront
            }
        }

        await client.query(`
            UPDATE warehouse_products 
            SET name = $1, category_id = $2, cost_price = $3, selling_price = $4, current_stock = $5, min_stock_level = $6, is_active = $7,
                front_stock = $8, back_stock = $9, max_front_stock = $10, min_front_stock = $11
            WHERE id = $12
        `, [data.name, data.category_id, data.cost_price, data.selling_price, data.current_stock, data.min_stock_level || 0, data.is_active, 
            newFront, newBack, data.max_front_stock || 0, data.min_front_stock || 0, id])
        
        if (oldStock !== data.current_stock) {
            await logStockMovement(client, clubId, userId, id, data.current_stock - oldStock, oldStock, data.current_stock, 'MANUAL_EDIT', 'Product Update')
        }
        
        // CHECK RESTOCK NEED
        // If front < min_front and back > 0 -> Create Task
        if (data.max_front_stock && data.max_front_stock > 0 && newFront <= (data.min_front_stock || 0) && newBack > 0) {
            // Check if task already exists
            const existingTask = await client.query(`
                SELECT 1 FROM club_tasks 
                WHERE club_id = $1 AND type = 'RESTOCK' AND related_entity_id = $2 AND status != 'COMPLETED'
            `, [clubId, id])
            
            if (existingTask.rowCount === 0) {
                await client.query(`
                    INSERT INTO club_tasks (club_id, type, title, description, priority, related_entity_type, related_entity_id, created_by)
                    VALUES ($1, 'RESTOCK', $2, $3, 'HIGH', 'PRODUCT', $4, $5)
                `, [clubId, `Пополнить: ${data.name}`, `На витрине осталось ${newFront} шт. Пополните из запасов.`, id, userId])
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

export async function writeOffProduct(clubId: string, userId: string, productId: number, amount: number, reason: string) {
    const client = await import("@/db").then(m => m.getClient())
    try {
        await client.query('BEGIN')
        
        // Check current stock
        const res = await client.query('SELECT current_stock, front_stock, back_stock, max_front_stock FROM warehouse_products WHERE id = $1', [productId])
        const product = res.rows[0]
        const currentStock = product?.current_stock || 0
        const front = product?.front_stock || 0
        const back = product?.back_stock || 0
        
        if (currentStock < amount) {
            throw new Error(`Недостаточно товара на складе. Текущий остаток: ${currentStock}`)
        }
        
        // Strategy: Write off from Front first? Or Back?
        // Usually damage happens in front (broken bottle) or expiration.
        // Let's assume Front first, then Back.
        // OR: let UI decide? UI currently only sends total.
        // Let's implement: Front first.
        
        let newFront = front
        let newBack = back
        let remaining = amount
        
        if (newFront >= remaining) {
            newFront -= remaining
            remaining = 0
        } else {
            remaining -= newFront
            newFront = 0
            newBack -= remaining // We checked total >= amount, so this is safe
        }
        
        const newStock = currentStock - amount
        await client.query(`
            UPDATE warehouse_products 
            SET current_stock = $1, front_stock = $2, back_stock = $3
            WHERE id = $4
        `, [newStock, newFront, newBack, productId])
        
        // Log movement
        await logStockMovement(client, clubId, userId, productId, -amount, currentStock, newStock, 'WRITE_OFF', reason)
        
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

        // 2. Add Items & Update Stock
        for (const item of data.items) {
            await client.query(`
                INSERT INTO warehouse_supply_items (supply_id, product_id, quantity, cost_price, total_cost)
                VALUES ($1, $2, $3, $4, $5)
            `, [supplyId, item.product_id, item.quantity, item.cost_price, item.quantity * item.cost_price])

            // Update product stock and cost price (last price)
            // Supplies usually go to BACK stock if capacity is managed, otherwise default.
            // Let's assume Back Stock by default if capacity is set.
            const stockRes = await client.query(`
                UPDATE warehouse_products
                SET current_stock = current_stock + $1, cost_price = $2,
                    back_stock = CASE WHEN max_front_stock > 0 THEN back_stock + $1 ELSE back_stock END,
                    front_stock = CASE WHEN max_front_stock > 0 THEN front_stock ELSE front_stock + $1 END
                WHERE id = $3
                RETURNING current_stock
            `, [item.quantity, item.cost_price, item.product_id])
            
            const newStock = stockRes.rows[0].current_stock
            const oldStock = newStock - item.quantity

            await logStockMovement(client, clubId, userId, item.product_id, item.quantity, oldStock, newStock, 'SUPPLY', `Supply #${supplyId}`, 'SUPPLY', supplyId)
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

        // 2. Snapshot current stock
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
        // First get items with differences
        const diffItems = await client.query(`
            SELECT ii.product_id, ii.expected_stock, ii.actual_stock
            FROM warehouse_inventory_items ii
            WHERE ii.inventory_id = $1 AND ii.actual_stock IS NOT NULL AND ii.actual_stock != ii.expected_stock
        `, [inventoryId])

        for (const item of diffItems.rows) {
            const diff = item.actual_stock - item.expected_stock
            await logStockMovement(client, clubId, null, item.product_id, diff, item.expected_stock, item.actual_stock, 'INVENTORY_ADJUSTMENT', `Inventory #${inventoryId}`, 'INVENTORY', inventoryId)
        }

        await client.query(`
            UPDATE warehouse_products p
            SET current_stock = ii.actual_stock
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
