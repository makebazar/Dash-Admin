import { NextRequest } from 'next/server'
import { registerInventoryEventsClient, unregisterInventoryEventsClient } from '@/lib/inventory-events'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clubId = searchParams.get('clubId')

  if (!clubId) {
    return new Response('Missing clubId', { status: 400 })
  }

  const stream = new ReadableStream({
    start(controller) {
      const client = registerInventoryEventsClient(clubId, controller)

      request.signal.addEventListener('abort', () => {
        unregisterInventoryEventsClient(clubId, client)
      })
    },
    cancel() {
      return undefined
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Отключаем буферизацию nginx
    }
  })
}
