
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not defined in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration...');

    // 1. Add warehouse_id to warehouse_inventories
    console.log('Adding warehouse_id column...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'warehouse_inventories' AND column_name = 'warehouse_id'
        ) THEN
          ALTER TABLE warehouse_inventories 
          ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id);
        END IF;
      END $$;
    `);

    // 2. Add inventory_settings to clubs
    console.log('Adding inventory_settings column...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'clubs' AND column_name = 'inventory_settings'
        ) THEN
          ALTER TABLE clubs 
          ADD COLUMN inventory_settings JSONB DEFAULT '{}';
        END IF;
      END $$;
    `);
    
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
