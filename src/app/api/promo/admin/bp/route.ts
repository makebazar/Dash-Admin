import { NextResponse } from "next/server";
import { query, getPool } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get active season
    const seasonRes = await query(
      `SELECT * FROM promo_bp_seasons WHERE club_id = $1 AND is_active = TRUE LIMIT 1`,
      [clubId],
    );

    let season = seasonRes.rows[0];
    let tiers = [];

    if (season) {
      // 2. Get tiers
      const tiersRes = await query(
        `SELECT * FROM promo_bp_tiers WHERE season_id = $1 ORDER BY level_number ASC, is_premium ASC`,
        [season.id],
      );
      tiers = tiersRes.rows;
    }

    return NextResponse.json({ season, tiers });
  } catch (error) {
    console.error("Fetch BP Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { clubId, season, tiers } = await request.json();
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await client.query("BEGIN");

    // 1. Upsert Season
    let seasonId = season.id;
    if (seasonId) {
      await client.query(
        `UPDATE promo_bp_seasons
         SET name = $1, start_date = $2, end_date = $3, is_active = $4
         WHERE id = $5 AND club_id = $6`,
        [
          season.name,
          season.start_date,
          season.end_date,
          season.is_active,
          seasonId,
          clubId,
        ],
      );
    } else {
      const res = await client.query(
        `INSERT INTO promo_bp_seasons (club_id, name, start_date, end_date, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id`,
        [clubId, season.name, season.start_date, season.end_date],
      );
      seasonId = res.rows[0].id;
    }

    // 2. Clear existing tiers and insert new ones
    // (A simpler approach for sync)
    await client.query(`DELETE FROM promo_bp_tiers WHERE season_id = $1`, [
      seasonId,
    ]);

    for (const tier of tiers) {
      await client.query(
        `INSERT INTO promo_bp_tiers (season_id, level_number, xp_required, reward_type, reward_value, reward_name, is_premium)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          seasonId,
          tier.level_number,
          tier.xp_required,
          tier.reward_type,
          tier.reward_value,
          tier.reward_name,
          tier.is_premium,
        ],
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({ success: true, seasonId });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update BP Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
