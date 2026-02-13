#!/usr/bin/env node

const http = require('http');

console.log('🚀 INICIANDO PRUEBAS COMPLETAS DEL SISTEMA');
console.log('='.repeat(50));

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

async function testSystem() {
  const tests = [];
  
  // Test 1: Frontend
  console.log('🌐 Probando Frontend...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    });
    
    if (response.statusCode === 200) {
      console.log('✅ Frontend: OK');
      tests.push({ name: 'Frontend', status: 'OK' });
    } else {
      console.log(`❌ Frontend: Error ${response.statusCode}`);
      tests.push({ name: 'Frontend', status: 'ERROR', code: response.statusCode });
    }
  } catch (error) {
    console.log(`❌ Frontend: ${error.message}`);
    tests.push({ name: 'Frontend', status: 'ERROR', error: error.message });
  }
  
  // Test 2: API Health
  console.log('🔧 Probando API Health...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      method: 'GET'
    });
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      if (data.status === 'healthy') {
        console.log('✅ API Health: OK');
        tests.push({ name: 'API Health', status: 'OK' });
      } else {
        console.log('⚠️ API Health: Degraded');
        tests.push({ name: 'API Health', status: 'DEGRADED' });
      }
    } else {
      console.log(`❌ API Health: Error ${response.statusCode}`);
      tests.push({ name: 'API Health', status: 'ERROR', code: response.statusCode });
    }
  } catch (error) {
    console.log(`❌ API Health: ${error.message}`);
    tests.push({ name: 'API Health', status: 'ERROR', error: error.message });
  }
  
  // Test 3: Login Page
  console.log('🔐 Probando Página de Login...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/login',
      method: 'GET'
    });
    
    if (response.statusCode === 200) {
      console.log('✅ Login Page: OK');
      tests.push({ name: 'Login Page', status: 'OK' });
    } else {
      console.log(`❌ Login Page: Error ${response.statusCode}`);
      tests.push({ name: 'Login Page', status: 'ERROR', code: response.statusCode });
    }
  } catch (error) {
    console.log(`❌ Login Page: ${error.message}`);
    tests.push({ name: 'Login Page', status: 'ERROR', error: error.message });
  }
  
  // Test 4: API Tickets
  console.log('🎫 Probando API de Tickets...');
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/tickets',
      method: 'GET'
    });
    
    if (response.statusCode === 200 || response.statusCode === 401) {
      // 401 es esperado sin autenticación
      console.log('✅ API Tickets: OK (endpoint disponible)');
      tests.push({ name: 'API Tickets', status: 'OK' });
    } else {
      console.log(`❌ API Tickets: Error ${response.statusCode}`);
      tests.push({ name: 'API Tickets', status: 'ERROR', code: response.statusCode });
    }
  } catch (error) {
    console.log(`❌ API Tickets: ${error.message}`);
    tests.push({ name: 'API Tickets', status: 'ERROR', error: error.message });
  }
  
  // Resumen
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE PRUEBAS:');
  
  const successful = tests.filter(t => t.status === 'OK').length;
  const failed = tests.filter(t => t.status === 'ERROR').length;
  const degraded = tests.filter(t => t.status === 'DEGRADED').length;
  
  console.log(`✅ Exitosas: ${successful}`);
  console.log(`❌ Fallidas: ${failed}`);
  console.log(`⚠️ Degradadas: ${degraded}`);
  
  if (failed === 0) {
    console.log('\n🎉 ¡SISTEMA FUNCIONANDO CORRECTAMENTE!');
    console.log('\n📋 Credenciales de prueba:');
    console.log('👤 Admin: admin@tickets.com / admin123');
    console.log('🔧 Técnico: tecnico1@tickets.com / tech123');
    console.log('👥 Cliente: cliente1@empresa.com / client123');
    console.log('\n🌐 Accede a: http://localhost:3000');
  } else {
    console.log('\n⚠️ Hay problemas en el sistema que requieren atención');
  }
}

testSystem().catch(console.error);