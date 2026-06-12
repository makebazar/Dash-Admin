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

export async function setPlayerLimitGroupAction(
  clubId: string,
  playerId: string,
  limitGroupId: string | null,
) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query(
      `UPDATE promo_player_balances 
       SET limit_group_id = $1, updated_at = NOW() 
       WHERE player_id = $2::uuid AND club_id = $3::int`,
      [limitGroupId === "default" ? null : limitGroupId, playerId, clubId]
    );

    revalidatePath(`/clubs/${clubId}/promo`);
    return { success: true };
  } catch (e: any) {
    console.error("[Limit Group Action] Failed to set limit group:", e);
    return { success: false, error: e.message };
  } finally {
    client.release();
  }
}
