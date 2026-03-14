const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from root
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    try {
        const argPath = process.argv[2];
        const sqlPath = argPath ? path.resolve(process.cwd(), argPath) : path.join(__dirname, '..', 'migrations', 'add_club_instructions.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        console.log('Executing migration from:', sqlPath);
        await pool.query(sql);
        
        console.log('Migration successful!');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

run();
