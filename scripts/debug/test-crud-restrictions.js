#!/usr/bin/env node

/**
 * Script de prueba para verificar las restricciones CRUD
 * en los módulos de usuarios, técnicos y categorías
 */

const testCrudRestrictions = async () => {
  console.log('🧪 [TEST] Iniciando pruebas de restricciones CRUD...\n')

  const baseUrl = 'http://localhost:3000/api'
  
  // Función helper para hacer peticiones
  const makeRequest = async (url, options = {}) => {
    try {
      const response = await fetch(`${baseUrl}${url}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      })
      
      const data = await response.json()
      return { status: response.status, data, ok: response.ok }
    } catch (error) {
      return { status: 0, data: { error: error.message }, ok: false }
    }
  }

  // Test 1: Verificar que las categorías muestren canDelete correctamente
  console.log('📁 [TEST-CATEGORIES] Verificando restricciones de eliminación...')
  const categoriesResult = await makeRequest('/categories')
  
  if (categoriesResult.ok && categoriesResult.data.success) {
    const categories = categoriesResult.data.data
    console.log(`   ✅ ${categories.length} categorías cargadas`)
    
    categories.forEach(cat => {
      const hasTickets = cat._count?.tickets > 0
      const hasChildren = cat._count?.children > 0
      const shouldNotDelete = hasTickets || hasChildren
      
      console.log(`   📂 ${cat.name}: canDelete=${cat.canDelete}, tickets=${cat._count?.tickets || 0}, children=${cat._count?.children || 0}`)
      
      if (shouldNotDelete && cat.canDelete) {
        console.log(`   ⚠️  ADVERTENCIA: ${cat.name} debería tener canDelete=false`)
      }
    })
  } else {
    console.log('   ❌ Error al cargar categorías:', categoriesResult.data.error)
  }

  // Test 2: Verificar que los técnicos muestren información correcta
  console.log('\n👨‍💻 [TEST-TECHNICIANS] Verificando técnicos...')
  const techniciansResult = await makeRequest('/users?role=TECHNICIAN')
  
  if (techniciansResult.ok && techniciansResult.data.success) {
    const technicians = techniciansResult.data.data
    console.log(`   ✅ ${technicians.length} técnicos cargados`)
    
    technicians.forEach(tech => {
      const hasAssignedTickets = tech._count?.assignedTickets > 0
      const hasAssignments = tech._count?.technicianAssignments > 0
      
      console.log(`   👨‍💻 ${tech.name}: tickets=${tech._count?.assignedTickets || 0}, assignments=${tech._count?.technicianAssignments || 0}`)
      
      if (tech.technicianAssignments && tech.technicianAssignments.length > 0) {
        console.log(`      📋 Categorías asignadas: ${tech.technicianAssignments.map(a => a.category.name).join(', ')}`)
      }
    })
  } else {
    console.log('   ❌ Error al cargar técnicos:', techniciansResult.data.error)
  }

  // Test 3: Verificar usuarios generales
  console.log('\n👥 [TEST-USERS] Verificando usuarios...')
  const usersResult = await makeRequest('/users')
  
  if (usersResult.ok && usersResult.data.success) {
    const users = usersResult.data.data
    console.log(`   ✅ ${users.length} usuarios cargados`)
    
    const usersByRole = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1
      return acc
    }, {})
    
    console.log('   📊 Distribución por roles:')
    Object.entries(usersByRole).forEach(([role, count]) => {
      console.log(`      ${role}: ${count}`)
    })
    
    // Verificar usuarios con tickets asignados
    const usersWithTickets = users.filter(u => u._count?.assignedTickets > 0)
    if (usersWithTickets.length > 0) {
      console.log('   🎫 Usuarios con tickets asignados:')
      usersWithTickets.forEach(user => {
        console.log(`      ${user.name} (${user.role}): ${user._count.assignedTickets} tickets`)
      })
    }
  } else {
    console.log('   ❌ Error al cargar usuarios:', usersResult.data.error)
  }

  // Test 4: Verificar estructura de respuestas
  console.log('\n🔍 [TEST-STRUCTURE] Verificando estructura de respuestas...')
  
  const endpoints = [
    { name: 'Categories', url: '/categories' },
    { name: 'Users', url: '/users' },
    { name: 'Technicians', url: '/users?role=TECHNICIAN' }
  ]
  
  for (const endpoint of endpoints) {
    const result = await makeRequest(endpoint.url)
    
    if (result.ok && result.data.success) {
      const hasData = Array.isArray(result.data.data)
      const hasCount = typeof result.data.count === 'number'
      
      console.log(`   📋 ${endpoint.name}: ✅ success=${result.data.success}, data=${hasData ? 'array' : 'invalid'}, count=${hasCount ? result.data.count : 'missing'}`)
    } else {
      console.log(`   📋 ${endpoint.name}: ❌ ${result.data.error || 'Error desconocido'}`)
    }
  }

  console.log('\n🏁 [TEST] Pruebas completadas')
  console.log('\n📝 [RESUMEN] Verificaciones realizadas:')
  console.log('   ✓ Restricciones de eliminación en categorías')
  console.log('   ✓ Información de técnicos y asignaciones')
  console.log('   ✓ Distribución de usuarios por roles')
  console.log('   ✓ Estructura de respuestas de API')
  console.log('\n💡 [NOTA] Revisa los logs anteriores para identificar posibles problemas')
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testCrudRestrictions().catch(console.error)
}

module.exports = { testCrudRestrictions }