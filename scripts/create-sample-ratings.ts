import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function createSampleRatings() {
  console.log('⭐ Creando calificaciones de ejemplo...')

  try {
    // Obtener el ticket resuelto
    const resolvedTicket = await prisma.tickets.findFirst({
      where: {
        status: 'RESOLVED',
        assigneeId: { not: null }
      },
      include: {
        users_tickets_clientIdTousers: true,
        users_tickets_assigneeIdTousers: true
      }
    })

    if (!resolvedTicket) {
      console.log('❌ No se encontró ningún ticket resuelto')
      return
    }

    console.log(`📋 Creando calificación para ticket: ${resolvedTicket.title}`)

    // Crear calificación para el ticket resuelto
    const rating = await prisma.ticket_ratings.create({
      data: {
        id: randomUUID(),
        ticketId: resolvedTicket.id,
        clientId: resolvedTicket.clientId,
        technicianId: resolvedTicket.assigneeId!,
        rating: 5,
        feedback: 'Excelente servicio! El técnico Juan resolvió el problema de conectividad muy rápidamente y me explicó qué había causado la lentitud. Muy profesional y eficiente.',
        responseTime: 5,
        technicalSkill: 5,
        communication: 4,
        problemResolution: 5,
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
        comment: `Calificación agregada: ${rating.rating}/5 estrellas - "Excelente servicio!"`,
        ticketId: resolvedTicket.id,
        userId: resolvedTicket.clientId,
        createdAt: new Date()
      }
    })

    console.log(`✅ Calificación creada: ${rating.rating}/5 estrellas`)
    console.log(`   Cliente: ${resolvedTicket.users_tickets_clientIdTousers.name}`)
    console.log(`   Técnico: ${resolvedTicket.users_tickets_assigneeIdTousers?.name}`)
    console.log(`   Comentario: ${rating.feedback?.substring(0, 50)}...`)

    // Crear otro ticket resuelto para tener más datos
    const newResolvedTicket = await prisma.tickets.create({
      data: {
        id: randomUUID(),
        title: 'Instalación de software de contabilidad',
        description: 'Necesito ayuda para instalar y configurar el nuevo software de contabilidad en mi computadora.',
        status: 'RESOLVED',
        priority: 'MEDIUM',
        clientId: resolvedTicket.clientId,
        assigneeId: resolvedTicket.assigneeId,
        categoryId: (await prisma.categories.findFirst({ where: { name: 'Software' } }))!.id,
        resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      }
    })

    // Crear calificación para el nuevo ticket
    const rating2 = await prisma.ticket_ratings.create({
      data: {
        id: randomUUID(),
        ticketId: newResolvedTicket.id,
        clientId: newResolvedTicket.clientId,
        technicianId: newResolvedTicket.assigneeId!,
        rating: 4,
        feedback: 'Buen servicio. El técnico instaló el software correctamente, aunque tardó un poco más de lo esperado.',
        responseTime: 3,
        technicalSkill: 5,
        communication: 4,
        problemResolution: 4,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    console.log(`✅ Segunda calificación creada: ${rating2.rating}/5 estrellas`)

    console.log('\n🎉 Calificaciones de ejemplo creadas exitosamente!')
    console.log('\n📊 Resumen:')
    console.log(`   - Total calificaciones: 2`)
    console.log(`   - Promedio: ${(rating.rating + rating2.rating) / 2}/5`)
    console.log(`   - Técnico evaluado: ${resolvedTicket.users_tickets_assigneeIdTousers?.name}`)

  } catch (error) {
    console.error('❌ Error creando calificaciones:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createSampleRatings()