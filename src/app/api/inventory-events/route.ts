// Server-Sent Events endpoint для POS-обновлений
// Отправляет уведомления при создании/аннулировании чеков

import { NextRequest } from 'next/server'

// Глобальное хранилище клиентов для отправки событий
const clients = new Map<string, Set<{
  controller: ReadableStreamDefaultController
  pingInterval: NodeJS.Timeout
}>>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clubId = searchParams.get('clubId')
  const userId = searchParams.get('userId')

  if (!clubId || !userId) {
    return new Response('Missing clubId or userId', { status: 400 })
  }

  const encoder = new TextEncoder()
  const clientId = `${clubId}-${userId}`

  // Создаем ReadableStream для SSE
  const stream = new ReadableStream({
    start(controller) {
      // Добавляем клиента в хранилище
      if (!clients.has(clientId)) {
        clients.set(clientId, new Set())
      }
      
      // Отправляем начальное событие
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`))

      // Отправляем ping каждые 30 секунд
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'PING', timestamp: Date.now() })}\n\n`))
        } catch (e) {
          // Контроллер закрыт - очищаем интервал
          clearInterval(pingInterval)
        }
      }, 30000)

      clients.get(clientId)!.add({ controller, pingInterval })

      // Очистка при закрытии соединения
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval)
        const clubClients = clients.get(clientId)
        if (clubClients) {
          clubClients.delete({ controller, pingInterval })
          if (clubClients.size === 0) {
            clients.delete(clientId)
          }
        }
      })
    },
    cancel() {
      // Клиент отключился - очищаем ресурсы
      const clubClients = clients.get(clientId)
      if (clubClients) {
        clubClients.forEach(client => {
          clearInterval(client.pingInterval)
          try {
            client.controller.close()
          } catch (e) {
            // Уже закрыт
          }
        })
        clients.delete(clientId)
      }
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

// Функция для отправки события всем клиентам клуба
export function sendToClub(clubId: string, data: any) {
  const encoder = new TextEncoder()

  // Отправляем всем клиентам клуба
  const clubClients = clients.get(clubId)
  if (clubClients) {
    const message = `data: ${JSON.stringify(data)}\n\n`
    clubClients.forEach(client => {
      try {
        client.controller.enqueue(encoder.encode(message))
      } catch (e) {
        // Клиент отключился, удаляем
        clubClients.delete(client)
      }
    })
  }
}

// Экспорт для использования в Server Actions
export const notifyClubClients = sendToClub
