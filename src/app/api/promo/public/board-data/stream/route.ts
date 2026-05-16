import { getClient } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clubId = searchParams.get("clubId");

  if (!clubId) {
    return new Response("clubId is required", { status: 400 });
  }

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  const dbClient = await getClient();

  const sendEvent = async (data: any) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch (e) {
      // ignore
    }
  };

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    sendEvent({ type: "heartbeat" });
  }, 30000);

  const setupListener = async () => {
    try {
      await dbClient.query(`LISTEN promo_queue_updates`);

      dbClient.on("notification", async (msg) => {
        if (msg.channel === "promo_queue_updates" && msg.payload === clubId) {
          // A new win happened in this club. Fetch the latest one.
          try {
            const winRes = await dbClient.query(
              `SELECT
                h.id,
                COALESCE(p.full_name, regexp_replace(p.phone_number, '(\\d{4})\\d+(\\d{2})', '\\1****\\2')) as player,
                prz.name as prize,
                prz.type as type
              FROM promo_history h
              JOIN promo_players p ON h.player_id = p.id
              JOIN promo_prizes prz ON h.prize_id = prz.id
              WHERE h.club_id = $1 AND h.prize_id IS NOT NULL
              ORDER BY h.created_at DESC
              LIMIT 1`,
              [clubId],
            );
            if (winRes.rowCount) {
              await sendEvent({
                type: "new_win",
                win: {
                  ...winRes.rows[0],
                  time: "Только что",
                },
              });
            }
          } catch (e) {
            console.error("Stream fetch error:", e);
          }
        }
      });
    } catch (e) {
      console.error("SSE Setup Error:", e);
    }
  };

  setupListener();

  request.signal.addEventListener("abort", async () => {
    clearInterval(heartbeat);
    try {
      await dbClient.query(`UNLISTEN promo_queue_updates`);
      dbClient.release();
      await writer.close();
    } catch (e) {
      // ignore
    }
  });

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
