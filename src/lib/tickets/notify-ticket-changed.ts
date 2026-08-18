import { invalidateCache } from '@/lib/api-cache'
import { TicketEvents } from '@/lib/ticket-events'

const TICKET_CACHE_KEYS = [
  'tickets:role=ADMIN*',
  'tickets:role=TECHNICIAN*',
  'tickets:role=CLIENT*',
  'dashboard:*',
]

export async function invalidateTicketCaches() {
  await invalidateCache(TICKET_CACHE_KEYS).catch(() => {})
}

/**
 * Invalida caché de listados/dashboard y avisa por SSE
 * (detalle del ticket + métricas de todos los roles).
 */
export function notifyTicketChanged(
  ticketId: string | null,
  type: string,
  extra?: Record<string, unknown>
) {
  void invalidateTicketCaches()
  if (ticketId) {
    TicketEvents.emit(ticketId, { type, ...extra })
  } else {
    TicketEvents.emitMetrics({ type, ...extra })
  }
}
