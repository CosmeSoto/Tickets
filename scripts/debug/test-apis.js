const fetch = require('node-fetch')

async function testAPIs() {
  const baseURL = 'http://localhost:3000'
  
  console.log('🧪 Probando APIs de reportes...\n')
  
  try {
    // Test API de reportes de tickets
    console.log('📊 Probando API de reportes de tickets...')
    const ticketsResponse = await fetch(`${baseURL}/api/reports?type=tickets`)
    console.log(`Status: ${ticketsResponse.status}`)
    
    if (ticketsResponse.ok) {
      const ticketsData = await ticketsResponse.json()
      console.log('✅ Datos de tickets recibidos:')
      console.log(`   Total tickets: ${ticketsData.totalTickets}`)
      console.log(`   Tickets abiertos: ${ticketsData.openTickets}`)
      console.log(`   Tickets resueltos: ${ticketsData.resolvedTickets}`)
      console.log(`   Tiempo promedio: ${ticketsData.avgResolutionTime}`)
      console.log(`   Tickets por prioridad:`, ticketsData.ticketsByPriority)
      console.log(`   Tickets por categoría: ${ticketsData.ticketsByCategory?.length || 0} categorías`)
      console.log(`   Datos diarios: ${ticketsData.dailyTickets?.length || 0} días`)
    } else {
      const error = await ticketsResponse.text()
      console.log('❌ Error en API de tickets:', error)
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // Test API de reportes de técnicos
    console.log('👨‍💻 Probando API de reportes de técnicos...')
    const techniciansResponse = await fetch(`${baseURL}/api/reports?type=technicians`)
    console.log(`Status: ${techniciansResponse.status}`)
    
    if (techniciansResponse.ok) {
      const techniciansData = await techniciansResponse.json()
      console.log('✅ Datos de técnicos recibidos:')
      console.log(`   Número de técnicos: ${techniciansData.length}`)
      techniciansData.forEach((tech, index) => {
        console.log(`   ${index + 1}. ${tech.technicianName}:`)
        console.log(`      - Asignados: ${tech.totalAssigned}`)
        console.log(`      - Resueltos: ${tech.resolved}`)
        console.log(`      - En progreso: ${tech.inProgress}`)
        console.log(`      - Tasa resolución: ${tech.resolutionRate.toFixed(1)}%`)
        console.log(`      - Carga: ${tech.workload}`)
      })
    } else {
      const error = await techniciansResponse.text()
      console.log('❌ Error en API de técnicos:', error)
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // Test API de reportes de categorías
    console.log('📁 Probando API de reportes de categorías...')
    const categoriesResponse = await fetch(`${baseURL}/api/reports?type=categories`)
    console.log(`Status: ${categoriesResponse.status}`)
    
    if (categoriesResponse.ok) {
      const categoriesData = await categoriesResponse.json()
      console.log('✅ Datos de categorías recibidos:')
      console.log(`   Número de categorías: ${categoriesData.length}`)
      categoriesData.forEach((cat, index) => {
        console.log(`   ${index + 1}. ${cat.categoryName}:`)
        console.log(`      - Total tickets: ${cat.totalTickets}`)
        console.log(`      - Resueltos: ${cat.resolvedTickets}`)
        console.log(`      - Tasa resolución: ${cat.resolutionRate.toFixed(1)}%`)
        console.log(`      - Tiempo promedio: ${cat.avgResolutionTime}`)
      })
    } else {
      const error = await categoriesResponse.text()
      console.log('❌ Error en API de categorías:', error)
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // Test API de usuarios
    console.log('👥 Probando API de usuarios...')
    const usersResponse = await fetch(`${baseURL}/api/users`)
    console.log(`Status: ${usersResponse.status}`)
    
    if (usersResponse.ok) {
      const usersData = await usersResponse.json()
      console.log('✅ Datos de usuarios recibidos:')
      if (usersData.success && usersData.data) {
        console.log(`   Número de usuarios: ${usersData.data.length}`)
        usersData.data.slice(0, 3).forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.name} (${user.role}):`)
          console.log(`      - Email: ${user.email}`)
          console.log(`      - Activo: ${user.isActive}`)
          console.log(`      - Tickets creados: ${user._count?.createdTickets || 0}`)
          console.log(`      - Tickets asignados: ${user._count?.assignedTickets || 0}`)
        })
      }
    } else {
      const error = await usersResponse.text()
      console.log('❌ Error en API de usuarios:', error)
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // Test API de categorías
    console.log('📂 Probando API de categorías...')
    const categoriesListResponse = await fetch(`${baseURL}/api/categories`)
    console.log(`Status: ${categoriesListResponse.status}`)
    
    if (categoriesListResponse.ok) {
      const categoriesListData = await categoriesListResponse.json()
      console.log('✅ Lista de categorías recibida:')
      if (categoriesListData.success && categoriesListData.data) {
        console.log(`   Número de categorías: ${categoriesListData.data.length}`)
        categoriesListData.data.slice(0, 5).forEach((cat, index) => {
          console.log(`   ${index + 1}. ${cat.name}`)
          console.log(`      - ID: ${cat.id}`)
          console.log(`      - Activa: ${cat.isActive}`)
          console.log(`      - Técnicos asignados: ${cat.technicianAssignments?.length || 0}`)
        })
      }
    } else {
      const error = await categoriesListResponse.text()
      console.log('❌ Error en API de categorías:', error)
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message)
  }
}

testAPIs()