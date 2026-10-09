import { getClient } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;
  const parsedTournamentId = parseInt(tournamentId);
  if (isNaN(parsedTournamentId)) {
    return new Response("Invalid tournament ID", { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let dbClient: any = null;
  let notificationHandler: ((msg: { channel: string; payload?: string }) => void) | null = null;
  let pingTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, payload: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
          )
        );
      };

      const setupListener = async () => {
        try {
          dbClient = await getClient();
          notificationHandler = (msg: { channel: string; payload?: string }) => {
            if (!msg.payload) return;
            // Trigger update if notification belongs to this tournament
            if (
              msg.payload === String(parsedTournamentId) ||
              msg.payload === "all"
            ) {
              sendEvent("update", { tournamentId: parsedTournamentId, ts: Date.now() });
            }
          };

          dbClient.on("notification", notificationHandler);
          await dbClient.query(`LISTEN tournament_updates`);

          // Send initial ready event
          sendEvent("ready", { ok: true, tournamentId: parsedTournamentId });
        } catch (e) {
          console.error("Tournament SSE Setup Error:", e);
          sendEvent("ready", { ok: false });
        }
      };

      setupListener();

      // Keepalive ping every 15 seconds
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
        await dbClient.query(`UNLISTEN tournament_updates`).catch(() => {});
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
