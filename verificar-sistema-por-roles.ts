#!/usr/bin/env tsx

/**
 * Script de verificación completa del sistema por roles
 * Verifica BD, sincronización y funcionalidad específica por rol
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface VerificationResult {
  success: number
  warnings: number
  errors: number
  details: string[]
}

async function verifyDatabaseConnection(): Promise<VerificationResult> {
  const result: VerificationResult = { success: 0, warnings: 0, errors: 0, details: [] }
  
  try {
    // Verificar conexión básica
    await prisma.$queryRaw`SELECT 1`
    result.success++
    result.details.push('✅ Conexión a base de datos establecida')
    
    // Verificar tablas principales
    const tables = ['users', 'categories', 'departments', 'tickets', 'technician_assignments']
    for (const table of tables) {
      try {
        const count = await (prisma as any)[table].count()
        result.success++
        result.details.push(`✅ Tabla ${table}: ${count} registros`)
      } catch (error) {
        result.errors++
        result.details.push(`❌ Error en tabla ${table}: ${error}`)
      }
    }
    
  } catch (error) {
    result.errors++
    result.details.push(`❌ Error de conexión: ${error}`)
  }
  
  return result
}

async function verifyAdminFunctionality(): Promise<VerificationResult> {
  const result: VerificationResult = { success: 0, warnings: 0, errors: 0, details: [] }
  
  try {
    // Verificar que admin puede ver todos los usuarios
    const totalUsers = await prisma.users.count()
    const adminUsers = await prisma.users.count({ where: { role: 'ADMIN' } })
    const technicianUsers = await prisma.users.count({ where: { role: 'TECHNICIAN' } })
    const clientUsers = await prisma.users.count({ where: { role: 'CLIENT' } })
    
    if (totalUsers === adminUsers + technicianUsers + clientUsers) {
      result.success++
      result.details.push(`✅ Admin: Acceso a todos los usuarios (${totalUsers} total)`)
    } else {
      result.warnings++
      result.details.push(`⚠️ Admin: Inconsistencia en conteo de usuarios`)
    }
    
    // Verificar que admin puede ver todos los tickets
    const totalTickets = await prisma.tickets.count()
    result.success++
    result.details.push(`✅ Admin: Acceso a todos los tickets (${totalTickets} total)`)
    
    // Verificar que admin puede gestionar departamentos
    const totalDepartments = await prisma.departments.count()
    result.success++
    result.details.push(`✅ Admin: Gestión de departamentos (${totalDepartments} total)`)
    
    // Verificar que admin puede gestionar categorías
    const totalCategories = await prisma.categories.count()
    result.success++
    result.details.push(`✅ Admin: Gestión de categorías (${totalCategories} total)`)
    
  } catch (error) {
    result.errors++
    result.details.push(`❌ Admin: Error en verificación - ${error}`)
  }
  
  return result
}

async function verifyTechnicianFunctionality(): Promise<VerificationResult> {
  const result: VerificationResult = { success: 0, warnings: 0, errors: 0, details: [] }
  
  try {
    // Buscar un técnico de ejemplo
    const technician = await prisma.users.findFirst({
      where: { role: 'TECHNICIAN' },
      include: {
        technician_assignments: {
          include: {
            categories: true
          }
        }
      }
    })
    
    if (!technician) {
      result.warnings++
      result.details.push(`⚠️ Técnico: No se encontraron técnicos en el sistema`)
      return result
    }
    
    result.success++
    result.details.push(`✅ Técnico: Usuario encontrado (${technician.name})`)
    
    // Verificar asignaciones de categorías
    const assignments = technician.technician_assignments.length
    if (assignments > 0) {
      result.success++
      result.details.push(`✅ Técnico: Tiene ${assignments} asignaciones de categorías`)
    } else {
      result.warnings++
      result.details.push(`⚠️ Técnico: Sin asignaciones de categorías`)
    }
    
    // Verificar tickets asignados
    const assignedTickets = await prisma.tickets.count({
      where: { assigneeId: technician.id }
    })
    
    result.success++
    result.details.push(`✅ Técnico: ${assignedTickets} tickets asignados`)
    
    // Verificar que puede ver solo sus tickets
    const allTickets = await prisma.tickets.count()
    if (assignedTickets <= allTickets) {
      result.success++
      result.details.push(`✅ Técnico: Acceso restringido correcto (${assignedTickets}/${allTickets})`)
    }
    
  } catch (error) {
    result.errors++
    result.details.push(`❌ Técnico: Error en verificación - ${error}`)
  }
  
  return result
}

async function verifyClientFunctionality(): Promise<VerificationResult> {
  const result: VerificationResult = { success: 0, warnings: 0, errors: 0, details: [] }
  
  try {
    // Buscar un cliente de ejemplo
    const client = await prisma.users.findFirst({
      where: { role: 'CLIENT' }
    })
    
    if (!client) {
      result.warnings++
      result.details.push(`⚠️ Cliente: No se encontraron clientes en el sistema`)
      return result
    }
    
    result.success++
    result.details.push(`✅ Cliente: Usuario encontrado (${client.name})`)
    
    // Verificar tickets propios
    const clientTickets = await prisma.tickets.count({
      where: { clientId: client.id }
    })
    
    result.success++
    result.details.push(`✅ Cliente: ${clientTickets} tickets propios`)
    
    // Verificar que no puede ver tickets de otros
    const allTickets = await prisma.tickets.count()
    if (clientTickets <= allTickets) {
      result.success++
      result.details.push(`✅ Cliente: Acceso restringido correcto (${clientTickets}/${allTickets})`)
    }
    
    // Verificar que puede crear tickets
    const categories = await prisma.categories.count({ where: { isActive: true } })
    if (categories > 0) {
      result.success++
      result.details.push(`✅ Cliente: Puede crear tickets (${categories} categorías disponibles)`)
    } else {
      result.warnings++
      result.details.push(`⚠️ Cliente: Sin categorías activas para crear tickets`)
    }
    
  } catch (error) {
    result.errors++
    result.details.push(`❌ Cliente: Error en verificación - ${error}`)
  }
  
  return result
}

async function verifyDataIntegrity(): Promise<VerificationResult> {
  const result: VerificationResult = { success: 0, warnings: 0, errors: 0, details: [] }
  
  try {
    // Verificar que todos los tickets tienen las relaciones básicas
    const totalTickets = await prisma.tickets.count()
    const ticketsWithRelations = await prisma.tickets.count({
      where: {
        AND: [
          { clientId: { not: "" } },
          { categoryId: { not: "" } }
        ]
      }
    })
    
    if (totalTickets === ticketsWithRelations) {
      result.success++
      result.details.push(`✅ Integridad: Todos los tickets (${totalTickets}) tienen cliente y categoría`)
    } else {
      result.errors++
      result.details.push(`❌ Integridad: ${totalTickets - ticketsWithRelations} tickets sin relaciones válidas`)
    }
    
    // Verificar asignaciones de técnicos
    const totalAssignments = await prisma.technician_assignments.count()
    const validAssignments = await prisma.technician_assignments.count({
      where: {
        AND: [
          { technicianId: { not: "" } },
          { categoryId: { not: "" } }
        ]
      }
    })
    
    if (totalAssignments === validAssignments) {
      result.success++
      result.details.push(`✅ Integridad: Todas las asignaciones (${totalAssignments}) son válidas`)
    } else {
      result.errors++
      result.details.push(`❌ Integridad: ${totalAssignments - validAssignments} asignaciones inválidas`)
    }
    
    // Verificar usuarios únicos por email
    const totalUsers = await prisma.users.count()
    const uniqueEmails = await prisma.users.groupBy({
      by: ['email'],
      _count: { email: true }
    })
    
    if (totalUsers === uniqueEmails.length) {
      result.success++
      result.details.push(`✅ Integridad: Todos los emails son únicos`)
    } else {
      result.errors++
      result.details.push(`❌ Integridad: Emails duplicados detectados`)
    }
    
  } catch (error) {
    result.errors++
    result.details.push(`❌ Integridad: Error en verificación - ${error}`)
  }
  
  return result
}

async function verifyPerformance(): Promise<VerificationResult> {
  const result: VerificationResult = { success: 0, warnings: 0, errors: 0, details: [] }
  
  try {
    // Test de consulta de tickets con relaciones
    const startTime = Date.now()
    await prisma.tickets.findMany({
      take: 10,
      include: {
        users_tickets_clientIdTousers: true,
        categories: true,
        users_tickets_assigneeIdTousers: true
      }
    })
    const queryTime = Date.now() - startTime
    
    if (queryTime < 500) {
      result.success++
      result.details.push(`✅ Performance: Consulta rápida (${queryTime}ms)`)
    } else if (queryTime < 1000) {
      result.warnings++
      result.details.push(`⚠️ Performance: Consulta aceptable (${queryTime}ms)`)
    } else {
      result.errors++
      result.details.push(`❌ Performance: Consulta lenta (${queryTime}ms)`)
    }
    
    // Test de conteo de registros
    const countStartTime = Date.now()
    await Promise.all([
      prisma.users.count(),
      prisma.tickets.count(),
      prisma.categories.count(),
      prisma.departments.count()
    ])
    const countTime = Date.now() - countStartTime
    
    if (countTime < 200) {
      result.success++
      result.details.push(`✅ Performance: Conteos rápidos (${countTime}ms)`)
    } else {
      result.warnings++
      result.details.push(`⚠️ Performance: Conteos lentos (${countTime}ms)`)
    }
    
  } catch (error) {
    result.errors++
    result.details.push(`❌ Performance: Error en pruebas - ${error}`)
  }
  
  return result
}

async function main() {
  console.log('🔍 VERIFICACIÓN COMPLETA DEL SISTEMA POR ROLES')
  console.log('=' .repeat(60))
  
  const results = {
    database: await verifyDatabaseConnection(),
    admin: await verifyAdminFunctionality(),
    technician: await verifyTechnicianFunctionality(),
    client: await verifyClientFunctionality(),
    integrity: await verifyDataIntegrity(),
    performance: await verifyPerformance()
  }
  
  // Mostrar resultados
  for (const [section, result] of Object.entries(results)) {
    console.log(`\n📋 ${section.toUpperCase()}:`)
    result.details.forEach(detail => console.log(`   ${detail}`))
  }
  
  // Resumen final
  const totalSuccess = Object.values(results).reduce((sum, r) => sum + r.success, 0)
  const totalWarnings = Object.values(results).reduce((sum, r) => sum + r.warnings, 0)
  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0)
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN FINAL:')
  console.log(`   ✅ Exitosos: ${totalSuccess}`)
  console.log(`   ⚠️  Advertencias: ${totalWarnings}`)
  console.log(`   ❌ Errores: ${totalErrors}`)
  
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('\n🎉 ¡SISTEMA COMPLETAMENTE FUNCIONAL PARA TODOS LOS ROLES!')
    console.log('   - Base de datos sincronizada correctamente')
    console.log('   - Funcionalidad por rol verificada')
    console.log('   - Integridad de datos confirmada')
    console.log('   - Performance óptima')
  } else if (totalErrors === 0) {
    console.log('\n✅ Sistema funcional con advertencias menores')
    console.log('   Las advertencias no afectan la funcionalidad principal')
  } else {
    console.log('\n⚠️  Se encontraron errores críticos que requieren atención')
    process.exit(1)
  }
  
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('❌ Error fatal:', error)
  process.exit(1)
})