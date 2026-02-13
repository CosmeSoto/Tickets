// Test de la API HTTP de reportes
const http = require('http');

function testReportsHTTP() {
  console.log('🧪 PROBANDO API HTTP DE REPORTES\n');
  
  // Construir parámetros como lo hace la página
  const today = new Date();
  const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const params = new URLSearchParams({
    type: 'tickets',
    startDate: startDate.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0]
  });
  
  console.log('📋 PARÁMETROS A ENVIAR:');
  console.log(`   type: tickets`);
  console.log(`   startDate: ${startDate.toISOString().split('T')[0]}`);
  console.log(`   endDate: ${today.toISOString().split('T')[0]}`);
  console.log(`   URL completa: /api/reports?${params.toString()}`);
  console.log('');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/reports?${params.toString()}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Nota: En producción necesitaríamos las cookies de sesión
    }
  };

  const req = http.request(options, (res) => {
    console.log(`📊 Status: ${res.statusCode} ${res.statusMessage}`);
    console.log('📊 Headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('📊 Response Body:', data);
      
      if (res.statusCode === 200) {
        try {
          const jsonData = JSON.parse(data);
          console.log('\n✅ DATOS PARSEADOS:');
          console.log(`   Total Tickets: ${jsonData.totalTickets}`);
          console.log(`   Abiertos: ${jsonData.openTickets}`);
          console.log(`   En Progreso: ${jsonData.inProgressTickets}`);
          console.log(`   Resueltos: ${jsonData.resolvedTickets}`);
          console.log(`   Prioridades:`, jsonData.ticketsByPriority);
          console.log(`   Categorías:`, jsonData.ticketsByCategory);
        } catch (error) {
          console.log('❌ Error parseando JSON:', error.message);
        }
      } else if (res.statusCode === 401) {
        console.log('❌ Error de autenticación - necesita estar logueado');
      } else {
        console.log('❌ Error en la API');
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error de conexión:', error.message);
    console.log('\n💡 ASEGÚRATE DE QUE:');
    console.log('1. El servidor esté corriendo (npm run dev)');
    console.log('2. El puerto 3000 esté disponible');
  });

  req.end();
}

// Ejecutar test
testReportsHTTP();