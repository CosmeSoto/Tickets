/**
 * Cron Job: Auto-cierre de tickets resueltos sin calificación
 * 
 * Cierra automáticamente tickets que llevan más de X días en estado RESOLVED
 * sin que el cliente haya enviado su calificación.
 * El plazo es configurable por el admin en Configuración > Seguridad.
 */

import prisma from '../prisma'
import { randomUUID } from 'crypto'

const DEFAULT_AUTO_CLOSE_DAYS = 3

async function getAutoCloseDays(): Promise<number> {
  try {
    const setting = await prisma.system_settings.findUnique({
      where: { key: 'autoCloseDays' },
    })
    if (setting) {
      const value = parseInt(setting.value)
      if (!isNaN(value) && value >= 1) return value
    }
  } catch (error) {
    console.warn('[AUTO-CLOSE] Error leyendo configuración, usando default:', error)
  }
  return DEFAULT_AUTO_CLOSE_DAYS
}

export async function autoCloseResolvedTickets(): Promise<{
  closed: number
  errors: number
}> {
  const autoCloseDays = await getAutoCloseDays()
  console.log(`[AUTO-CLOSE] Iniciando auto-cierre (plazo: ${autoCloseDays} días)...`)

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - autoCloseDays)

  let closed = 0
  let errors = 0

  try {
    // Buscar tickets RESOLVED sin calificación que superaron el plazo
    const staleTickets = await prisma.tickets.findMany({
      where: {
        status: 'RESOLVED',
        resolvedAt: { lt: cutoffDate },
        ticket_ratings: null,
      },
      select: {
        id: true,
        title: true,
        clientId: true,
        assigneeId: true,
      },
    })

    console.log(`[AUTO-CLOSE] ${staleTickets.length} tickets pendientes de cierre automático`)

    for (const ticket of staleTickets) {
      try {
        await prisma.$transaction(async (tx) => {
          // Cerrar el ticket
          await tx.tickets.update({
            where: { id: ticket.id },
            data: {
              status: 'CLOSED',
              closedAt: new Date(),
              updatedAt: new Date(),
            },
          })

          // Registrar en historial
          await tx.ticket_history.create({
            data: {
              id: randomUUID(),
              action: 'status_changed',
              field: 'status',
              oldValue: 'RESOLVED',
              newValue: 'CLOSED',
              comment: `Ticket cerrado automáticamente tras ${autoCloseDays} día${autoCloseDays > 1 ? 's' : ''} sin calificación del cliente`,
              ticketId: ticket.id,
              userId: ticket.assigneeId || ticket.clientId,
              createdAt: new Date(),
            },
          })

          // Notificar al cliente
          await tx.notifications.create({
            data: {
              id: randomUUID(),
              title: 'Ticket cerrado automáticamente',
              message: `Tu ticket "${ticket.title}" fue cerrado automáticamente tras ${autoCloseDays} día${autoCloseDays > 1 ? 's' : ''} sin calificación. Aún puedes calificarlo desde el detalle del ticket.`,
              type: 'INFO',
              userId: ticket.clientId,
              ticketId: ticket.id,
              isRead: false,
            },
          })

          // Notificar al técnico
          if (ticket.assigneeId) {
            await tx.notifications.create({
              data: {
                id: randomUUID(),
                title: 'Ticket cerrado por inactividad',
                message: `El ticket "${ticket.title}" fue cerrado automáticamente. El cliente no envió calificación en ${autoCloseDays} día${autoCloseDays > 1 ? 's' : ''}. Puedes promoverlo a artículo de conocimiento.`,
                type: 'INFO',
                userId: ticket.assigneeId,
                ticketId: ticket.id,
                isRead: false,
              },
            })
          }
        })

        closed++
      } catch (err) {
        console.error(`[AUTO-CLOSE] Error cerrando ticket ${ticket.id}:`, err)
        errors++
      }
    }

    console.log(`[AUTO-CLOSE] Completado: ${closed} cerrados, ${errors} errores`)
  } catch (error) {
    console.error('[AUTO-CLOSE] Error general:', error)
    throw error
  }

  return { closed, errors }
}
