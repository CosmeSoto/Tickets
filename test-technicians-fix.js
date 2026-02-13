#!/usr/bin/env node

/**
 * Script de prueba para verificar las correcciones del sistema de técnicos (CORREGIDO)
 * Ejecutar: node test-technicians-fix.js
 */

const BASE_URL = 'http://localhost:3000'

// Datos de prueba para promoción de usuarios
const promotionTestCases = [
  {
    name: 'Promoción Básica',
    data: {
      departmentId: null,
      assignedCategories: []
    }
  },
  {
    name: 'Promoción con Departamento y Categorías',
    data: {
      departmentId: 'dept-example-1',
      assignedCategories: [
        {
          categoryId: 'cat-example-1',
          priority: 1,
          maxTickets: 20,
          autoAssign: true
        },
        {
          categoryId: 'cat-example-2',
          priority: 2,
          autoAssign: false
        }
      ]
    }
  }
]

// Datos de prueba para actualización de técnicos
const updateTestCases = [
  {
    name: 'Actualización de Estado',
    data: {
      isActive: false,
      assignedCategories: []
    }
  },
  {
    name: 'Actualización de Asignaciones',
    data: {
      isActive: true,
      assignedCategories: [
        {
          categoryId: 'cat-example-1',
          priority: 3,
          maxTickets: 15,
          autoAssign: true
        }
      ]
    }
  },
  {
    name: 'Prioridad Fuera de Rango (debe fallar)',
    data: {
      isActive: true,
      assignedCategories: [
        {
          categoryId: 'cat-example-1',
          priority: 15, // Fuera de rango
          autoAssign: true
        }
      ]
    },
    shouldFail: true
  }
]

async function testUserPromotion(userId, testCase) {
  console.log(`\n🔼 Probando promoción: ${testCase.name}`)
  console.log('📤 Datos enviados:', JSON.stringify(testCase.data, null, 2))
  
  try {
    const response = await fetch(`${BASE_URL}/api/users/${userId}/promote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'next-auth.session-token=your-session-token' // Reemplazar con token real
      },
      body: JSON.stringify(testCase.data)
    })
    
    const result = await response.json()
    
    if (response.ok && result.success) {
      console.log('✅ Promoción exitosa')
      console.log('📝 Mensaje:', result.message)
      console.log('👤 Técnico:', result.data.name)
      console.log('📧 Email:', result.data.email)
      console.log('🏢 Departamento:', result.data.department?.name || 'Sin departamento')
      console.log('📊 Categorías asignadas:', result.data.technicianAssignments?.length || 0)
    } else {
      console.log('❌ Error en promoción')
      console.log('📝 Error:', result.error)
      if (result.details) {
        console.log('📋 Detalles:', result.details)
      }
    }
    
    console.log('📊 Status:', response.status)
    
  } catch (error) {
    console.log('❌ Error de red:', error.message)
  }
}

async function testTechnicianUpdate(technicianId, testCase) {
  console.log(`\n🔄 Probando actualización: ${testCase.name}`)
  console.log('📤 Datos enviados:', JSON.stringify(testCase.data, null, 2))
  
  try {
    const response = await fetch(`${BASE_URL}/api/technicians/${technicianId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'next-auth.session-token=your-session-token' // Reemplazar con token real
      },
      body: JSON.stringify(testCase.data)
    })
    
    const result = await response.json()
    
    if (testCase.shouldFail) {
      if (!response.ok) {
        console.log('✅ Falló como se esperaba')
        console.log('📝 Error:', result.error)
        if (result.details) {
          console.log('📋 Detalles:', result.details)
        }
      } else {
        console.log('❌ Debería haber fallado pero fue exitoso')
      }
    } else {
      if (response.ok && result.success) {
        console.log('✅ Actualización exitosa')
        console.log('📝 Mensaje:', result.message)
        console.log('👤 Técnico:', result.data.name)
        console.log('🔄 Estado activo:', result.data.isActive)
        console.log('📊 Categorías asignadas:', result.data.technicianAssignments?.length || 0)
      } else {
        console.log('❌ Error en actualización')
        console.log('📝 Error:', result.error)
        if (result.details) {
          console.log('📋 Detalles:', result.details)
        }
      }
    }
    
    console.log('📊 Status:', response.status)
    
  } catch (error) {
    console.log('❌ Error de red:', error.message)
  }
}

async function testTechnicianGet(technicianId) {
  console.log(`\n🔍 Probando GET técnico: ${technicianId}`)
  
  try {
    const response = await fetch(`${BASE_URL}/api/technicians/${technicianId}`, {
      method: 'GET',
      headers: {
        'Cookie': 'next-auth.session-token=your-session-token' // Reemplazar con token real
      }
    })
    
    const result = await response.json()
    
    if (response.ok && result.success) {
      console.log('✅ Técnico obtenido exitosamente')
      console.log('👤 Nombre:', result.data.name)
      console.log('📧 Email:', result.data.email)
      console.log('📱 Teléfono:', result.data.phone || 'Sin teléfono')
      console.log('🏢 Departamento:', result.data.department?.name || 'Sin departamento')
      console.log('📊 Tickets asignados:', result.data._count?.assignedTickets || 0)
      console.log('🏷️ Categorías asignadas:', result.data.technicianAssignments?.length || 0)
      console.log('🗑️ Puede eliminar:', result.data.canDelete ? 'Sí' : 'No (se degrada a cliente)')
    } else {
      console.log('❌ Error obteniendo técnico')
      console.log('📝 Error:', result.error)
    }
    
    console.log('📊 Status:', response.status)
    
  } catch (error) {
    console.log('❌ Error de red:', error.message)
  }
}

