import { registerSseClient } from "@/lib/cs2/sse";
import { query } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const parsedClubId = parseInt(clubId, 10);
  if (isNaN(parsedClubId)) {
    return new Response("Invalid club ID", { status: 400 });
  }

  // Verify club exists
  const clubRes = await query(`SELECT id, name FROM clubs WHERE id = $1`, [parsedClubId]);
  if (!clubRes.rowCount || clubRes.rowCount === 0) {
    return new Response("Club not found", { status: 404 });
  }

  let cleanup: (() => void) | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      // Register client for instant broadcasts
      cleanup = registerSseClient(parsedClubId, controller);

      // Send initial hello
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ club_id: parsedClubId, time: Date.now() })}\n\n`)
      );

      // Keepalive ping every 15s to prevent proxies from terminating idle connections
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      }, 15000);
    },
    cancel() {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
