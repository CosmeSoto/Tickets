/**
 * Script simple para corregir firstResponseAt en tickets
 * Ejecutar con: node scripts/fix-first-response-simple.js
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixFirstResponse() {
  console.log('🔧 Corrigiendo campo firstResponseAt en tickets...\n')

  try {
    // 1. Obtener tickets con comentarios pero sin firstResponseAt
    const ticketsToFix = await prisma.tickets.findMany({
      where: {
        firstResponseAt: null,
        comments: {
          some: {
            users: {
              role: {
                in: ['TECHNICIAN', 'ADMIN']
              }
            }
          }
        }
      },
      include: {
        comments: {
          where: {
            users: {
              role: {
                in: ['TECHNICIAN', 'ADMIN']
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          },
          take: 1
        },
        ticket_sla_metrics: true
      }
    })

    console.log(`📊 Tickets a corregir: ${ticketsToFix.length}\n`)

    if (ticketsToFix.length === 0) {
      console.log('✅ No hay tickets que necesiten corrección')
      return
    }

    let fixed = 0

    for (const ticket of ticketsToFix) {
      const firstComment = ticket.comments[0]
      
      if (!firstComment) continue

      const firstResponseDate = firstComment.createdAt

      console.log(`📋 Ticket #${ticket.id}: Actualizando firstResponseAt a ${firstResponseDate.toISOString()}`)

      // Actualizar tickets.firstResponseAt
      await prisma.tickets.update({
        where: { id: ticket.id },
        data: {
          firstResponseAt: firstResponseDate
        }
      })

      // Si tiene métricas SLA, actualizar también
      if (ticket.ticket_sla_metrics) {
        const responseTimeMins = Math.floor(
          (firstResponseDate.getTime() - ticket.createdAt.getTime()) / (1000 * 60)
        )

        await prisma.ticket_sla_metrics.update({
          where: { ticketId: ticket.id },
          data: {
            firstResponseAt: firstResponseDate,
            responseTimeMinutes: responseTimeMins
          }
        })

        console.log(`   ✅ Actualizado (${responseTimeMins} minutos de respuesta)`)
      } else {
        console.log(`   ✅ Actualizado (sin métricas SLA)`)
      }

      fixed++
    }

    console.log(`\n✅ Corrección completada: ${fixed} tickets actualizados`)

    // Calcular y mostrar el tiempo promedio
    const ticketsWithResponse = await prisma.tickets.findMany({
      where: {
        firstResponseAt: {
          not: null
        }
      },
      select: {
        createdAt: true,
        firstResponseAt: true
      }
    })

    if (ticketsWithResponse.length > 0) {
      const totalMinutes = ticketsWithResponse.reduce((acc, ticket) => {
        const responseTime = new Date(ticket.firstResponseAt).getTime() - new Date(ticket.createdAt).getTime()
        return acc + responseTime / (1000 * 60)
      }, 0)

      const avgMinutes = totalMinutes / ticketsWithResponse.length
      const hours = Math.floor(avgMinutes / 60)
      const minutes = Math.floor(avgMinutes % 60)

      console.log(`\n📊 Estadísticas:`)
      console.log(`   Total tickets con respuesta: ${ticketsWithResponse.length}`)
      console.log(`   Tiempo promedio: ${hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`}`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar
fixFirstResponse()
  .then(() => {
    console.log('\n✅ Script completado exitosamente')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
