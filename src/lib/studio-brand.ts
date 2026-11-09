import { query } from "@/db";
import {
  type BrandDesign,
  type FormatId,
  type StudioPost,
  type StudioAsset,
  sanitizeDesign,
} from "./studio-types";

export * from "./studio-types";

let ensured = false;
export async function ensureStudioTables() {
  if (ensured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS club_brand (
      club_id INTEGER PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
      design JSONB NOT NULL DEFAULT '{}'::jsonb,
      polza_api_key TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS studio_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      template_id VARCHAR(50) NOT NULL,
      format VARCHAR(20) NOT NULL DEFAULT 'post',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      preview_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_studio_posts_club ON studio_posts(club_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS studio_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_studio_assets_club ON studio_assets(club_id, created_at DESC);
  `);
  ensured = true;
}

export const ensureClubBrandTable = ensureStudioTables;

export async function getClubBrand(clubId: string) {
  await ensureStudioTables();
  const r = await query(`SELECT design, polza_api_key FROM club_brand WHERE club_id = $1`, [clubId]);
  const row = r.rows[0];
  return {
    design: sanitizeDesign(row?.design),
    polzaKey: (row?.polza_api_key as string | null) ?? null,
    designSaved: Object.keys(row?.design ?? {}).length > 0,
  };
}

// ---------------- ПОСТЫ ----------------
export async function getClubPosts(clubId: string): Promise<StudioPost[]> {
  await ensureStudioTables();
  const res = await query(
    `SELECT id, club_id, title, template_id, format, data, preview_url, created_at, updated_at
     FROM studio_posts WHERE club_id = $1 ORDER BY updated_at DESC`,
    [clubId]
  );
  return res.rows;
}

export async function saveClubPost(
  clubId: string,
  post: { id?: string; title: string; template_id: string; format: string; data: any; preview_url?: string }
): Promise<StudioPost> {
  await ensureStudioTables();
  if (post.id) {
    const res = await query(
      `UPDATE studio_posts 
       SET title = $2, template_id = $3, format = $4, data = $5, preview_url = COALESCE($6, preview_url), updated_at = NOW()
       WHERE id = $1 AND club_id = $7
       RETURNING *`,
      [post.id, post.title, post.template_id, post.format, JSON.stringify(post.data), post.preview_url || null, clubId]
    );
    if (res.rows.length > 0) return res.rows[0];
  }

  const res = await query(
    `INSERT INTO studio_posts (club_id, title, template_id, format, data, preview_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [clubId, post.title, post.template_id, post.format, JSON.stringify(post.data), post.preview_url || null]
  );
  return res.rows[0];
}

export async function deleteClubPost(clubId: string, postId: string) {
  await ensureStudioTables();
  await query(`DELETE FROM studio_posts WHERE id = $1 AND club_id = $2`, [postId, clubId]);
}

// ---------------- АССЕТЫ ----------------
export async function getClubAssets(clubId: string): Promise<StudioAsset[]> {
  await ensureStudioTables();
  const res = await query(
    `SELECT id, club_id, type, name, url, created_at
     FROM studio_assets WHERE club_id = $1 ORDER BY created_at DESC`,
    [clubId]
  );
  return res.rows;
}

export async function saveClubAsset(
  clubId: string,
  asset: { type: string; name: string; url: string }
): Promise<StudioAsset> {
  await ensureStudioTables();
  const res = await query(
    `INSERT INTO studio_assets (club_id, type, name, url)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [clubId, asset.type, asset.name, asset.url]
  );
  return res.rows[0];
}

export async function deleteClubAsset(clubId: string, assetId: string) {
  await ensureStudioTables();
  await query(`DELETE FROM studio_assets WHERE id = $1 AND club_id = $2`, [assetId, clubId]);
}
