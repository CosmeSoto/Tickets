/**
 * Registro global de conexiones SSE por ticketId.
 * Usa globalThis para sobrevivir hot-reload de Turbopack y compartir
 * el Map entre diferentes API routes en el mismo proceso Node.js.
 */

type Subscriber = (data: string) => void

const GLOBAL_KEY = '__ticketEventSubscribers__'

/** Canal de métricas / listados: cualquier mutación de ticket avisa a dashboards y listas. */
export const TICKET_METRICS_CHANNEL = '__ticket_metrics__'

function getSubscribers(): Map<string, Set<Subscriber>> {
  if (!(globalThis as any)[GLOBAL_KEY]) {
    ;(globalThis as any)[GLOBAL_KEY] = new Map<string, Set<Subscriber>>()
  }
  return (globalThis as any)[GLOBAL_KEY]
}

function notify(channel: string, payload: string) {
  const subs = getSubscribers().get(channel)
  if (!subs || subs.size === 0) return
  subs.forEach(fn => {
    try {
      fn(payload)
    } catch {
      /* cliente desconectado */
    }
  })
}

export const TicketEvents = {
  subscribe(ticketId: string, fn: Subscriber): () => void {
    const subscribers = getSubscribers()
    if (!subscribers.has(ticketId)) {
      subscribers.set(ticketId, new Set())
    }
    subscribers.get(ticketId)!.add(fn)

    return () => {
      const subs = subscribers.get(ticketId)
      if (subs) {
        subs.delete(fn)
        if (subs.size === 0) subscribers.delete(ticketId)
      }
    }
  },

  emit(ticketId: string, event: { type: string; [key: string]: unknown }) {
    const payload = `data: ${JSON.stringify({ ...event, ticketId })}\n\n`
    notify(ticketId, payload)
    notify(TICKET_METRICS_CHANNEL, payload)
  },

  emitMetrics(event: { type: string; [key: string]: unknown }) {
    const payload = `data: ${JSON.stringify(event)}\n\n`
    notify(TICKET_METRICS_CHANNEL, payload)
  },
}
