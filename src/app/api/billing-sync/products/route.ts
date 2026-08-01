import { NextResponse } from 'next/server';
import { query } from '@/db';

export const dynamic = 'force-dynamic';


export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const xClubId = request.headers.get('X-Club-Id');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: missing or invalid Authorization header' }, { status: 401 });
        }

        const apiKey = authHeader.substring(7);
        const targetClubId = xClubId ? parseInt(xClubId) : null;

        if (!targetClubId) {
            return NextResponse.json({ error: 'X-Club-Id header is required' }, { status: 400 });
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

        const settings = club.inventory_settings || {};
        const rawIds = Array.isArray(settings.cashbox_warehouse_ids)
            ? settings.cashbox_warehouse_ids
            : (settings.cashbox_warehouse_id ? [settings.cashbox_warehouse_id] : []);
        const cashboxWarehouseIds = rawIds
            .map((id: any) => Number(id))
            .filter((id: number) => Number.isInteger(id) && id > 0);

        // Fetch active products with stock aggregated only from allowed cashbox warehouses
        let productsRes;
        if (cashboxWarehouseIds.length > 0) {
            productsRes = await query(
                `SELECT 
                    p.id, 
                    p.name, 
                    p.cost_price, 
                    p.selling_price, 
                    COALESCE(SUM(ws.quantity), 0)::int as current_stock, 
                    p.barcodes, 
                    p.barcode
                 FROM warehouse_products p
                 LEFT JOIN warehouse_stock ws ON ws.product_id = p.id AND ws.warehouse_id = ANY($2::int[])
                 WHERE p.club_id = $1 AND p.deleted_at IS NULL AND p.is_active = true
                 GROUP BY p.id
                 ORDER BY p.name ASC`,
                [targetClubId, cashboxWarehouseIds]
            );
        } else {
            productsRes = await query(
                `SELECT 
                    p.id, 
                    p.name, 
                    p.cost_price, 
                    p.selling_price, 
                    COALESCE(SUM(ws.quantity), 0)::int as current_stock, 
                    p.barcodes, 
                    p.barcode
                 FROM warehouse_products p
                 LEFT JOIN warehouse_stock ws ON ws.product_id = p.id 
                    AND ws.warehouse_id IN (SELECT id FROM warehouses WHERE club_id = $1)
                 WHERE p.club_id = $1 AND p.deleted_at IS NULL AND p.is_active = true
                 GROUP BY p.id
                 ORDER BY p.name ASC`,
                [targetClubId]
            );
        }

        return NextResponse.json({
            success: true,
            products: productsRes.rows.map(row => ({
                id: row.id,
                name: row.name,
                cost_price: parseFloat(row.cost_price),
                selling_price: parseFloat(row.selling_price),
                current_stock: parseInt(row.current_stock) || 0,
                barcodes: Array.isArray(row.barcodes) ? row.barcodes : (row.barcode ? [row.barcode] : [])
            }))
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });

    } catch (error) {
        console.error('Billing Sync GET Products Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
