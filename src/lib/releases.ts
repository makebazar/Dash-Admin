import { query } from "@/db";

let tableInitialized = false;

export async function ensureReleasesTable() {
  if (tableInitialized) return;
  try {
    await query(`
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
    tableInitialized = true;
  } catch (e) {
    console.error("Failed to auto-create app_releases table:", e);
  }
}
