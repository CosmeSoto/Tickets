/**
 * Registro global de conexiones SSE por ticketId.
 * Permite empujar eventos a todos los clientes suscritos a un ticket.
 */

type Subscriber = (data: string) => void

// Map: ticketId → Set de funciones que envían datos al cliente SSE
const subscribers = new Map<string, Set<Subscriber>>()

export const TicketEvents = {
  subscribe(ticketId: string, fn: Subscriber): () => void {
    if (!subscribers.has(ticketId)) {
      subscribers.set(ticketId, new Set())
    }
    subscribers.get(ticketId)!.add(fn)

    // Retorna función de cleanup
    return () => {
      const subs = subscribers.get(ticketId)
      if (subs) {
        subs.delete(fn)
        if (subs.size === 0) subscribers.delete(ticketId)
      }
    }
  },

  emit(ticketId: string, event: { type: string; [key: string]: unknown }) {
    const subs = subscribers.get(ticketId)
    if (!subs || subs.size === 0) return
    const payload = `data: ${JSON.stringify(event)}\n\n`
    subs.forEach(fn => {
      try { fn(payload) } catch { /* cliente desconectado */ }
    })
  },
}
