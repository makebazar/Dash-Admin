import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const client = await getClient();
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get player's referral code and club settings
    const playerClubRes = await client.query(
      `SELECT p.referral_code, c.promo_settings, c.name as club_name
       FROM promo_players p
       LEFT JOIN clubs c ON c.id = $2::int
       WHERE p.id = $1::uuid`,
      [playerId, activeClubId]
    );

    if (playerClubRes.rowCount === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const { referral_code, promo_settings, club_name } = playerClubRes.rows[0];

    // Get referral settings with defaults
    const referralSettings = (promo_settings || {}).referral_settings || {
      enabled: true,
      threshold: 1000.0,
      fixed_reward_tickets: 5,
      fixed_reward_bonus: 0.0,
      recurring_percent: 10.0,
    };

    // 2. Get list of referred friends
    const referredFriendsRes = await client.query(
      `SELECT r.id, r.status, r.total_referred_deposits, r.created_at, p.full_name
       FROM promo_referrals r
       JOIN promo_players p ON r.referred_id = p.id
       WHERE r.referrer_id = $1::uuid
       ORDER BY r.created_at DESC`,
      [playerId]
    );

    // 3. Get total rewards summary
    const rewardsSummaryRes = await client.query(
      `SELECT 
         COALESCE(SUM((result_data->>'bonus_amount')::numeric), 0)::float as total_bonus,
         COALESCE(SUM((result_data->>'tickets')::numeric), 0)::int as total_tickets
       FROM promo_history 
       WHERE player_id = $1::uuid AND club_id = $2::int AND game_type IN ('REFERRAL_FIXED_AWARD', 'REFERRAL_PERCENT_AWARD')`,
      [playerId, activeClubId]
    );

    const { total_bonus, total_tickets } = rewardsSummaryRes.rows[0] || { total_bonus: 0, total_tickets: 0 };

    // 4. Get detailed accrual history
    const accrualsRes = await client.query(
      `SELECT h.id, h.game_type, h.result_data, h.created_at, p.full_name as friend_name
       FROM promo_history h
       LEFT JOIN promo_players p ON (h.result_data->>'referred_friend_id')::uuid = p.id
       WHERE h.player_id = $1::uuid AND h.club_id = $2::int AND h.game_type IN ('REFERRAL_FIXED_AWARD', 'REFERRAL_PERCENT_AWARD')
       ORDER BY h.created_at DESC
       LIMIT 50`,
      [playerId, activeClubId]
    );

    // 5. Get referrer details (who invited this player)
    const referrerRes = await client.query(
      `SELECT p.full_name, p.phone_number
       FROM promo_referrals r
       JOIN promo_players p ON r.referrer_id = p.id
       WHERE r.referred_id = $1::uuid
       LIMIT 1`,
      [playerId]
    );

    const invitedBy = referrerRes.rowCount && referrerRes.rowCount > 0
      ? {
          fullName: referrerRes.rows[0].full_name,
          phoneNumber: referrerRes.rows[0].phone_number,
        }
      : null;

    return NextResponse.json({
      referralCode: referral_code,
      clubName: club_name,
      settings: referralSettings,
      invitedBy,
      referredFriends: referredFriendsRes.rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        status: row.status,
        totalReferredDeposits: parseFloat(row.total_referred_deposits || "0"),
        createdAt: row.created_at,
      })),
      stats: {
        totalBonus: total_bonus,
        totalTickets: total_tickets,
        friendsCount: referredFriendsRes.rowCount || 0,
      },
      history: accrualsRes.rows.map((row) => ({
        id: row.id,
        type: row.game_type,
        friendName: row.friend_name || "Друг",
        amount: parseFloat(row.result_data?.bonus_amount || "0"),
        tickets: parseInt(row.result_data?.tickets || "0"),
        percent: parseFloat(row.result_data?.percent || "0"),
        depositAmount: parseFloat(row.result_data?.deposit_amount || "0"),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Promo Referrals API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
