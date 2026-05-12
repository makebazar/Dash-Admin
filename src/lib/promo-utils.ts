import { query } from "@/db";
import { headers } from "next/headers";

export async function getClubFromDomain() {
  const headerList = await headers();
  const host = headerList.get("host") || "";

  // Example: play.myclub.ru
  // We can store the domain in the clubs table or settings.
  // For now, let's assume we can also pass it via query param if needed,
  // but the request is for "separate domain with link to us".

  // Check if host matches any club's promo domain (we should add this field to clubs)
  // Or for now, we can use a hardcoded map or just the first club for testing.

  const result = await query(
    `SELECT id FROM clubs WHERE promo_settings->>'domain' = $1`,
    [host],
  );

  if (result.rowCount && result.rowCount > 0) {
    return result.rows[0].id;
  }

  return null;
}
