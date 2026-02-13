// Test experto de APIs de reportes con autenticación simulada
const { PrismaClient } = require('@prisma/client')
const { ReportService } = require('./src/lib/services/report-service.ts')

const prisma = new PrismaClient()

async function testReportsAPI() {
  try {
    console.log('🧪 TEST EXPERTO DE APIs DE REPORTES\n')
    
    // 1. Test directo del ReportService (sin autenticación)
    console.log('📊 1. PROBANDO ReportService.generateTicketReport():')
    const ticketReport = await ReportService.generateTicketReport({})
    console.log('   Resultado:', JSON.stringify(ticketReport, null, 2))
    
    console.log('\n👨‍💻 2. PROBANDO ReportService.generateTechnicianReport():')
    const technicianReport = await ReportService.generateTechnicianReport({})
    console.log('   Resultado:', JSON.stringify(technicianReport, null, 2))
    
    console.log('\n📁 3. PROBANDO ReportService.generateCategoryReport():')
    const categoryReport = await ReportService.generateCategoryReport({})
    console.log('   Resultado:', JSON.stringify(categoryReport, null, 2))
    
    // 2. Verificar datos específicos
    console.log('\n🔍 4. VERIFICACIÓN DE DATOS ESPECÍFICOS:')
    
    // Verificar que los números coincidan con la BD
    const totalTickets = await prisma.ticket.count()
    const openTickets = await prisma.ticket.count({ where: { status: 'OPEN' } })
    const resolvedTickets = await prisma.ticket.count({ where: { status: 'RESOLVED' } })
    
    console.log(`   BD - Total tickets: ${totalTickets}`)
    console.log(`   BD - Tickets abiertos: ${openTickets}`)
    console.log(`   BD - Tickets resueltos: ${resolvedTickets}`)
    
    console.log(`   API - Total tickets: ${ticketReport.totalTickets}`)
    console.log(`   API - Tickets abiertos: ${ticketReport.openTickets}`)
    console.log(`   API - Tickets resueltos: ${ticketReport.resolvedTickets}`)
    
    // Verificar coincidencia
    const dataMatches = 
      totalTickets === ticketReport.totalTickets &&
      openTickets === ticketReport.openTickets &&
      resolvedTickets === ticketReport.resolvedTickets
    
    console.log(`   ✅ Datos coinciden: ${dataMatches ? 'SÍ' : 'NO'}`)
    
    if (!dataMatches) {
      console.log('   ❌ PROBLEMA: Los datos de la API no coinciden con la BD')
    }
    
    // 3. Verificar estructura de datos para gráficos
    console.log('\n📈 5. VERIFICACIÓN DE DATOS PARA GRÁFICOS:')
    
    console.log('   ticketsByPriority:', ticketReport.ticketsByPriority)
    console.log('   ticketsByCategory length:', ticketReport.ticketsByCategory?.length || 0)
    console.log('   dailyTickets length:', ticketReport.dailyTickets?.length || 0)
    
    if (ticketReport.ticketsByCategory?.length > 0) {
      console.log('   Categorías con datos:')
      ticketReport.ticketsByCategory.forEach(cat => {
        console.log(`     - ${cat.categoryName}: ${cat.count} tickets (${cat.percentage.toFixed(1)}%)`)
      })
    }
    
    if (ticketReport.dailyTickets?.length > 0) {
      console.log('   Datos diarios:')
      ticketReport.dailyTickets.slice(0, 5).forEach(day => {
        console.log(`     - ${day.date}: ${day.created} creados, ${day.resolved} resueltos`)
      })
    }
    
    // 4. Verificar técnicos
    console.log('\n👨‍💻 6. VERIFICACIÓN DE TÉCNICOS:')
    console.log(`   Número de técnicos en reporte: ${technicianReport.length}`)
    
    technicianReport.forEach(tech => {
      console.log(`   - ${tech.technicianName}:`)
      console.log(`     Asignados: ${tech.totalAssigned}`)
      console.log(`     Resueltos: ${tech.resolved}`)
      console.log(`     En progreso: ${tech.inProgress}`)
      console.log(`     Tasa resolución: ${tech.resolutionRate.toFixed(1)}%`)
      console.log(`     Carga: ${tech.workload}`)
    })
    
    // 5. Verificar categorías
    console.log('\n📁 7. VERIFICACIÓN DE CATEGORÍAS:')
    console.log(`   Número de categorías en reporte: ${categoryReport.length}`)
    
    categoryReport.forEach(cat => {
      console.log(`   - ${cat.categoryName}:`)
      console.log(`     Total tickets: ${cat.totalTickets}`)
      console.log(`     Resueltos: ${cat.resolvedTickets}`)
      console.log(`     Tasa resolución: ${cat.resolutionRate.toFixed(1)}%`)
    })
    
    console.log('\n✅ TEST DE APIs COMPLETADO')
    
  } catch (error) {
    console.error('❌ Error en test de APIs:', error)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testReportsAPI()