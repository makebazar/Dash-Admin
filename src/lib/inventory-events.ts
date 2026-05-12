type InventoryEventsClient = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  pingInterval: NodeJS.Timeout;
};

const encoder = new TextEncoder();

// Use globalThis to persist across Next.js hot-reloads in development
const globalForEvents = globalThis as unknown as {
  inventoryEventClients: Map<string, Set<InventoryEventsClient>>;
};

export const inventoryEventClients =
  globalForEvents.inventoryEventClients ||
  new Map<string, Set<InventoryEventsClient>>();
if (process.env.NODE_ENV !== "production") {
  globalForEvents.inventoryEventClients = inventoryEventClients;
}

function formatSseMessage(data: unknown) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export function registerInventoryEventsClient(
  clubId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const client: InventoryEventsClient = {
    controller,
    pingInterval: setInterval(() => {
      try {
        controller.enqueue(
          formatSseMessage({ type: "PING", timestamp: Date.now() }),
        );
      } catch {
        unregisterInventoryEventsClient(clubId, client);
      }
    }, 30000),
  };

  if (!inventoryEventClients.has(clubId)) {
    inventoryEventClients.set(clubId, new Set());
  }

  inventoryEventClients.get(clubId)!.add(client);
  controller.enqueue(
    formatSseMessage({ type: "CONNECTED", timestamp: Date.now() }),
  );
  return client;
}

export function unregisterInventoryEventsClient(
  clubId: string,
  client: InventoryEventsClient,
) {
  clearInterval(client.pingInterval);
  const clubClients = inventoryEventClients.get(clubId);
  if (!clubClients) return;

  clubClients.delete(client);
  if (clubClients.size === 0) {
    inventoryEventClients.delete(clubId);
  }
}

export function notifyInventoryClub(clubId: string, data: unknown) {
  const clubClients = inventoryEventClients.get(clubId);
  if (!clubClients) return;

  const message = formatSseMessage(data);
  for (const client of Array.from(clubClients)) {
    try {
      client.controller.enqueue(message);
    } catch {
      unregisterInventoryEventsClient(clubId, client);
    }
  }
}
