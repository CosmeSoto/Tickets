/**
 * Envío único del correo “ticket resuelto → calificar”
 * (evita divergencia entre PATCH /tickets/[id] y /status).
 */

import { EmailService } from '@/lib/services/email/email-service'

export async function queueTicketResolvedRaterEmail(params: {
  ticketId: string
  title: string
  raterId: string
  raterName: string
  raterEmail: string
  raterRole: string
  technicianName: string
  actorUserId: string
  isPatrolEscalation: boolean
  resolution?: string | null
}): Promise<void> {
  const rolePrefix =
    params.raterRole === 'ADMIN'
      ? 'admin'
      : params.raterRole === 'TECHNICIAN'
        ? 'technician'
        : 'client'

  const ticketShort = params.ticketId.substring(0, 8)

  await EmailService.queueEmail(
    {
      to: params.raterEmail,
      subject: params.isPatrolEscalation
        ? `Ticket escalado resuelto — califique el servicio`
        : `Ticket #${ticketShort} resuelto — ${params.title}`,
      template: 'ticket-resolved',
      templateData: {
        ticketId: params.ticketId,
        ticketTitle: params.title,
        title: params.title,
        clientName: params.raterName,
        technicianName: params.technicianName,
        resolution: params.resolution || 'Consulte el detalle en el sistema.',
        rolePrefix,
        ticketUrl: `/${rolePrefix}/tickets/${params.ticketId}`,
        ratingUrl: `/${rolePrefix}/tickets/${params.ticketId}?rate=1`,
        isPatrolEscalation: params.isPatrolEscalation,
      },
      recipientUserId: params.raterId,
      ticketEmailEvent: 'statusChanged',
    },
    params.actorUserId
  )
}
