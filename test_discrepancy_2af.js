const { Client } = require('pg');

async function test() {
    const client = new Client({ connectionString: 'postgres://postgres_dashadmin:3owtCcRjbTka89Ortjxn0gIzohfPDKGGSiBOcphxu8DwvhFKrtj2cxgwO0JxyNgo@194.87.161.199:5432/postgres' });
    await client.connect();

    try {
        const shiftId = '2af1f80e-b56e-4894-9992-150de3c592d7';
        
        const snaps = await client.query(`SELECT id, snapshot_type FROM shift_zone_snapshots WHERE shift_id = $1`, [shiftId]);
        console.log("Snapshots for shift:", snaps.rows);

        // Also check if there's any snapshot missing or what
        const openSnap = snaps.rows.find(s => s.snapshot_type === 'OPEN');
        if (!openSnap) {
            console.log("NO OPEN SNAPSHOT FOUND!");
        }
        
    } finally {
        await client.end();
    }
}
test().catch(console.error);
