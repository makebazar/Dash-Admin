import { query } from '../src/db';

async function checkTables() {
    try {
        const res = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables:', res.rows.map(r => r.table_name).join(', '));

        const count = await query("SELECT count(*) FROM finance_scheduled_expenses");
        console.log('Count in finance_scheduled_expenses:', count.rows[0].count);
    } catch (error) {
        console.error('Error:', error);
    }
}

checkTables();
