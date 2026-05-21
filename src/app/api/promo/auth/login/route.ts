import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";
import bcrypt from "bcrypt";
import { normalizePhone } from "@/lib/phone-utils";
import crypto from "crypto";

export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json().catch(() => ({}));
    const { phoneNumber, pin, fullName, clubId, refCode } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizePhone(String(phoneNumber));
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 },
      );
    }

    client = await getClient();
    await client.query("BEGIN");

    let activeClubId = clubId;
    if (!activeClubId && refCode) {
      const referrerClubRes = await client.query(
        `SELECT b.club_id 
         FROM promo_player_balances b
         JOIN promo_players p ON p.id = b.player_id
         WHERE p.referral_code = $1
         ORDER BY b.updated_at DESC
         LIMIT 1`,
        [String(refCode).trim()]
      );
      if (referrerClubRes.rowCount && referrerClubRes.rowCount > 0) {
        activeClubId = referrerClubRes.rows[0].club_id;
      }
    }

    // 1. Find player by phone globally
    const playerResult = await client.query(
      `SELECT id, pin_hash, full_name FROM promo_players WHERE phone_number = $1`,
      [normalizedPhone],
    );

    let playerId;
    let isNewUser = false;

    if (!playerResult.rowCount) {
      isNewUser = true;

      // New player registration check
      if (!fullName) {
        await client.query("ROLLBACK");
        return NextResponse.json({ requiresRegistration: true });
      }

      // If we are actually registering (have fullName), we must have a clubId
      if (!activeClubId) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Для регистрации необходимо ввести код клуба или отсканировать QR-код в клубе" },
          { status: 400 },
        );
      }

      if (!pin || String(pin).length < 4) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "PIN must be at least 4 digits" },
          { status: 400 },
        );
      }

      const pinHash = await bcrypt.hash(String(pin), 10);
      const selfReferralCode = "INV-" + crypto.randomBytes(3).toString("hex").toUpperCase();

      try {
        const newUser = await client.query(
          `INSERT INTO promo_players (phone_number, full_name, pin_hash, referral_code)
                      VALUES ($1, $2, $3, $4) RETURNING id`,
          [normalizedPhone, fullName, pinHash, selfReferralCode],
        );
        playerId = newUser.rows[0].id;

        // Bind referral code if provided
        if (refCode) {
          const referrerRes = await client.query(
            `SELECT id FROM promo_players WHERE referral_code = $1`,
            [String(refCode).trim()]
          );
          if (referrerRes.rowCount && referrerRes.rowCount > 0) {
            const referrerId = referrerRes.rows[0].id;
            if (referrerId !== playerId) {
              await client.query(
                `INSERT INTO promo_referrals (referrer_id, referred_id, status)
                 VALUES ($1, $2, 'registered')
                 ON CONFLICT (referred_id) DO NOTHING`,
                [referrerId, playerId]
              );
            }
          }
        }
      } catch (err: any) {
        if (err.code === "23505") {
          // Unique violation
          const retryResult = await client.query(
            `SELECT id, pin_hash, full_name FROM promo_players WHERE phone_number = $1`,
            [normalizedPhone],
          );
          if ((retryResult.rowCount ?? 0) > 0) {
            playerId = retryResult.rows[0].id;
            await client.query("ROLLBACK");
            return NextResponse.json(
              { error: "Пользователь уже зарегистрирован" },
              { status: 409 },
            );
          }
        }
        throw err;
      }
    } else {
      const player = playerResult.rows[0];

      if (!pin && !fullName) {
        // fullName check is a hack to differentiate initial phone check
        // If no PIN provided, we just return that they need to provide PIN
        // Wait, the frontend checks if `requiresRegistration` is true.
        // If it's false, frontend asks for PIN.
        await client.query("ROLLBACK");
        return NextResponse.json({ requiresRegistration: false });
      }

      if (!pin) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "PIN is required" }, { status: 400 });
      }

      const isValid = await bcrypt.compare(String(pin), player.pin_hash);

      if (!isValid) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Неверный ПИН-код" },
          { status: 401 },
        );
      }

      playerId = player.id;
    }

    let numericClubId;

    if (activeClubId) {
      // Resolve clubId to internal numeric ID if it's a public_id or string ID
      const clubRes = await client.query(
        `SELECT id FROM clubs WHERE id::text = $1 OR UPPER(public_id) = UPPER($1)`,
        [String(activeClubId)],
      );

      if (clubRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Клуб не найден" }, { status: 404 });
      }
      numericClubId = clubRes.rows[0].id;
    } else {
      // If no clubId provided, find the most recent club for this player
      const recentClubResult = await client.query(
        `SELECT club_id FROM promo_player_balances WHERE player_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [playerId],
      );

      if (recentClubResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Клубы не найдены. Отсканируйте QR-код в клубе." },
          { status: 404 },
        );
      }

      numericClubId = recentClubResult.rows[0].club_id;
    }

    // 2. Ensure balance record exists for THIS club
    // (Club already verified if clubId was provided above, but we still need it for consistency or when clubId was NOT provided)
    if (!activeClubId) {
      const clubCheck = await client.query(
        "SELECT id FROM clubs WHERE id = $1",
        [numericClubId],
      );

      if (!clubCheck.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Клуб не найден" }, { status: 404 });
      }
    }

    const balanceUpsert = await client.query(
      `INSERT INTO promo_player_balances (player_id, club_id)
             VALUES ($1, $2)
             ON CONFLICT (player_id, club_id)
             DO UPDATE SET updated_at = NOW()
             RETURNING welcome_bonus_awarded`,
      [playerId, numericClubId],
    );

    const welcomeBonusAlreadyAwarded =
      balanceUpsert.rows[0]?.welcome_bonus_awarded;

    // Issue Welcome Bonus if configured and not yet awarded
    if (isNewUser || !welcomeBonusAlreadyAwarded) {
      const clubRes = await client.query(
        `SELECT promo_settings FROM clubs WHERE id = $1`,
        [numericClubId],
      );
      const settings = clubRes.rows[0]?.promo_settings || {};
      const welcomeTickets = parseInt(settings.welcome_bonus_tickets) || 0;

      if (welcomeTickets > 0 && !welcomeBonusAlreadyAwarded) {
        await client.query(
          `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
           SELECT $1, $2, 'available', 'welcome_bonus', NULL
           FROM generate_series(1, $3)`,
          [playerId, numericClubId, welcomeTickets],
        );

        // Mark as awarded
        await client.query(
          `UPDATE promo_player_balances SET welcome_bonus_awarded = TRUE
           WHERE player_id = $1 AND club_id = $2`,
          [playerId, numericClubId],
        );
      }
    }

    await client.query("COMMIT");

    // Set cookies
    const cookieStore = await cookies();
    cookieStore.set("promo_player_id", String(playerId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    // Also store active club context
    cookieStore.set("promo_active_club_id", String(numericClubId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({
      success: true,
      playerId,
      clubId: numericClubId,
    });
  } catch (error: any) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }
    console.error("Promo Login Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message:
          process.env.NODE_ENV !== "production" ? error.message : undefined,
      },
      { status: 500 },
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
