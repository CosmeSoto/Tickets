/**
 * Emails de tickets (legacy helpers activos).
 * El envío pasa por queueNotificationEmail (SMTP + prefs + prioridad).
 */

import prisma from './prisma'
import { getTicketOversightAdmins } from '@/lib/notifications/family-recipients'
import { buildOperationalEmail } from '@/lib/services/email/operational-email'
import ticketAssignedTemplate from '@/lib/services/email/templates/ticket-assigned'
import { getEmailBranding } from '@/lib/services/email/email-branding'
import { escapeHtml } from '@/lib/services/email/email-layout'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import type {
  EmailModule,
  EmailPriority,
  NotificationEmailEvent,
} from '@/lib/notifications/email-policy'

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  recipientUserId?: string | null
  recipients?: Array<{ userId: string; email: string }>
  module?: EmailModule
  event?: NotificationEmailEvent
  priority?: EmailPriority
}

/** Encola (no envía SMTP directo) respetando política global. */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const result = await queueNotificationEmail({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      recipientUserId: options.recipientUserId,
      recipients: options.recipients,
      module: options.module || 'tickets',
      event: options.event || 'generic',
      priority: options.priority,
    })
    if (result.sent === 0 && result.queuedIds.length === 0) {
      console.log('[EMAIL] No enviado (SMTP off o prefs)')
      return false
    }
    if (result.queuedIds.length > 0) {
      console.log(
        `[EMAIL] Encolado para reintento (${result.queuedIds.length}) → ${Array.isArray(options.to) ? options.to.join(',') : options.to}`
      )
    } else {
      console.log(
        `[EMAIL] Enviado de inmediato (${result.sent}) → ${Array.isArray(options.to) ? options.to.join(',') : options.to}`
      )
    }
    return true
  } catch (error) {
    console.error('Error queueing email:', error)
    return false
  }
}

function ticketCode(ticket: { id: string; ticketCode?: string | null }): string {
  return ticket.ticketCode || ticket.id.substring(0, 8)
}

export async function sendTicketCreatedToAdminEmail(ticketId: string) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: { select: { name: true, email: true } },
        users_tickets_assigneeIdTousers: { select: { name: true } },
        categories: { select: { name: true } },
      },
    })

    if (!ticket) return false

    const admins = await getTicketOversightAdmins(ticket.familyId, {
      select: { id: true, email: true, name: true },
      excludeUserIds: [ticket.clientId, ticket.createdById, ticket.assigneeId],
    })
    const adminRecipients = admins
      .filter(a => a.email)
      .map(a => ({ userId: a.id, email: a.email as string }))
    if (adminRecipients.length === 0) return false

    const branding = await getEmailBranding()
    const code = ticketCode(ticket as { id: string; ticketCode?: string | null })
    const assigned = Boolean(ticket.assigneeId)
    const { html, text } = await buildOperationalEmail({
      headline: assigned ? 'Nuevo ticket registrado' : 'Nuevo ticket sin asignar',
      preheader: assigned
        ? `Ticket #${code} creado en tu área.`
        : `Ticket #${code} requiere asignación.`,
      introHtml: assigned
        ? `<p style="margin:0 0 8px;">Se registró un ticket en un área que cubres.</p>`
        : `<p style="margin:0 0 8px;">Se registró un ticket que requiere asignación de técnico.</p>`,
      infoRows: [
        { label: 'Ticket', value: `#${code}` },
        { label: 'Título', value: ticket.title },
        { label: 'Cliente', value: ticket.users_tickets_clientIdTousers.name },
        { label: 'Categoría', value: ticket.categories.name },
        { label: 'Prioridad', value: ticket.priority },
        ...(assigned
          ? [{ label: 'Técnico', value: ticket.users_tickets_assigneeIdTousers?.name || '—' }]
          : []),
      ],
      cta: {
        href: `${branding.baseUrl}/admin/tickets/${ticket.id}`,
        label: assigned ? 'Ver ticket' : 'Asignar técnico',
      },
    })

    return await sendEmail({
      to: adminRecipients.map(r => r.email),
      recipients: adminRecipients,
      subject: assigned
        ? `[Admin] Ticket #${code} — nuevo`
        : `[Admin] Ticket #${code} — asignación pendiente`,
      html,
      text,
      module: 'tickets',
      event: 'ticketCreated',
      priority: 'important',
    })
  } catch (error) {
    console.error('Error sending ticket created to admin email:', error)
    return false
  }
}

export async function sendTicketAssignedToTechnicianEmail(ticketId: string) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: { select: { name: true, email: true } },
        users_tickets_assigneeIdTousers: { select: { name: true, email: true } },
        categories: { select: { name: true } },
      },
    })

    if (!ticket || !ticket.assigneeId || !ticket.users_tickets_assigneeIdTousers?.email) {
      return false
    }

    const branding = await getEmailBranding()
    const code = ticketCode(ticket as { id: string; ticketCode?: string | null })
    const { html, text } = ticketAssignedTemplate({
      ...branding,
      ticketId: ticket.id,
      ticketNumber: code,
      ticketTitle: ticket.title,
      technicianName: ticket.users_tickets_assigneeIdTousers.name,
      clientName: ticket.users_tickets_clientIdTousers.name,
      category: ticket.categories.name,
      priority: ticket.priority,
      description: ticket.description,
      ticketUrl: `/technician/tickets/${ticket.id}`,
    })

    return await sendEmail({
      to: ticket.users_tickets_assigneeIdTousers.email,
      recipientUserId: ticket.assigneeId,
      subject: `[Asignado] Ticket #${code} — ${ticket.title}`,
      html,
      text,
      module: 'tickets',
      event: 'ticketAssigned',
      priority: 'important',
    })
  } catch (error) {
    console.error('Error sending ticket assigned to technician email:', error)
    return false
  }
}

