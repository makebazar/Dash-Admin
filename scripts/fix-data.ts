import { query } from '../src/db';

async function fixData() {
    console.log('Fixing existing scheduled expenses data...');
    try {
        // Update scheduled expenses from their recurring templates
        const res = await query(`
            UPDATE finance_scheduled_expenses fse
            SET 
                is_consumption_based = rp.is_consumption_based,
                consumption_unit = rp.consumption_unit,
                unit_price = COALESCE(fse.unit_price, rp.default_unit_price)
            FROM recurring_payments rp
            WHERE fse.recurring_payment_id = rp.id
            AND rp.is_consumption_based = true
            RETURNING fse.id, fse.name, fse.is_consumption_based
        `);
        console.log(`Updated ${res.rows.length} rows.`);
        console.table(res.rows);
    } catch (error) {
        console.error('Error fixing data:', error);
    }
}

fixData();
