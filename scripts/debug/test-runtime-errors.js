#!/usr/bin/env node

/**
 * Script para detectar errores de runtime en componentes específicos
 * Verifica los módulos que han tenido problemas con arrays undefined
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Páginas que han tenido problemas de runtime
const PROBLEMATIC_PAGES = [
  {
    name: 'Admin Users',
    path: '/admin/users',
    description: 'Página de usuarios con problema de RefreshCw'
  },
  {
    name: 'Admin Tickets', 
    path: '/admin/tickets',
    description: 'Página de tickets con problema de array length'
  },
  {
    name: 'Admin Categories',
    path: '/admin/categories', 
    description: 'Página de categorías'
  },
  {
    name: 'Admin Backups',
    path: '/admin/backups',
    description: 'Página de backups'
  },
  {
    name: 'Client Dashboard',
    path: '/client',
    description: 'Dashboard de cliente'
  }
];

async function testPage(page) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: page.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const success = res.statusCode === 200 || res.statusCode === 307 || res.statusCode === 401;
        
        // Verificar si hay errores de JavaScript en el HTML
        const hasJSError = data.includes('TypeError') || 
                          data.includes('Cannot read properties of undefined') ||
                          data.includes('ReferenceError') ||
                          data.includes('SyntaxError');
        
        resolve({
          name: page.name,
          path: page.path,
          statusCode: res.statusCode,
          success: success && !hasJSError,
          hasJSError,
          size: data.length,
          description: page.description
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        name: page.name,
        path: page.path,
        statusCode: 0,
        success: false,
        hasJSError: false,
        error: error.message,
        description: page.description
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: page.name,
        path: page.path,
        statusCode: 0,
        success: false,
        hasJSError: false,
        error: 'Timeout',
        description: page.description
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🔍 VERIFICACIÓN DE ERRORES DE RUNTIME');
  console.log('============================================================');
  
  const results = [];
  
  for (const page of PROBLEMATIC_PAGES) {
    console.log(`🔍 Verificando ${page.name}...`);
    const result = await testPage(page);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${page.name}: OK (${result.statusCode})`);
    } else if (result.hasJSError) {
      console.log(`❌ ${page.name}: ERROR DE JAVASCRIPT (${result.statusCode})`);
    } else if (result.error) {
      console.log(`❌ ${page.name}: ERROR - ${result.error}`);
    } else {
      console.log(`⚠️  ${page.name}: RESPUESTA INESPERADA (${result.statusCode})`);
    }
    
    // Pequeña pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n============================================================');
  console.log('📊 RESUMEN DE VERIFICACIÓN:');
  
  const successful = results.filter(r => r.success).length;
  const withJSErrors = results.filter(r => r.hasJSError).length;
  const withErrors = results.filter(r => !r.success).length;
  
  console.log(`✅ Páginas OK: ${successful}`);
  console.log(`🟨 Errores JS: ${withJSErrors}`);
  console.log(`❌ Errores Totales: ${withErrors}`);
  
  const successRate = ((successful / results.length) * 100).toFixed(1);
  console.log(`\n📈 Tasa de Éxito: ${successRate}%`);
  
  if (withJSErrors > 0) {
    console.log('\n⚠️  PÁGINAS CON ERRORES DE JAVASCRIPT:');
    results.filter(r => r.hasJSError).forEach(result => {
      console.log(`   - ${result.name} (${result.path})`);
    });
  }
  
  if (successful === results.length) {
    console.log('\n🎉 ¡TODAS LAS PÁGINAS FUNCIONAN CORRECTAMENTE!');
  } else {
    console.log('\n🔧 Algunas páginas necesitan corrección.');
  }
  
  console.log('\n🌐 Accede a: http://localhost:3000');
}

// Ejecutar las pruebas
runTests().catch(console.error);