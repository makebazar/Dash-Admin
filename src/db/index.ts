import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Explicitly load .env.local first (higher priority), then .env
// This matches Next.js behavior
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

// Load .env.local if exists
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
}

// Load .env if exists (will be overridden by .env.local values)
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// Fallback to default dotenv.config() which loads .env
dotenv.config();


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
export default pool;
