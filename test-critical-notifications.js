#!/usr/bin/env node

/**
 * Script para probar notificaciones críticas con datos reales
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testCriticalNotifications() {
  console.log('🔔 PRUEBA DE NOTIFICACIONES CRÍTICAS')
  console.log('====================================')
  
  try {
    // Buscar un ticket crítico sin asignar para simular la notificación
    const criticalTicket = await prisma.tickets.findFirst({
      where: {
        assigneeId: null,
        priority: 'HIGH',
        status: 'OPEN'
      },
      include: {
        users_tickets_clientIdTousers: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    if (criticalTicket) {
      const now = new Date()
      const hoursOld = Math.floor((now.getTime() - criticalTicket.createdAt.getTime()) / (1000 * 60 * 60))
      const minutesOld = Math.floor(((now.getTime() - criticalTicket.createdAt.getTime()) % (1000 * 60 * 60)) / (1000 * 60))
      
      console.log('🚨 NOTIFICACIÓN CRÍTICA DETECTADA:')
      console.log(`   Título: "${criticalTicket.title}"`)
      console.log(`   Tiempo sin asignar: ${hoursOld}h ${minutesOld}min`)
      console.log(`   Cliente: ${criticalTicket.users_tickets_clientIdTousers?.name || 'Desconocido'}`)
      console.log(`   ID del ticket: ${criticalTicket.id}`)
      
      // Simular el mensaje de notificación exacto
      const notificationMessage = `"${criticalTicket.title}" lleva ${hoursOld}h sin asignar. Cliente: ${criticalTicket.users_tickets_clientIdTousers?.name || 'Desconocido'}`
      console.log('\n📱 MENSAJE DE NOTIFICACIÓN:')
      console.log(`   🚨 Ticket crítico sin asignar`)
      console.log(`   ${notificationMessage}`)
      
    } else {
      console.log('✅ No hay tickets críticos sin asignar en este momento')
    }
    
    // Verificar tickets que están próximos a vencer SLA
    console.log('\n⏰ VERIFICANDO TICKETS PRÓXIMOS A VENCER SLA...')
    
    const now = new Date()
    
    // Tickets HIGH que están entre 2h y 4h (próximos a vencer)
    const nearSLATickets = await prisma.tickets.findMany({
      where: {
        priority: 'HIGH',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        createdAt: {
          lt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // Más de 2h
          gte: new Date(now.getTime() - 4 * 60 * 60 * 1000)  // Menos de 4h
        }
      },
      include: {
        users_tickets_clientIdTousers: { select: { name: true } },
        users_tickets_assigneeIdTousers: { select: { name: true } }
      },
      orderBy: { createdAt: 'asc' }
    })
    
    if (nearSLATickets.length > 0) {
      console.log(`⚠️  ${nearSLATickets.length} tickets próximos a vencer SLA:`)
      
      nearSLATickets.forEach(ticket => {
        const hoursLeft = 4 - Math.floor((now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60))
        console.log(`   - "${ticket.title}" vence en ${hoursLeft}h`)
        console.log(`     Asignado a: ${ticket.users_tickets_assigneeIdTousers?.name || 'Sin asignar'}`)
        console.log(`     Cliente: ${ticket.users_tickets_clientIdTousers?.name || 'Desconocido'}`)
      })
    } else {
      console.log('✅ No hay tickets próximos a vencer SLA')
    }
    
    console.log('\n✨ PRUEBA DE NOTIFICACIONES COMPLETADA ✨')
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar prueba
testCriticalNotifications()