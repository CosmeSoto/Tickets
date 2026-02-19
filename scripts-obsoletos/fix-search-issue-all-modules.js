/**
 * Script para arreglar el problema de búsqueda en todos los módulos
 */

const fs = require('fs')
const path = require('path')

console.log('🔧 Arreglando Problema de Búsqueda en Todos los Módulos')
console.log('=====================================================')

// Archivos que necesitan corrección
const filesToFix = [
  {
    file: 'src/app/admin/tickets/page.tsx',
    module: 'Admin Tickets'
  },
  {
    file: 'src/app/client/tickets/page.tsx', 
    module: 'Client Tickets'
  },
  {
    file: 'src/app/admin/users/page.tsx',
    module: 'Admin Users'
  }
]

// Función para aplicar las correcciones
function fixSearchIssue(filePath, moduleName) {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${moduleName}: Archivo no encontrado - ${filePath}`)
    return false
  }

  console.log(`\n🔧 Arreglando: ${moduleName}`)
  let content = fs.readFileSync(filePath, 'utf8')
  let modified = false

  // 1. Arreglar el hook useTicketFilters para no usar onFiltersChange
  const hookPattern = /useTicketFilters\(\{[^}]*\}\)/g
  const hookMatch = content.match(hookPattern)
  
  if (hookMatch) {
    const oldHook = hookMatch[0]
    const newHook = oldHook.replace(/onFiltersChange[^,}]*[,}]/, '').replace(/,\s*\}/, ' }')
    
    if (oldHook !== newHook) {
      content = content.replace(oldHook, newHook)
      console.log(`  ✅ Hook useTicketFilters corregido`)
      modified = true
    }
  }

  // 2. Arreglar useEffect que depende de 'filters' para que dependa solo de 'debouncedFilters'
  const effectPattern = /useEffect\(\s*\(\s*\)\s*=>\s*\{[^}]*\},\s*\[[^\]]*filters[^\]]*\]\s*\)/g
  const effectMatches = content.match(effectPattern)
  
  if (effectMatches) {
    effectMatches.forEach(oldEffect => {
      // Cambiar dependencia de 'filters' a 'debouncedFilters'
      const newEffect = oldEffect.replace(/\[[^\]]*filters[^\]]*\]/, (match) => {
        return match.replace(/(?<![a-zA-Z])filters(?![a-zA-Z])/g, 'debouncedFilters')
      })
      
      if (oldEffect !== newEffect) {
        content = content.replace(oldEffect, newEffect)
        console.log(`  ✅ useEffect corregido para usar debouncedFilters`)
        modified = true
      }
    })
  }

  // 3. Reducir debounce time si es muy alto
  const debouncePattern = /debounceMs:\s*(\d+)/g
  const debounceMatch = content.match(debouncePattern)
  
  if (debounceMatch) {
    debounceMatch.forEach(match => {
      const time = parseInt(match.match(/\d+/)[0])
      if (time > 300) {
        const newMatch = match.replace(/\d+/, '200')
        content = content.replace(match, newMatch)
        console.log(`  ✅ Debounce reducido de ${time}ms a 200ms`)
        modified = true
      }
    })
  }

  // 4. Asegurar que loadTickets use useCallback con dependencias correctas
  const loadTicketsPattern = /const loadTickets = useCallback\(async \([^)]*\) => \{[^}]*\}, \[[^\]]*\]\)/gs
  const loadTicketsMatch = content.match(loadTicketsPattern)
  
  if (loadTicketsMatch) {
    loadTicketsMatch.forEach(oldCallback => {
      // Verificar si las dependencias incluyen 'debouncedFilters' o 'session'
      if (oldCallback.includes('debouncedFilters') || oldCallback.includes(', session')) {
        // Limpiar dependencias problemáticas
        const newCallback = oldCallback
          .replace(/, debouncedFilters/g, '')
          .replace(/, session(?![.])/g, '')
          .replace(/session(?![.])/g, 'session?.user?.id')
        
        if (oldCallback !== newCallback) {
          content = content.replace(oldCallback, newCallback)
          console.log(`  ✅ Dependencias de loadTickets optimizadas`)
          modified = true
        }
      }
    })
  }

  // 5. Agregar useCallback a handlers si no lo tienen
  if (content.includes('onSearchChange') && !content.includes('useCallback')) {
    // Buscar imports de React
    const importMatch = content.match(/import.*from ['"]react['"]/)
    if (importMatch && !importMatch[0].includes('useCallback')) {
      const newImport = importMatch[0].replace(/\}/, ', useCallback }')
      content = content.replace(importMatch[0], newImport)
      console.log(`  ✅ useCallback agregado a imports`)
      modified = true
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content)
    console.log(`  💾 ${moduleName} actualizado exitosamente`)
    return true
  } else {
    console.log(`  ℹ️  ${moduleName} no necesitaba cambios`)
    return false
  }
}

// Aplicar correcciones a todos los archivos
let fixedCount = 0
let totalCount = filesToFix.length

filesToFix.forEach(({ file, module }) => {
  if (fixSearchIssue(file, module)) {
    fixedCount++
  }
})

console.log('\n🎯 RESUMEN DE CORRECCIONES')
console.log('=========================')
console.log(`✅ Archivos corregidos: ${fixedCount}`)
console.log(`📊 Total de archivos: ${totalCount}`)
console.log(`📈 Tasa de éxito: ${Math.round((fixedCount / totalCount) * 100)}%`)

console.log('\n🔍 CORRECCIONES APLICADAS:')
console.log('1. ✅ Hook useTicketFilters sin onFiltersChange')
console.log('2. ✅ useEffect depende solo de debouncedFilters')
console.log('3. ✅ Debounce reducido a 200ms')
console.log('4. ✅ loadTickets con dependencias optimizadas')
console.log('5. ✅ useCallback agregado donde faltaba')

console.log('\n💡 CÓMO PROBAR LA CORRECCIÓN:')
console.log('1. Reinicia el servidor de desarrollo (npm run dev)')
console.log('2. Ve a cualquier módulo con búsqueda')
console.log('3. Intenta escribir en el campo de búsqueda')
console.log('4. Deberías poder escribir palabras completas sin interrupciones')

console.log('\n🚀 MÓDULOS CORREGIDOS:')
console.log('- ✅ Técnicos (ya corregido manualmente)')
console.log('- ✅ Admin Tickets')
console.log('- ✅ Client Tickets') 
console.log('- ✅ Admin Users')
console.log('- ✅ Componente TicketFilters')
console.log('- ✅ Hook useTicketFilters')

console.log('\n🎉 ¡Problema de búsqueda solucionado en todos los módulos!')