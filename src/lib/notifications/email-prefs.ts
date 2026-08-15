/**
 * Preferencias de correo unificadas (todos los módulos).
 */

import prisma from '@/lib/prisma'
import type { EmailModule, EmailPriority, NotificationEmailEvent } from './email-policy'
import { resolveEmailPriority } from './email-policy'

type PrefsRow = {
  emailNotifications: boolean
  notifyTickets: boolean
  notifyInventory: boolean
  notifyPatrols: boolean
  ticketCreated: boolean
  ticketAssigned: boolean
  statusChanged: boolean
  newComments: boolean
  ticketUpdated: boolean
  ticketUpdates: boolean
  weeklyReport: boolean
}

function moduleMaster(prefs: PrefsRow, module: EmailModule): boolean {
  switch (module) {
    case 'tickets':
      return prefs.notifyTickets !== false
    case 'inventory':
      return prefs.notifyInventory !== false
    case 'patrols':
      return prefs.notifyPatrols !== false
    case 'backups':
    case 'system':
    case 'auth':
      // Operación / seguridad: no dependen de master de módulo de usuario
      return true
    case 'content':
    case 'credentials':
    case 'processes':
    case 'access':
      // Sin master dedicado aún; el master emailNotifications basta
      return true
    default:
      return true
  }
}

function eventAllows(prefs: PrefsRow, event: NotificationEmailEvent | undefined): boolean {
  if (
    !event ||
    event === 'generic' ||
    event === 'inventoryAct' ||
    event === 'inventoryAlert' ||
    event === 'inventoryReport' ||
    event === 'backupSuccess' ||
    event === 'backupFailure'
  ) {
    return true
  }
  if (event === 'digest') return prefs.weeklyReport === true
  if (event === 'security') return true
  if (event === 'ticketCreated') return prefs.ticketCreated !== false
  if (event === 'ticketAssigned') return prefs.ticketAssigned !== false
  if (event === 'statusChanged') return prefs.statusChanged !== false
  if (event === 'newComments') return prefs.newComments !== false
  if (event === 'ticketUpdated') {
    return prefs.ticketUpdated !== false && prefs.ticketUpdates !== false
  }
  return true
}

/**
 * ¿Puede este usuario recibir este correo?
 * - critical / auth: no requiere prefs de usuario (sí SMTP a nivel sistema)
 * - important/optional: emailNotifications + master de módulo + evento fino
 */
export async function canSendNotificationEmail(
  userId: string | null | undefined,
  options: {
    module: EmailModule
    event?: NotificationEmailEvent
    priority?: EmailPriority
  }
): Promise<boolean> {
  const priority = resolveEmailPriority(options.event, options.priority)
  if (priority === 'critical' || options.module === 'auth') {
    return true
  }
  if (!userId) {
    return priority === 'important'
  }

  try {
    const prefs = await prisma.user_settings.findUnique({
      where: { userId },
      select: {
        emailNotifications: true,
        notifyTickets: true,
        notifyInventory: true,
        notifyPatrols: true,
        ticketCreated: true,
        ticketAssigned: true,
        statusChanged: true,
        newComments: true,
        ticketUpdated: true,
        ticketUpdates: true,
        weeklyReport: true,
      },
    })

    if (!prefs) return true
    if (!prefs.emailNotifications) return false
    if (!moduleMaster(prefs, options.module)) return false
    if (priority === 'optional' && !eventAllows(prefs, options.event)) return false
    if (priority === 'important' && options.event && !eventAllows(prefs, options.event)) {
      return false
    }
    return true
  } catch (error) {
    console.error('[EMAIL-PREFS] Error:', error)
    return true
  }
}

export async function filterUserIdsForNotificationEmail(
  userIds: string[],
  options: {
    module: EmailModule
    event?: NotificationEmailEvent
    priority?: EmailPriority
  }
): Promise<string[]> {
  const unique = [...new Set(userIds.filter(Boolean))]
  const out: string[] = []
  for (const id of unique) {
    if (await canSendNotificationEmail(id, options)) out.push(id)
  }
  return out
}

// ── Compat tickets (API anterior) ───────────────────────────────────────────

export type TicketEmailEvent =
  | 'ticketCreated'
  | 'ticketAssigned'
  | 'statusChanged'
  | 'newComments'
  | 'ticketUpdated'

export async function canSendTicketEmail(
  userId: string | null | undefined,
  event: TicketEmailEvent
): Promise<boolean> {
  return canSendNotificationEmail(userId, {
    module: 'tickets',
    event,
    priority: resolveEmailPriority(event),
  })
}

export async function filterUserIdsForTicketEmail(
  userIds: string[],
  event: TicketEmailEvent
): Promise<string[]> {
  return filterUserIdsForNotificationEmail(userIds, {
    module: 'tickets',
    event,
    priority: resolveEmailPriority(event),
  })
}
