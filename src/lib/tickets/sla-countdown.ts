/**
 * Formateo compartido del tiempo restante de SLA (`tickets.slaDeadline`).
 *
 * El sistema ya calcula un `slaDeadline` real (ver SLAService.assignSLA),
 * pero hasta ahora nunca se mostraba en ningún lado — ni en el detalle del
 * ticket, ni en las notificaciones de asignación, ni en las tablas. Este
 * util centraliza el formateo para que todos esos lugares lo muestren igual.
 */

export type SlaUrgency = 'ok' | 'warning' | 'overdue' | 'none'

export interface SlaCountdown {
  /** Texto listo para mostrar, p. ej. "Vence en 3h 20min" o "Vencido hace 2h". */
  label: string
  /** Nivel de urgencia para colorear (verde/ámbar/rojo). 'none' = sin SLA aplicable. */
  urgency: SlaUrgency
}

const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
/** Umbral por debajo del cual se considera "por vencer" (ámbar) en vez de "en curso" (verde). */
const WARNING_THRESHOLD_MS = 4 * HOUR_MS

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / MINUTE_MS)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours <= 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

/**
 * Calcula el estado del SLA de un ticket en un momento dado.
 *
 * @param slaDeadline `ticket.slaDeadline` — null si el ticket no tiene SLA
 *   aplicable (sin política configurada) o aún no se le asignó ninguna.
 * @param resolvedAt `ticket.resolvedAt`/`closedAt` — si el ticket ya está
 *   resuelto/cerrado, el SLA deja de "correr" y no tiene sentido mostrar un
 *   countdown en vivo.
 */
export function getSlaCountdown(
  slaDeadline: Date | string | null | undefined,
  resolvedAt: Date | string | null | undefined,
  now: Date = new Date()
): SlaCountdown {
  if (!slaDeadline) {
    return { label: 'Sin SLA configurado', urgency: 'none' }
  }

  const deadline = new Date(slaDeadline)

  if (resolvedAt) {
    const resolved = new Date(resolvedAt)
    if (resolved.getTime() > deadline.getTime()) {
      return {
        label: `Resuelto fuera de SLA (${formatDuration(resolved.getTime() - deadline.getTime())} tarde)`,
        urgency: 'overdue',
      }
    }
    return { label: 'Resuelto dentro de SLA', urgency: 'ok' }
  }

  const diffMs = deadline.getTime() - now.getTime()

  if (diffMs <= 0) {
    return { label: `Vencido hace ${formatDuration(-diffMs)}`, urgency: 'overdue' }
  }

  if (diffMs <= WARNING_THRESHOLD_MS) {
    return { label: `Vence en ${formatDuration(diffMs)}`, urgency: 'warning' }
  }

  return { label: `Vence en ${formatDuration(diffMs)}`, urgency: 'ok' }
}
