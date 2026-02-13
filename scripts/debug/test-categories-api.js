#!/usr/bin/env node

const http = require('http')

async function testCategoriesAPI() {
  console.log('🧪 PROBANDO API DE CATEGORÍAS CON AUTENTICACIÓN')
  console.log('=' .repeat(60))
  
  try {
    // Primero intentar login
    console.log('\n1. INTENTANDO LOGIN...')
    const loginData = JSON.stringify({
      email: 'admin@tickets.com',
      password: 'admin123'
    })
    
    const loginOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/signin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    }
    
    const loginResponse = await makeRequest(loginOptions, loginData)
    console.log('📡 Respuesta de login:', loginResponse.statusCode)
    console.log('🍪 Headers:', JSON.stringify(loginResponse.headers, null, 2))
    
    // Extraer cookies si las hay
    const cookies = loginResponse.headers['set-cookie'] || []
    const cookieHeader = cookies.join('; ')
    
    // Ahora probar la API de categorías
    console.log('\n2. PROBANDO API DE CATEGORÍAS...')
    const categoriesOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/categories',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      }
    }
    
    const categoriesResponse = await makeRequest(categoriesOptions)
    console.log('📡 Respuesta de categorías:', categoriesResponse.statusCode)
    console.log('📦 Datos:', categoriesResponse.data)
    
    // Probar acceso directo a la página
    console.log('\n3. PROBANDO ACCESO A PÁGINA DE CATEGORÍAS...')
    const pageOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/admin/categories',
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }
    
    const pageResponse = await makeRequest(pageOptions)
    console.log('📄 Respuesta de página:', pageResponse.statusCode)
    console.log('📝 Tipo de contenido:', pageResponse.headers['content-type'])
    
    if (pageResponse.statusCode === 200) {
      console.log('✅ Página de categorías accesible')
    } else if (pageResponse.statusCode === 307 || pageResponse.statusCode === 302) {
      console.log('🔄 Redirección detectada a:', pageResponse.headers.location)
    } else {
      console.log('❌ Error al acceder a la página')
    }
    
  } catch (error) {
    console.error('❌ ERROR EN PRUEBA:', error.message)
  }
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = ''
      
      res.on('data', (chunk) => {
        responseData += chunk
      })
      
      res.on('end', () => {
        try {
          const parsedData = responseData ? JSON.parse(responseData) : null
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          })
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData.substring(0, 200) + (responseData.length > 200 ? '...' : '')
          })
        }
      })
    })
    
    req.on('error', (error) => {
      reject(error)
    })
    
    if (data) {
      req.write(data)
    }
    
    req.end()
  })
}

testCategoriesAPI()