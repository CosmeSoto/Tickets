import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setupTestRatings() {
  console.log('🔧 Configurando tickets para pruebas de calificación...')

  try {
    // Obtener algunos tickets que tengan técnico asignado
    const tickets = await prisma.tickets.findMany({
      where: {
        assigneeId: { not: null },
        status: { in: ['OPEN', 'IN_PROGRESS'] }
      },
      take: 3
    })

    console.log(`📋 Encontrados ${tickets.length} tickets para actualizar`)

    // Actualizar tickets a estado RESOLVED
    for (const ticket of tickets) {
      await prisma.tickets.update({
        where: { id: ticket.id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date()
        }
      })

      // Agregar entrada al historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'status_changed',
          field: 'status',
          oldValue: ticket.status,
          newValue: 'RESOLVED',
          comment: 'Ticket marcado como resuelto para pruebas de calificación',
          ticketId: ticket.id,
          userId: ticket.assigneeId!,
          createdAt: new Date()
        }
      })

      console.log(`✅ Ticket ${ticket.id.slice(-8)} actualizado a RESOLVED`)
    }

    // Ahora crear calificaciones para estos tickets
    for (const ticket of tickets) {
      const rating = Math.floor(Math.random() * 2) + 4 // Entre 4 y 5
      const responseTime = Math.floor(Math.random() * 2) + 4
      const technicalSkill = Math.floor(Math.random() * 2) + 4
      const communication = Math.floor(Math.random() * 2) + 4
      const problemResolution = Math.floor(Math.random() * 2) + 4

      const feedbacks = [
        'Excelente servicio, muy rápido y eficiente.',
        'El técnico fue muy profesional y resolvió el problema rápidamente.',
        'Muy satisfecho con la atención recibida.',
        'Buena comunicación y seguimiento del caso.',
        'Problema resuelto de manera efectiva.'
      ]

      const feedback = feedbacks[Math.floor(Math.random() * feedbacks.length)]

      await prisma.ticket_ratings.create({
        data: {
          id: randomUUID(),
          ticketId: ticket.id,
          clientId: ticket.clientId,
          technicianId: ticket.assigneeId!,
          rating,
          feedback,
          responseTime,
          technicalSkill,
          communication,
          problemResolution,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Agregar entrada al historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'rating_added',
          comment: `Calificación agregada: ${rating}/5 estrellas - "${feedback}"`,
          ticketId: ticket.id,
          userId: ticket.clientId,
          createdAt: new Date()
        }
      })

      console.log(`⭐ Calificación creada para ticket ${ticket.id.slice(-8)} - ${rating}/5 estrellas`)
    }

    console.log('✅ Configuración de pruebas completada exitosamente')
  } catch (error) {
    console.error('❌ Error durante la configuración:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar
setupTestRatings()
  .then(() => {
    console.log('🎉 Proceso completado')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error)
    process.exit(1)
  })