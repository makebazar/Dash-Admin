const { Client } = require('pg');

async function test() {
    const client = new Client({ connectionString: 'postgres://postgres_dashadmin:3owtCcRjbTka89Ortjxn0gIzohfPDKGGSiBOcphxu8DwvhFKrtj2cxgwO0JxyNgo@194.87.161.199:5432/postgres' });
    await client.connect();

    try {
        const clubId = '9';
        const shiftId = '955b6b39-4e7b-49ce-87f8-64a311bb7551';
        
        // Let's manually fetch the data for MARMELAD (product_id 118) in this shift
        const snapshotItemsRes = await client.query(
            `SELECT
                ss.warehouse_id,
                ss.snapshot_type,
                ss.created_at as snapshot_created_at,
                sii.product_id,
                sii.counted_quantity,
                sii.system_quantity,
                p.name as product_name,
                p.selling_price
            FROM shift_zone_snapshots ss
            JOIN shift_zone_snapshot_items sii ON sii.snapshot_id = ss.id
            JOIN warehouse_products p ON p.id = sii.product_id
            WHERE ss.shift_id = $1 AND sii.product_id = 118`,
            [shiftId]
        );
        
        console.log("Snapshots:", snapshotItemsRes.rows);

        const movementRows = await client.query(
            `SELECT warehouse_id, product_id, change_amount, type, reason, created_at, user_id, shift_id, related_entity_type, related_entity_id
            FROM warehouse_stock_movements
            WHERE club_id = $1 AND product_id = 118 AND shift_id = $2`,
            [clubId, shiftId]
        );

        console.log("Movements:", movementRows.rows);
    } finally {
        await client.end();
    }
}
test().catch(console.error);
