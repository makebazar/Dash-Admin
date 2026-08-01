import { NextResponse } from 'next/server';
import { query, getClient } from '@/db';
import { normalizeInventorySettings } from '@/lib/inventory-settings';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xClubId = request.headers.get('X-Club-Id');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: missing or invalid Authorization header' }, { status: 401 });
        }

        const apiKey = authHeader.substring(7);
        const body = await request.json();
        const {
            club_id,
            staff_phone,
            payment_type, // 'cash' | 'card' | 'mixed'
            cash_amount,
            card_amount,
            items // Array<{ name: string, barcode?: string, quantity: number, price: number }>
        } = body;

        const targetClubId = xClubId ? parseInt(xClubId) : club_id;
        if (!targetClubId) {
            return NextResponse.json({ error: 'club_id is required' }, { status: 400 });
        }

        // Fetch club details to verify API Key
        const clubRes = await query(
            `SELECT owner_id, inventory_settings FROM clubs WHERE id = $1`,
            [targetClubId]
        );

        if (!clubRes.rows || clubRes.rows.length === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const club = clubRes.rows[0];
        const clubApiKey = club.inventory_settings?.api_key || process.env.DASHADMIN_SYNC_KEY;

        if (clubApiKey && apiKey !== clubApiKey && apiKey !== process.env.DASHADMIN_SYNC_KEY) {
            return NextResponse.json({ error: 'Forbidden: invalid API key' }, { status: 403 });
        }

        const inventorySettings = normalizeInventorySettings(club.inventory_settings || {});
        const cashboxWarehouseIds = inventorySettings.cashbox_warehouse_ids || [];
        if (cashboxWarehouseIds.length === 0) {
            return NextResponse.json({ error: 'No cashbox warehouses configured for this club' }, { status: 400 });
        }
        
        // Use the main cashbox warehouse as primary destination
        const warehouseId = cashboxWarehouseIds[0];

        // Resolve staff ID
        let adminId = club.owner_id;
        if (staff_phone) {
            const cleanPhone = staff_phone.trim().replace(/\D/g, '');
            if (cleanPhone.length >= 10) {
                const userRes = await query(
                    `SELECT u.id 
                     FROM users u
                     JOIN club_employees ce ON ce.user_id = u.id
                     WHERE ce.club_id = $1 AND RIGHT(u.phone_number, 10) = RIGHT($2, 10)
                     LIMIT 1`,
                    [targetClubId, cleanPhone]
                );
                if (userRes.rows && userRes.rows.length > 0) {
                    adminId = userRes.rows[0].id;
                }
            }
        }

        // Fetch open shift in DashAdmin
        const shiftRes = await query(
            `SELECT id FROM shifts WHERE club_id = $1 AND status = 'ACTIVE' LIMIT 1`,
            [targetClubId]
        );
        if (shiftRes.rowCount === 0) {
            return NextResponse.json({ error: 'No active shift found in DashAdmin' }, { status: 400 });
        }
        const shiftId = shiftRes.rows[0].id;

        const client = await getClient();
        try {
            await client.query('BEGIN');

            let totalAmount = 0;
            const processedItems = [];

            for (const item of items) {
                const { product_id, name, barcode, quantity, price } = item;

                // Find matching product in DashAdmin
                let productRes;
                if (product_id) {
                    productRes = await client.query(
                        `SELECT id, cost_price, selling_price FROM warehouse_products 
                         WHERE club_id = $1 AND id = $2 AND deleted_at IS NULL
                         LIMIT 1`,
                        [targetClubId, product_id]
                    );
                }

                if (!productRes || productRes.rowCount === 0) {
                    productRes = await client.query(
                        `SELECT id, cost_price, selling_price FROM warehouse_products 
                         WHERE club_id = $1 
                           AND (name = $2 OR ($3 <> '' AND (barcodes @> ARRAY[$3]::text[] OR (barcode IS NOT NULL AND barcode = $3))))
                           AND deleted_at IS NULL
                         LIMIT 1`,
                        [targetClubId, name, barcode || '']
                    );
                }

                if (productRes.rowCount === 0) {
                    throw new Error(`Product not found in DashAdmin: ${name}`);
                }

                const product = productRes.rows[0];
                const unitPrice = price || Number(product.selling_price || 0);
                const costPrice = Number(product.cost_price || 0);
                totalAmount += unitPrice * quantity;

                processedItems.push({
                    productId: product.id,
                    quantity,
                    unitPrice,
                    costPrice
                });
            }

            // Fetch stock quantities for these products on allowed cashbox warehouses
            const productIds = processedItems.map(pi => pi.productId);
            const stockRes = await client.query(
                `SELECT warehouse_id, product_id, quantity
                 FROM warehouse_stock
                 WHERE warehouse_id = ANY($1::int[])
                   AND product_id = ANY($2::int[])`,
                [cashboxWarehouseIds, productIds]
            );

            const stockMap = new Map<string, number>();
            for (const row of stockRes.rows) {
                stockMap.set(`${row.warehouse_id}:${row.product_id}`, Number(row.quantity || 0));
            }

            // Resolve warehouse for each product (prioritize warehouse with maximum stock)
            const itemWarehouseMap = new Map<number, number>();
            const usedWarehouseIds = new Set<number>();

            for (const pi of processedItems) {
                const candidates = cashboxWarehouseIds
                    .map(whId => ({
                        id: whId,
                        available: stockMap.get(`${whId}:${pi.productId}`) || 0
                    }))
                    .sort((a, b) => b.available - a.available);

                const picked = candidates[0];
                itemWarehouseMap.set(pi.productId, picked.id);
                usedWarehouseIds.add(picked.id);
            }

            const receiptWarehouseId = usedWarehouseIds.size === 1 ? Array.from(usedWarehouseIds)[0] : cashboxWarehouseIds[0];

            const finalCash = payment_type === 'cash' ? totalAmount : (payment_type === 'mixed' ? (cash_amount || 0) : 0);
            const finalCard = payment_type === 'card' ? totalAmount : (payment_type === 'mixed' ? (card_amount || 0) : 0);

            // Create shift receipt
            const receiptRes = await client.query(
                `INSERT INTO shift_receipts (
                    club_id, shift_id, created_by, warehouse_id,
                    payment_type, cash_amount, card_amount, total_amount, Notes, committed_at,
                    counts_in_revenue
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Продажа из DashLock POS', NOW(), true)
                RETURNING id`,
                [targetClubId, shiftId, adminId, receiptWarehouseId || cashboxWarehouseIds[0], payment_type, finalCash, finalCard, totalAmount]
            );
            const receiptId = receiptRes.rows[0].id;

            // Create receipt items and write off stock
            for (const pi of processedItems) {
                const itemWarehouseId = itemWarehouseMap.get(pi.productId) || cashboxWarehouseIds[0];

                await client.query(
                    `INSERT INTO shift_receipt_items (receipt_id, product_id, quantity, selling_price_snapshot, cost_price_snapshot, warehouse_id)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [receiptId, pi.productId, pi.quantity, pi.unitPrice, pi.costPrice, itemWarehouseId]
                );

                // Deduct stock from the resolved warehouse
                const stockRes = await client.query(
                    `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, updated_at)
                     VALUES ($1, $2, 0, NOW())
                     ON CONFLICT (warehouse_id, product_id)
                     DO UPDATE SET quantity = warehouse_stock.quantity - $3, updated_at = NOW()
                     RETURNING quantity`,
                    [itemWarehouseId, pi.productId, pi.quantity]
                );
                
                const newStock = Number(stockRes.rows[0].quantity);
                const prevStock = newStock + pi.quantity;

                // Insert stock movement record
                await client.query(
                    `INSERT INTO warehouse_stock_movements (
                        club_id, product_id, user_id, change_amount, previous_stock, new_stock, 
                        type, reason, related_entity_type, related_entity_id, shift_id, warehouse_id, price_at_time
                     ) VALUES ($1, $2, $3, $4, $5, $6, 'SALE', $7, 'SHIFT_RECEIPT', $8, $9, $10, $11)`,
                    [
                        targetClubId, pi.productId, adminId, -pi.quantity, prevStock, newStock,
                        `DashLock POS: Чек #${receiptId}`, receiptId, shiftId, itemWarehouseId, pi.unitPrice
                    ]
                );

                // Update product cache current_stock
                await client.query(
                    `UPDATE warehouse_products p
                     SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = p.id)
                     WHERE id = $1 AND club_id = $2`,
                    [pi.productId, targetClubId]
                );
            }

            await client.query('COMMIT');
            return NextResponse.json({
                success: true,
                message: 'Receipt synchronized successfully',
                receiptId
            });

        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('Billing Sync Receipts Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
