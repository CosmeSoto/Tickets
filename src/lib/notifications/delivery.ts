/**
 * Lógica de decisión de entrega: preferencias por módulo, horas silenciosas y Web Push.
 * Usada por NotificationService (servidor).
 */

import prisma from '@/lib/prisma'
import { NotificationType } from '@prisma/client'
import { randomUUID } from 'crypto'
import { getAppTimezone } from '@/lib/utils/date-utils'
import { isNotificationMuted } from '@/lib/notifications/mute-service'

export type NotificationSpecificType =
  | 'ticketCreated'
  | 'ticketAssigned'
  | 'statusChanged'
  | 'newComments'
  | 'ticketUpdates'

export type NotificationModule = 'tickets' | 'inventory' | 'patrols' | 'system'

export interface DeliveryDecision {
  /** Crear registro in-app + emitir SSE */
  allowInApp: boolean
  /** Enviar Web Push si no hay SSE activo */
  allowWebPush: boolean
}

/** Hora local HH:mm en la zona del usuario (o del sistema). */
export function getLocalTimeHHMM(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || getAppTimezone(),
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date())

    let hour = parts.find(p => p.type === 'hour')?.value ?? '00'
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00'
    if (hour === '24') hour = '00'
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  } catch {
    const now = new Date()
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  }
}

/** true si currentTime está dentro del rango [start, end], soportando cruce de medianoche. */
export function isWithinQuietHours(currentTime: string, start: string, end: string): boolean {
  if (start === end) return false
  if (start < end) {
    return currentTime >= start && currentTime <= end
  }
  return currentTime >= start || currentTime <= end
}

/**
 * Resuelve el módulo de origen de una notificación para gates de preferencia.
 */
export function resolveNotificationModule(options: {
  type: NotificationType | string
  specificType?: NotificationSpecificType
  ticketId?: string | null
  metadata?: Record<string, any> | null
}): NotificationModule {
  const type = options.type
  const meta = options.metadata ?? {}
  const link = typeof meta.link === 'string' ? meta.link : ''

  if (
    type === 'PATROL_MISSED' ||
    type === 'PATROL_INCOMPLETE' ||
    type === 'PATROL_ASSIGNED' ||
    type === 'OFFLINE_SYNC_REJECTED' ||
    meta.patrolId ||
    meta.scheduleId ||
    meta.routeId ||
    meta.incidentId ||
    link.includes('/patrol')
  ) {
    return 'patrols'
  }

  if (
    type === 'INVENTORY' ||
    meta.equipmentId ||
    meta.actId ||
    meta.maintenanceId ||
    meta.batchId ||
    link.includes('/inventory')
  ) {
    return 'inventory'
  }

  if (
    type === 'TICKET_FAMILY_CHANGE' ||
    options.specificType ||
    options.ticketId ||
    meta.ticketId ||
    link.includes('/tickets/')
  ) {
    return 'tickets'
  }

  return 'system'
}

/**
 * Evalúa preferencias del usuario.
 * 1) force → todo
 * 2) master por módulo (tickets / inventario / rondas) o systemAlerts
 * 3) preferencias finas de tickets (si aplica)
 * 4) pushNotifications + quiet hours → Web Push
 */
export async function evaluateDelivery(
  userId: string,
  options: {
    type: NotificationType | string
    specificType?: NotificationSpecificType
    force?: boolean
    ticketId?: string | null
    metadata?: Record<string, any> | null
  }
): Promise<DeliveryDecision> {
  if (options.force) {
    return { allowInApp: true, allowWebPush: true }
  }

  try {
    // Silenciar hilo (mute/snooze por entidad) — salvo force
    const muted = await isNotificationMuted(userId, {
      ticketId: options.ticketId,
      metadata: options.metadata,
    })
    if (muted) {
      return { allowInApp: false, allowWebPush: false }
    }

    const prefs = await prisma.user_settings.findUnique({
      where: { userId },
      select: {
        pushNotifications: true,
        ticketCreated: true,
        ticketAssigned: true,
        statusChanged: true,
        newComments: true,
        ticketUpdated: true,
        ticketUpdates: true,
        systemAlerts: true,
        notifyTickets: true,
        notifyInventory: true,
        notifyPatrols: true,
        quietHoursEnabled: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        timezone: true,
      },
    })

    if (!prefs) {
      prisma.user_settings
        .upsert({
          where: { userId },
          update: {},
          create: {
            id: randomUUID(),
            userId,
            emailNotifications: true,
            pushNotifications: true,
            ticketCreated: true,
            ticketAssigned: true,
            statusChanged: true,
            newComments: true,
            ticketUpdated: true,
            ticketUpdates: true,
            systemAlerts: true,
            notifyTickets: true,
            notifyInventory: true,
            notifyPatrols: true,
            weeklyReport: false,
            soundEnabled: true,
            quietHoursEnabled: false,
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00',
            autoAssignEnabled: true,
            maxConcurrentTickets: 10,
            theme: 'light',
            language: 'es',
            timezone: getAppTimezone(),
            updatedAt: new Date(),
          },
        })
        .catch(err => console.error('[NOTIFICATION] Error creating default settings:', err))
      return { allowInApp: true, allowWebPush: true }
    }

    const notificationModule = resolveNotificationModule(options)

    // Master por módulo
    let allowInApp = true
    if (notificationModule === 'tickets') {
      allowInApp = prefs.notifyTickets !== false
    } else if (notificationModule === 'inventory') {
      allowInApp = prefs.notifyInventory !== false
    } else if (notificationModule === 'patrols') {
      allowInApp = prefs.notifyPatrols !== false
    } else {
      allowInApp = prefs.systemAlerts
    }

    // Preferencias finas (tickets / eventos tipados)
    if (allowInApp && options.specificType) {
      switch (options.specificType) {
        case 'ticketCreated':
          allowInApp = prefs.ticketCreated
          break
        case 'ticketAssigned':
          allowInApp = prefs.ticketAssigned
          break
        case 'statusChanged':
          allowInApp = prefs.statusChanged
          break
        case 'newComments':
          allowInApp = prefs.newComments
          break
        case 'ticketUpdates':
          allowInApp = prefs.ticketUpdated && prefs.ticketUpdates
          break
      }
    } else if (allowInApp && options.type === 'TICKET_FAMILY_CHANGE') {
      allowInApp = prefs.ticketUpdated && prefs.ticketUpdates
    }

    if (!allowInApp) {
      return { allowInApp: false, allowWebPush: false }
    }

    let allowWebPush = prefs.pushNotifications
    if (allowWebPush && prefs.quietHoursEnabled && prefs.quietHoursStart && prefs.quietHoursEnd) {
      const tz = prefs.timezone || getAppTimezone()
      const currentTime = getLocalTimeHHMM(tz)
      if (isWithinQuietHours(currentTime, prefs.quietHoursStart, prefs.quietHoursEnd)) {
        allowWebPush = false
      }
    }

    return { allowInApp: true, allowWebPush }
  } catch (error) {
    console.error('[NOTIFICATION] Error checking preferences:', error)
    return { allowInApp: true, allowWebPush: true }
  }
}
