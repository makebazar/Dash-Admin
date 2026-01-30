import { query } from '../src/db';

async function searchData() {
    try {
        const rp = await query("SELECT * FROM recurring_payments WHERE name ILIKE '%Электричество%'");
        console.log('Recurring Payments found:', rp.rows.length);
        console.table(rp.rows);

        const fse = await query("SELECT * FROM finance_scheduled_expenses WHERE name ILIKE '%Электричество%'");
        console.log('Scheduled Expenses found:', fse.rows.length);
        console.table(fse.rows);
    } catch (error) {
        console.error('Error:', error);
    }
}

searchData();
