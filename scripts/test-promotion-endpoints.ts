/**
 * Script de prueba para verificar los endpoints de promoción/despromoción
 * Ejecutar con: npx tsx scripts/test-promotion-endpoints.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testPromotionEndpoints() {
  console.log('🧪 Iniciando pruebas de endpoints de promoción...\n')

  try {
    // 1. Buscar un usuario cliente
    console.log('1️⃣ Buscando usuarios clientes...')
    const clients = await prisma.users.findMany({
      where: { role: 'CLIENT' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    if (clients.length === 0) {
      console.log('❌ No se encontraron usuarios clientes')
      return
    }

    console.log(`✅ Encontrados ${clients.length} clientes:`)
    clients.forEach(c => console.log(`   - ${c.name} (${c.email})`))
    console.log()

    // 2. Verificar tickets pendientes de cada cliente
    console.log('2️⃣ Verificando tickets pendientes...')
    for (const client of clients) {
      const pendingTickets = await prisma.tickets.count({
        where: {
          clientId: client.id,
          status: {
            in: ['OPEN', 'IN_PROGRESS']
          }
        }
      })

      const canPromote = pendingTickets === 0
      const icon = canPromote ? '✅' : '⚠️'
      console.log(`   ${icon} ${client.name}: ${pendingTickets} tickets pendientes ${canPromote ? '(puede promover)' : '(no puede promover)'}`)
    }
    console.log()

    // 3. Buscar técnicos
    console.log('3️⃣ Buscando técnicos...')
    const technicians = await prisma.users.findMany({
      where: { role: 'TECHNICIAN' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    if (technicians.length === 0) {
      console.log('❌ No se encontraron técnicos')
    } else {
      console.log(`✅ Encontrados ${technicians.length} técnicos:`)
      technicians.forEach(t => console.log(`   - ${t.name} (${t.email})`))
      console.log()

      // 4. Verificar tickets asignados a cada técnico
      console.log('4️⃣ Verificando tickets asignados a técnicos...')
      for (const tech of technicians) {
        const assignedTickets = await prisma.tickets.count({
          where: {
            assigneeId: tech.id,
            status: {
              in: ['OPEN', 'IN_PROGRESS']
            }
          }
        })

        const activeAssignments = await prisma.technician_assignments.count({
          where: {
            technicianId: tech.id,
            isActive: true
          }
        })

        const canDemote = assignedTickets === 0 && activeAssignments === 0
        const icon = canDemote ? '✅' : '⚠️'
        console.log(`   ${icon} ${tech.name}: ${assignedTickets} tickets asignados, ${activeAssignments} asignaciones ${canDemote ? '(puede despromover)' : '(no puede despromover)'}`)
      }
      console.log()
    }

    // 5. Verificar enums
    console.log('5️⃣ Verificando enums de TicketStatus...')
    const statusCounts = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT status, COUNT(*) as count
      FROM tickets
      GROUP BY status
    `
    
    console.log('   Estados de tickets en la base de datos:')
    statusCounts.forEach(s => console.log(`   - ${s.status}: ${s.count} tickets`))
    console.log()

    console.log('✅ Pruebas completadas exitosamente')
    console.log('\n📋 Resumen:')
    console.log(`   - Clientes encontrados: ${clients.length}`)
    console.log(`   - Técnicos encontrados: ${technicians.length}`)
    console.log(`   - Estados de tickets válidos: ${statusCounts.map(s => s.status).join(', ')}`)

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error)
    if (error instanceof Error) {
      console.error('   Mensaje:', error.message)
      console.error('   Stack:', error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar pruebas
testPromotionEndpoints()
  .then(() => {
    console.log('\n✅ Script finalizado')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error)
    process.exit(1)
  })
