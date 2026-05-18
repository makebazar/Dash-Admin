"use server";

import { getPool } from "@/db";
import { activatePremiumBP } from "@/lib/promo-bp";
import { revalidatePath } from "next/cache";

export async function activatePremiumBPAction(
  clubId: string,
  playerId: string,
) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const progress = await activatePremiumBP(client, clubId, playerId);

    await client.query("COMMIT");

    revalidatePath(`/clubs/${clubId}/promo`);
    return { success: true, progress };
  } catch (e: any) {
    await client.query("ROLLBACK");
    console.error("[BP Action] Failed to activate:", e);
    return { success: false, error: e.message };
  } finally {
    client.release();
  }
}
