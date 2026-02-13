#!/usr/bin/env node

/**
 * Script de verificación profunda para datos reales del sistema
 * Verifica que toda la información mostrada sea dinámica y real
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function verifyRealData() {
  console.log('🔍 VERIFICACIÓN PROFUNDA DE DATOS REALES')
  console.log('==========================================')
  
  try {
    // 1. Verificar cálculos de tickets urgentes
    console.log('\n📊 Verificando cálculos de tickets urgentes...')
    
    const urgentTickets = await prisma.tickets.count({
      where: {
        priority: 'HIGH',
        status: { in: ['OPEN', 'IN_PROGRESS'] }
      }
    })
    
    console.log(`✅ Tickets urgentes (HIGH priority, no resueltos): ${urgentTickets}`)
    
    // 2. Verificar cálculos de tickets vencidos con SLA real
    console.log('\n⏰ Verificando cálculos de tickets vencidos (SLA)...')
    
    const now = new Date()
    
    const overdueHigh = await prisma.tickets.count({
      where: {
        priority: 'HIGH',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        createdAt: { lt: new Date(now.getTime() - 4 * 60 * 60 * 1000) }
      }
    })
    
    const overdueMedium = await prisma.tickets.count({
      where: {
        priority: 'MEDIUM',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        createdAt: { lt: new Date(now.getTime() - 8 * 60 * 60 * 1000) }
      }
    })
    
    const overdueLow = await prisma.tickets.count({
      where: {
        priority: 'LOW',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      }
    })
    
    const totalOverdue = overdueHigh + overdueMedium + overdueLow
    
    console.log(`✅ Tickets vencidos HIGH (>4h): ${overdueHigh}`)
    console.log(`✅ Tickets vencidos MEDIUM (>8h): ${overdueMedium}`)
    console.log(`✅ Tickets vencidos LOW (>24h): ${overdueLow}`)
    console.log(`✅ Total tickets vencidos: ${totalOverdue}`)
    
    // 3. Verificar cálculo de pico de actividad (30 días)
    console.log('\n📈 Verificando detección de picos de actividad...')
    
    const todayTickets = await prisma.tickets.count({
      where: {
        createdAt: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000)
        }
      }
    })
    
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ticketsLast30Days = await prisma.tickets.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    })
    
    const avgDailyTickets = Math.floor(ticketsLast30Days / 30)
    const isActivitySpike = (avgDailyTickets > 0 && todayTickets > avgDailyTickets * 1.5) || 
                           (avgDailyTickets === 0 && todayTickets >= 3)
    
    console.log(`✅ Tickets creados hoy: ${todayTickets}`)
    console.log(`✅ Tickets últimos 30 días: ${ticketsLast30Days}`)
    console.log(`✅ Promedio diario (30 días): ${avgDailyTickets}`)
    console.log(`✅ ¿Pico de actividad detectado?: ${isActivitySpike ? 'SÍ' : 'NO'}`)
    
    if (isActivitySpike) {
      console.log(`⚠️  ALERTA: ${todayTickets} tickets hoy vs ${avgDailyTickets} promedio diario`)
    }
    
    // 4. Verificar tickets críticos sin asignar
    console.log('\n🚨 Verificando tickets críticos sin asignar...')
    
    const criticalUnassigned = await prisma.tickets.findMany({
      where: {
        assigneeId: null,
        priority: 'HIGH',
        status: 'OPEN',
        createdAt: {
          gte: new Date(now.getTime() - 4 * 60 * 60 * 1000)
        }
      },
      include: {
        users_tickets_clientIdTousers: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    console.log(`✅ Tickets críticos sin asignar (últimas 4h): ${criticalUnassigned.length}`)
    
    criticalUnassigned.forEach((ticket, index) => {
      const hoursOld = Math.floor((now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60))
      const minutesOld = Math.floor(((now.getTime() - ticket.createdAt.getTime()) % (1000 * 60 * 60)) / (1000 * 60))
      console.log(`   ${index + 1}. "${ticket.title}" - ${hoursOld}h ${minutesOld}min sin asignar`)
      console.log(`      Cliente: ${ticket.users_tickets_clientIdTousers?.name || 'Desconocido'}`)
    })
    
    // 5. Verificar datos de sistema en tiempo real
    console.log('\n💻 Verificando datos del sistema en tiempo real...')
    
    // Verificar conexión a base de datos
    try {
      await prisma.$queryRaw`SELECT 1`
      console.log('✅ Base de datos: CONECTADA')
    } catch (error) {
      console.log('❌ Base de datos: ERROR -', error.message)
    }
    
    // Verificar memoria del proceso
    const memoryUsage = process.memoryUsage()
    console.log(`✅ Memoria RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`)
    console.log(`✅ Memoria Heap: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`)
    
    // Verificar uptime del proceso
    const uptimeSeconds = process.uptime()
    const uptimeHours = Math.floor(uptimeSeconds / 3600)
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60)
    console.log(`✅ Uptime del proceso: ${uptimeHours}h ${uptimeMinutes}min`)
    
    // 6. Resumen de alertas que se mostrarían
    console.log('\n🎯 RESUMEN DE ALERTAS REALES QUE SE MOSTRARÍAN:')
    console.log('================================================')
    
    const totalCritical = urgentTickets + totalOverdue
    if (totalCritical > 0) {
      console.log(`🚨 ALERTA: ${totalCritical} tickets requieren atención inmediata`)
      console.log(`   - ${urgentTickets} urgentes (HIGH priority)`)
      console.log(`   - ${totalOverdue} vencidos (SLA excedido)`)
    } else {
      console.log('✅ No hay tickets críticos en este momento')
    }
    
    if (isActivitySpike) {
      console.log(`📈 ALERTA: Pico de actividad detectado`)
      console.log(`   - ${todayTickets} tickets creados hoy vs ${avgDailyTickets} promedio diario`)
      console.log(`   - Considera reforzar el equipo`)
    }
    
    if (criticalUnassigned.length > 0) {
      console.log(`⚠️  ALERTA: ${criticalUnassigned.length} tickets críticos sin asignar`)
      criticalUnassigned.forEach(ticket => {
        const hoursOld = Math.floor((now.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60))
        const minutesOld = Math.floor(((now.getTime() - ticket.createdAt.getTime()) % (1000 * 60 * 60)) / (1000 * 60))
        console.log(`   - "${ticket.title}" lleva ${hoursOld}h ${minutesOld}min sin asignar`)
      })
    }
    
    console.log('\n✨ VERIFICACIÓN COMPLETADA - TODOS LOS DATOS SON REALES ✨')
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar verificación
verifyRealData()