const { Client } = require('pg');

async function fix() {
    const client = new Client({ connectionString: 'postgres://postgres_dashadmin:3owtCcRjbTka89Ortjxn0gIzohfPDKGGSiBOcphxu8DwvhFKrtj2cxgwO0JxyNgo@194.87.161.199:5432/postgres' });
    await client.connect();

    try {
        await client.query('BEGIN');

        const prevShiftId = '3f204d57-4f85-461d-8c88-fbb70040e19d';
        const currShiftId = '2af1f80e-b56e-4894-9992-150de3c592d7';
        
        // 1. Check if OPEN snapshot already exists for currShift
        const existing = await client.query(`SELECT id FROM shift_zone_snapshots WHERE shift_id = $1 AND snapshot_type = 'OPEN'`, [currShiftId]);
        if (existing.rowCount > 0) {
            console.log("OPEN snapshot already exists for 2af1f80e");
            await client.query('ROLLBACK');
            return;
        }

        // 2. Get prev CLOSE snapshot
        const prevSnap = await client.query(`SELECT * FROM shift_zone_snapshots WHERE shift_id = $1 AND snapshot_type = 'CLOSE'`, [prevShiftId]);
        if (prevSnap.rowCount === 0) throw new Error("No prev CLOSE snap");
        const prevSnapId = prevSnap.rows[0].id;

        // 3. Insert OPEN snapshot for currShift
        const newSnapRes = await client.query(`
            INSERT INTO shift_zone_snapshots (club_id, shift_id, employee_id, warehouse_id, snapshot_type, created_at, accepted_from_shift_id, accepted_from_employee_id)
            VALUES ($1, $2, $3, $4, 'OPEN', '2026-05-21T13:26:27.324Z', $5, $6)
            RETURNING id
        `, [
            prevSnap.rows[0].club_id,
            currShiftId,
            '82e8e7d4-4f1a-42b6-aab9-c20577fbae83', // Night shift user
            prevSnap.rows[0].warehouse_id,
            prevShiftId,
            prevSnap.rows[0].employee_id
        ]);
        const newSnapId = newSnapRes.rows[0].id;

        // 4. Copy items
        await client.query(`
            INSERT INTO shift_zone_snapshot_items (snapshot_id, product_id, counted_quantity, system_quantity)
            SELECT $1, product_id, counted_quantity, system_quantity
            FROM shift_zone_snapshot_items
            WHERE snapshot_id = $2
        `, [newSnapId, prevSnapId]);

        await client.query('COMMIT');
        console.log("Fix applied successfully! Created OPEN snapshot for shift 2af1f80e");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error during fix:", e);
    } finally {
        await client.end();
    }
}
fix().catch(console.error);
