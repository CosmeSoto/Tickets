/**
 * Preferencias de Telegram unificadas (paridad con email-prefs).
 */

import prisma from '@/lib/prisma'
import type { TelegramModule, TelegramEvent } from './telegram-policy'
import { resolveTelegramPriority } from './telegram-policy'
import type { TelegramPriority } from '@/lib/services/telegram.service'

type PrefsRow = {
  telegramNotifications: boolean
  notifyTickets: boolean
  notifyInventory: boolean
  notifyPatrols: boolean
  ticketCreated: boolean
  ticketAssigned: boolean
  statusChanged: boolean
  newComments: boolean
  ticketUpdated: boolean
  ticketUpdates: boolean
}

const PATROL_EVENTS: TelegramEvent[] = [
  'patrolAssigned',
  'patrolReminder',
  'patrolMissed',
  'patrolCancelled',
]

function moduleMaster(prefs: PrefsRow, module: TelegramModule): boolean {
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
      return true
    case 'content':
    case 'credentials':
      return true
    default:
      return true
  }
}

function eventAllows(prefs: PrefsRow, event: TelegramEvent | undefined): boolean {
  if (!event || event === 'generic') return true

  if (PATROL_EVENTS.includes(event)) {
    return prefs.notifyPatrols !== false
  }

  if (
    event === 'inventoryAct' ||
    event === 'inventoryAlert' ||
    event === 'inventoryReport' ||
    event === 'backupSuccess' ||
    event === 'backupFailure'
  ) {
    return true
  }

  if (event === 'digest') return false
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

export async function canSendTelegramNotification(
  userId: string | null | undefined,
  options: {
    module: TelegramModule
    event?: TelegramEvent
    priority?: TelegramPriority
  },
  prefs?: PrefsRow | null
): Promise<boolean> {
  const priority = resolveTelegramPriority(options.event, options.priority)
  if (priority === 'critical' || options.module === 'auth') {
    return true
  }
  if (!userId) return false

  try {
    const row =
      prefs ??
      (await prisma.user_settings.findUnique({
        where: { userId },
        select: {
          telegramNotifications: true,
          notifyTickets: true,
          notifyInventory: true,
          notifyPatrols: true,
          ticketCreated: true,
          ticketAssigned: true,
          statusChanged: true,
          newComments: true,
          ticketUpdated: true,
          ticketUpdates: true,
        },
      }))

    if (!row) return true
    if (!row.telegramNotifications) return false
    if (!moduleMaster(row, options.module)) return false
    if (options.event && !eventAllows(row, options.event)) return false
    return true
  } catch (error) {
    console.error('[TELEGRAM-PREFS] Error:', error)
    return true
  }
}

export async function filterUserIdsForTelegramNotification(
  userIds: string[],
  options: {
    module: TelegramModule
    event?: TelegramEvent
    priority?: TelegramPriority
  }
): Promise<string[]> {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return []

  const priority = resolveTelegramPriority(options.event, options.priority)
  if (priority === 'critical' || options.module === 'auth') {
    return unique
  }

  try {
    const settings = await prisma.user_settings.findMany({
      where: { userId: { in: unique } },
      select: {
        userId: true,
        telegramNotifications: true,
        notifyTickets: true,
        notifyInventory: true,
        notifyPatrols: true,
        ticketCreated: true,
        ticketAssigned: true,
        statusChanged: true,
        newComments: true,
        ticketUpdated: true,
        ticketUpdates: true,
      },
    })

    const prefsByUser = new Map(settings.map(s => [s.userId, s]))

    return unique.filter(id => {
      const prefs = prefsByUser.get(id)
      if (!prefs) return true
      if (!prefs.telegramNotifications) return false
      if (!moduleMaster(prefs, options.module)) return false
      if (options.event && !eventAllows(prefs, options.event)) return false
      return true
    })
  } catch (error) {
    console.error('[TELEGRAM-PREFS] Error filtrando usuarios:', error)
    return unique
  }
}
