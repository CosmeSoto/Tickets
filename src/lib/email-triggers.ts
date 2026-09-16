/**
 * Email Triggers (tickets) — solo rutas activas.
 * Envío vía queueNotificationEmail (SMTP + prefs + prioridad).
 */

import {
  sendTicketCreatedToAdminEmail,
  sendTicketAssignedToTechnicianEmail,
  sendTicketAssignedToClientEmail,
  sendTicketResolvedToAdminEmail,
  sendTicketClosedEmail,
  sendTicketReopenedEmail,
} from './email-service'

export function triggerTicketCreatedToAdminEmail(ticketId: string) {
  sendTicketCreatedToAdminEmail(ticketId).catch(error => {
    console.error('Failed to send ticket created to admin email:', error)
  })
}

export function triggerTicketAssignedToTechnicianEmail(ticketId: string) {
  sendTicketAssignedToTechnicianEmail(ticketId).catch(error => {
    console.error('Failed to send ticket assigned to technician email:', error)
  })
}

export function triggerTicketAssignedToClientEmail(ticketId: string) {
  sendTicketAssignedToClientEmail(ticketId).catch(error => {
    console.error('Failed to send ticket assigned to client email:', error)
  })
}

/** Digest admin (optional vía prefs ticketUpdated) */
export function triggerTicketResolvedToAdminEmail(ticketId: string, actorUserId?: string) {
  sendTicketResolvedToAdminEmail(ticketId, actorUserId).catch(error => {
    console.error('Failed to send ticket resolved to admin email:', error)
  })
}

export function triggerTicketClosedEmail(ticketId: string, actorUserId?: string) {
  sendTicketClosedEmail(ticketId, actorUserId).catch(error => {
    console.error('Failed to send ticket closed email:', error)
  })
}

export function triggerTicketReopenedEmail(ticketId: string, actorUserId?: string) {
  sendTicketReopenedEmail(ticketId, actorUserId).catch(error => {
    console.error('Failed to send ticket reopened email:', error)
  })
}
