import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Explicitly load .env first, then .env.local (higher priority)
// This matches Next.js behavior
const envPath = path.resolve(process.cwd(), '.env');
const envLocalPath = path.resolve(process.cwd(), '.env.local');

// Load .env if exists
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
}

// Load .env.local if exists (will override .env values)
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true, quiet: true });
}


// Use a global variable to store the pool in development to avoid connection exhaustion
declare global {
    var db_pool: Pool | undefined;
}

const pool = global.db_pool || new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 60000, // Увеличил до 60 секунд
});

if (process.env.NODE_ENV !== 'production') {
    global.db_pool = pool;
}

export const query = (text: string, params?: any[]) => pool.query(text, params);
export const getClient = () => pool.connect();
export const queryClient = () => pool.connect();
export default pool;
