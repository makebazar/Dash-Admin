"use server"

import { query } from "@/db"
import { revalidatePath } from "next/cache"

export type Product = {
    id: number
    club_id: number
    category_id: number | null
    name: string
    cost_price: number
    selling_price: number
    current_stock: number
    is_active: boolean
    category_name?: string
}

export type Category = {
    id: number
    name: string
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

// --- PRODUCTS ---

export async function getCategories(clubId: string) {
    const res = await query(`SELECT * FROM warehouse_categories WHERE club_id = $1 ORDER BY name`, [clubId])
    return res.rows as Category[]
}

export async function createCategory(clubId: string, name: string) {
    await query(`INSERT INTO warehouse_categories (club_id, name) VALUES ($1, $2)`, [clubId, name])
    revalidatePath(`/clubs/${clubId}/inventory`)
}

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

export async function createProduct(clubId: string, data: { name: string, category_id: number | null, cost_price: number, selling_price: number, current_stock: number }) {
    await query(`
        INSERT INTO warehouse_products (club_id, category_id, name, cost_price, selling_price, current_stock)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [clubId, data.category_id, data.name, data.cost_price, data.selling_price, data.current_stock])
    revalidatePath(`/clubs/${clubId}/inventory`)
}

export async function updateProduct(id: number, clubId: string, data: { name: string, category_id: number | null, cost_price: number, selling_price: number, current_stock: number, is_active: boolean }) {
    await query(`
        UPDATE warehouse_products 
        SET name = $1, category_id = $2, cost_price = $3, selling_price = $4, current_stock = $5, is_active = $6
        WHERE id = $7
    `, [data.name, data.category_id, data.cost_price, data.selling_price, data.current_stock, data.is_active, id])
    revalidatePath(`/clubs/${clubId}/inventory`)
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
            await client.query(`
                UPDATE warehouse_products
                SET current_stock = current_stock + $1, cost_price = $2
                WHERE id = $3
            `, [item.quantity, item.cost_price, item.product_id])
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

export async function createInventory(clubId: string, userId: string, targetMetricKey: string) {
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
        // Get all active products
        const productsRes = await client.query(`SELECT id, current_stock, cost_price, selling_price FROM warehouse_products WHERE club_id = $1 AND is_active = true`, [clubId])
        
        for (const p of productsRes.rows) {
            await client.query(`
                INSERT INTO warehouse_inventory_items (inventory_id, product_id, expected_stock, cost_price_snapshot, selling_price_snapshot)
                VALUES ($1, $2, $3, $4, $5)
            `, [inventoryId, p.id, p.current_stock, p.cost_price, p.selling_price])
        }

        await client.query('COMMIT')
        return inventoryId
    } catch (e) {
        await client.query('ROLLBACK')
        throw e
    } finally {
        client.release()
    }
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
        // difference = expected - actual (Wait, if expected 10, actual 8. Difference is 2 missing/sold. So expected - actual)
        // calculated_revenue = (expected - actual) * selling_price
        
        // Let's verify "Blind Inventory" logic.
        // User said: "Expected - Actual = Sold".
        // If Expected 10, Actual 8 => Sold 2.
        // If Expected 10, Actual 12 => Sold -2 (Surplus/Found).
        
        // Update items calculations
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
        const diff = reportedRevenue - calculatedRevenue // If reported 5000, calculated 4000. Diff +1000 (Surplus money). Or maybe Calculated - Reported?
        // User: "у него должны сойтись цифры продаж и ивентаризация"
        // Usually Variance = Reported - Calculated.
        // If Reported 5000 (Cash), Calculated 5000 (Sold goods). Variance 0.
        
        // 3. Update Stock Levels to Actual
        // Since inventory is authoritative, we update current_stock to actual_stock
        // But only if actual_stock is not null
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
