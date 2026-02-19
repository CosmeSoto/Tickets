/**
 * Script para diagnosticar el problema de búsqueda en todos los módulos
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 Diagnosticando Problema de Búsqueda en Todos los Módulos')
console.log('=========================================================')

// Archivos que contienen filtros de búsqueda
const searchFiles = [
  'src/components/tickets/ticket-filters.tsx',
  'src/app/admin/tickets/page.tsx',
  'src/app/technician/tickets/page.tsx',
  'src/app/client/tickets/page.tsx',
  'src/app/admin/users/page.tsx',
  'src/app/admin/categories/page.tsx',
  'src/app/admin/departments/page.tsx',
  'src/hooks/common/use-ticket-filters.ts',
  'src/hooks/common/use-user-filters.ts'
]

console.log('📁 Archivos a revisar:')
searchFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`)
  } else {
    console.log(`❌ ${file} - NO EXISTE`)
  }
})

console.log('\n🔍 Analizando patrones problemáticos...')

searchFiles.forEach(file => {
  if (!fs.existsSync(file)) return
  
  console.log(`\n📄 Analizando: ${file}`)
  const content = fs.readFileSync(file, 'utf8')
  
  // Buscar patrones problemáticos
  const issues = []
  
  // 1. Input controlado sin estado local
  if (content.includes('value={') && content.includes('onChange=')) {
    const inputMatches = content.match(/value=\{[^}]+\}/g)
    const onChangeMatches = content.match(/onChange=\{[^}]+\}/g)
    
    if (inputMatches && onChangeMatches) {
      console.log(`  🔍 Encontrado input controlado`)
      
      // Verificar si usa estado local
      if (!content.includes('localSearchTerm') && !content.includes('localSearch')) {
        issues.push('❌ Input controlado SIN estado local')
      } else {
        console.log(`  ✅ Usa estado local`)
      }
    }
  }
  
  // 2. useEffect que puede causar re-renders
  const useEffectMatches = content.match(/useEffect\([^}]+\}/g)
  if (useEffectMatches) {
    console.log(`  📊 Encontrados ${useEffectMatches.length} useEffect`)
    
    // Buscar useEffect con dependencias de filtros
    if (content.includes('useEffect') && content.includes('filters')) {
      issues.push('⚠️  useEffect con dependencia de filters (posible re-render)')
    }
  }
  
  // 3. Debounce mal configurado
  if (content.includes('useDebounce') || content.includes('debounce')) {
    console.log(`  ⏱️  Usa debounce`)
    
    // Verificar tiempo de debounce
    const debounceMatch = content.match(/debounce[^0-9]*(\d+)/i)
    if (debounceMatch) {
      const time = parseInt(debounceMatch[1])
      if (time > 300) {
        issues.push(`⚠️  Debounce muy alto: ${time}ms (recomendado: ≤300ms)`)
      }
    }
  }
  
  // 4. Callback que puede cambiar en cada render
  if (content.includes('onSearchChange') && !content.includes('useCallback')) {
    issues.push('⚠️  onSearchChange sin useCallback')
  }
  
  // Mostrar issues encontrados
  if (issues.length > 0) {
    console.log(`  🚨 PROBLEMAS ENCONTRADOS:`)
    issues.forEach(issue => console.log(`    ${issue}`))
  } else {
    console.log(`  ✅ No se encontraron problemas obvios`)
  }
})

console.log('\n🎯 DIAGNÓSTICO COMPLETO')
console.log('======================')
console.log('Problemas comunes que causan el "salto" de una letra:')
console.log('1. ❌ Input controlado sin estado local')
console.log('2. ❌ useEffect que se ejecuta en cada cambio de filtro')
console.log('3. ❌ Callback que cambia en cada render')
console.log('4. ❌ Debounce muy agresivo (>300ms)')
console.log('5. ❌ Re-renders innecesarios del componente padre')

console.log('\n💡 SOLUCIONES A APLICAR:')
console.log('1. ✅ Usar estado local para el input de búsqueda')
console.log('2. ✅ useCallback para handlers estables')
console.log('3. ✅ Debounce moderado (150-300ms)')
console.log('4. ✅ Separar efectos de carga de datos')
console.log('5. ✅ Memoización de componentes pesados')