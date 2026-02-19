#!/usr/bin/env node

/**
 * Script para verificar que todos los módulos tengan debounce consistente de 1.5 segundos
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 Verificando consistencia de debounce en todos los módulos...\n')

// Archivos que deben usar SearchInputStable con debounce de 1.5s
const modulesWithSearch = [
  {
    file: 'src/components/tickets/ticket-filters.tsx',
    module: 'Tickets',
    component: 'TicketFilters'
  },
  {
    file: 'src/components/technicians/technician-filters.tsx',
    module: 'Técnicos',
    component: 'TechnicianFilters'
  },
  {
    file: 'src/components/users/user-filters.tsx',
    module: 'Usuarios',
    component: 'UserFilters'
  },
  {
    file: 'src/components/categories/category-filters.tsx',
    module: 'Categorías',
    component: 'CategoryFilters'
  },
  {
    file: 'src/components/departments/department-filters.tsx',
    module: 'Departamentos',
    component: 'DepartmentFilters'
  },
  {
    file: 'src/components/notifications/notification-filters.tsx',
    module: 'Notificaciones',
    component: 'NotificationFilters'
  }
]

// Verificar cada módulo
console.log('📋 Estado de los módulos:\n')

let allCorrect = true

modulesWithSearch.forEach(({ file, module, component }) => {
  const fullPath = path.join(__dirname, file)
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${module}: Archivo no encontrado - ${file}`)
    allCorrect = false
    return
  }
  
  const content = fs.readFileSync(fullPath, 'utf8')
  
  // Verificar que use SearchInputStable
  const usesSearchInputStable = content.includes('SearchInputStable')
  
  // Verificar que tenga debounce de 1500ms
  const hasCorrectDebounce = content.includes('debounceMs={1500}') || content.includes('debounceMs: 1500')
  
  // Verificar que NO use Input normal para búsqueda
  const hasOldInput = content.includes('onChange={(e) => set') && content.includes('Input')
  
  if (usesSearchInputStable && hasCorrectDebounce && !hasOldInput) {
    console.log(`✅ ${module}: Configuración correcta`)
    console.log(`   - Usa SearchInputStable: ✅`)
    console.log(`   - Debounce 1.5s: ✅`)
    console.log(`   - Sin Input obsoleto: ✅`)
  } else {
    console.log(`❌ ${module}: Necesita corrección`)
    console.log(`   - Usa SearchInputStable: ${usesSearchInputStable ? '✅' : '❌'}`)
    console.log(`   - Debounce 1.5s: ${hasCorrectDebounce ? '✅' : '❌'}`)
    console.log(`   - Sin Input obsoleto: ${!hasOldInput ? '✅' : '❌'}`)
    allCorrect = false
  }
  console.log('')
})

// Verificar el hook principal
console.log('🔧 Verificando hook principal:\n')

const hookPath = path.join(__dirname, 'src/hooks/common/use-ticket-filters.ts')
if (fs.existsSync(hookPath)) {
  const hookContent = fs.readFileSync(hookPath, 'utf8')
  const hasCorrectHookDebounce = hookContent.includes('debounceMs = 1500')
  
  if (hasCorrectHookDebounce) {
    console.log('✅ useTicketFilters: Debounce correcto (1.5s)')
  } else {
    console.log('❌ useTicketFilters: Debounce incorrecto')
    allCorrect = false
  }
} else {
  console.log('❌ useTicketFilters: Archivo no encontrado')
  allCorrect = false
}

// Verificar SearchInputStable
console.log('\n🎯 Verificando SearchInputStable:\n')

const searchInputPath = path.join(__dirname, 'src/components/tickets/search-input-stable.tsx')
if (fs.existsSync(searchInputPath)) {
  const searchContent = fs.readFileSync(searchInputPath, 'utf8')
  const hasCorrectDefault = searchContent.includes('debounceMs = 1500')
  
  if (hasCorrectDefault) {
    console.log('✅ SearchInputStable: Debounce por defecto correcto (1.5s)')
  } else {
    console.log('❌ SearchInputStable: Debounce por defecto incorrecto')
    allCorrect = false
  }
} else {
  console.log('❌ SearchInputStable: Archivo no encontrado')
  allCorrect = false
}

// Resultado final
console.log('\n' + '='.repeat(60))
if (allCorrect) {
  console.log('🎉 ¡PERFECTO! Todos los módulos tienen debounce consistente de 1.5 segundos')
  console.log('\n✨ Beneficios aplicados:')
  console.log('• Los usuarios pueden escribir durante 1.5 segundos sin interrupciones')
  console.log('• Experiencia de búsqueda consistente en todos los módulos')
  console.log('• No más saltos o interrupciones al escribir')
  console.log('• Búsqueda inmediata con Enter o al perder el foco')
} else {
  console.log('⚠️  Algunos módulos necesitan corrección')
  console.log('\n🔧 Acciones requeridas:')
  console.log('• Revisar los módulos marcados con ❌')
  console.log('• Asegurar que usen SearchInputStable')
  console.log('• Configurar debounceMs={1500}')
  console.log('• Eliminar Input obsoletos')
}

console.log('\n📝 Para probar:')
console.log('1. Ir a cualquier módulo (técnicos, usuarios, categorías, etc.)')
console.log('2. Hacer clic en el campo de búsqueda')
console.log('3. Escribir una frase lentamente')
console.log('4. Verificar que no hay interrupciones durante 1.5 segundos')