export async function sendTicketAssignedToClientEmail(ticketId: string) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: { select: { name: true, email: true } },
        users_tickets_assigneeIdTousers: { select: { name: true, email: true } },
        categories: { select: { name: true } },
      },
    })

    if (
      !ticket ||
      !ticket.clientId ||
      !ticket.users_tickets_clientIdTousers.email ||
      !ticket.users_tickets_assigneeIdTousers
    ) {
      return false
    }

    const branding = await getEmailBranding()
    const code = ticketCode(ticket as { id: string; ticketCode?: string | null })
    const { html, text } = await buildOperationalEmail({
      headline: 'Técnico asignado',
      preheader: `Ticket #${code}: ${ticket.users_tickets_assigneeIdTousers.name} atenderá su solicitud.`,
      greetingName: ticket.users_tickets_clientIdTousers.name,
      introHtml: `<p style="margin:0 0 8px;">Su ticket fue asignado a <strong>${escapeHtml(ticket.users_tickets_assigneeIdTousers.name)}</strong>.</p>`,
      infoRows: [
        { label: 'Ticket', value: `#${code}` },
        { label: 'Título', value: ticket.title },
      ],
      cta: {
        href: `${branding.baseUrl}/client/tickets/${ticket.id}`,
        label: 'Ver ticket',
      },
    })

    return await sendEmail({
      to: ticket.users_tickets_clientIdTousers.email,
      recipientUserId: ticket.clientId,
      subject: `Técnico asignado — Ticket #${code}`,
      html,
      text,
      module: 'tickets',
      event: 'ticketAssigned',
      priority: 'important',
    })
  } catch (error) {
    console.error('Error sending ticket assigned to client email:', error)
    return false
  }
}

export async function sendTicketResolvedToAdminEmail(ticketId: string, actorUserId?: string) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: { select: { name: true, email: true } },
        users_tickets_assigneeIdTousers: { select: { name: true, email: true } },
        categories: { select: { name: true } },
      },
    })

    if (!ticket) return false

    const admins = await getTicketOversightAdmins(ticket.familyId, {
      select: { id: true, email: true, name: true },
      excludeUserIds: [ticket.clientId, ticket.assigneeId, ticket.createdById, actorUserId],
    })
    const adminRecipients = admins
      .filter(a => a.email)
      .map(a => ({ userId: a.id, email: a.email as string }))
    if (adminRecipients.length === 0) return false

    const branding = await getEmailBranding()
    const code = ticketCode(ticket as { id: string; ticketCode?: string | null })
    const resolutionHours = ticket.resolvedAt
      ? Math.round((ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60))
      : 0

    const { html, text } = await buildOperationalEmail({
      headline: 'Ticket resuelto',
      preheader: `Ticket #${code} marcado como resuelto.`,
      introHtml: `<p style="margin:0 0 8px;">Un ticket fue resuelto en el sistema.</p>`,
      infoRows: [
        { label: 'Ticket', value: `#${code}` },
        { label: 'Título', value: ticket.title },
        { label: 'Cliente', value: ticket.users_tickets_clientIdTousers.name },
        { label: 'Técnico', value: ticket.users_tickets_assigneeIdTousers?.name || '—' },
        { label: 'Tiempo', value: `${resolutionHours} h` },
      ],
      cta: {
        href: `${branding.baseUrl}/admin/tickets/${ticket.id}`,
        label: 'Ver ticket',
      },
    })

    return await sendEmail({
      to: adminRecipients.map(r => r.email),
      recipients: adminRecipients,
      subject: `[Admin] Ticket #${code} resuelto`,
      html,
      text,
      module: 'tickets',
      event: 'statusChanged',
      priority: 'important',
    })
  } catch (error) {
    console.error('Error sending ticket resolved to admin email:', error)
    return false
  }
}

export async function sendRatingToAdminEmail(ticketId: string, rating: number) {
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_clientIdTousers: { select: { name: true, email: true } },
        users_tickets_assigneeIdTousers: { select: { id: true, name: true, email: true } },
        categories: { select: { name: true } },
      },
    })

    if (!ticket) return false

    const technician = ticket.users_tickets_assigneeIdTousers
    if (!technician?.email || !ticket.assigneeId) return false

    const ratingData = await prisma.ticket_ratings.findUnique({
      where: { ticketId },
      select: { rating: true, feedback: true },
    })
    if (!ratingData) return false

    const branding = await getEmailBranding()
    const code = ticketCode(ticket as { id: string; ticketCode?: string | null })
    const feedback = ratingData.feedback?.trim() || 'Sin comentario'

    const { html, text } = await buildOperationalEmail({
      headline: 'Nueva calificación',
      preheader: `Ticket #${code}: ${rating}/5 estrellas.`,
      greetingName: technician.name,
      introHtml: `<p style="margin:0 0 8px;">El cliente calificó el servicio de este ticket.</p>`,
      infoRows: [
        { label: 'Ticket', value: `#${code}` },
        { label: 'Calificación', value: `${rating}/5` },
        { label: 'Comentario', value: feedback.slice(0, 120) },
      ],
      cta: {
        href: `${branding.baseUrl}/technician/tickets/${ticket.id}`,
        label: 'Ver ticket',
      },
    })

    return await sendEmail({
      to: technician.email,
      recipientUserId: ticket.assigneeId,
      subject: `Calificación ${rating}/5 — Ticket #${code}`,
      html,
      text,
      module: 'tickets',
      event: 'ticketUpdated',
      priority: 'optional',
    })
  } catch (error) {
    console.error('Error sending rating to technician email:', error)
    return false
  }
}
