import { query } from "@/db";

/**
 * Resolves a clubId (numeric or public_id) to its internal numeric ID.
 */
export async function resolveClubId(clubId: string | number | null): Promise<number | null> {
  if (!clubId) return null;

  // If it's already a number or a numeric string
  const numeric = parseInt(String(clubId), 10);
  if (!isNaN(numeric) && String(numeric) === String(clubId)) {
    return numeric;
  }

  // Otherwise, try to find by public_id or text id
  try {
    const result = await query(
      `SELECT id FROM clubs WHERE id::text = $1 OR UPPER(public_id) = UPPER($1) LIMIT 1`,
      [String(clubId)]
    );
    if (result.rowCount && result.rowCount > 0) {
      return result.rows[0].id;
    }
  } catch (e) {
    console.error("Resolve Club ID Error:", e);
  }

  return null;
}
