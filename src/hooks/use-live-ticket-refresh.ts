'use client'

import { useEffect, useRef } from 'react'

/**
 * Recarga métricas y listados en cuanto hay un cambio de ticket:
 * SSE global, eventos locales (mismo navegador) y al volver a la pestaña.
 */
export function useLiveTicketRefresh(onUpdate: () => void, enabled = true) {
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    if (!enabled) return

    let debounce: ReturnType<typeof setTimeout> | null = null
    const fire = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => onUpdateRef.current(), 350)
    }

    window.addEventListener('ticket-created', fire)
    window.addEventListener('ticket-updated', fire)

    let es: EventSource | null = null
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let retries = 0

    const connect = () => {
      es = new EventSource('/api/dashboard/events')
      es.onmessage = e => {
        try {
          const data = JSON.parse(e.data)
          if (data.type && data.type !== 'connected') fire()
        } catch {
          /* mensaje malformado */
        }
      }
      es.onerror = () => {
        es?.close()
        es = null
        const delay = Math.min(1000 * 2 ** retries, 30_000)
        retries++
        retryTimeout = setTimeout(connect, delay)
      }
      es.onopen = () => {
        retries = 0
      }
    }

    connect()

    const onVisible = () => {
      if (!document.hidden) fire()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (debounce) clearTimeout(debounce)
      if (retryTimeout) clearTimeout(retryTimeout)
      es?.close()
      window.removeEventListener('ticket-created', fire)
      window.removeEventListener('ticket-updated', fire)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled])
}
