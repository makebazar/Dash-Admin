const { Client } = require('pg');

async function test() {
    const client = new Client({ connectionString: 'postgres://postgres_dashadmin:3owtCcRjbTka89Ortjxn0gIzohfPDKGGSiBOcphxu8DwvhFKrtj2cxgwO0JxyNgo@194.87.161.199:5432/postgres' });
    await client.connect();

    try {
        const clubId = '9';
        const shiftId = '955b6b39-4e7b-49ce-87f8-64a311bb7551';
        
        // Mocking the getShiftZoneDiscrepancyReportInternal logic for MARMELAD
        const shiftRes = await client.query('SELECT user_id, check_in, check_out FROM shifts WHERE id = $1', [shiftId]);
        const shift = shiftRes.rows[0];

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
        
        let entry = {
            warehouse_id: 12,
            product_id: 118,
            opening_counted_quantity: null,
            opening_system_quantity: null,
            closing_counted_quantity: null,
            closing_system_quantity: null,
            inflow_quantity: 0,
            outflow_quantity: 0,
            has_process_gap: false,
            movements: []
        };

        for (const row of snapshotItemsRes.rows) {
            entry.product_name = row.product_name;
            if (row.snapshot_type === 'OPEN') {
                entry.opening_counted_quantity = Number(row.counted_quantity);
                entry.opening_system_quantity = Number(row.system_quantity);
                entry.open_snapshot_at = row.snapshot_created_at;
            }
        }

        const movementRows = await client.query(
            `SELECT warehouse_id, product_id, change_amount, type, reason, created_at, user_id, shift_id, related_entity_type, related_entity_id
            FROM warehouse_stock_movements
            WHERE club_id = $1 AND product_id = 118
              AND created_at >= $2 AND created_at <= $3`,
            [clubId, shift.check_in, shift.check_out || new Date().toISOString()]
        );

        for (const row of movementRows.rows) {
            const movementType = row.type;
            const relatedEntityType = row.related_entity_type;
            const isInventoryMovement = ["INVENTORY_GAIN", "INVENTORY_LOSS", "INVENTORY_CORRECTION"].includes(movementType);
            const isManualGap = movementType === "ADJUSTMENT";
            const isShiftZoneSnapshotAdjustment = relatedEntityType === "SHIFT_ZONE_SNAPSHOT";
            const isOperationalMovement = !isInventoryMovement && !isManualGap && !isShiftZoneSnapshotAdjustment;
            
            if (isShiftZoneSnapshotAdjustment) continue;

            entry.movements.push(row);

            if (isOperationalMovement) {
                if (row.change_amount > 0) entry.inflow_quantity += row.change_amount;
                if (row.change_amount < 0) entry.outflow_quantity += Math.abs(row.change_amount);
            }

            if (isInventoryMovement || isManualGap || String(row.shift_id) !== shiftId || String(row.user_id) !== String(shift.user_id)) {
                entry.has_process_gap = true;
            }
        }

        let expectedClosing = null;
        let difference = null;
        const hasOpening = entry.opening_counted_quantity !== null;
        const hasClosing = entry.closing_counted_quantity !== null;

        if (hasOpening && !hasClosing) {
            expectedClosing = entry.opening_counted_quantity;
            difference = entry.opening_counted_quantity - entry.opening_system_quantity;
        }

        console.log({
            entry,
            expectedClosing,
            difference
        });

    } finally {
        await client.end();
    }
}
test().catch(console.error);
