// Global in-memory registry of SSE connections across Next.js route invocations
type SseClient = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  clubId: number;
};

declare global {
  var __cs2SseClients: Map<number, Set<SseClient>> | undefined;
}

if (!global.__cs2SseClients) {
  global.__cs2SseClients = new Map<number, Set<SseClient>>();
}

const clients = global.__cs2SseClients;

export function registerSseClient(
  clubId: number,
  controller: ReadableStreamDefaultController<Uint8Array>
): () => void {
  if (!clients.has(clubId)) {
    clients.set(clubId, new Set());
  }
  const client: SseClient = { controller, clubId };
  clients.get(clubId)!.add(client);

  return () => {
    const set = clients.get(clubId);
    if (set) {
      set.delete(client);
      if (set.size === 0) {
        clients.delete(clubId);
      }
    }
  };
}

export function broadcastSseCommand(clubId: number, command: any): boolean {
  const set = clients.get(clubId);
  if (!set || set.size === 0) return false;

  const payload = `data: ${JSON.stringify(command)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(payload);

  let delivered = false;
  for (const client of Array.from(set)) {
    try {
      client.controller.enqueue(encoded);
      delivered = true;
    } catch {
      set.delete(client);
    }
  }
  return delivered;
}

export function getActiveSseCount(clubId: number): number {
  return clients.get(clubId)?.size || 0;
}
