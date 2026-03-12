/**
 * Script para agregar una respuesta de prueba y verificar el cálculo de tiempo promedio
 * Ejecutar con: node scripts/add-test-response.js
 */

const { PrismaClient } = require('@prisma/client')
const { randomUUID } = require('crypto')

const prisma = new PrismaClient()

async function addTestResponse() {
  console.log('🔧 Agregando respuesta de prueba para verificar cálculo de SLA...\n')

  try {
    // 1. Obtener el ticket
    const ticket = await prisma.tickets.findFirst({
      include: {
        ticket_sla_metrics: true
      }
    })

    if (!ticket) {
      console.log('❌ No hay tickets en el sistema')
      return
    }

    console.log(`📋 Ticket encontrado: ${ticket.id}`)
    console.log(`   Status: ${ticket.status}`)
    console.log(`   Creado: ${ticket.createdAt}`)
    console.log(`   firstResponseAt actual: ${ticket.firstResponseAt || 'NULL'}`)

    // 2. Obtener un técnico
    const technician = await prisma.users.findFirst({
      where: { role: 'TECHNICIAN' }
    })

    if (!technician) {
      console.log('❌ No hay técnicos en el sistema')
      return
    }

    console.log(`\n👤 Técnico: ${technician.name} (${technician.email})`)

    // 3. Crear un comentario de respuesta (31 minutos después de la creación)
    const responseDate = new Date(ticket.createdAt.getTime() + 31 * 60 * 1000)
    
    console.log(`\n💬 Creando comentario de respuesta...`)
    console.log(`   Fecha: ${responseDate.toISOString()}`)

    const comment = await prisma.comments.create({
      data: {
        id: randomUUID(),
        content: 'Hola, estoy revisando tu solicitud. Te responderé pronto con una solución.',
        createdAt: responseDate,
        updatedAt: responseDate,
        tickets: {
          connect: { id: ticket.id }
        },
        users: {
          connect: { id: technician.id }
        }
      }
    })

    console.log(`   ✅ Comentario creado: ${comment.id}`)

    // 4. Actualizar firstResponseAt en la tabla tickets
    await prisma.tickets.update({
      where: { id: ticket.id },
      data: { firstResponseAt: responseDate }
    })

    console.log(`\n✅ tickets.firstResponseAt actualizado`)

    // 5. Actualizar métricas SLA si existen
    if (ticket.ticket_sla_metrics) {
      const responseTimeMinutes = Math.floor(
        (responseDate.getTime() - ticket.createdAt.getTime()) / (1000 * 60)
      )

      // Verificar si cumplió el SLA de respuesta
      const responseSLAMet = ticket.ticket_sla_metrics.responseDeadline
        ? responseDate <= new Date(ticket.ticket_sla_metrics.responseDeadline)
        : null

      await prisma.ticket_sla_metrics.update({
        where: { ticketId: ticket.id },
        data: {
          firstResponseAt: responseDate,
          responseTimeMinutes: responseTimeMinutes,
          responseSLAMet: responseSLAMet
        }
      })

      console.log(`✅ ticket_sla_metrics actualizado`)
      console.log(`   responseTimeMinutes: ${responseTimeMinutes}`)
      console.log(`   responseSLAMet: ${responseSLAMet}`)
    }

    // 6. Verificar el resultado
    console.log(`\n📊 Verificando resultado...`)

    const updated = await prisma.tickets.findUnique({
      where: { id: ticket.id },
      include: {
        ticket_sla_metrics: true,
        comments: true
      }
    })

    console.log(`\n✅ Ticket actualizado:`)
    console.log(`   firstResponseAt: ${updated.firstResponseAt}`)
    console.log(`   Comentarios: ${updated.comments.length}`)

    if (updated.ticket_sla_metrics) {
      console.log(`\n✅ Métricas SLA:`)
      console.log(`   firstResponseAt: ${updated.ticket_sla_metrics.firstResponseAt}`)
      console.log(`   responseTimeMinutes: ${updated.ticket_sla_metrics.responseTimeMinutes}`)
      console.log(`   responseSLAMet: ${updated.ticket_sla_metrics.responseSLAMet}`)
    }

    // 7. Calcular el tiempo promedio (como lo hace report-service.ts)
    const ticketsWithResponse = await prisma.tickets.findMany({
      where: {
        firstResponseAt: { not: null }
      },
      select: {
        createdAt: true,
        firstResponseAt: true
      }
    })

    if (ticketsWithResponse.length > 0) {
      const totalMinutes = ticketsWithResponse.reduce((acc, t) => {
        const responseTime = new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime()
        return acc + responseTime / (1000 * 60)
      }, 0)

      const avgMinutes = totalMinutes / ticketsWithResponse.length
      const hours = Math.floor(avgMinutes / 60)
      const minutes = Math.floor(avgMinutes % 60)

      const avgSlaResponseTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`

      console.log(`\n📊 Tiempo Promedio de Primera Respuesta:`)
      console.log(`   Tickets con respuesta: ${ticketsWithResponse.length}`)
      console.log(`   Promedio: ${avgSlaResponseTime}`)
      console.log(`\n✅ Ahora el dashboard debería mostrar: "${avgSlaResponseTime}" en lugar de "0min"`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar
addTestResponse()
  .then(() => {
    console.log('\n✅ Script completado exitosamente')
    console.log('\n📝 Próximos pasos:')
    console.log('   1. Recarga la página de reportes en el navegador')
    console.log('   2. Ve a Admin → Reportes → Cumplimiento de SLA')
    console.log('   3. Verifica que "Tiempo Promedio de Primera Respuesta" muestre "31min"')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
