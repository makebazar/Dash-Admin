import { query } from '../src/db';

async function checkData() {
    try {
        const rp = await query('SELECT id, name, is_consumption_based FROM recurring_payments');
        console.log('Recurring Payments:');
        console.table(rp.rows);

        const fse = await query('SELECT * FROM finance_scheduled_expenses');
        console.log('Scheduled Expenses:');
        console.table(fse.rows);
    } catch (error) {
        console.error('Error:', error);
    }
}

checkData();
