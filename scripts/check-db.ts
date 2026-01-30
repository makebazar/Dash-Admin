import { query } from '../src/db';

async function checkData() {
    console.log('Checking scheduled expenses...');
    try {
        const res = await query('SELECT id, name, is_consumption_based, consumption_unit, amount FROM finance_scheduled_expenses');
        console.table(res.rows);
    } catch (error) {
        console.error('Error:', error);
    }
}

checkData();
