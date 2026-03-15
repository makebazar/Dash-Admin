// WebSocket сервер для POS-обновлений в реальном времени
// Отправляет уведомления при создании/аннулировании чеков

import { WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { query } from '@/db'

// Глобальное хранилище WebSocket соединений
const clients = new Map<string, Set<any>>()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clubId = searchParams.get('clubId')
  const userId = searchParams.get('userId')

  if (!clubId || !userId) {
    return new Response('Missing clubId or userId', { status: 400 })
  }

  // Для WebSocket используем кастомный ответ
  // Примечание: Next.js не поддерживает нативные WebSocket, 
  // поэтому используем external WebSocket сервер
  
  return new Response('WebSocket endpoint - use external server', { status: 200 })
}

// Экспорт функций для управления подключениями
export function subscribeToClub(clubId: string, ws: any) {
  if (!clients.has(clubId)) {
    clients.set(clubId, new Set())
  }
  clients.get(clubId)!.add(ws)
}

export function unsubscribeFromClub(clubId: string, ws: any) {
  const clubClients = clients.get(clubId)
  if (clubClients) {
    clubClients.delete(ws)
    if (clubClients.size === 0) {
      clients.delete(clubId)
    }
  }
}

export function notifyClub(clubId: string, data: any) {
  const clubClients = clients.get(clubId)
  if (clubClients) {
    const message = JSON.stringify(data)
    clubClients.forEach(ws => {
      if (ws.readyState === 1) { // OPEN
        ws.send(message)
      }
    })
  }
}

// Server Action для отправки уведомления при создании чека
export async function sendReceiptNotification(clubId: string, receipt: any) {
  notifyClub(clubId, {
    type: 'RECEIPT_CREATED',
    receipt,
    timestamp: Date.now()
  })
}

// Server Action для отправки уведомления при аннулировании чека
export async function sendReceiptVoidNotification(clubId: string, receiptId: number) {
  notifyClub(clubId, {
    type: 'RECEIPT_VOIDED',
    receiptId,
    timestamp: Date.now()
  })
}

// Server Action для отправки уведомления об изменении остатков
export async function sendStockUpdateNotification(clubId: string, productId: number, newStock: number) {
  notifyClub(clubId, {
    type: 'STOCK_UPDATED',
    productId,
    newStock,
    timestamp: Date.now()
  })
}
