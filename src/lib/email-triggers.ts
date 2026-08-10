/**
 * Email Triggers (tickets) — solo rutas activas.
 * Envío vía queueNotificationEmail (SMTP + prefs + prioridad).
 */

import {
  sendTicketCreatedToAdminEmail,
  sendTicketAssignedToTechnicianEmail,
  sendTicketAssignedToClientEmail,
  sendTicketResolvedToAdminEmail,
  sendRatingToAdminEmail,
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
export function triggerTicketResolvedToAdminEmail(ticketId: string) {
  sendTicketResolvedToAdminEmail(ticketId).catch(error => {
    console.error('Failed to send ticket resolved to admin email:', error)
  })
}

/** Digest admin de calificación (optional vía prefs ticketUpdated) */
export function triggerRatingToAdminEmail(ticketId: string, rating: number) {
  sendRatingToAdminEmail(ticketId, rating).catch(error => {
    console.error('Failed to send rating to admin email:', error)
  })
}
