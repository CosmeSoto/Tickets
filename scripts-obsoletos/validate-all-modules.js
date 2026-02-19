#!/usr/bin/env node

const http = require('http');

console.log('🔍 VALIDACIÓN COMPLETA DE MÓDULOS DEL SISTEMA');
console.log('='.repeat(60));

// Función para hacer peticiones HTTP
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (options.data) {
      req.write(options.data);
    }
    
    req.end();
  });
}

async function validateModule(moduleName, path, expectedStatus = 200) {
  console.log(`🔍 Validando ${moduleName}...`);
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET'
    });
    
    if (response.statusCode === expectedStatus || 
        response.statusCode === 401 || 
        response.statusCode === 307 || 
        response.statusCode === 302) {
      // 401 = No autorizado, 307/302 = Redirección (normal para páginas protegidas)
      console.log(`✅ ${moduleName}: OK (${response.statusCode})`);
      return { name: moduleName, status: 'OK', code: response.statusCode };
    } else {
      console.log(`❌ ${moduleName}: Error ${response.statusCode}`);
      return { name: moduleName, status: 'ERROR', code: response.statusCode };
    }
  } catch (error) {
    console.log(`❌ ${moduleName}: ${error.message}`);
    return { name: moduleName, status: 'ERROR', error: error.message };
  }
}

async function validateSystem() {
  const modules = [
    // Páginas públicas
    { name: 'Landing Page', path: '/' },
    { name: 'Login Page', path: '/login' },
    
    // APIs básicas
    { name: 'API Health', path: '/api/health' },
    { name: 'API Tickets', path: '/api/tickets' },
    { name: 'API Users', path: '/api/users' },
    { name: 'API Categories', path: '/api/categories' },
    
    // Páginas de Admin (esperamos redirección sin auth)
    { name: 'Admin Dashboard', path: '/admin' },
    { name: 'Admin Users', path: '/admin/users' },
    { name: 'Admin Tickets', path: '/admin/tickets' },
    { name: 'Admin Categories', path: '/admin/categories' },
    { name: 'Admin Backups', path: '/admin/backups' },
    { name: 'Admin Reports', path: '/admin/reports' },
    { name: 'Admin Settings', path: '/admin/settings' },
    
    // Páginas de Técnico (esperamos redirección sin auth)
    { name: 'Technician Dashboard', path: '/technician' },
    { name: 'Technician Tickets', path: '/technician/tickets' },
    
    // Páginas de Cliente (esperamos redirección sin auth)
    { name: 'Client Dashboard', path: '/client' },
    { name: 'Client Tickets', path: '/client/tickets' },
    
    // APIs de Admin (esperamos 401 sin auth)
    { name: 'API Admin Backups', path: '/api/admin/backups', expectedStatus: 401 },
    { name: 'API Admin Logs', path: '/api/admin/logs', expectedStatus: 401 },
    { name: 'API Admin Config', path: '/api/admin/config', expectedStatus: 401 },
  ];

  const results = [];
  
  for (const module of modules) {
    const result = await validateModule(
      module.name, 
      module.path, 
      module.expectedStatus
    );
    results.push(result);
    
    // Pequeña pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE VALIDACIÓN:');
  
  const successful = results.filter(r => r.status === 'OK').length;
  const failed = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`✅ Módulos OK: ${successful}`);
  console.log(`❌ Módulos con Error: ${failed}`);
  
  if (failed > 0) {
    console.log('\n🔍 MÓDULOS CON ERRORES:');
    results
      .filter(r => r.status === 'ERROR')
      .forEach(r => {
        console.log(`   ❌ ${r.name}: ${r.error || `HTTP ${r.code}`}`);
      });
  }
  
  const successRate = ((successful / results.length) * 100).toFixed(1);
  console.log(`\n📈 Tasa de Éxito: ${successRate}%`);
  
  if (successRate >= 90) {
    console.log('\n🎉 ¡SISTEMA EN EXCELENTE ESTADO!');
    console.log('\n📋 Credenciales de prueba:');
    console.log('👤 Admin: admin@tickets.com / admin123');
    console.log('🔧 Técnico: tecnico1@tickets.com / tech123');
    console.log('👥 Cliente: cliente1@empresa.com / client123');
    console.log('\n🌐 Accede a: http://localhost:3000');
  } else if (successRate >= 75) {
    console.log('\n⚠️ Sistema funcional con algunos problemas menores');
  } else {
    console.log('\n🚨 Sistema requiere atención - múltiples errores detectados');
  }
}

validateSystem().catch(console.error);