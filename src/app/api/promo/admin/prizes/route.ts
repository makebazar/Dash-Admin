import { NextResponse } from "next/server";
import { query, getClient } from "@/db";
import { cookies } from "next/headers";
import { resolveClubId } from "@/lib/promo-admin-utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubIdParam = searchParams.get("clubId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubIdParam) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clubId = await resolveClubId(clubIdParam);
    if (!clubId) {
      return NextResponse.json({ error: "Invalid Club" }, { status: 404 });
    }

    const result = await query(
      `SELECT * FROM promo_prizes WHERE club_id = $1 AND is_active = TRUE ORDER BY probability DESC`,
      [clubId],
    );

    return NextResponse.json({ prizes: result.rows });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const client = await getClient();
  try {
    const { clubId: clubIdParam, prizes } = await request.json();
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubIdParam) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const numericClubId = await resolveClubId(clubIdParam);
    if (!numericClubId) {
      return NextResponse.json({ error: "Invalid Club" }, { status: 400 });
    }

    await client.query("BEGIN");

    // 1. Get existing active prize IDs to identify which ones to delete
    const existingPrizesRes = await client.query(
      `SELECT id FROM promo_prizes WHERE club_id = $1 AND is_active = TRUE`,
      [numericClubId],
    );
    const existingIds = existingPrizesRes.rows.map((r) => r.id);
    const incomingIds = prizes
      .map((p: any) => p.id)
      .filter((id: any) => id !== undefined && id !== null);

    // 2. Identify prizes to remove
    const idsToRemove = existingIds.filter((id) => !incomingIds.includes(id));

    if (idsToRemove.length > 0) {
      for (const id of idsToRemove) {
        try {
          // Use SAVEPOINT to allow recovery from foreign key violations within the same transaction
          await client.query("SAVEPOINT prize_delete");
          await client.query(`DELETE FROM promo_prizes WHERE id = $1`, [id]);
          await client.query("RELEASE SAVEPOINT prize_delete");
        } catch (delError) {
          // If delete fails (e.g. foreign key constraint), rollback to savepoint and deactivate instead
          await client.query("ROLLBACK TO SAVEPOINT prize_delete");
          await client.query(
            `UPDATE promo_prizes SET is_active = FALSE WHERE id = $1`,
            [id],
          );
        }
      }
    }

    // 3. Upsert incoming prizes
    for (const prize of prizes) {
      const winCondition = prize.win_condition
        ? typeof prize.win_condition === "string"
          ? prize.win_condition
          : JSON.stringify(prize.win_condition)
        : null;

      if (prize.id) {
        // UPDATE existing prize
        await client.query(
          `UPDATE promo_prizes
           SET name = $1, type = $2, value = $3, probability = $4, daily_limit = $5, is_active = $6,
               game_slug = $7, win_condition = $8, min_level = $9, max_level = $10, image_url = $11
           WHERE id = $12 AND club_id = $13`,
          [
            prize.name,
            prize.type,
            prize.value,
            prize.probability,
            prize.daily_limit,
            prize.is_active,
            prize.game_slug,
            winCondition,
            prize.min_level || 1,
            prize.max_level || 999,
            prize.image_url || null,
            prize.id,
            numericClubId,
          ],
        );
      } else {
        // INSERT new prize
        await client.query(
          `INSERT INTO promo_prizes (club_id, name, type, value, probability, daily_limit, is_active,
                                     game_slug, win_condition, min_level, max_level, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            numericClubId,
            prize.name,
            prize.type,
            prize.value,
            prize.probability,
            prize.daily_limit,
            prize.is_active,
            prize.game_slug,
            winCondition,
            prize.min_level || 1,
            prize.max_level || 999,
            prize.image_url || null,
          ],
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Save Prizes Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
