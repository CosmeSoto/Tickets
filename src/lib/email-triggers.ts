/**
 * Email Triggers
 * 
 * Este módulo contiene funciones que se deben llamar después de acciones importantes
 * para enviar notificaciones por email automáticamente.
 * 
 * Uso:
 * - Importar la función correspondiente en la API route
 * - Llamarla después de la operación exitosa
 * - No esperar la respuesta (fire and forget) para no bloquear la respuesta al usuario
 */

import {
  sendTicketCreatedEmail,
  sendCommentAddedEmail,
  sendTicketStatusChangedEmail,
  sendTicketAssignedEmail,
  sendTicketCreatedToAdminEmail,
  sendTicketAssignedToTechnicianEmail,
  sendTicketAssignedToClientEmail,
  sendTicketResolvedToAdminEmail,
  sendRatingToAdminEmail
} from './email-service'

/**
 * Trigger para envío de email cuando se crea un ticket
 * Llamar después de crear el ticket en la BD
 */
export function triggerTicketCreatedEmail(ticketId: string) {
  // Fire and forget - no bloquear la respuesta
  sendTicketCreatedEmail(ticketId).catch(error => {
    console.error('Failed to send ticket created email:', error)
  })
}

/**
 * Trigger para envío de email cuando se agrega un comentario
 * Llamar después de crear el comentario en la BD
 */
export function triggerCommentAddedEmail(commentId: string) {
  // Fire and forget - no bloquear la respuesta
  sendCommentAddedEmail(commentId).catch(error => {
    console.error('Failed to send comment added email:', error)
  })
}

/**
 * Trigger para envío de email cuando cambia el estado de un ticket
 * Llamar después de actualizar el estado en la BD
 */
export function triggerTicketStatusChangedEmail(ticketId: string, newStatus: string) {
  // Fire and forget - no bloquear la respuesta
  sendTicketStatusChangedEmail(ticketId, newStatus).catch(error => {
    console.error('Failed to send status changed email:', error)
  })
}

/**
 * Trigger para envío de email cuando se asigna un ticket
 * Llamar después de asignar el ticket en la BD
 */
export function triggerTicketAssignedEmail(ticketId: string) {
  // Fire and forget - no bloquear la respuesta
  sendTicketAssignedEmail(ticketId).catch(error => {
    console.error('Failed to send ticket assigned email:', error)
  })
}

/**
 * Ejemplo de uso en una API route:
 * 
 * ```typescript
 * import { triggerTicketCreatedEmail } from '@/lib/email-triggers'
 * 
 * export async function POST(request: NextRequest) {
 *   // ... crear ticket en BD
 *   const ticket = await prisma.tickets.create({ ... })
 *   
 *   // Enviar email (no esperar respuesta)
 *   triggerTicketCreatedEmail(ticket.id)
 *   
 *   // Retornar respuesta inmediatamente
 *   return NextResponse.json(ticket)
 * }
 * ```
 */

/**
 * ⭐ NUEVO: Trigger para envío de email al administrador cuando se crea un ticket
 * Llamar después de crear el ticket en la BD
 */
export function triggerTicketCreatedToAdminEmail(ticketId: string) {
  // Fire and forget - no bloquear la respuesta
  sendTicketCreatedToAdminEmail(ticketId).catch(error => {
    console.error('Failed to send ticket created to admin email:', error)
  })
}

/**
 * ⭐ NUEVO: Trigger para envío de email al técnico cuando se le asigna un ticket
 * Llamar después de asignar el ticket en la BD
 */
export function triggerTicketAssignedToTechnicianEmail(ticketId: string) {
  // Fire and forget - no bloquear la respuesta
  sendTicketAssignedToTechnicianEmail(ticketId).catch(error => {
    console.error('Failed to send ticket assigned to technician email:', error)
  })
}

/**
 * ⭐ NUEVO: Trigger para envío de email al cliente cuando se asigna un técnico
 * Llamar después de asignar el ticket en la BD
 */
export function triggerTicketAssignedToClientEmail(ticketId: string) {
  // Fire and forget - no bloquear la respuesta
  sendTicketAssignedToClientEmail(ticketId).catch(error => {
    console.error('Failed to send ticket assigned to client email:', error)
  })
}

/**
 * ⭐ NUEVO: Trigger para envío de email al administrador cuando se resuelve un ticket
 * Llamar después de marcar el ticket como resuelto
 */
export function triggerTicketResolvedToAdminEmail(ticketId: string) {
  // Fire and forget - no bloquear la respuesta
  sendTicketResolvedToAdminEmail(ticketId).catch(error => {
    console.error('Failed to send ticket resolved to admin email:', error)
  })
}

/**
 * ⭐ NUEVO: Trigger para envío de email al administrador cuando el cliente califica
 * Llamar después de guardar la calificación en la BD
 */
export function triggerRatingToAdminEmail(ticketId: string, rating: number) {
  // Fire and forget - no bloquear la respuesta
  sendRatingToAdminEmail(ticketId, rating).catch(error => {
    console.error('Failed to send rating to admin email:', error)
  })
}
