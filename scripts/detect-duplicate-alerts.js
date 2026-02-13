#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

console.log('🔍 Detectando alertas duplicadas en el sistema...\n')

const modulesToCheck = [
  'src/app/admin/backups/page.tsx',
  'src/app/admin/categories/page.tsx',
  'src/app/admin/departments/page.tsx',
  'src/app/admin/users/page.tsx',
  'src/app/admin/technicians/page.tsx',
  'src/app/admin/tickets/page.tsx',
]

const results = []

modulesToCheck.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath)
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  ${filePath} - No existe`)
    return
  }

  const content = fs.readFileSync(fullPath, 'utf-8')
  
  // Buscar patrones de toast sin condición
  const toastPattern = /toast\(\{[\s\S]*?\}\)/g
  const toastMatches = content.match(toastPattern) || []
  
  // Buscar funciones de carga
  const loadFunctions = content.match(/const\s+load\w+\s*=\s*async\s*\([^)]*\)/g) || []
  
  // Buscar si tiene parámetro showToast
  const hasShowToast = content.includes('showToast')
  
  // Buscar useEffect que llama funciones de carga
  const hasAutoLoad = content.includes('useEffect') && loadFunctions.length > 0
  
  const status = {
    file: filePath,
    toastCount: toastMatches.length,
    loadFunctions: loadFunctions.length,
    hasShowToast,
    hasAutoLoad,
    needsFix: !hasShowToast && toastMatches.length > 0 && hasAutoLoad
  }
  
  results.push(status)
  
  const icon = status.needsFix ? '❌' : '✅'
  console.log(`${icon} ${filePath}`)
  console.log(`   Toasts: ${status.toastCount}, Loads: ${status.loadFunctions}, ShowToast: ${status.hasShowToast}`)
  
  if (status.needsFix) {
    console.log(`   ⚠️  NECESITA CORRECCIÓN`)
  }
  console.log()
})

console.log('\n' + '='.repeat(60))
console.log('📊 RESUMEN')
console.log('='.repeat(60))

const needsFix = results.filter(r => r.needsFix)
const ok = results.filter(r => !r.needsFix)

console.log(`✅ Correctos: ${ok.length}`)
console.log(`❌ Necesitan corrección: ${needsFix.length}`)

if (needsFix.length > 0) {
  console.log('\n🔧 Archivos a corregir:')
  needsFix.forEach(r => console.log(`   - ${r.file}`))
}

console.log('\n💡 Siguiente paso: Aplicar patrón showToast a los archivos marcados')
