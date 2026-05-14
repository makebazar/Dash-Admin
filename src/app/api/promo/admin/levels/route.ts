import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clubId = url.searchParams.get("clubId");

  if (!clubId) {
    return NextResponse.json({ error: "Missing clubId" }, { status: 400 });
  }

  const client = await getClient();
  try {
    const res = await client.query(
      `SELECT * FROM promo_levels WHERE club_id = $1::int ORDER BY level_number ASC`,
      [clubId],
    );
    return NextResponse.json({ levels: res.rows });
  } catch (error: any) {
    console.error("Promo Admin Levels Fetch Error:", error);
    return NextResponse.json(
      { error: "Internal Error: " + error.message },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const { clubId, levels } = await request.json();
  const userId = (await cookies()).get("session_user_id")?.value;

  if (!userId || !clubId) {
    return NextResponse.json(
      { error: "Unauthorized or missing clubId" },
      { status: 400 },
    );
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Simplest approach: Delete all and re-insert for this club
    await client.query(`DELETE FROM promo_levels WHERE club_id = $1::int`, [
      clubId,
    ]);

    for (const level of levels) {
      await client.query(
        `INSERT INTO promo_levels (club_id, level_number, xp_required) VALUES ($1::int, $2, $3)`,
        [clubId, level.level_number, level.xp_required],
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Promo Admin Levels Save Error:", error);
    return NextResponse.json(
      { error: "Internal Error: " + error.message },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
