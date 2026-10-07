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

    // Get player global data + club-specific balance
    let result = await client.query(
      `SELECT p.id, p.full_name, p.phone_number, p.steam_link, p.faceit_link, b.total_xp, b.bonus_balance, b.active_boost_percent, b.extra_withdraw_limit, b.limit_group_id, c.name as club_name, c.promo_settings
             FROM promo_players p
             JOIN promo_player_balances b ON p.id = b.player_id AND b.club_id = $2
             JOIN clubs c ON c.id = b.club_id
             WHERE p.id = $1`,
      [playerId, activeClubId],
    );

    if (result.rowCount === 0) {
      // Check if player exists globally and club exists
      const playerCheck = await client.query(
        `SELECT id FROM promo_players WHERE id = $1::uuid`,
        [playerId]
      );
      const clubCheck = await client.query(
        `SELECT id FROM clubs WHERE id = $1::int`,
        [activeClubId]
      );

      if (playerCheck.rowCount && playerCheck.rowCount > 0 && clubCheck.rowCount && clubCheck.rowCount > 0) {
        // Create balance record for this club
        await client.query(
          `INSERT INTO promo_player_balances (player_id, club_id, total_xp, bonus_balance)
           VALUES ($1::uuid, $2::int, 0, 0)
           ON CONFLICT (player_id, club_id) DO NOTHING`,
          [playerId, activeClubId]
        );

        // Fetch again
        result = await client.query(
          `SELECT p.id, p.full_name, p.phone_number, b.total_xp, b.bonus_balance, b.active_boost_percent, b.extra_withdraw_limit, b.limit_group_id, c.name as club_name, c.promo_settings
                 FROM promo_players p
                 JOIN promo_player_balances b ON p.id = b.player_id AND b.club_id = $2
                 JOIN clubs c ON c.id = b.club_id
                 WHERE p.id = $1`,
          [playerId, activeClubId],
        );
      }
    }

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Data not found" }, { status: 404 });
    }

    const data = result.rows[0];

    // Фоновая синхронизация свежих платежей из SmartShell для этого игрока (non-blocking)
    if (data.phone_number) {
      import("@/lib/promo-smartshell-sync").then((m) => {
        m.syncClientRecentPaymentsOnDemand(activeClubId, data.phone_number).catch((e) =>
          console.warn("[On-Demand Promo Sync error]", e)
        );
      }).catch(() => {});
    }

    // Get tickets for THIS club
    const ticketsResult = await client.query(
      `SELECT COUNT(*)::int as count
             FROM promo_tickets
             WHERE player_id = $1 AND club_id = $2 AND status = 'available' AND (expires_at IS NULL OR expires_at > NOW())`,
      [playerId, activeClubId],
    );

    // Get all levels for the roadmap
    const allLevelsResult = await client.query(
      `SELECT level_number as level, xp_required FROM promo_levels WHERE club_id = $1 ORDER BY level_number ASC`,
      [activeClubId],
    );

    const totalXp = parseFloat(data.total_xp || 0);
    const levelInfo = null;
    const bpInfo = null;

    // Calculate monthly topups and withdrawals for limits
    let monthlyTopups = 0;
    let monthlyWithdrawn = 0;
    let monthlyBarReal = 0;
    let monthlyBarBonus = 0;

    try {
      const topupRes = await client.query(
        `SELECT COALESCE(SUM((result_data->>'amount')::float), 0) as total
         FROM promo_history
         WHERE player_id = $1 AND club_id = $2 AND (game_type ILIKE '%topup%' OR game_type = 'pos_sale') AND created_at >= date_trunc('month', CURRENT_DATE)`,
        [playerId, activeClubId],
      );
      const topups = parseFloat(topupRes.rows[0].total);

      const barRealRes = await client.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM shift_receipts
         WHERE promo_player_id = $1 AND club_id = $2
           AND payment_type IN ('cash', 'card', 'mixed')
           AND committed_at >= date_trunc('month', CURRENT_DATE)`,
        [playerId, activeClubId],
      );
      monthlyBarReal = parseFloat(barRealRes.rows[0].total);
      monthlyTopups = topups + monthlyBarReal;

      const withdrawRes = await client.query(
        `SELECT COALESCE(SUM(withdraw_amount), 0) as total
         FROM promo_prize_queue
         WHERE player_id = $1 AND club_id = $2 AND status != 'canceled' AND created_at >= date_trunc('month', CURRENT_DATE)`,
        [playerId, activeClubId],
      );
      const normalWithdraw = parseFloat(withdrawRes.rows[0].total);

      const barBonusRes = await client.query(
        `SELECT COALESCE(SUM((result_data->>'bonus_cost')::float), 0) as total
         FROM promo_history
         WHERE player_id = $1 AND club_id = $2
           AND game_type = 'BAR_BONUS_PURCHASE'
           AND created_at >= date_trunc('month', CURRENT_DATE)`,
        [playerId, activeClubId],
      );
      monthlyBarBonus = parseFloat(barBonusRes.rows[0].total);
      monthlyWithdrawn = normalWithdraw + monthlyBarBonus;
    } catch (e) {
      console.error("Failed to fetch monthly stats for limits:", e);
    }

    const hasPremiumBp = false;

    // Fetch package progress
    let packageProgress = null;
    try {
      // Fetch all program progress rows for this player in this club
      const allProgressRes = await client.query(
        `SELECT program_id, current_count, last_event_date
         FROM promo_package_progress
         WHERE player_id = $1 AND club_id = $2`,
        [playerId, activeClubId]
      );

      // Fetch pending loyalty claims to prevent multiple claim requests
      const pendingClaimsRes = await client.query(
        `SELECT loyalty_type FROM promo_prize_queue 
         WHERE player_id = $1 AND club_id = $2 AND status = 'pending' AND loyalty_type IS NOT NULL`,
        [playerId, activeClubId]
      );
      const pendingClaims = pendingClaimsRes.rows.map((r: any) => r.loyalty_type);

      // Fetch all pending prizes (including bar items) to show player
      const pendingPrizesRes = await client.query(
        `SELECT q.id, 
                COALESCE(p.name, q.custom_reward_name, 'Приз') as prize_name, 
                q.prize_type, 
                q.created_at
         FROM promo_prize_queue q
         LEFT JOIN promo_prizes p ON q.prize_id = p.id
         WHERE q.player_id = $1 AND q.club_id = $2 AND q.status = 'pending'
         ORDER BY q.created_at DESC`,
        [playerId, activeClubId]
      );
      const pendingPrizes = pendingPrizesRes.rows;

      const programProgress: Record<string, { current_count: number; last_event_date: string | null }> = {};
      
      let accumulated_packages = 0;
      let accumulated_visits = 0;
      let current_streak = 0;
      let last_purchase_date = null;
      let last_visit_date = null;

      for (const row of allProgressRes.rows) {
        programProgress[row.program_id] = {
          current_count: row.current_count,
          last_event_date: row.last_event_date,
        };

        if (row.program_id === "legacy_packages" || row.program_id === "legacy") {
          accumulated_packages = row.current_count;
          last_purchase_date = row.last_event_date;
        } else if (row.program_id === "legacy_visits") {
          accumulated_visits = row.current_count;
          last_visit_date = row.last_event_date;
        } else if (row.program_id === "legacy_streak") {
          current_streak = row.current_count;
        }
      }

      packageProgress = {
        accumulated_packages,
        accumulated_visits,
        current_streak,
        last_visit_date,
        last_purchase_date,
        pendingClaims,
        pendingPrizes,
        programProgress,
      };
    } catch (err) {
      console.error("Failed to fetch package progress for player:", err);
    }

    let clubTariffs: Array<{ id: string; name: string }> = [];
    let clubZones: Array<{ id: string; title: string }> = [];
    try {
      const { getSmartShellClientForClub } = await import("@/lib/smartshell/shift-sync");
      const ssClient = await getSmartShellClientForClub(parseInt(activeClubId));
      if (ssClient) {
        const [ssTariffs, ssZones] = await Promise.all([
          ssClient.getTariffs(),
          ssClient.getHostGroups(),
        ]);
        clubTariffs = ssTariffs.map((t) => ({ id: String(t.id), name: t.title }));
        clubZones = ssZones.map((z) => ({ id: String(z.id), title: z.title }));
      }
    } catch (ssErr) {
      console.warn("[Player Route SS Fetch Error]", ssErr);
    }

    // Merge manual service rules
    if (Array.isArray(data.promo_settings?.service_rules)) {
      for (const r of data.promo_settings.service_rules) {
        if (r.id && r.name && !clubTariffs.some((t) => String(t.id) === String(r.id))) {
          clubTariffs.push({ id: String(r.id), name: r.name });
        }
      }
    }

    return NextResponse.json({
      player: {
        id: data.id,
        fullName: data.full_name,
        phoneNumber: data.phone_number,
          steam_link: data.steam_link,
          faceit_link: data.faceit_link,
        totalXp,
        bonusBalance: parseFloat(data.bonus_balance || 0),
        activeBoostPercent: parseInt(data.active_boost_percent || 0),
        extraWithdrawLimit: parseFloat(data.extra_withdraw_limit || 0),
        limitGroupId: data.limit_group_id,
        clubName: data.club_name,
        clubId: activeClubId,
        settings: data.promo_settings,
        tariffs: clubTariffs,
        zones: clubZones,
        level: levelInfo,
        bp: bpInfo,
        monthlyTopups,
        monthlyWithdrawn,
        monthlyBarReal,
        monthlyBarBonus,
        hasPremiumBp,
        packageProgress,
      },
      allLevels: allLevelsResult.rows,
      tickets: ticketsResult.rows[0].count,
    });
  } catch (error) {
    console.error("Promo Player Info Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
