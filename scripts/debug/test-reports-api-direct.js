// Test directo de la API de reportes
const { ReportService } = require('./src/lib/services/report-service.ts');

async function testReportsAPI() {
  try {
    console.log('🧪 PROBANDO API DE REPORTES DIRECTAMENTE\n');
    
    // 1. Probar sin filtros
    console.log('1️⃣ PROBANDO SIN FILTROS:');
    const reportWithoutFilters = await ReportService.generateTicketReport();
    console.log('   Resultado:', {
      totalTickets: reportWithoutFilters.totalTickets,
      openTickets: reportWithoutFilters.openTickets,
      inProgressTickets: reportWithoutFilters.inProgressTickets,
      resolvedTickets: reportWithoutFilters.resolvedTickets,
      closedTickets: reportWithoutFilters.closedTickets,
      avgResolutionTime: reportWithoutFilters.avgResolutionTime
    });
    console.log('   Prioridades:', reportWithoutFilters.ticketsByPriority);
    console.log('   Categorías:', reportWithoutFilters.ticketsByCategory);
    console.log('');
    
    // 2. Probar con filtros amplios
    console.log('2️⃣ PROBANDO CON FILTROS AMPLIOS:');
    const today = new Date();
    const startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const reportWithFilters = await ReportService.generateTicketReport({
      startDate: startDate,
      endDate: today
    });
    
    console.log('   Filtros usados:');
    console.log(`     Inicio: ${startDate.toISOString()}`);
    console.log(`     Fin: ${today.toISOString()}`);
    console.log('   Resultado:', {
      totalTickets: reportWithFilters.totalTickets,
      openTickets: reportWithFilters.openTickets,
      inProgressTickets: reportWithFilters.inProgressTickets,
      resolvedTickets: reportWithFilters.resolvedTickets,
      closedTickets: reportWithFilters.closedTickets,
      avgResolutionTime: reportWithFilters.avgResolutionTime
    });
    console.log('');
    
    // 3. Probar reportes de técnicos
    console.log('3️⃣ PROBANDO REPORTE DE TÉCNICOS:');
    const technicianReport = await ReportService.generateTechnicianReport();
    console.log('   Técnicos encontrados:', technicianReport.length);
    technicianReport.forEach(tech => {
      console.log(`   - ${tech.technicianName}: ${tech.totalAssigned} asignados, ${tech.resolved} resueltos`);
    });
    console.log('');
    
    // 4. Probar reportes de categorías
    console.log('4️⃣ PROBANDO REPORTE DE CATEGORÍAS:');
    const categoryReport = await ReportService.generateCategoryReport();
    console.log('   Categorías encontradas:', categoryReport.length);
    categoryReport.forEach(cat => {
      console.log(`   - ${cat.categoryName}: ${cat.totalTickets} tickets, ${cat.resolvedTickets} resueltos`);
    });
    
    console.log('\n✅ PRUEBAS COMPLETADAS');
    
  } catch (error) {
    console.error('❌ Error en pruebas:', error);
  }
}

testReportsAPI();