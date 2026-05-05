import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { requireClubApiAccess } from "@/lib/club-api-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  await requireClubApiAccess(clubId);

  const encoder = new TextEncoder();
  let closed = false;
  let dbClient: Awaited<ReturnType<typeof getClient>> | null = null;
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
            if (msg.payload === clubId) {
              sendEvent("update", { ts: Date.now() });
            }
          };
          dbClient.on("notification", notificationHandler);
          await dbClient.query(`LISTEN employee_requests_updates`);
          sendEvent("ready", { ok: true });
        } catch {
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
        await dbClient.query(`UNLISTEN employee_requests_updates`);
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
