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
        const sqlPath = path.join(__dirname, '..', 'migrations', 'improve_equipment_issues.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        console.log('Executing migration from:', sqlPath);
        
        // Split by semicolon
        const statements = sql.split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const stmt of statements) {
            console.log('Running statement:', stmt.substring(0, 50) + '...');
            await pool.query(stmt);
        }
        
        console.log('Migration successful!');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

run();
