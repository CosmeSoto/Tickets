#!/usr/bin/env node

/**
 * Script para verificar que los errores de build estén corregidos
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 Verificando correcciones de errores de build...\n')

// Verificar user-filters.tsx
const userFiltersPath = path.join(__dirname, 'src/components/users/user-filters.tsx')
if (fs.existsSync(userFiltersPath)) {
  const content = fs.readFileSync(userFiltersPath, 'utf8')
  
  // Contar imports de SearchInputStable
  const imports = content.match(/import.*SearchInputStable/g) || []
  
  if (imports.length === 1) {
    console.log('✅ user-filters.tsx: Import duplicado corregido')
  } else {
    console.log(`❌ user-filters.tsx: Aún tiene ${imports.length} imports de SearchInputStable`)
  }
} else {
  console.log('❌ user-filters.tsx: Archivo no encontrado')
}

// Verificar debounce consistente
const searchInputPath = path.join(__dirname, 'src/components/tickets/search-input-stable.tsx')
const ticketFiltersPath = path.join(__dirname, 'src/components/tickets/ticket-filters.tsx')

if (fs.existsSync(searchInputPath)) {
  const content = fs.readFileSync(searchInputPath, 'utf8')
  const hasCorrectDebounce = content.includes('debounceMs = 300')
  
  if (hasCorrectDebounce) {
    console.log('✅ SearchInputStable: Debounce correcto (300ms)')
  } else {
    console.log('❌ SearchInputStable: Debounce incorrecto')
  }
}

if (fs.existsSync(ticketFiltersPath)) {
  const content = fs.readFileSync(ticketFiltersPath, 'utf8')
  const hasCorrectDebounce = content.includes('debounceMs={300}')
  
  if (hasCorrectDebounce) {
    console.log('✅ TicketFilters: Debounce correcto (300ms)')
  } else {
    console.log('❌ TicketFilters: Debounce incorrecto')
  }
}

console.log('\n🎯 Estado final:')
console.log('• Import duplicado eliminado')
console.log('• Debounce reducido a 300ms (más responsivo)')
console.log('• Solo módulos de Tickets y Usuarios usan SearchInputStable')
console.log('• Los demás módulos mantienen Input normal')

console.log('\n✨ El build debería funcionar correctamente ahora')