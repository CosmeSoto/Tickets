/**
 * Script de diagnóstico para verificar logs de auditoría
 * Ejecutar con: npx tsx scripts/check-audit-logs.ts
 */

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAuditLogs() {
  console.log('🔍 Verificando logs de auditoría...\n')

  try {
    // 1. Contar total de logs
    const totalLogs = await prisma.audit_logs.count()
    console.log(`📊 Total de logs en la base de datos: ${totalLogs}`)

    // 2. Obtener los últimos 10 logs
    const recentLogs = await prisma.audit_logs.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    console.log(`\n📝 Últimos 10 logs registrados:\n`)
    recentLogs.forEach((log, index) => {
      console.log(`${index + 1}. [${log.createdAt.toISOString()}]`)
      console.log(`   Acción: ${log.action}`)
      console.log(`   Tipo: ${log.entityType}`)
      console.log(`   Usuario: ${log.users?.name || 'N/A'} (${log.users?.email || 'N/A'})`)
      console.log(`   Detalles:`, JSON.stringify(log.details, null, 2))
      console.log('')
    })

    // 3. Contar por tipo de acción
    const actionCounts = await prisma.audit_logs.groupBy({
      by: ['action'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    })

    console.log(`\n📈 Logs por tipo de acción:`)
    actionCounts.forEach(({ action, _count }) => {
      console.log(`   ${action}: ${_count.id}`)
    })

    // 4. Contar por tipo de entidad
    const entityCounts = await prisma.audit_logs.groupBy({
      by: ['entityType'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    })

    console.log(`\n📦 Logs por tipo de entidad:`)
    entityCounts.forEach(({ entityType, _count }) => {
      console.log(`   ${entityType}: ${_count.id}`)
    })

    // 5. Verificar logs de las últimas 24 horas
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const recentCount = await prisma.audit_logs.count({
      where: {
        createdAt: { gte: yesterday }
      }
    })

    console.log(`\n⏰ Logs de las últimas 24 horas: ${recentCount}`)

    // 6. Verificar si hay logs con detalles enriquecidos
    const logsWithContext = await prisma.audit_logs.findMany({
      where: {
        details: {
          path: ['context'],
          not: Prisma.DbNull
        }
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    })

    console.log(`\n🎯 Logs con contexto enriquecido: ${logsWithContext.length}`)
    if (logsWithContext.length > 0) {
      console.log('   Ejemplo de contexto:')
      console.log(JSON.stringify(logsWithContext[0].details, null, 2))
    }

    // 7. Verificar logs de tickets
    const ticketLogs = await prisma.audit_logs.findMany({
      where: {
        entityType: 'ticket'
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    })

    console.log(`\n🎫 Logs de tickets: ${ticketLogs.length}`)
    ticketLogs.forEach((log, index) => {
      console.log(`   ${index + 1}. ${log.action} - ${new Date(log.createdAt).toLocaleString()}`)
    })

    // 8. Verificar logs de comentarios
    const commentLogs = await prisma.audit_logs.findMany({
      where: {
        entityType: 'comment'
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    })

    console.log(`\n💬 Logs de comentarios: ${commentLogs.length}`)
    commentLogs.forEach((log, index) => {
      console.log(`   ${index + 1}. ${log.action} - ${new Date(log.createdAt).toLocaleString()}`)
    })

    // 9. Verificar logs de usuarios
    const userLogs = await prisma.audit_logs.findMany({
      where: {
        entityType: 'user'
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    })

    console.log(`\n👤 Logs de usuarios: ${userLogs.length}`)
    userLogs.forEach((log, index) => {
      console.log(`   ${index + 1}. ${log.action} - ${new Date(log.createdAt).toLocaleString()}`)
    })

    console.log('\n✅ Diagnóstico completado')

  } catch (error) {
    console.error('❌ Error al verificar logs:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAuditLogs()
