
import { query } from '../src/db';

async function checkColumns() {
  try {
    const res = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clubs';
    `);
    console.log('Columns in clubs table:', res.rows.map(r => r.column_name));
    
    const res2 = await query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'warehouse_inventories';
    `);
    console.log('Columns in warehouse_inventories table:', res2.rows.map(r => r.column_name));

  } catch (e) {
    console.error(e);
  }
}

checkColumns();
