const { Client } = require('pg');

async function fix() {
    const client = new Client({ connectionString: 'postgres://postgres_dashadmin:3owtCcRjbTka89Ortjxn0gIzohfPDKGGSiBOcphxu8DwvhFKrtj2cxgwO0JxyNgo@194.87.161.199:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');

        // 1. Move sale to warehouse 12
        await client.query(`UPDATE shift_receipt_items SET warehouse_id = 12 WHERE receipt_id = '3151' AND product_id = 118`);
        
        // 2. Update sale movement
        await client.query(`
            UPDATE warehouse_stock_movements 
            SET warehouse_id = 12, previous_stock = 3, new_stock = 2 
            WHERE id = 6306
        `);

        // 3. Update transfer movement on warehouse 12
        await client.query(`
            UPDATE warehouse_stock_movements 
            SET previous_stock = 2, new_stock = 3 
            WHERE id = 6308
        `);

        // 4. Update CLOSE snapshot of previous shift
        const prevShiftId = '3f204d57-4f85-461d-8c88-fbb70040e19d';
        await client.query(`
            UPDATE shift_zone_snapshot_items 
            SET system_quantity = 3, counted_quantity = 3 
            WHERE product_id = 118 
            AND snapshot_id = (SELECT id FROM shift_zone_snapshots WHERE shift_id = $1 AND snapshot_type = 'CLOSE' AND warehouse_id = 12 LIMIT 1)
        `, [prevShiftId]);

        // 5. Delete INVENTORY_LOSS
        await client.query(`DELETE FROM warehouse_stock_movements WHERE id = 6406`);

        // 6. Update OPEN snapshot of current shift
        const currShiftId = '955b6b39-4e7b-49ce-87f8-64a311bb7551';
        await client.query(`
            UPDATE shift_zone_snapshot_items 
            SET system_quantity = 3 
            WHERE product_id = 118 
            AND snapshot_id = (SELECT id FROM shift_zone_snapshots WHERE shift_id = $1 AND snapshot_type = 'OPEN' AND warehouse_id = 12 LIMIT 1)
        `, [currShiftId]);

        // 7. Update warehouse 5 stock
        await client.query(`UPDATE warehouse_stock SET quantity = 10 WHERE warehouse_id = 5 AND product_id = 118`);

        // 8. Update transfer movement on warehouse 5
        await client.query(`
            UPDATE warehouse_stock_movements 
            SET previous_stock = 11, new_stock = 10 
            WHERE id = 6307
        `);

        await client.query('COMMIT');
        console.log("Fix applied successfully!");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error during fix:", e);
    } finally {
        await client.end();
    }
}
fix().catch(console.error);
