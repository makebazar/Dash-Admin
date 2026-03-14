const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local from root
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('Loaded .env.local');
} else {
    console.warn('.env.local not found, trying .env');
    dotenv.config({ path: path.join(__dirname, '..', '.env') });
}

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env.local or .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    try {
        const argPath = process.argv[2];
        if (!argPath) {
            console.error('Please provide a path to the migration file');
            process.exit(1);
        }
        const sqlPath = path.resolve(process.cwd(), argPath);
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
