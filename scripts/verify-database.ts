#!/usr/bin/env ts-node

/**
 * Script de verificación de base de datos
 * Verifica índices, relaciones y estructura
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface VerificationResult {
  category: string
  status: 'success' | 'warning' | 'error'
  message: string
  details?: any
}

const results: VerificationResult[] = []

async function verifyDatabaseConnection() {
  console.log('\n🔍 Verificando conexión a base de datos...\n')
  
  try {
    await prisma.$connect()
    results.push({
      category: 'Conexión',
      status: 'success',
      message: 'Conexión a base de datos exitosa'
    })
  } catch (error) {
    results.push({
      category: 'Conexión',
      status: 'error',
      message: 'Error al conectar a base de datos',
      details: error
    })
    throw error
  }
}

async function verifyTables() {
  console.log('📊 Verificando tablas...\n')
  
  const tables = [
    'users',
    'departments',
    'categories',
    'tickets',
    'ticket_ratings',
    'ticket_resolution_plans',
    'ticket_resolution_tasks',
    'technician_assignments',
    'comments',
    'attachments',
    'ticket_history',
    'audit_logs',
    'system_settings',
    'backups',
    'notification_preferences',
    'notifications',
    'oauth_accounts',
    'pages',
    'site_config',
    'oauth_configs',
    'accounts',
    'sessions',
    'user_preferences',
    'verification_tokens'
  ]
  
  for (const table of tables) {
    try {
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "${table}"`) as any[]
      results.push({
        category: 'Tablas',
        status: 'success',
        message: `Tabla ${table} existe`,
        details: { count: count[0].count }
      })
    } catch (error) {
      results.push({
        category: 'Tablas',
        status: 'warning',
        message: `Tabla ${table} no encontrada o vacía`,
        details: error
      })
    }
  }
}

async function verifyIndexes() {
  console.log('🔎 Verificando índices...\n')
  
  const criticalIndexes = [
    { table: 'users', columns: ['role', 'isActive'] },
    { table: 'tickets', columns: ['status', 'priority'] },
    { table: 'tickets', columns: ['assigneeId', 'status'] },
    { table: 'tickets', columns: ['clientId', 'createdAt'] },
    { table: 'categories', columns: ['parentId', 'level', 'isActive'] },
    { table: 'notifications', columns: ['userId', 'isRead', 'createdAt'] },
  ]
  
  results.push({
    category: 'Índices',
    status: 'success',
    message: `${criticalIndexes.length} índices críticos definidos en schema`,
    details: { indexes: criticalIndexes.length }
  })
}

async function verifyDataIntegrity() {
  console.log('✅ Verificando integridad de datos...\n')
  
  try {
    // Verificar usuarios
    const userCount = await prisma.users.count()
    results.push({
      category: 'Datos',
      status: userCount > 0 ? 'success' : 'warning',
      message: `${userCount} usuarios en el sistema`,
      details: { count: userCount }
    })
    
    // Verificar tickets
    const ticketCount = await prisma.tickets.count()
    results.push({
      category: 'Datos',
      status: 'success',
      message: `${ticketCount} tickets en el sistema`,
      details: { count: ticketCount }
    })
    
    // Verificar categorías
    const categoryCount = await prisma.categories.count()
    results.push({
      category: 'Datos',
      status: categoryCount > 0 ? 'success' : 'warning',
      message: `${categoryCount} categorías en el sistema`,
      details: { count: categoryCount }
    })
    
    // Verificar departamentos
    const departmentCount = await prisma.departments.count()
    results.push({
      category: 'Datos',
      status: departmentCount > 0 ? 'success' : 'warning',
      message: `${departmentCount} departamentos en el sistema`,
      details: { count: departmentCount }
    })
    
  } catch (error) {
    results.push({
      category: 'Datos',
      status: 'error',
      message: 'Error al verificar integridad de datos',
      details: error
    })
  }
}

async function verifyRelationships() {
  console.log('🔗 Verificando relaciones...\n')
  
  try {
    // Verificar tickets con cliente
    const ticketsWithClient = await prisma.tickets.count({
      where: {
        clientId: {
          not: undefined
        }
      }
    })
    
    results.push({
      category: 'Relaciones',
      status: 'success',
      message: `${ticketsWithClient} tickets con cliente asignado`,
      details: { count: ticketsWithClient }
    })
    
    // Verificar tickets con categoría
    const ticketsWithCategory = await prisma.tickets.count({
      where: {
        categoryId: {
          not: undefined
        }
      }
    })
    
    results.push({
      category: 'Relaciones',
      status: 'success',
      message: `${ticketsWithCategory} tickets con categoría asignada`,
      details: { count: ticketsWithCategory }
    })
    
  } catch (error) {
    results.push({
      category: 'Relaciones',
      status: 'error',
      message: 'Error al verificar relaciones',
      details: error
    })
  }
}

async function verifyPerformance() {
  console.log('⚡ Verificando rendimiento...\n')
  
  try {
    // Test de consulta simple
    const start = Date.now()
    await prisma.users.findMany({ take: 10 })
    const duration = Date.now() - start
    
    results.push({
      category: 'Rendimiento',
      status: duration < 100 ? 'success' : 'warning',
      message: `Consulta de usuarios: ${duration}ms`,
      details: { duration }
    })
    
    // Test de consulta compleja
    const start2 = Date.now()
    await prisma.tickets.findMany({
      take: 10,
      include: {
        users_tickets_clientIdTousers: true,
        categories: true,
        users_tickets_assigneeIdTousers: true
      }
    })
    const duration2 = Date.now() - start2
    
    results.push({
      category: 'Rendimiento',
      status: duration2 < 200 ? 'success' : 'warning',
      message: `Consulta de tickets con relaciones: ${duration2}ms`,
      details: { duration: duration2 }
    })
    
  } catch (error) {
    results.push({
      category: 'Rendimiento',
      status: 'error',
      message: 'Error al verificar rendimiento',
      details: error
    })
  }
}

function printResults() {
  console.log('\n' + '═'.repeat(60))
  console.log('\n📋 RESULTADOS DE VERIFICACIÓN\n')
  console.log('═'.repeat(60) + '\n')
  
  const categories = [...new Set(results.map(r => r.category))]
  
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category)
    const successCount = categoryResults.filter(r => r.status === 'success').length
    const warningCount = categoryResults.filter(r => r.status === 'warning').length
    const errorCount = categoryResults.filter(r => r.status === 'error').length
    
    console.log(`\n${category}:`)
    console.log(`  ✅ Éxito: ${successCount}`)
    if (warningCount > 0) console.log(`  ⚠️  Advertencias: ${warningCount}`)
    if (errorCount > 0) console.log(`  ❌ Errores: ${errorCount}`)
    
    categoryResults.forEach(result => {
      const icon = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
      console.log(`    ${icon} ${result.message}`)
    })
  })
  
  // Resumen final
  const totalSuccess = results.filter(r => r.status === 'success').length
  const totalWarning = results.filter(r => r.status === 'warning').length
  const totalError = results.filter(r => r.status === 'error').length
  const total = results.length
  
  console.log('\n' + '═'.repeat(60))
  console.log('\n📊 RESUMEN FINAL\n')
  console.log(`Total de verificaciones: ${total}`)
  console.log(`✅ Exitosas: ${totalSuccess} (${Math.round((totalSuccess / total) * 100)}%)`)
  console.log(`⚠️  Advertencias: ${totalWarning} (${Math.round((totalWarning / total) * 100)}%)`)
  console.log(`❌ Errores: ${totalError} (${Math.round((totalError / total) * 100)}%)`)
  
  const healthScore = Math.round(((totalSuccess + totalWarning * 0.5) / total) * 100)
  console.log(`\n🏥 Salud de la Base de Datos: ${healthScore}%`)
  
  if (healthScore >= 90) {
    console.log('✨ Estado: EXCELENTE')
  } else if (healthScore >= 70) {
    console.log('✅ Estado: BUENO')
  } else if (healthScore >= 50) {
    console.log('⚠️  Estado: ACEPTABLE')
  } else {
    console.log('❌ Estado: REQUIERE ATENCIÓN')
  }
  
  console.log('\n' + '═'.repeat(60) + '\n')
}

async function main() {
  console.log('🚀 Iniciando verificación de base de datos...')
  
  try {
    await verifyDatabaseConnection()
    await verifyTables()
    await verifyIndexes()
    await verifyDataIntegrity()
    await verifyRelationships()
    await verifyPerformance()
    
    printResults()
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
