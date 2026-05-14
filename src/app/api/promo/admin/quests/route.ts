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
      `SELECT * FROM promo_quests WHERE club_id = $1 ORDER BY created_at DESC`,
      [clubId],
    );
    return NextResponse.json({ quests: res.rows });
  } catch (error) {
    console.error("Promo Admin Quests Fetch Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const data = await request.json();
  const userId = (await cookies()).get("session_user_id")?.value;

  if (!userId || !data.club_id) {
    return NextResponse.json(
      { error: "Unauthorized or missing clubId" },
      { status: 400 },
    );
  }

  const client = await getClient();
  try {
    const res = await client.query(
      `INSERT INTO promo_quests (
         club_id, title, description, trigger_type, target_entity_id, target_entity_id_type, target_value,
         reward_xp, reward_tickets, reward_bonus_balance, reward_prize_id,
         is_randomizable, lifetime_minutes, is_active,
         available_days, time_start, time_end,
         action_button_text, action_button_url, requires_photo_verification,
         reset_period, min_level
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
       ) RETURNING *`,
      [
        data.club_id,
        data.title,
        data.description,
        data.trigger_type,
        data.target_entity_id || null,
        data.target_entity_id_type || null,
        data.target_value || 1,
        data.reward_xp || 0,
        data.reward_tickets || 0,
        data.reward_bonus_balance || 0,
        data.reward_prize_id || null,
        data.is_randomizable || false,
        data.lifetime_minutes || null,
        data.is_active !== false,
        data.available_days || null,
        data.time_start || null,
        data.time_end || null,
        data.action_button_text || null,
        data.action_button_url || null,
        data.requires_photo_verification || false,
        data.reset_period || "none",
        data.min_level || 1,
      ],
    );
    return NextResponse.json({ success: true, quest: res.rows[0] });
  } catch (error) {
    console.error("Promo Admin Quest Create Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(request: Request) {
  const data = await request.json();
  const userId = (await cookies()).get("session_user_id")?.value;

  if (!userId || !data.id || !data.club_id) {
    return NextResponse.json(
      { error: "Unauthorized or missing IDs" },
      { status: 400 },
    );
  }

  const client = await getClient();
  try {
    const res = await client.query(
      `UPDATE promo_quests SET
         title = $1, description = $2, trigger_type = $3,
         target_entity_id = $4, target_entity_id_type = $5,
         target_value = $6, reward_xp = $7, reward_tickets = $8,
         reward_bonus_balance = $9, reward_prize_id = $10, is_randomizable = $11,
         lifetime_minutes = $12, is_active = $13,
         available_days = $14, time_start = $15, time_end = $16,
         action_button_text = $17, action_button_url = $18, requires_photo_verification = $19,
         reset_period = $20, min_level = $21,
         updated_at = NOW()
       WHERE id = $22 AND club_id = $23
       RETURNING *`,
      [
        data.title,
        data.description,
        data.trigger_type,
        data.target_entity_id || null,
        data.target_entity_id_type || null,
        data.target_value || 1,
        data.reward_xp || 0,
        data.reward_tickets || 0,
        data.reward_bonus_balance || 0,
        data.reward_prize_id || null,
        data.is_randomizable || false,
        data.lifetime_minutes || null,
        data.is_active !== false,
        data.available_days || null,
        data.time_start || null,
        data.time_end || null,
        data.action_button_text || null,
        data.action_button_url || null,
        data.requires_photo_verification || false,
        data.reset_period || "none",
        data.min_level || 1,
        data.id,
        data.club_id,
      ],
    );
    return NextResponse.json({ success: true, quest: res.rows[0] });
  } catch (error) {
    console.error("Promo Admin Quest Update Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const clubId = url.searchParams.get("clubId");
  const userId = (await cookies()).get("session_user_id")?.value;

  if (!userId || !id || !clubId) {
    return NextResponse.json(
      { error: "Unauthorized or missing IDs" },
      { status: 400 },
    );
  }

  const client = await getClient();
  try {
    await client.query(
      `DELETE FROM promo_quests WHERE id = $1 AND club_id = $2`,
      [id, clubId],
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Promo Admin Quest Delete Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
