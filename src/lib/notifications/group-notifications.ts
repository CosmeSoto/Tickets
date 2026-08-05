/**
 * Agrupa notificaciones del inbox por entidad (ticket, equipo, ronda, etc.).
 */

import type { NotificationData } from '@/contexts/notifications-context'
import { buildEntityKey } from '@/lib/notifications/entity-key'
import { getTypeConfig } from '@/lib/notifications/notification-types'

export type NotificationGroupKey =
  | `ticket:${string}`
  | `equipment:${string}`
  | `patrol:${string}`
  | `act:${string}`
  | `maintenance:${string}`
  | `single:${string}`

export interface NotificationGroup {
  key: NotificationGroupKey
  label: string
  subtitle?: string
  module: 'tickets' | 'inventory' | 'patrols' | 'other'
  unreadCount: number
  latestAt: string
  notifications: NotificationData[]
  /** Clave usable para silenciar el hilo (null si es single suelto) */
  muteKey: string | null
}

function entityMeta(n: NotificationData): {
  key: NotificationGroupKey
  label: string
  subtitle?: string
  module: NotificationGroup['module']
  muteKey: string | null
} {
  const muteKey = buildEntityKey({ ticketId: n.ticketId, metadata: n.metadata })
  if (muteKey) {
    const kind = muteKey.split(':')[0]
    const notificationModule =
      kind === 'ticket'
        ? 'tickets'
        : kind === 'patrol'
          ? 'patrols'
          : kind === 'equipment' || kind === 'act' || kind === 'maintenance'
            ? 'inventory'
            : 'other'
    return {
      key: muteKey as NotificationGroupKey,
      label: n.tickets?.title || n.title,
      subtitle:
        kind === 'ticket'
          ? `Ticket #${muteKey.split(':')[1]?.slice(-6)}`
          : kind === 'equipment'
            ? 'Equipo de inventario'
            : kind === 'act'
              ? 'Acta de inventario'
              : kind === 'maintenance'
                ? 'Mantenimiento'
                : 'Ronda',
      module: notificationModule,
      muteKey,
    }
  }

  const cfg = getTypeConfig(n.type)
  return {
    key: `single:${n.id}`,
    label: n.title,
    subtitle: cfg.label,
    module: 'other',
    muteKey: null,
  }
}

/** Agrupa manteniendo orden por actividad más reciente del grupo. */
export function groupNotifications(notifications: NotificationData[]): NotificationGroup[] {
  const map = new Map<string, NotificationGroup>()

  for (const n of notifications) {
    const meta = entityMeta(n)
    const existing = map.get(meta.key)
    if (!existing) {
      map.set(meta.key, {
        key: meta.key,
        label: meta.label,
        subtitle: meta.subtitle,
        module: meta.module,
        unreadCount: n.isRead ? 0 : 1,
        latestAt: n.createdAt,
        notifications: [n],
        muteKey: meta.muteKey,
      })
      continue
    }

    existing.notifications.push(n)
    if (!n.isRead) existing.unreadCount += 1
    if (new Date(n.createdAt).getTime() > new Date(existing.latestAt).getTime()) {
      existing.latestAt = n.createdAt
      if (n.tickets?.title) existing.label = n.tickets.title
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
  )
}
