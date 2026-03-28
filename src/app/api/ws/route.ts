export async function GET(request: Request) {
  void request
  return new Response('WebSocket endpoint is disabled. Use /api/inventory-events for live updates.', { status: 200 })
}
