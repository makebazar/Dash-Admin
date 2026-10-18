import { query } from "@/db";

let tableEnsured = false;

export async function ensureMarketingSnapshotsTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS marketing_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      period_start DATE,
      period_end DATE,
      file_names TEXT[],
      summary_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
      guests_data JSONB NOT NULL DEFAULT '[]'::jsonb,
      pc_data JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_marketing_snapshots_club_id ON marketing_snapshots(club_id);
    CREATE INDEX IF NOT EXISTS idx_marketing_snapshots_created_at ON marketing_snapshots(created_at DESC);
  `);
  tableEnsured = true;
}
