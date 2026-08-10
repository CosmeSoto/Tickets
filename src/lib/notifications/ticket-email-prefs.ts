/**
 * Preferencias de correo para eventos de tickets.
 * Master: emailNotifications + notifyTickets + evento fino.
 * Defaults: todo ON (salvo que el usuario desactive).
 */

import prisma from '@/lib/prisma'

export type TicketEmailEvent =
  | 'ticketCreated'
  | 'ticketAssigned'
  | 'statusChanged'
  | 'newComments'
  | 'ticketUpdated'

const EVENT_FIELD: Record<TicketEmailEvent, keyof TicketEmailPrefsRow> = {
  ticketCreated: 'ticketCreated',
  ticketAssigned: 'ticketAssigned',
  statusChanged: 'statusChanged',
  newComments: 'newComments',
  ticketUpdated: 'ticketUpdated',
}

type TicketEmailPrefsRow = {
  emailNotifications: boolean
  notifyTickets: boolean
  ticketCreated: boolean
  ticketAssigned: boolean
  statusChanged: boolean
  newComments: boolean
  ticketUpdated: boolean
  ticketUpdates: boolean
}

function allows(prefs: TicketEmailPrefsRow | null, event: TicketEmailEvent): boolean {
  // Sin fila de settings → defaults ON (comportamiento esperado)
  if (!prefs) return true
  if (!prefs.emailNotifications) return false
  if (!prefs.notifyTickets) return false

  const field = EVENT_FIELD[event]
  if (event === 'ticketUpdated') {
    return prefs.ticketUpdated !== false && prefs.ticketUpdates !== false
  }
  return prefs[field] !== false
}

export async function canSendTicketEmail(
  userId: string | null | undefined,
  event: TicketEmailEvent
): Promise<boolean> {
  if (!userId) return false
  try {
    const prefs = await prisma.user_settings.findUnique({
      where: { userId },
      select: {
        emailNotifications: true,
        notifyTickets: true,
        ticketCreated: true,
        ticketAssigned: true,
        statusChanged: true,
        newComments: true,
        ticketUpdated: true,
        ticketUpdates: true,
      },
    })
    return allows(prefs, event)
  } catch (error) {
    console.error('[TICKET-EMAIL-PREFS] Error:', error)
    return true // fail-open hacia envío si hay SMTP (no silenciar por error de BD)
  }
}

/** Filtra IDs de usuario que aceptan el evento por correo */
export async function filterUserIdsForTicketEmail(
  userIds: string[],
  event: TicketEmailEvent
): Promise<string[]> {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return []

  const rows = await prisma.user_settings.findMany({
    where: { userId: { in: unique } },
    select: {
      userId: true,
      emailNotifications: true,
      notifyTickets: true,
      ticketCreated: true,
      ticketAssigned: true,
      statusChanged: true,
      newComments: true,
      ticketUpdated: true,
      ticketUpdates: true,
    },
  })
  const byUser = new Map(rows.map(r => [r.userId, r]))

  return unique.filter(id => {
    const prefs = byUser.get(id) ?? null
    return allows(prefs, event)
  })
}
