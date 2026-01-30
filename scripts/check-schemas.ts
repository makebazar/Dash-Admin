import { query } from '../src/db';

async function checkAll() {
    try {
        const res = await query("SELECT schema_name FROM information_schema.schemata");
        console.log('Schemas:', res.rows.map(r => r.schema_name).join(', '));

        const tables = await query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'recurring_payments'");
        console.table(tables.rows);
    } catch (error) {
        console.error('Error:', error);
    }
}

checkAll();
