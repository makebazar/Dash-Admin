"use client"

import React, { useEffect, useRef, useCallback, useState, createContext, useContext, ReactNode } from 'react'

interface SSEMessage {
  type: 'RECEIPT_CREATED' | 'RECEIPT_VOIDED' | 'STOCK_UPDATED' | 'PING' | 'CONNECTED'
  receipt?: any
  receiptId?: number
  productId?: number
  newStock?: number
  timestamp: number
}

interface SSEContextType {
  isConnected: boolean
  retryCount: number
  subscribe: (callback: (message: SSEMessage) => void) => () => void
}

const SSEContext = createContext<SSEContextType | null>(null)

/**
 * SSE Provider - создает ОДНО подключение на все приложение
 * Все компоненты подписываются через useSSE
 */
export function SSEProvider({ clubId, userId, children }: { clubId: string, userId: string, children: ReactNode }) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const callbacksRef = useRef<Set<(message: SSEMessage) => void>>(new Set())
  const clubIdRef = useRef(clubId)
  const userIdRef = useRef(userId)

  const MAX_RETRIES = 5
  const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]

  const connect = useCallback(() => {
    if (eventSourceRef.current) return

    const sseUrl = `/api/inventory-events?clubId=${clubIdRef.current}&userId=${userIdRef.current}`

    try {
      const es = new EventSource(sseUrl)
      eventSourceRef.current = es

      es.onopen = () => {
        setIsConnected(true)
        setRetryCount(0)
      }

      es.onmessage = (event) => {
        try {
          const data: SSEMessage = JSON.parse(event.data)
          callbacksRef.current.forEach(cb => cb(data))
        } catch (e) {
          // Игнорируем ошибки парсинга
        }
      }

      es.onerror = (error) => {
        // Тихая ошибка - SSE endpoint может не существовать
        setIsConnected(false)

        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }

        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)]
          
          setTimeout(() => {
            setRetryCount(prev => prev + 1)
            connect()
          }, delay)
        }
      }
    } catch (e) {
      // Тихая ошибка подключения
    }
  }, [retryCount])

  // Подключение при монтировании
  useEffect(() => {
    connect()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [connect])

  const subscribe = useCallback((callback: (message: SSEMessage) => void) => {
    callbacksRef.current.add(callback)
    return () => {
      callbacksRef.current.delete(callback)
    }
  }, [])

  return (
    <SSEContext.Provider value={{ isConnected, retryCount, subscribe }}>
      {children}
    </SSEContext.Provider>
  )
}

/**
 * Хук для подписки на SSE события
 * Использует ОДНО подключение на все приложение
 */
export function useSSE(onMessage?: (message: SSEMessage) => void) {
  const context = useContext(SSEContext)
  
  if (!context) {
    throw new Error('useSSE must be used within SSEProvider')
  }

  // Подписка при монтировании
  useEffect(() => {
    if (!onMessage) return
    return context.subscribe(onMessage)
  }, [context, onMessage])

  return context
}

// Для обратной совместимости
export function usePOSSSE({ clubId, userId, onMessage, enabled = true }: { 
  clubId: string, 
  userId: string, 
  onMessage?: (message: SSEMessage) => void,
  enabled?: boolean 
}) {
  const context = useContext(SSEContext)
  
  // Если Provider не установлен, используем fallback (старое поведение)
  if (!context) {
    const [isConnected, setIsConnected] = useState(false)
    const [retryCount, setRetryCount] = useState(0)
    const eventSourceRef = useRef<EventSource | null>(null)

    useEffect(() => {
      if (!enabled) return

      const sseUrl = `/api/inventory-events?clubId=${clubId}&userId=${userId}`
      const es = new EventSource(sseUrl)
      eventSourceRef.current = es

      es.onopen = () => setIsConnected(true)
      es.onmessage = (event) => {
        try {
          const data: SSEMessage = JSON.parse(event.data)
          onMessage?.(data)
        } catch (e) {
          console.error('[SSE Fallback] Parse error:', e)
        }
      }
      es.onerror = () => {
        setIsConnected(false)
        es.close()
      }

      return () => {
        es.close()
      }
    }, [clubId, userId, enabled, onMessage])

    return { isConnected, retryCount, reconnect: () => {} }
  }

  // Используем общее подключение
  useEffect(() => {
    if (!onMessage) return
    return context.subscribe(onMessage)
  }, [context, onMessage])

  return context
}

export const usePOSWebSocket = usePOSSSE
