import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envLocal = path.resolve(process.cwd(), ".env.local");
const envDefault = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envDefault)) dotenv.config({ path: envDefault });
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal, override: true });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_releases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      app_name VARCHAR(50) NOT NULL DEFAULT 'dashfrag',
      version VARCHAR(30) NOT NULL,
      download_url TEXT NOT NULL,
      file_size_bytes BIGINT,
      original_filename TEXT,
      checksum_sha256 VARCHAR(64),
      changelog TEXT,
      is_active BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_app_releases_name_active ON app_releases(app_name, is_active);
  `);
  console.log("SUCCESS: app_releases table verified / created.");
  await pool.end();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
