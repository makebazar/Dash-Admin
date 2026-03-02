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


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
