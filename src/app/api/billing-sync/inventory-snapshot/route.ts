import { NextResponse } from 'next/server';
import { query, getClient } from '@/db';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xClubId = request.headers.get('X-Club-Id');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: missing or invalid Authorization header' }, { status: 401 });
        }

        const apiKey = authHeader.substring(7);
        const body = await request.json();
        const { club_id, items } = body;

        const targetClubId = xClubId ? parseInt(xClubId) : club_id;

        if (!targetClubId) {
            return NextResponse.json({ error: 'club_id is required in body or X-Club-Id header' }, { status: 400 });
        }

        // Fetch club details to verify API Key
        const clubRes = await query(
            `SELECT inventory_settings FROM clubs WHERE id = $1`,
            [targetClubId]
        );

        if (!clubRes.rows || clubRes.rows.length === 0) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 });
        }

        const club = clubRes.rows[0];
        const clubApiKey = club.inventory_settings?.api_key || process.env.DASHADMIN_SYNC_KEY;

        // Verify API key
        if (clubApiKey && apiKey !== clubApiKey && apiKey !== process.env.DASHADMIN_SYNC_KEY) {
            return NextResponse.json({ error: 'Forbidden: invalid API key' }, { status: 403 });
        }

        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'items array is required' }, { status: 400 });
        }

        // Connect to database to run transaction
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // 1. Ensure at least one warehouse exists for the club
            let warehouseId: number;
            const whRes = await client.query(
                `SELECT id FROM warehouses WHERE club_id = $1 ORDER BY id LIMIT 1`,
                [targetClubId]
            );

            if (whRes.rows && whRes.rows.length > 0) {
                warehouseId = whRes.rows[0].id;
            } else {
                const newWh = await client.query(
                    `INSERT INTO warehouses (club_id, name, type) 
                     VALUES ($1, 'Основной склад', 'GENERAL') 
                     RETURNING id`,
                    [targetClubId]
                );
                warehouseId = newWh.rows[0].id;
            }

            // 2. Sync each product
            for (const item of items) {
                const { name, barcode, stock, cost_price, selling_price } = item;

                // Look for existing product (by name or barcode array or legacy barcode column)
                const productRes = await client.query(
                    `SELECT id FROM warehouse_products 
                     WHERE club_id = $1 
                       AND (name = $2 OR barcodes @> ARRAY[$3]::text[] OR (barcode IS NOT NULL AND barcode = $3))
                       AND deleted_at IS NULL
                     LIMIT 1`,
                    [targetClubId, name, barcode || '']
                );

                let productId: number;

                if (productRes.rows && productRes.rows.length > 0) {
                    productId = productRes.rows[0].id;

                    // Update existing product details
                    await client.query(
                        `UPDATE warehouse_products 
                         SET cost_price = $1, 
                             selling_price = $2, 
                             current_stock = $3,
                             barcodes = CASE 
                                WHEN $4::text IS NOT NULL AND NOT (barcodes @> ARRAY[$4]::text[]) 
                                THEN array_append(barcodes, $4) 
                                ELSE barcodes 
                             END
                         WHERE id = $5`,
                        [cost_price || 0, selling_price || 0, stock || 0, barcode || null, productId]
                    );
                } else {
                    // Create new product
                    const newProdRes = await client.query(
                        `INSERT INTO warehouse_products (
                            club_id, 
                            name, 
                            cost_price, 
                            selling_price, 
                            current_stock, 
                            barcodes,
                            is_active
                         ) VALUES ($1, $2, $3, $4, $5, ARRAY[$6]::text[], true)
                         RETURNING id`,
                        [targetClubId, name, cost_price || 0, selling_price || 0, stock || 0, barcode || '']
                    );
                    productId = newProdRes.rows[0].id;
                }

                // 3. Upsert warehouse stock entry
                await client.query(
                    `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, updated_at)
                     VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (warehouse_id, product_id)
                     DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
                    [warehouseId, productId, stock || 0]
                );
            }

            await client.query('COMMIT');
            return NextResponse.json({
                success: true,
                message: `Inventory snapshot synced successfully. Processed ${items.length} items.`
            });

        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Billing Sync Inventory Snapshot Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
