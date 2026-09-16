/**
 * Cola de digest agrupado para eventos "ruidosos" de tickets (comentarios,
 * actualizaciones menores) — en vez de un correo por evento, se acumulan aquí
 * y un cron (ver src/lib/cron/ticket-activity-digest.ts) los consolida en un
 * solo correo por (ticket, destinatario) cada cierto intervalo.
 */

import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { canSendTicketEmail, type TicketEmailEvent } from './email-prefs'

export type TicketDigestEvent = Extract<TicketEmailEvent, 'newComments' | 'ticketUpdated'>

export async function queueTicketDigestItem(params: {
  ticketId: string
  recipientId: string
  event: TicketDigestEvent
  summary: string
}): Promise<void> {
  const allowed = await canSendTicketEmail(params.recipientId, params.event)
  if (!allowed) return

  await prisma.ticket_email_digest_items.create({
    data: {
      id: randomUUID(),
      ticketId: params.ticketId,
      recipientId: params.recipientId,
      event: params.event,
      summary: params.summary,
    },
  })
}
