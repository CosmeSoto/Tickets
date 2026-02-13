import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedRatings() {
  console.log('🌱 Iniciando seed de calificaciones...')

  try {
    // Obtener tickets resueltos que no tengan calificación
    const resolvedTickets = await prisma.tickets.findMany({
      where: {
        status: { in: ['RESOLVED', 'CLOSED'] },
        assigneeId: { not: null },
        ticket_ratings: null
      },
      include: {
        users_tickets_clientIdTousers: true,
        users_tickets_assigneeIdTousers: true
      },
      take: 5 // Solo los primeros 5 para prueba
    })

    console.log(`📋 Encontrados ${resolvedTickets.length} tickets resueltos sin calificación`)

    for (const ticket of resolvedTickets) {
      if (!ticket.assigneeId) continue

      // Generar calificaciones aleatorias pero realistas
      const rating = Math.floor(Math.random() * 2) + 4 // Entre 4 y 5
      const responseTime = Math.floor(Math.random() * 2) + 4 // Entre 4 y 5
      const technicalSkill = Math.floor(Math.random() * 2) + 4 // Entre 4 y 5
      const communication = Math.floor(Math.random() * 2) + 4 // Entre 4 y 5
      const problemResolution = Math.floor(Math.random() * 2) + 4 // Entre 4 y 5

      const feedbacks = [
        'Excelente servicio, muy rápido y eficiente.',
        'El técnico fue muy profesional y resolvió el problema rápidamente.',
        'Muy satisfecho con la atención recibida.',
        'Buena comunicación y seguimiento del caso.',
        'Problema resuelto de manera efectiva.',
        null // Algunas sin comentarios
      ]

      const feedback = feedbacks[Math.floor(Math.random() * feedbacks.length)]

      await prisma.ticket_ratings.create({
        data: {
          id: randomUUID(),
          ticketId: ticket.id,
          clientId: ticket.clientId,
          technicianId: ticket.assigneeId,
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
          comment: `Calificación agregada: ${rating}/5 estrellas`,
          ticketId: ticket.id,
          userId: ticket.clientId,
          createdAt: new Date()
        }
      })

      console.log(`⭐ Calificación creada para ticket ${ticket.id.slice(-8)} - ${rating}/5 estrellas`)
    }

    console.log('✅ Seed de calificaciones completado exitosamente')
  } catch (error) {
    console.error('❌ Error durante el seed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  seedRatings()
    .then(() => {
      console.log('🎉 Proceso completado')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error)
      process.exit(1)
    })
}

export default seedRatings