async function testTechnicianDelete(technicianId) {
  console.log(`\n🗑️ Probando DELETE técnico: ${technicianId}`)
  
  try {
    const response = await fetch(`${BASE_URL}/api/technicians/${technicianId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': 'next-auth.session-token=your-session-token' // Reemplazar con token real
      }
    })
    
    const result = await response.json()
    
    console.log('📝 Respuesta:', result.error || result.message)
    console.log('📊 Status:', response.status)
    
    if (result.redirect) {
      console.log('🔄 Redirección sugerida:', result.redirect)
    }
    
  } catch (error) {
    console.log('❌ Error de red:', error.message)
  }
}

async function runTests() {
  console.log('🚀 Iniciando pruebas del sistema de técnicos (CORREGIDO)')
  console.log('=' .repeat(60))
  
  // IDs de prueba (reemplazar con IDs reales)
  const testUserId = 'user-client-id-example' // Usuario CLIENT para promover
  const testTechnicianId = 'adeed1a6-41a5-4e09-a7ed-0078159d4797' // Técnico existente
  
  console.log(`📋 Usuario para promover: ${testUserId}`)
  console.log(`📋 Técnico para actualizar: ${testTechnicianId}`)
  console.log('⚠️  Asegúrate de tener una sesión válida y que los IDs existan')
  
  // 1. Probar GET de técnico
  await testTechnicianGet(testTechnicianId)
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // 2. Probar promoción de usuarios
  console.log('\n' + '='.repeat(40))
  console.log('🔼 PRUEBAS DE PROMOCIÓN DE USUARIOS')
  console.log('='.repeat(40))
  
  for (const testCase of promotionTestCases) {
    await testUserPromotion(testUserId, testCase)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // 3. Probar actualización de técnicos
  console.log('\n' + '='.repeat(40))
  console.log('🔄 PRUEBAS DE ACTUALIZACIÓN DE TÉCNICOS')
  console.log('='.repeat(40))
  
  for (const testCase of updateTestCases) {
    await testTechnicianUpdate(testTechnicianId, testCase)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // 4. Probar DELETE (debe redirigir a demote)
  console.log('\n' + '='.repeat(40))
  console.log('🗑️ PRUEBA DE DELETE (debe redirigir)')
  console.log('='.repeat(40))
  
  await testTechnicianDelete(testTechnicianId)
  
  console.log('\n' + '=' .repeat(60))
  console.log('🏁 Pruebas completadas')
  console.log('\n📝 Notas importantes:')
  console.log('- Los técnicos NO se eliminan, se degradan a clientes')
  console.log('- Los datos personales se editan desde /api/users')
  console.log('- Las prioridades (1-10) determinan orden de asignación automática')
  console.log('- Reemplaza los IDs y token de sesión con valores reales')
  console.log('- Revisa los logs del servidor para debugging detallado')
}

// Función para explicar el sistema
function explainSystem() {
  console.log('\n🎯 EXPLICACIÓN DEL SISTEMA DE TÉCNICOS')
  console.log('=' .repeat(50))
  
  console.log('\n📋 FLUJO CORRECTO:')
  console.log('1. Los usuarios CLIENT se promueven a TECHNICIAN')
  console.log('2. Los TECHNICIAN se degradan a CLIENT (no se eliminan)')
  console.log('3. Datos personales: módulo de usuarios')
  console.log('4. Asignaciones: módulo de técnicos')
  
  console.log('\n🔢 PRIORIDADES:')
  console.log('- Rango: 1-10')
  console.log('- Propósito: Orden de asignación automática de tickets')
  console.log('- Prioridad 1: Primera opción')
  console.log('- Prioridad 10: Última opción')
  
  console.log('\n🔒 CAMPOS EDITABLES:')
  console.log('- Desde /api/users: nombre, email, teléfono, departamento')
  console.log('- Desde /api/technicians: solo asignaciones y estado activo')
  
  console.log('\n📡 ENDPOINTS:')
  console.log('- GET /api/technicians/[id] - Obtener técnico')
  console.log('- PUT /api/technicians/[id] - Actualizar asignaciones')
  console.log('- POST /api/users/[id]/promote - Promover a técnico')
  console.log('- POST /api/users/[id]/demote - Degradar a cliente')
}

// Ejecutar si se llama directamente
if (require.main === module) {
  console.log('🔧 Script de Prueba - Sistema de Técnicos (CORREGIDO)')
  console.log('Versión: 2.0.0')
  console.log('Fecha:', new Date().toISOString())
  
  explainSystem()
  
  console.log('\n⚠️  Para probar las APIs, asegúrate de:')
  console.log('1. Tener el servidor ejecutándose en localhost:3000')
  console.log('2. Estar autenticado como ADMIN')
  console.log('3. Tener un usuario CLIENT para promover')
  console.log('4. Tener un técnico existente para actualizar')
  console.log('5. Reemplazar los IDs y token de sesión')
  console.log('\n¿Continuar con las pruebas de API? (Ctrl+C para cancelar)')
  
  setTimeout(() => {
    runTests().catch(console.error)
  }, 5000)
}

module.exports = {
  testUserPromotion,
  testTechnicianUpdate,
  testTechnicianGet,
  testTechnicianDelete,
  promotionTestCases,
  updateTestCases
}