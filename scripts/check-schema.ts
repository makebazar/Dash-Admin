import { query } from '../src/db';

async function checkSchema() {
    try {
        const res = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'finance_scheduled_expenses'
        `);
        console.table(res.rows);
    } catch (error) {
        console.error('Error:', error);
    }
}

checkSchema();
