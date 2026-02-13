/**
 * SCRIPT DE VALIDACIÓN DE PERFORMANCE DE BASE DE DATOS
 *
 * Este script valida que los índices estén funcionando correctamente
 * y que las queries tengan el performance esperado
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// Función para medir tiempo de ejecución
async function measureQuery(name, queryFn) {
  const start = Date.now()
  try {
    const result = await queryFn()
    const duration = Date.now() - start

    if (duration < 50) {
      log(`✅ ${name}: ${duration}ms (Excelente)`, 'green')
    } else if (duration < 100) {
      log(`⚠️  ${name}: ${duration}ms (Bueno)`, 'yellow')
    } else {
      log(`❌ ${name}: ${duration}ms (Necesita optimización)`, 'red')
    }

    return { duration, success: true, count: Array.isArray(result) ? result.length : 1 }
  } catch (error) {
    const duration = Date.now() - start
    log(`❌ ${name}: Error después de ${duration}ms - ${error.message}`, 'red')
    return { duration, success: false, error: error.message }
  }
}

// Función para verificar índices
async function checkIndexes() {
  log('\n📊 Verificando índices creados...', 'blue')

  try {
    const indexes = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `

    log(`✅ Encontrados ${indexes.length} índices personalizados`, 'green')

    // Mostrar algunos índices importantes
    const importantIndexes = [
      'idx_tickets_assignee_status',
      'idx_tickets_client_created',
      'idx_comments_ticket_created',
      'idx_audit_logs_user_created',
    ]

    for (const indexName of importantIndexes) {
      const found = indexes.find(idx => idx.indexname === indexName)
      if (found) {
        log(`  ✅ ${indexName}`, 'green')
      } else {
        log(`  ❌ ${indexName} - NO ENCONTRADO`, 'red')
      }
    }
  } catch (error) {
    log(`❌ Error verificando índices: ${error.message}`, 'red')
  }
}

// Tests de performance
async function runPerformanceTests() {
  log('\n🚀 Ejecutando tests de performance...', 'blue')

  const results = []

  // Test 1: Dashboard de técnico (query más frecuente)
  results.push(
    await measureQuery('Dashboard de técnico - Tickets asignados', () =>
      prisma.ticket.findMany({
        where: {
          assigneeId: 'test-user-id',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { name: true, email: true } },
          category: { select: { name: true } },
        },
      })
    )
  )

  // Test 2: Dashboard de cliente
  results.push(
    await measureQuery('Dashboard de cliente - Mis tickets', () =>
      prisma.ticket.findMany({
        where: {
          clientId: 'test-client-id',
          status: { not: 'CLOSED' },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      })
    )
  )

  // Test 3: Comentarios de ticket
  results.push(
    await measureQuery('Comentarios de ticket', () =>
      prisma.comment.findMany({
        where: { ticketId: 'test-ticket-id' },
        include: {
          author: { select: { name: true, avatar: true } },
        },
        orderBy: { createdAt: 'asc' },
      })
    )
  )

  // Test 4: Auditoría por usuario
  results.push(
    await measureQuery('Auditoría por usuario', () =>
      prisma.auditLog.findMany({
        where: { userId: 'test-user-id' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    )
  )

  // Test 5: Búsqueda full-text en tickets
  results.push(
    await measureQuery(
      'Búsqueda full-text en tickets',
      () => prisma.$queryRaw`
      SELECT id, title, description
      FROM tickets
      WHERE to_tsvector('spanish', title || ' ' || description) @@ plainto_tsquery('spanish', 'problema sistema')
      LIMIT 10
    `
    )
  )

  // Test 6: Categorías jerárquicas
  results.push(
    await measureQuery('Categorías jerárquicas activas', () =>
      prisma.category.findMany({
        where: {
          isActive: true,
          parentId: { not: null },
        },
        orderBy: [{ level: 'asc' }, { order: 'asc' }],
      })
    )
  )

  return results
}

// Función para verificar estadísticas de la base de datos
async function checkDatabaseStats() {
  log('\n📈 Estadísticas de la base de datos...', 'blue')

  try {
    // Conexiones activas
    const connections = await prisma.$queryRaw`
      SELECT 
        count(*)::text as active_connections,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_connections
      FROM pg_stat_activity 
      WHERE state = 'active'
    `

    const conn = connections[0]
    const activeConnections = parseInt(conn.active_connections)
    const maxConnections = parseInt(conn.max_connections)
    const usage = Math.round((activeConnections / maxConnections) * 100)
    log(
      `📊 Conexiones: ${activeConnections}/${maxConnections} (${usage}%)`,
      usage > 80 ? 'red' : usage > 60 ? 'yellow' : 'green'
    )

    // Tamaño de la base de datos
    const dbSize = await prisma.$queryRaw`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `
    log(`💾 Tamaño de BD: ${dbSize[0].size}`, 'blue')

    // Queries lentas activas
    const slowQueries = await prisma.$queryRaw`
      SELECT count(*) as slow_queries
      FROM pg_stat_activity 
      WHERE state != 'idle' 
        AND query != '<IDLE>'
        AND now() - query_start > interval '1 second'
    `

    const slowCount = slowQueries[0].slow_queries
    log(
      `🐌 Queries lentas activas: ${slowCount}`,
      slowCount > 5 ? 'red' : slowCount > 2 ? 'yellow' : 'green'
    )
  } catch (error) {
    log(`❌ Error obteniendo estadísticas: ${error.message}`, 'red')
  }
}

// Función principal
async function main() {
  log('🔍 VALIDACIÓN DE PERFORMANCE DE BASE DE DATOS', 'bold')
  log('='.repeat(50), 'blue')

  try {
    // Verificar conexión
    await prisma.$connect()
    log('✅ Conexión a base de datos establecida', 'green')

    // Verificar índices
    await checkIndexes()

    // Ejecutar tests de performance
    const results = await runPerformanceTests()

    // Mostrar estadísticas
    await checkDatabaseStats()

    // Resumen
    log('\n📋 RESUMEN DE RESULTADOS', 'bold')
    log('='.repeat(30), 'blue')

    const successful = results.filter(r => r.success).length
    const avgDuration =
      results.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) / successful

    log(`✅ Tests exitosos: ${successful}/${results.length}`, 'green')
    log(
      `⏱️  Tiempo promedio: ${Math.round(avgDuration)}ms`,
      avgDuration < 50 ? 'green' : avgDuration < 100 ? 'yellow' : 'red'
    )

    // Recomendaciones
    log('\n💡 RECOMENDACIONES:', 'bold')
    if (avgDuration > 100) {
      log('  - Considerar agregar más índices específicos', 'yellow')
      log('  - Revisar queries que no usan índices', 'yellow')
    }
    if (successful < results.length) {
      log('  - Revisar errores en queries fallidas', 'red')
    }
    if (avgDuration < 50) {
      log('  - ¡Excelente performance! Base de datos optimizada', 'green')
    }
  } catch (error) {
    log(`❌ Error durante la validación: ${error.message}`, 'red')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main, measureQuery, checkIndexes }
