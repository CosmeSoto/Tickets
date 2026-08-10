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
}): Promise<void> {
  const rolePrefix =
    params.raterRole === 'ADMIN'
      ? 'admin'
      : params.raterRole === 'TECHNICIAN'
        ? 'technician'
        : 'client'

  await EmailService.queueEmail(
    {
      to: params.raterEmail,
      subject: params.isPatrolEscalation
        ? 'Ticket escalado resuelto — califica el servicio'
        : `Ticket #${params.ticketId.substring(0, 8)} resuelto`,
      template: 'ticket-resolved',
      templateData: {
        ticketId: params.ticketId,
        title: params.title,
        clientName: params.raterName,
        technicianName: params.technicianName,
        ticketUrl: `/${rolePrefix}/tickets/${params.ticketId}`,
        isPatrolEscalation: params.isPatrolEscalation,
      },
      recipientUserId: params.raterId,
      ticketEmailEvent: 'statusChanged',
    },
    params.actorUserId
  )
}
