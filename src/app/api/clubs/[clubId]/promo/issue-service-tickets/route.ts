import { NextResponse } from "next/server";
import { getClient, query } from "@/db";
import { cookies } from "next/headers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const { playerId, ruleId } = await request.json();
  const userId = (await cookies()).get("session_user_id")?.value;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    // 1. Get promo settings to find the rule
    const clubRes = await client.query(
      `SELECT promo_settings, timezone FROM clubs WHERE id = $1`,
      [clubId],
    );
    const settings = clubRes.rows[0]?.promo_settings || {};
    const timezone = clubRes.rows[0]?.timezone || "Europe/Moscow";
    const rules = settings.service_rules || [];
    const rule = rules.find((r: any) => r.id === ruleId);

    if (!rule) {
      throw new Error("Правило не найдено");
    }

    // 2. Validate day and time in club's timezone
    let clubTime: { day: number; time: number } | null = null;
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
        weekday: "short",
      });
      const parts = formatter.formatToParts(new Date());
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
      const minute = parseInt(
        parts.find((p) => p.type === "minute")?.value || "0",
      );
      const weekdayStr = parts.find((p) => p.type === "weekday")?.value;
      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      clubTime = {
        day: weekdays.indexOf(weekdayStr || ""),
        time: hour * 100 + minute,
      };
    } catch (e) {
      console.error("Failed to calculate club time for validation", e);
    }

    if (clubTime) {
      const isDayValid = rule.days.includes(clubTime.day);
      const [startH, startM] = rule.time_start.split(":").map(Number);
      const [endH, endM] = rule.time_end.split(":").map(Number);
      const startTime = startH * 100 + startM;
      const endTime = endH * 100 + endM;

      let isTimeValid = false;
      if (startTime <= endTime) {
        isTimeValid = clubTime.time >= startTime && clubTime.time <= endTime;
      } else {
        isTimeValid = clubTime.time >= startTime || clubTime.time <= endTime;
      }

      if (!isDayValid || !isTimeValid) {
        console.warn(
          `Manual service award outside of schedule: ${rule.name} (Club: ${clubId}, Admin: ${userId})`,
        );
        // We allow manual issuance even if off-schedule, but we could add more logic here if needed.
      }
    }

    // 3. Issue tickets
    const expiryHours = settings.ticket_expiry_hours || 24;
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + expiryHours);

    await client.query(
      `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
          SELECT $1, $2, 'available', 'service_award', $3
          FROM generate_series(1, $4)`,
      [playerId, clubId, expiryDate, rule.tickets],
    );

    // 4. Log in promo_history
    await client.query(
      `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'SERVICE_AWARD', $3)`,
      [
        playerId,
        clubId,
        JSON.stringify({
          rule_id: rule.id,
          rule_name: rule.name,
          tickets: rule.tickets,
          processed_by: userId,
        }),
      ],
    );

    // 5. Process Quests
    const { processServiceAwardEvent } = await import("@/lib/promo-quests");
    await processServiceAwardEvent(client, clubId, playerId, rule.id);

    await client.query("COMMIT");

    // Notify updates
    await query(`SELECT pg_notify('promo_queue_updates', $1)`, [clubId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Issue Service Tickets Error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  } finally {
    client.release();
  }
}
