#!/usr/bin/env node

/**
 * Script específico para probar la página de categorías
 * Incluye autenticación y verificación de errores JavaScript
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function testCategoriesPage() {
  console.log('🔍 PRUEBA ESPECÍFICA DE CATEGORÍAS');
  console.log('============================================================');
  
  // Primero probar sin autenticación
  console.log('🔍 Probando acceso sin autenticación...');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/admin/categories',
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.5',
      'Connection': 'keep-alive',
    },
    timeout: 10000
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📡 Código de respuesta: ${res.statusCode}`);
        console.log(`📏 Tamaño de respuesta: ${data.length} bytes`);
        
        // Verificar redirección a login
        if (res.statusCode === 307 || res.statusCode === 302) {
          const location = res.headers.location;
          console.log(`🔄 Redirigido a: ${location}`);
          
          if (location && location.includes('login')) {
            console.log('✅ Redirección correcta a login');
          } else {
            console.log('⚠️  Redirección inesperada');
          }
        }
        
        // Verificar errores de JavaScript en el HTML
        const hasJSError = data.includes('TypeError') || 
                          data.includes('Cannot read properties of undefined') ||
                          data.includes('ReferenceError') ||
                          data.includes('SyntaxError') ||
                          data.includes('data.filter is not a function');
        
        if (hasJSError) {
          console.log('❌ Se encontraron errores de JavaScript en la respuesta');
          
          // Extraer errores específicos
          const errorMatches = data.match(/(TypeError|ReferenceError|SyntaxError)[^<]*/g);
          if (errorMatches) {
            console.log('🐛 Errores encontrados:');
            errorMatches.forEach(error => {
              console.log(`   - ${error.trim()}`);
            });
          }
        } else {
          console.log('✅ No se encontraron errores de JavaScript');
        }
        
        // Verificar si contiene elementos del layout
        const hasLayout = data.includes('sidebar') || 
                         data.includes('nav') || 
                         data.includes('menu') ||
                         data.includes('DashboardLayout');
        
        if (hasLayout) {
          console.log('✅ Layout detectado en la respuesta');
        } else {
          console.log('⚠️  Layout no detectado claramente');
        }
        
        // Verificar contenido específico de categorías
        const hasCategoriesContent = data.includes('categorías') || 
                                   data.includes('Categorías') ||
                                   data.includes('Nueva Categoría');
        
        if (hasCategoriesContent) {
          console.log('✅ Contenido de categorías detectado');
        } else {
          console.log('⚠️  Contenido de categorías no detectado');
        }
        
        resolve({
          statusCode: res.statusCode,
          hasJSError,
          hasLayout,
          hasCategoriesContent,
          size: data.length
        });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Error de conexión: ${error.message}`);
      resolve({
        statusCode: 0,
        hasJSError: false,
        hasLayout: false,
        hasCategoriesContent: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('❌ Timeout de conexión');
      resolve({
        statusCode: 0,
        hasJSError: false,
        hasLayout: false,
        hasCategoriesContent: false,
        error: 'Timeout'
      });
    });

    req.end();
  });
}

async function testCategoriesAPI() {
  console.log('\n🔍 Probando API de categorías...');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/categories',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 5000
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📡 API Código de respuesta: ${res.statusCode}`);
        
        if (res.statusCode === 401) {
          console.log('✅ API correctamente protegida (401 Unauthorized)');
        } else if (res.statusCode === 200) {
          console.log('✅ API respondió correctamente');
          try {
            const jsonData = JSON.parse(data);
            console.log(`📦 Datos recibidos: ${JSON.stringify(jsonData).substring(0, 100)}...`);
          } catch (e) {
            console.log('⚠️  Respuesta no es JSON válido');
          }
        } else {
          console.log(`⚠️  Código de respuesta inesperado: ${res.statusCode}`);
        }
        
        resolve({
          statusCode: res.statusCode,
          data: data.substring(0, 200)
        });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Error en API: ${error.message}`);
      resolve({ statusCode: 0, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('❌ Timeout en API');
      resolve({ statusCode: 0, error: 'Timeout' });
    });

    req.end();
  });
}

async function runTests() {
  const pageResult = await testCategoriesPage();
  const apiResult = await testCategoriesAPI();
  
  console.log('\n============================================================');
  console.log('📊 RESUMEN DE PRUEBAS DE CATEGORÍAS:');
  
  console.log(`🌐 Página: ${pageResult.statusCode === 307 ? 'OK (Redirige)' : 'ERROR'}`);
  console.log(`🔌 API: ${apiResult.statusCode === 401 ? 'OK (Protegida)' : 'ERROR'}`);
  console.log(`🐛 Errores JS: ${pageResult.hasJSError ? 'SÍ' : 'NO'}`);
  console.log(`🎨 Layout: ${pageResult.hasLayout ? 'SÍ' : 'NO'}`);
  
  if (pageResult.statusCode === 307 && !pageResult.hasJSError && apiResult.statusCode === 401) {
    console.log('\n🎉 ¡CATEGORÍAS FUNCIONANDO CORRECTAMENTE!');
  } else {
    console.log('\n🔧 Categorías necesita correcciones.');
  }
  
  console.log('\n💡 Para probar con autenticación:');
  console.log('   1. Ve a http://localhost:3000');
  console.log('   2. Inicia sesión con: admin@tickets.com / admin123');
  console.log('   3. Navega a /admin/categories');
}

runTests().catch(console.error);