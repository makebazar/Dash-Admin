import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const playerId = cookieStore.get("promo_player_id")?.value;
  const activeClubId = cookieStore.get("promo_active_club_id")?.value;

  if (!playerId || !activeClubId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let dbClient: any = null;
  let notificationHandler: ((msg: { payload?: string }) => void) | null = null;
  let pingTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, payload: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
          ),
        );
      };

      const setupListener = async () => {
        try {
          dbClient = await getClient();
          notificationHandler = (msg: { payload?: string }) => {
            if (!msg.payload) return;
            // When promo_queue_updates is triggered for this club
            if (msg.payload === String(activeClubId)) {
              sendEvent("update", { ts: Date.now() });
            }
          };
          dbClient.on("notification", notificationHandler);
          await dbClient.query(`LISTEN promo_queue_updates`);
          sendEvent("ready", { ok: true });
        } catch (e) {
          console.error("Player SSE Setup Error:", e);
          sendEvent("ready", { ok: false });
        }
      };

      setupListener();
      pingTimer = setInterval(() => {
        if (!closed) sendEvent("ping", { ts: Date.now() });
      }, 15000);
    },
    async cancel() {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      if (dbClient) {
        if (notificationHandler) {
          dbClient.off("notification", notificationHandler);
        }
        await dbClient.query(`UNLISTEN promo_queue_updates`);
        dbClient.release();
        dbClient = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
