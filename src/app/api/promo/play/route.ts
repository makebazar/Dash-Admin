import { NextResponse } from "next/server";
import { query, getClient } from "@/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const client = await getClient();
  try {
    const {
      gameType,
      selectedCode,
      availableCodes,
      selectedWire,
      availableWires,
      diceRoll,
    } = await request.json();
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await client.query("BEGIN");

    // 1. Get player and club info
    const playerResult = await client.query(
      `SELECT p.id, b.club_id FROM promo_players p
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

    // Level requirements check removed

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

    const ticketIds = ticketsResult.rows.map((r: any) => r.id);

    // 3. Mark tickets as used
    await client.query(
      `UPDATE promo_tickets SET status = 'used', used_at = NOW() WHERE id = ANY($1)`,
      [ticketIds],
    );

    const isEmptyPrizeRow = (p: any) => {
      if (!p) return true;
      const nameLower = String(p.name || "").trim().toLowerCase();
      return (
        p.type === "none" ||
        nameLower === "пусто" ||
        nameLower === "попробуй еще" ||
        nameLower === "ничего" ||
        (p.type !== "physical" && (parseFloat(p.value) || 0) <= 0)
      );
    };

    let isCodeCorrect = true;
    let winningCode = selectedCode;
    let safeCodes: string[] = [];

    // Special logic for "Safe": Player must guess 1 of 6 unique codes
    if (gameType === "safe" && selectedCode) {
      const uniqueFromClient = Array.isArray(availableCodes)
        ? Array.from(new Set(availableCodes.map((c: any) => String(c))))
        : [];
      safeCodes = uniqueFromClient.includes(String(selectedCode))
        ? [...uniqueFromClient]
        : [String(selectedCode)];
      while (safeCodes.length < 6) {
        const candidate = String(Math.floor(1000 + Math.random() * 9000));
        if (!safeCodes.includes(candidate)) safeCodes.push(candidate);
      }
      winningCode = safeCodes[Math.floor(Math.random() * safeCodes.length)];
      isCodeCorrect = String(selectedCode) === String(winningCode);
    }

    let wonPrize: any = null;
    let matchedSectorId: number | null = null;
    const roll = Math.random() * 100;
    let cumulative = 0;
    let diceResult: {
      d1: number;
      d2: number;
      sum: number;
      initialForces?: any[];
    } | null = null;

    const rollByProbability = async (prizesList: any[]) => {
      let matched: any = null;
      let lastValidPrize: any = null;
      for (const prize of prizesList) {
        const prob = parseFloat(prize.probability);
        if (!prob || prob <= 0) continue;

        if (prize.daily_limit > 0) {
          const countResult = await client.query(
            `SELECT COUNT(*)::int as count FROM promo_history
             WHERE prize_id = $1 AND created_at >= CURRENT_DATE`,
            [prize.id],
          );
          if (countResult.rows[0].count >= prize.daily_limit) continue;
        }

        lastValidPrize = prize;
        cumulative += prob;
        if (roll <= cumulative) {
          matched = prize;
          break;
        }
      }

      if (
        !matched &&
        lastValidPrize &&
        cumulative >= 99.9 &&
        roll > cumulative
      ) {
        matched = lastValidPrize;
      }
      return matched;
    };

    // 4. Calculate Prize
    if (isCodeCorrect) {
      const prizesResult = await client.query(
        `SELECT * FROM promo_prizes
         WHERE club_id = $1 AND is_active = TRUE
         AND game_slug = $2
         ORDER BY value DESC, id ASC`,
        [activeClubId, gameType],
      );

      const prizes = prizesResult.rows;

      if (gameType === "dice") {
        const rawD1 = Number(diceRoll?.d1);
        const rawD2 = Number(diceRoll?.d2);
        const d1 =
          Number.isInteger(rawD1) && rawD1 >= 1 && rawD1 <= 6
            ? rawD1
            : Math.floor(Math.random() * 6) + 1;
        const d2 =
          Number.isInteger(rawD2) && rawD2 >= 1 && rawD2 <= 6
            ? rawD2
            : Math.floor(Math.random() * 6) + 1;
        const sum = d1 + d2;

        diceResult = { d1, d2, sum };

        // Logic for Dice: Match against win_condition (sorted by value DESC so higher prizes win on overlap)
        for (const prize of prizes) {
          const condition = prize.win_condition;
          if (!condition) continue;

          let matches = false;

          if (
            Array.isArray(condition.dice_sums) &&
            condition.dice_sums.map(Number).includes(sum)
          ) {
            matches = true;
          }

          if (condition.dice_double && d1 === d2) {
            if (
              condition.dice_double === "any" ||
              Number(condition.dice_double) === d1
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
            if (!isEmptyPrizeRow(prize)) {
              wonPrize = prize;
              matchedSectorId = prize.id;
            }
            break;
          }
        }
      } else {
        const matched = await rollByProbability(prizes);
        if (matched) {
          matchedSectorId = matched.id;
          if (!isEmptyPrizeRow(matched)) {
            wonPrize = matched;
          }
        }
      }

      // In Safe, never open the safe empty: if no real prize was won, treat as wrong code
      if (gameType === "safe" && !wonPrize) {
        isCodeCorrect = false;
        const otherCodes = safeCodes.filter(
          (c) => String(c) !== String(selectedCode),
        );
        if (otherCodes.length > 0) {
          winningCode =
            otherCodes[Math.floor(Math.random() * otherCodes.length)];
        }
      }
    }

    const defaultWires = ["red", "blue", "yellow", "green", "purple"];
    const wirePool =
      Array.isArray(availableWires) && availableWires.length >= 2
        ? availableWires.map(String)
        : defaultWires;
    const chosenWire = selectedWire ? String(selectedWire) : wirePool[0];
    let isDefused = Boolean(wonPrize);
    let correctWire = chosenWire;
    if (gameType === "defuse" && !wonPrize) {
      isDefused = false;
      const otherWires = wirePool.filter((w: string) => w !== chosenWire);
      if (otherWires.length > 0) {
        correctWire = otherWires[Math.floor(Math.random() * otherWires.length)];
      }
    }

    // 5. Save history (only record prize_id for actual non-empty wins)
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
          selectedWire: gameType === "defuse" ? chosenWire : undefined,
          correctWire: gameType === "defuse" ? correctWire : undefined,
          isDefused: gameType === "defuse" ? isDefused : undefined,
          diceResult,
          matchedSectorId,
        }),
      ],
    );

    const historyId = historyResult.rows[0].id;

    // 6. Handle auto-rewards
    let questRewards: any[] = [];
    if (wonPrize) {
      const numericValue = parseFloat(wonPrize.value) || 0;
      if (wonPrize.type === "virtual" && numericValue > 0) {
        await client.query(
          `UPDATE promo_player_balances SET bonus_balance = COALESCE(bonus_balance, 0) + $1 WHERE player_id = $2 AND club_id = $3`,
          [numericValue, playerId, activeClubId],
        );
      } else if (wonPrize.type === "bonus_limitless" && numericValue > 0) {
        await client.query(
          `UPDATE promo_player_balances 
           SET bonus_balance = COALESCE(bonus_balance, 0) + $1,
               extra_withdraw_limit = COALESCE(extra_withdraw_limit, 0) + $1,
               updated_at = NOW()
           WHERE player_id = $2 AND club_id = $3`,
          [numericValue, playerId, activeClubId],
        );
      } else if (wonPrize.type === "attempt") {
        const ticketCount = Math.floor(numericValue);
        if (ticketCount > 0) {
          await client.query(
            `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
                   SELECT $1, $2, 'available', 'prize_win', NULL
                   FROM generate_series(1, $3)`,
            [playerId, activeClubId, ticketCount],
          );
        }
      } else if (wonPrize.type === "physical") {
        // Physical prizes MUST be in the queue for admin to see
        await client.query(
          `INSERT INTO promo_prize_queue (history_id, player_id, club_id, prize_id, status)
                 VALUES ($1, $2, $3, $4, 'pending')`,
          [historyId, playerId, activeClubId, wonPrize.id],
        );
      } else if (wonPrize.type === "withdraw_boost") {
        const boostVal = Math.floor(numericValue);
        if (boostVal > 0) {
          const boostName = wonPrize.name || `Буст вывода +${boostVal}%`;
          await client.query(
            `INSERT INTO promo_player_inventory (
              player_id, club_id, reward_type, reward_name, status, metadata
            ) VALUES ($1::uuid, $2::int, 'withdraw_boost', $3, 'acquired', $4)`,
            [
              playerId,
              activeClubId,
              boostName,
              JSON.stringify({
                reward_value: boostVal,
                source: "game_win",
                game_type: gameType,
                prize_id: wonPrize.id,
              }),
            ]
          );
        }
      }
    }

    // 6.5. Process Quests
    try {
      const { processGameEvent } = await import("@/lib/promo-quests");
      const questResults = await processGameEvent(
        client,
        activeClubId,
        playerId,
        gameType,
        !!wonPrize,
        ticketsNeeded,
      );
      if (questResults && Array.isArray(questResults)) {
        questRewards = questResults;
      }
    } catch (e) {
      console.error("Quest Game Processing Error:", e);
    }

    await client.query("COMMIT");

    // 7. Notify admin/staff
    await query(`SELECT pg_notify('promo_queue_updates', $1)`, [activeClubId]);

    return NextResponse.json({
      success: true,
      won: !!wonPrize,
      matchedSectorId,
      ticketsSpent: ticketsNeeded,
      isCodeCorrect,
      winningCode,
      isDefused,
      correctWire,
      selectedWire: chosenWire,
      diceResult,
      questRewards,
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
