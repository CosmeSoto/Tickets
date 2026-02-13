#!/usr/bin/env node

const puppeteer = require('puppeteer')

async function testCategoriesComplete() {
  console.log('🧪 PRUEBA COMPLETA DEL MÓDULO CATEGORÍAS')
  console.log('=' .repeat(60))
  
  let browser
  try {
    // Lanzar navegador
    console.log('\n1. INICIANDO NAVEGADOR...')
    browser = await puppeteer.launch({ 
      headless: false, // Para ver qué pasa
      defaultViewport: { width: 1280, height: 720 }
    })
    const page = await browser.newPage()
    
    // Escuchar logs de consola
    page.on('console', msg => {
      const type = msg.type()
      const text = msg.text()
      if (text.includes('[CATEGORIES]')) {
        console.log(`🖥️  [BROWSER-${type.toUpperCase()}] ${text}`)
      }
    })
    
    // Escuchar errores
    page.on('pageerror', error => {
      console.error('❌ [BROWSER-ERROR]', error.message)
    })
    
    // Ir a la página de login
    console.log('\n2. NAVEGANDO A LOGIN...')
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
    
    // Hacer login
    console.log('\n3. HACIENDO LOGIN...')
    await page.type('input[name="email"]', 'admin@tickets.com')
    await page.type('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    
    // Esperar redirección
    await page.waitForNavigation({ waitUntil: 'networkidle0' })
    console.log('✅ Login exitoso, URL actual:', page.url())
    
    // Ir a categorías
    console.log('\n4. NAVEGANDO A CATEGORÍAS...')
    await page.goto('http://localhost:3000/admin/categories', { waitUntil: 'networkidle0' })
    
    // Esperar un poco para que cargue
    await page.waitForTimeout(3000)
    
    // Verificar elementos en la página
    console.log('\n5. VERIFICANDO ELEMENTOS...')
    
    const title = await page.$eval('h1', el => el.textContent).catch(() => 'No encontrado')
    console.log('📄 Título de página:', title)
    
    const sidebar = await page.$('.sidebar, [data-testid="sidebar"]').catch(() => null)
    console.log('📋 Sidebar presente:', sidebar ? 'SÍ' : 'NO')
    
    const loadingSpinner = await page.$('.animate-spin').catch(() => null)
    console.log('⏳ Loading spinner presente:', loadingSpinner ? 'SÍ' : 'NO')
    
    const errorMessage = await page.$('[role="alert"], .text-red-500').catch(() => null)
    console.log('❌ Mensaje de error presente:', errorMessage ? 'SÍ' : 'NO')
    
    const categoriesCards = await page.$$('.grid .card, [data-testid="category-card"]').catch(() => [])
    console.log('📋 Tarjetas de categorías encontradas:', categoriesCards.length)
    
    // Tomar screenshot
    console.log('\n6. TOMANDO SCREENSHOT...')
    await page.screenshot({ path: 'categories-debug.png', fullPage: true })
    console.log('📸 Screenshot guardado como categories-debug.png')
    
    // Esperar más tiempo para ver si carga
    console.log('\n7. ESPERANDO CARGA ADICIONAL...')
    await page.waitForTimeout(5000)
    
    const finalLoadingSpinner = await page.$('.animate-spin').catch(() => null)
    console.log('⏳ Loading spinner después de espera:', finalLoadingSpinner ? 'SÍ' : 'NO')
    
    const finalCategoriesCards = await page.$$('.grid .card, [data-testid="category-card"]').catch(() => [])
    console.log('📋 Tarjetas finales de categorías:', finalCategoriesCards.length)
    
    console.log('\n✅ PRUEBA COMPLETADA')
    
  } catch (error) {
    console.error('❌ ERROR EN PRUEBA:', error.message)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// Verificar si puppeteer está disponible
try {
  testCategoriesComplete()
} catch (error) {
  console.log('⚠️  Puppeteer no disponible, ejecutando prueba alternativa...')
  console.log('💡 Para instalar: npm install puppeteer')
  console.log('🔗 Accede manualmente a: http://localhost:3000/admin/categories')
  console.log('👤 Usuario: admin@tickets.com')
  console.log('🔑 Contraseña: admin123')
}