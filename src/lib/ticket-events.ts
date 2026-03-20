/**
 * Registro global de conexiones SSE por ticketId.
 * Usa globalThis para sobrevivir hot-reload de Turbopack y compartir
 * el Map entre diferentes API routes en el mismo proceso Node.js.
 */

type Subscriber = (data: string) => void

// Clave única en globalThis para evitar colisiones
const GLOBAL_KEY = '__ticketEventSubscribers__'

function getSubscribers(): Map<string, Set<Subscriber>> {
  if (!(globalThis as any)[GLOBAL_KEY]) {
    ;(globalThis as any)[GLOBAL_KEY] = new Map<string, Set<Subscriber>>()
  }
  return (globalThis as any)[GLOBAL_KEY]
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
    const subscribers = getSubscribers()
    const subs = subscribers.get(ticketId)
    if (!subs || subs.size === 0) {
      console.log(`[SSE] No hay suscriptores para ticket ${ticketId}`)
      return
    }
    console.log(`[SSE] Emitiendo '${event.type}' a ${subs.size} suscriptor(es) del ticket ${ticketId}`)
    const payload = `data: ${JSON.stringify(event)}\n\n`
    subs.forEach(fn => {
      try { fn(payload) } catch { /* cliente desconectado */ }
    })
  },
}
