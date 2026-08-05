/**
 * Claves de entidad para agrupar / silenciar hilos de notificación.
 */

export type NotificationEntityKey =
  | `ticket:${string}`
  | `equipment:${string}`
  | `patrol:${string}`
  | `act:${string}`
  | `maintenance:${string}`

export function buildEntityKey(input: {
  ticketId?: string | null
  metadata?: Record<string, any> | null
}): NotificationEntityKey | null {
  const meta = input.metadata ?? {}
  if (input.ticketId || meta.ticketId) {
    return `ticket:${String(input.ticketId || meta.ticketId)}`
  }
  if (meta.equipmentId) return `equipment:${String(meta.equipmentId)}`
  if (meta.actId) return `act:${String(meta.actId)}`
  if (meta.maintenanceId) return `maintenance:${String(meta.maintenanceId)}`
  if (meta.patrolId || meta.scheduleId) {
    return `patrol:${String(meta.patrolId || meta.scheduleId)}`
  }
  return null
}

export function parseEntityKey(entityKey: string): { kind: string; id: string } | null {
  const idx = entityKey.indexOf(':')
  if (idx <= 0) return null
  return { kind: entityKey.slice(0, idx), id: entityKey.slice(idx + 1) }
}

export function entityKeyLabel(entityKey: string): string {
  const parsed = parseEntityKey(entityKey)
  if (!parsed) return entityKey
  switch (parsed.kind) {
    case 'ticket':
      return `Ticket #${parsed.id.slice(-6)}`
    case 'equipment':
      return 'Equipo'
    case 'act':
      return 'Acta'
    case 'maintenance':
      return 'Mantenimiento'
    case 'patrol':
      return 'Ronda'
    default:
      return entityKey
  }
}
