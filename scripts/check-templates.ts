import { query } from '../src/db';

async function checkTemplates() {
    try {
        const rp = await query('SELECT id, name, is_consumption_based, consumption_unit FROM recurring_payments');
        console.table(rp.rows);
    } catch (error) {
        console.error('Error:', error);
    }
}

checkTemplates();
