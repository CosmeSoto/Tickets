#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')

async function testCategoriesDebug() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 DIAGNÓSTICO COMPLETO DEL MÓDULO CATEGORÍAS')
    console.log('=' .repeat(60))
    
    // 1. Verificar conexión a base de datos
    console.log('\n1. VERIFICANDO CONEXIÓN A BASE DE DATOS...')
    await prisma.$connect()
    console.log('✅ Conexión a base de datos exitosa')
    
    // 2. Contar categorías totales
    console.log('\n2. CONTANDO CATEGORÍAS...')
    const totalCategories = await prisma.category.count()
    console.log(`📊 Total de categorías en BD: ${totalCategories}`)
    
    // 3. Obtener todas las categorías con detalles
    console.log('\n3. OBTENIENDO CATEGORÍAS CON DETALLES...')
    const categories = await prisma.category.findMany({
      orderBy: [
        { level: 'asc' },
        { order: 'asc' },
        { name: 'asc' }
      ],
      include: {
        parent: {
          select: { id: true, name: true, color: true, level: true }
        },
        children: {
          select: { id: true, name: true, color: true, level: true, isActive: true },
          where: { isActive: true },
          orderBy: { name: 'asc' }
        },
        _count: {
          select: { tickets: true, children: true }
        },
        technicianAssignments: {
          where: { isActive: true },
          include: {
            technician: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    })
    
    console.log(`📋 Categorías encontradas: ${categories.length}`)
    
    // 4. Mostrar estructura de categorías
    console.log('\n4. ESTRUCTURA DE CATEGORÍAS:')
    categories.forEach((cat, index) => {
      console.log(`${index + 1}. [Nivel ${cat.level}] ${cat.name}`)
      console.log(`   - ID: ${cat.id}`)
      console.log(`   - Color: ${cat.color}`)
      console.log(`   - Activa: ${cat.isActive}`)
      console.log(`   - Padre: ${cat.parent ? cat.parent.name : 'Sin padre'}`)
      console.log(`   - Hijos: ${cat.children.length}`)
      console.log(`   - Tickets: ${cat._count.tickets}`)
      console.log(`   - Técnicos: ${cat.technicianAssignments.length}`)
      console.log('')
    })
    
    // 5. Verificar jerarquía por niveles
    console.log('\n5. ANÁLISIS POR NIVELES:')
    for (let level = 1; level <= 4; level++) {
      const levelCategories = categories.filter(c => c.level === level)
      console.log(`📁 Nivel ${level}: ${levelCategories.length} categorías`)
      levelCategories.forEach(cat => {
        console.log(`   - ${cat.name} (${cat.isActive ? 'Activa' : 'Inactiva'})`)
      })
    }
    
    // 6. Verificar asignaciones de técnicos
    console.log('\n6. ASIGNACIONES DE TÉCNICOS:')
    const assignments = await prisma.technicianAssignment.findMany({
      include: {
        technician: { select: { name: true, email: true } },
        category: { select: { name: true, level: true } }
      }
    })
    console.log(`👥 Total asignaciones: ${assignments.length}`)
    assignments.forEach(assignment => {
      console.log(`   - ${assignment.technician.name} → ${assignment.category.name} (Nivel ${assignment.category.level})`)
    })
    
    // 7. Simular respuesta de API
    console.log('\n7. SIMULANDO RESPUESTA DE API...')
    const enrichedCategories = categories.map(category => ({
      ...category,
      levelName: getLevelName(category.level),
      canDelete: category._count.tickets === 0 && category._count.children === 0,
      assignedTechnicians: category.technicianAssignments.map(assignment => ({
        id: assignment.technician.id,
        name: assignment.technician.name,
        email: assignment.technician.email,
        priority: assignment.priority,
        maxTickets: assignment.maxTickets,
        autoAssign: assignment.autoAssign
      }))
    }))
    
    console.log('📤 Estructura de respuesta simulada:')
    console.log(JSON.stringify({
      success: true,
      data: enrichedCategories.slice(0, 2), // Solo mostrar 2 para no saturar
      count: enrichedCategories.length
    }, null, 2))
    
    // 8. Verificar usuarios administradores
    console.log('\n8. VERIFICANDO USUARIOS ADMIN...')
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, name: true, email: true, isActive: true }
    })
    console.log(`👑 Usuarios admin: ${adminUsers.length}`)
    adminUsers.forEach(admin => {
      console.log(`   - ${admin.name} (${admin.email}) - ${admin.isActive ? 'Activo' : 'Inactivo'}`)
    })
    
    console.log('\n✅ DIAGNÓSTICO COMPLETADO')
    console.log('=' .repeat(60))
    
  } catch (error) {
    console.error('❌ ERROR EN DIAGNÓSTICO:', error)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

function getLevelName(level) {
  switch (level) {
    case 1: return 'Principal'
    case 2: return 'Subcategoría'
    case 3: return 'Especialidad'
    case 4: return 'Detalle'
    default: return `Nivel ${level}`
  }
}

testCategoriesDebug()