import { PrismaClient } from '@prisma/client'
import { SLAService } from '../src/lib/services/sla-service'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Asignando SLA a tickets existentes...\n')

  // Obtener tickets sin SLA
  const ticketsWithoutSLA = await prisma.tickets.findMany({
    where: {
      ticket_sla_metrics: null
    },
    include: {
      categories: true,
      users_tickets_clientIdTousers: {
        select: { name: true }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  if (ticketsWithoutSLA.length === 0) {
    console.log('✅ Todos los tickets ya tienen SLA asignado')
    return
  }

  console.log(`📋 Encontrados ${ticketsWithoutSLA.length} tickets sin SLA:\n`)

  for (const ticket of ticketsWithoutSLA) {
    console.log(`  • Ticket: ${ticket.title}`)
    console.log(`    Prioridad: ${ticket.priority}`)
    console.log(`    Cliente: ${ticket.users_tickets_clientIdTousers.name}`)
    console.log(`    Categoría: ${ticket.categories.name}`)
    console.log(`    Creado: ${ticket.createdAt.toLocaleString()}`)
    
    try {
      // Asignar SLA usando el servicio
      await SLAService.assignSLA(ticket.id)
      
      // Verificar si se asignó
      const metrics = await prisma.ticket_sla_metrics.findUnique({
        where: { ticketId: ticket.id },
        include: {
          sla_policy: {
            select: { name: true }
          }
        }
      })
      
      if (metrics) {
        console.log(`    ✅ SLA asignado: ${metrics.sla_policy.name}`)
        console.log(`       Respuesta: ${metrics.responseDeadline?.toLocaleString()}`)
        console.log(`       Resolución: ${metrics.resolutionDeadline?.toLocaleString()}`)
        
        // Si el ticket ya tiene primera respuesta, registrarla
        const firstComment = await prisma.comments.findFirst({
          where: {
            ticketId: ticket.id,
            users: {
              role: { in: ['TECHNICIAN', 'ADMIN'] }
            },
            isInternal: false
          },
          orderBy: {
            createdAt: 'asc'
          }
        })
        
        if (firstComment) {
          await SLAService.recordFirstResponse(ticket.id)
          console.log(`       ✅ Primera respuesta registrada`)
        }
        
        // Si el ticket está resuelto, registrar resolución
        if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
          await SLAService.recordResolution(ticket.id)
          console.log(`       ✅ Resolución registrada`)
        }
      } else {
        console.log(`    ⚠️  No se pudo asignar SLA (no hay política para ${ticket.priority})`)
      }
    } catch (error) {
      console.log(`    ❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
    
    console.log('')
  }

  // Resumen final
  const totalWithSLA = await prisma.ticket_sla_metrics.count()
  const totalTickets = await prisma.tickets.count()
  
  console.log('\n📊 Resumen:')
  console.log(`   Total de tickets: ${totalTickets}`)
  console.log(`   Tickets con SLA: ${totalWithSLA}`)
  console.log(`   Tickets sin SLA: ${totalTickets - totalWithSLA}`)
  
  if (totalWithSLA === totalTickets) {
    console.log('\n✅ ¡Todos los tickets tienen SLA asignado!')
  }
}

main()
  .catch(e => {
    console.error('❌ Error:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
