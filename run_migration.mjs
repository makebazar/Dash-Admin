import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    const file = process.argv[2] || 'migrations/20260814_extend_dota2_frag_matches.sql';
    const sql = fs.readFileSync(file, 'utf8');
    console.log(`Running migration from ${file}...`);
    await pool.query(sql);
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

runMigration();
