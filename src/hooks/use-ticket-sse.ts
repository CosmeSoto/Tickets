'use client'

import { useEffect, useRef } from 'react'

/**
 * Suscribe al stream SSE de un ticket y llama onUpdate cuando llega
 * un evento relevante (comment_added, status_changed, etc.)
 */
export function useTicketSSE(ticketId: string, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  useEffect(() => {
    if (!ticketId) return

    let es: EventSource | null = null
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let retries = 0

    const connect = () => {
      es = new EventSource(`/api/tickets/${ticketId}/events`)

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          // Recargar en cualquier evento relevante (no heartbeat)
          if (data.type && data.type !== 'connected') {
            onUpdateRef.current()
          }
        } catch { /* ignorar mensajes malformados */ }
      }

      es.onerror = () => {
        es?.close()
        es = null
        const delay = Math.min(1000 * 2 ** retries, 30_000)
        retries++
        retryTimeout = setTimeout(connect, delay)
      }

      es.onopen = () => { retries = 0 }
    }

    connect()

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout)
      es?.close()
    }
  }, [ticketId])
}
