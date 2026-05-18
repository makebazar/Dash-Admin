import { NextResponse } from "next/server";
import { query, getClient } from "@/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const client = await getClient();
  try {
    const { gameType, selectedCode, availableCodes } = await request.json();
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await client.query("BEGIN");

    // 1. Get player and club info
    const playerResult = await client.query(
      `SELECT p.id, b.club_id, b.total_xp FROM promo_players p
             JOIN promo_player_balances b ON p.id = b.player_id AND b.club_id = $2
             WHERE p.id = $1`,
      [playerId, activeClubId],
    );

    if (!playerResult.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Player or Club context not found" },
        { status: 404 },
      );
    }

    // 2. Check for available tickets and game restrictions
    const clubResult = await client.query(
      `SELECT promo_settings FROM clubs WHERE id = $1`,
      [activeClubId],
    );
    const settings = clubResult.rows[0]?.promo_settings || {};
    const gameConfig = settings.game_configs?.[gameType] || {};

    // Check if game is enabled globally
    if (!(settings.enabled_games || []).includes(gameType)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Game is currently disabled." },
        { status: 403 },
      );
    }

    // Check level requirements
    const { getPlayerLevelInfo } = await import("@/lib/promo-quests");
    const totalXp = parseFloat(playerResult.rows[0]?.total_xp || 0);
    const levelInfo = await getPlayerLevelInfo(client, activeClubId, totalXp);
    const playerLevel = levelInfo.currentLevel;
    const minLevel = gameConfig.min_level || 0;

    if (playerLevel < minLevel) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: `This game requires level ${minLevel}. Your level is ${playerLevel}.`,
        },
        { status: 403 },
      );
    }

    const ticketsNeeded = gameConfig.tickets_per_play || 1;

    const ticketsResult = await client.query(
      `SELECT id FROM promo_tickets
             WHERE player_id = $1 AND club_id = $2 AND status = 'available' AND (expires_at IS NULL OR expires_at > NOW())
             LIMIT $3 FOR UPDATE`,
      [playerId, activeClubId, ticketsNeeded],
    );

    if ((ticketsResult.rowCount ?? 0) < ticketsNeeded) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: `Insufficient tickets. Need ${ticketsNeeded}, found ${ticketsResult.rowCount ?? 0}`,
        },
        { status: 400 },
      );
    }

    const ticketIds = ticketsResult.rows.map((r) => r.id);

    // 3. Mark tickets as used
    await client.query(
      `UPDATE promo_tickets SET status = 'used', used_at = NOW() WHERE id = ANY($1)`,
      [ticketIds],
    );

    let isCodeCorrect = true;
    let winningCode = selectedCode;

    // Special logic for "Safe": Player must guess the code
    if (gameType === "safe" && selectedCode && availableCodes) {
      // The server randomly picks one of the available codes as the "winning" one
      winningCode =
        availableCodes[Math.floor(Math.random() * availableCodes.length)];
      isCodeCorrect = selectedCode === winningCode;
    }

    let wonPrize = null;
    let roll = Math.random() * 100;
    let cumulative = 0;
    let diceResult: {
      d1: number;
      d2: number;
      sum: number;
      initialForces?: any[];
    } | null = null;

    // 4. Calculate Prize
    if (isCodeCorrect) {
      const prizesResult = await client.query(
        `SELECT * FROM promo_prizes
         WHERE club_id = $1 AND is_active = TRUE
         AND game_slug = $2
         AND $3 >= min_level AND $3 <= max_level`,
        [activeClubId, gameType, playerLevel],
      );

      const prizes = prizesResult.rows;

      if (gameType === "dice") {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const sum = d1 + d2;

        // Generate "Natural" initial forces that the client will use.
        // In a real deterministic setup, we'd run the simulation here.
        // To keep it simple and "honest-looking", we send random-looking forces.
        const initialForces = [
          {
            pos: { x: -1.5, y: 10, z: (Math.random() - 0.5) * 3 },
            vel: {
              x: (Math.random() - 0.5) * 6,
              y: -20,
              z: (Math.random() - 0.5) * 6,
            },
            angVel: {
              x: Math.random() * 40,
              y: Math.random() * 40,
              z: Math.random() * 40,
            },
          },
          {
            pos: { x: 1.5, y: 10, z: (Math.random() - 0.5) * 3 },
            vel: {
              x: (Math.random() - 0.5) * 6,
              y: -20,
              z: (Math.random() - 0.5) * 6,
            },
            angVel: {
              x: Math.random() * 40,
              y: Math.random() * 40,
              z: Math.random() * 40,
            },
          },
        ];

        diceResult = { d1, d2, sum, initialForces };

        // Logic for Dice: Match against win_condition
        for (const prize of prizes) {
          const condition = prize.win_condition;
          if (!condition) continue;

          let matches = false;

          // Check sums
          if (condition.dice_sums && condition.dice_sums.includes(sum)) {
            matches = true;
          }

          // Check doubles
          if (condition.dice_double && d1 === d2) {
            if (
              condition.dice_double === "any" ||
              condition.dice_double === d1
            ) {
              matches = true;
            }
          }

          if (matches) {
            if (prize.daily_limit > 0) {
              const countResult = await client.query(
                `SELECT COUNT(*)::int as count FROM promo_history
                           WHERE prize_id = $1 AND created_at >= CURRENT_DATE`,
                [prize.id],
              );
              if (countResult.rows[0].count >= prize.daily_limit) continue;
            }
            wonPrize = prize;
            break; // Stop at first match
          }
        }
      } else {
        // Generic probability logic (Wheel, etc)
        for (const prize of prizes) {
          if (prize.daily_limit > 0) {
            const countResult = await client.query(
              `SELECT COUNT(*)::int as count FROM promo_history
                         WHERE prize_id = $1 AND created_at >= CURRENT_DATE`,
              [prize.id],
            );
            if (countResult.rows[0].count >= prize.daily_limit) continue;
          }

          cumulative += parseFloat(prize.probability);
          if (roll <= cumulative) {
            wonPrize = prize;
            break;
          }
        }
      }
    }

    // 5. Save history
    const historyResult = await client.query(
      `INSERT INTO promo_history (player_id, club_id, game_type, prize_id, result_data)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        playerId,
        activeClubId,
        gameType,
        wonPrize?.id || null,
        JSON.stringify({
          roll,
          cumulative,
          selectedCode,
          winningCode,
          isCodeCorrect,
          diceResult,
        }),
      ],
    );

    const historyId = historyResult.rows[0].id;

    // 6. Handle auto-rewards
    if (wonPrize) {
      if (wonPrize.type === "bonus") {
        await client.query(
          `UPDATE promo_player_balances SET total_xp = total_xp + $1 WHERE player_id = $2 AND club_id = $3`,
          [wonPrize.value, playerId, activeClubId],
        );
      } else if (wonPrize.type === "virtual") {
        await client.query(
          `UPDATE promo_player_balances SET bonus_balance = bonus_balance + $1 WHERE player_id = $2 AND club_id = $3`,
          [wonPrize.value, playerId, activeClubId],
        );
      } else if (wonPrize.type === "attempt") {
        const ticketCount = Math.floor(parseFloat(wonPrize.value) || 1);
        const expiryHours = settings.ticket_expiry_hours || 24;
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + expiryHours);

        await client.query(
          `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
                 SELECT $1, $2, 'available', 'prize_win', $3
                 FROM generate_series(1, $4)`,
          [playerId, activeClubId, expiryDate, ticketCount],
        );
      } else if (wonPrize.type === "physical") {
        // Physical prizes MUST be in the queue for admin to see
        await client.query(
          `INSERT INTO promo_prize_queue (history_id, player_id, club_id, prize_id, status)
                 VALUES ($1, $2, $3, $4, 'pending')`,
          [historyId, playerId, activeClubId, wonPrize.id],
        );
      }
    }
    await client.query("COMMIT");

    // 6.5. Process Quests
    try {
      const { processGameEvent } = await import("@/lib/promo-quests");
      await processGameEvent(
        client,
        activeClubId,
        playerId,
        gameType,
        !!wonPrize,
        ticketsNeeded,
      );
    } catch (e) {
      console.error("Quest Game Processing Error:", e);
    }

    // 7. Notify admin/staff (Removed as per user request: games no longer in queue)
    await query(`SELECT pg_notify('promo_queue_updates', $1)`, [activeClubId]);

    return NextResponse.json({
      success: true,
      won: !!wonPrize,
      isCodeCorrect,
      winningCode,
      diceResult,
      prize: wonPrize
        ? {
            id: wonPrize.id,
            name: wonPrize.name,
            type: wonPrize.type,
            value: wonPrize.value,
          }
        : null,
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Promo Play Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
