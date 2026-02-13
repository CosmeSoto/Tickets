// Test completo del flujo de autenticación
// Este script simula el flujo completo de login

const https = require('https')
const http = require('http')

// Configurar para ignorar certificados SSL en desarrollo
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.port === 443 ? https : http
    const req = protocol.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => body += chunk)
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        })
      })
    })
    
    req.on('error', reject)
    
    if (data) {
      req.write(data)
    }
    
    req.end()
  })
}

async function testAuthFlow() {
  console.log('🧪 Probando flujo completo de autenticación...\n')
  
  try {
    // 1. Probar endpoint de sesión sin autenticación
    console.log('1. 📋 Probando /api/auth/session sin autenticación...')
    const sessionResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/session',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    console.log(`   Status: ${sessionResponse.statusCode}`)
    console.log(`   Body: ${sessionResponse.body}`)
    
    // 2. Probar endpoint de reportes sin autenticación
    console.log('\n2. 📊 Probando /api/reports sin autenticación...')
    const reportsResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/reports?type=tickets',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    console.log(`   Status: ${reportsResponse.statusCode}`)
    console.log(`   Body: ${reportsResponse.body}`)
    
    // 3. Probar login
    console.log('\n3. 🔐 Probando login con credenciales...')
    const loginData = JSON.stringify({
      email: 'admin@tickets.com',
      password: 'admin123',
      redirect: false
    })
    
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/callback/credentials',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }, loginData)
    
    console.log(`   Status: ${loginResponse.statusCode}`)
    console.log(`   Headers:`, Object.keys(loginResponse.headers))
    console.log(`   Body: ${loginResponse.body.substring(0, 200)}...`)
    
    // 4. Probar CSRF token
    console.log('\n4. 🛡️ Probando CSRF token...')
    const csrfResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/csrf',
      method: 'GET'
    })
    
    console.log(`   Status: ${csrfResponse.statusCode}`)
    console.log(`   Body: ${csrfResponse.body}`)
    
    // 5. Probar providers
    console.log('\n5. 🔧 Probando providers...')
    const providersResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/providers',
      method: 'GET'
    })
    
    console.log(`   Status: ${providersResponse.statusCode}`)
    console.log(`   Body: ${providersResponse.body}`)
    
    console.log('\n✅ Test de flujo de autenticación completado')
    
  } catch (error) {
    console.error('❌ Error en test de autenticación:', error.message)
  }
}

testAuthFlow()