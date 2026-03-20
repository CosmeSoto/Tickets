'use client'

import { useEffect, useRef } from 'react'

export function useTicketSSE(ticketId: string, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  useEffect(() => {
    if (!ticketId) return
    console.log(`[SSE-CLIENT] Conectando a ticket ${ticketId}`)

    let es: EventSource | null = null
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let retries = 0

    const connect = () => {
      es = new EventSource(`/api/tickets/${ticketId}/events`)

      es.onmessage = (e) => {
        console.log(`[SSE-CLIENT] Mensaje recibido:`, e.data)
        try {
          const data = JSON.parse(e.data)
          if (data.type !== 'connected') {
            console.log(`[SSE-CLIENT] Llamando onUpdate para evento: ${data.type}`)
            onUpdateRef.current()
          }
        } catch { /* ignorar mensajes malformados */ }
      }

      es.onerror = (err) => {
        console.log(`[SSE-CLIENT] Error, reconectando...`, err)
        es?.close()
        es = null
        const delay = Math.min(1000 * 2 ** retries, 30_000)
        retries++
        retryTimeout = setTimeout(connect, delay)
      }

      es.onopen = () => {
        console.log(`[SSE-CLIENT] Conexión abierta para ticket ${ticketId}`)
        retries = 0
      }
    }

    connect()

    return () => {
      console.log(`[SSE-CLIENT] Desconectando ticket ${ticketId}`)
      if (retryTimeout) clearTimeout(retryTimeout)
      es?.close()
    }
  }, [ticketId])
}
