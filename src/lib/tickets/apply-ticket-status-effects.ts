import prisma from '@/lib/prisma'
import { SLAService } from '@/lib/services/sla-service'
import { WebhookService } from '@/lib/services/webhook-service'
import { NotificationService } from '@/lib/services/notification-service'
import { TicketEvents } from '@/lib/ticket-events'

interface ApplyTicketStatusChangeEffectsParams {
  ticketId: string
  newStatus: string
  previousStatus: string
  /** Quien hizo el cambio (para el nombre en webhooks/emails, no para permisos). */
  actorUserId: string
  actorName: string
}

/**
 * Efectos secundarios de un cambio de estado de ticket, centralizados para
 * que las distintas rutas que pueden cambiar `status` (PUT /api/tickets/[id]
 * en sus ramas TECHNICIAN y ADMIN) se comporten igual que
 * PATCH /api/tickets/[id]/status.
 *
 * Antes de esto, la rama ADMIN del PUT genérico no ejecutaba NINGUNO de
 * estos efectos (un admin que resolvía/cerraba un ticket desde el
 * formulario de edición, en vez de los botones dedicados, no disparaba
 * SLA.recordResolution, ni el email/notificación de "califica el servicio",
 * ni el evento SSE que refresca en vivo la pantalla del cliente) — el
 * cliente nunca se enteraba y el modal de calificación no aparecía.
 *
 * No incluye la sincronización de `tickets.resolvedAt`/`closedAt`: eso se
 * hace en el mismo `prisma.tickets.update` que ya escribe `status`, para
 * que quede en una sola escritura atómica en vez de una segunda consulta.
 */
export async function applyTicketStatusChangeEffects({
  ticketId,
  newStatus,
  previousStatus,
  actorUserId,
  actorName,
}: ApplyTicketStatusChangeEffectsParams): Promise<void> {
  if (newStatus === 'RESOLVED') {
    await SLAService.recordResolution(ticketId).catch(err => {
      console.error('[SLA] Error registrando resolución:', err)
    })

    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        title: true,
        source: true,
        createdById: true,
        clientId: true,
        users_tickets_clientIdTousers: { select: { name: true } },
      },
    })

    if (ticket) {
      await WebhookService.trigger(WebhookService.EVENTS.TICKET_RESOLVED, {
        ticketId,
        resolvedBy: actorName,
        ticket: {
          id: ticketId,
          title: ticket.title,
          client: ticket.users_tickets_clientIdTousers?.name,
          resolvedAt: new Date(),
        },
      }).catch(err => {
        console.error('[WEBHOOK] Error disparando evento TICKET_RESOLVED:', err)
      })

      // Email + notificación a quien debe calificar
      // (PATROL → createdById / supervisor; WEB → clientId / solicitante)
      const isPatrolResolved = ticket.source === 'PATROL' && !!ticket.createdById
      const raterId = isPatrolResolved ? ticket.createdById! : ticket.clientId
      if (raterId) {
        const rater = await prisma.users.findUnique({
          where: { id: raterId },
          select: { name: true, email: true, role: true },
        })
        if (rater?.email) {
          const { queueTicketResolvedRaterEmail } =
            await import('@/lib/notifications/ticket-resolved-email')
          await queueTicketResolvedRaterEmail({
            ticketId,
            title: ticket.title,
            raterId,
            raterName: rater.name,
            raterEmail: rater.email,
            raterRole: rater.role,
            technicianName: actorName,
            actorUserId,
            isPatrolEscalation: isPatrolResolved,
          }).catch(err => {
            console.error('[EMAIL] Error enviando email de ticket resuelto:', err)
          })
        }
      }
    }

    await NotificationService.notifyTicketResolved(ticketId).catch(err => {
      console.error('[NOTIFICATION] Error enviando notificación de ticket resuelto:', err)
    })

    const { triggerTicketResolvedToAdminEmail } = await import('@/lib/email-triggers')
    void triggerTicketResolvedToAdminEmail(ticketId, actorUserId)
  }

  if (previousStatus === 'CLOSED' && newStatus === 'OPEN') {
    await WebhookService.trigger(WebhookService.EVENTS.TICKET_REOPENED, {
      ticketId,
      reopenedBy: actorName,
      ticket: { id: ticketId },
    }).catch(err => {
      console.error('[WEBHOOK] Error disparando evento TICKET_REOPENED:', err)
    })
  }

  TicketEvents.emit(ticketId, {
    type: 'status_changed',
    status: newStatus,
    previousStatus,
  })
}
