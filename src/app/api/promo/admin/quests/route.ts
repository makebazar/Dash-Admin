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
      `SELECT
         q.*,
         COALESCE(stats.total_plays_count, 0)::int as total_plays_count,
         COALESCE(stats.total_players_count, 0)::int as total_players_count,
         COALESCE(stats.completed_count, 0)::int as completed_count,
         COALESCE(stats.unique_players_count, 0)::int as unique_players_count
       FROM promo_quests q
       LEFT JOIN (
         SELECT
           quest_id,
           COUNT(*)::int as total_plays_count,
           COUNT(DISTINCT player_id)::int as total_players_count,
           COUNT(CASE WHEN status IN ('completed', 'claimed') THEN 1 END)::int as completed_count,
           COUNT(DISTINCT CASE WHEN status IN ('completed', 'claimed') THEN player_id END)::int as unique_players_count
         FROM promo_player_quests
         GROUP BY quest_id
       ) stats ON q.id = stats.quest_id
       WHERE q.club_id = $1
       ORDER BY q.created_at DESC`,
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
         reset_period, min_level, target_service_id, image_url, reset_hours, requires_seat_number, combo_triggers
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
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
        data.target_service_id || null,
        data.image_url || null,
        data.reset_hours || null,
        data.requires_seat_number || false,
        data.combo_triggers ? JSON.stringify(data.combo_triggers) : null,
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
         reset_period = $20, min_level = $21, target_service_id = $22,
         image_url = $23, reset_hours = $24, requires_seat_number = $25,
         combo_triggers = $26, updated_at = NOW()
       WHERE id = $27 AND club_id = $28
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
        data.target_service_id || null,
        data.image_url || null,
        data.reset_hours || null,
        data.requires_seat_number || false,
        data.combo_triggers ? JSON.stringify(data.combo_triggers) : null,
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
