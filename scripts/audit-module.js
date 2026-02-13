#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const moduleName = process.argv[2] || 'tickets'

console.log(`🔍 Auditando módulo: ${moduleName}\n`)

const checks = {
  admin: `src/app/admin/${moduleName}/page.tsx`,
  api: `src/app/api/${moduleName}/route.ts`,
  components: `src/components/${moduleName}/`,
  service: `src/lib/services/${moduleName}-service.ts`,
}

const results = {}

// Verificar archivos principales
Object.entries(checks).forEach(([key, filePath]) => {
  const fullPath = path.join(__dirname, '..', filePath)
  const exists = fs.existsSync(fullPath)
  const isDir = exists && fs.statSync(fullPath).isDirectory()
  
  results[key] = {
    path: filePath,
    exists,
    isDir,
    size: exists && !isDir ? fs.statSync(fullPath).size : 0
  }
  
  const icon = exists ? '✅' : '❌'
  console.log(`${icon} ${key}: ${filePath}`)
  
  if (exists && !isDir) {
    const content = fs.readFileSync(fullPath, 'utf-8')
    
    // Análisis básico
    const lines = content.split('\n').length
    const hasToast = content.includes('toast')
    const hasUseEffect = content.includes('useEffect')
    const hasAsync = content.includes('async')
    const hasTryCatch = content.includes('try') && content.includes('catch')
    
    console.log(`   📊 ${lines} líneas`)
    console.log(`   🔔 Toast: ${hasToast ? 'Sí' : 'No'}`)
    console.log(`   ⚡ useEffect: ${hasUseEffect ? 'Sí' : 'No'}`)
    console.log(`   🔄 Async: ${hasAsync ? 'Sí' : 'No'}`)
    console.log(`   🛡️  Try/Catch: ${hasTryCatch ? 'Sí' : 'No'}`)
  }
  console.log()
})

console.log('='.repeat(60))
console.log('📋 RESUMEN')
console.log('='.repeat(60))

const existing = Object.values(results).filter(r => r.exists).length
const total = Object.keys(results).length

console.log(`✅ Archivos encontrados: ${existing}/${total}`)

if (existing < total) {
  console.log('\n⚠️  Archivos faltantes:')
  Object.entries(results).forEach(([key, data]) => {
    if (!data.exists) {
      console.log(`   - ${key}: ${data.path}`)
    }
  })
}
