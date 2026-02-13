#!/usr/bin/env node

/**
 * Script para verificar que solo los módulos con problemas usen SearchInputStable
 * y los demás mantengan su Input normal que funcionaba bien
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 Verificando estado correcto después de la reversión...\n')

// Módulos que SÍ deben usar SearchInputStable (tenían problemas)
const modulesWithProblems = [
  {
    file: 'src/components/tickets/ticket-filters.tsx',
    module: 'Tickets',
    shouldUseSearchInputStable: true
  },
  {
    file: 'src/components/users/user-filters.tsx',
    module: 'Usuarios', 
    shouldUseSearchInputStable: true
  }
]

// Módulos que NO deben usar SearchInputStable (funcionaban bien)
const modulesWorkingFine = [
  {
    file: 'src/components/technicians/technician-filters.tsx',
    module: 'Técnicos',
    shouldUseSearchInputStable: false
  },
  {
    file: 'src/components/categories/category-filters.tsx',
    module: 'Categorías',
    shouldUseSearchInputStable: false
  },
  {
    file: 'src/components/departments/department-filters.tsx',
    module: 'Departamentos',
    shouldUseSearchInputStable: false
  },
  {
    file: 'src/components/notifications/notification-filters.tsx',
    module: 'Notificaciones',
    shouldUseSearchInputStable: false
  }
]

const allModules = [...modulesWithProblems, ...modulesWorkingFine]

console.log('📋 Verificando estado de cada módulo:\n')

let allCorrect = true

allModules.forEach(({ file, module, shouldUseSearchInputStable }) => {
  const fullPath = path.join(__dirname, file)
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${module}: Archivo no encontrado - ${file}`)
    allCorrect = false
    return
  }
  
  const content = fs.readFileSync(fullPath, 'utf8')
  
  const usesSearchInputStable = content.includes('SearchInputStable')
  const usesNormalInput = content.includes('onChange={(e) => set') && content.includes('<Input')
  
  if (shouldUseSearchInputStable) {
    // Módulos que SÍ deben usar SearchInputStable
    if (usesSearchInputStable && !usesNormalInput) {
      console.log(`✅ ${module}: Correcto - Usa SearchInputStable (tenía problemas)`)
    } else {
      console.log(`❌ ${module}: Incorrecto - Debería usar SearchInputStable`)
      allCorrect = false
    }
  } else {
    // Módulos que NO deben usar SearchInputStable
    if (!usesSearchInputStable && usesNormalInput) {
      console.log(`✅ ${module}: Correcto - Usa Input normal (funcionaba bien)`)
    } else {
      console.log(`❌ ${module}: Incorrecto - Debería usar Input normal`)
      allCorrect = false
    }
  }
})

console.log('\n' + '='.repeat(60))
if (allCorrect) {
  console.log('🎉 ¡PERFECTO! Estado restaurado correctamente')
  console.log('\n✅ Módulos con SearchInputStable (tenían problemas):')
  console.log('   • Tickets - Debounce 1.5s para evitar interrupciones')
  console.log('   • Usuarios - Debounce 1.5s para evitar interrupciones')
  console.log('\n✅ Módulos con Input normal (funcionaban bien):')
  console.log('   • Técnicos - Mantiene su funcionamiento original')
  console.log('   • Categorías - Mantiene su funcionamiento original')
  console.log('   • Departamentos - Mantiene su funcionamiento original')
  console.log('   • Notificaciones - Mantiene su funcionamiento original')
} else {
  console.log('⚠️  Algunos módulos no están en el estado correcto')
}

console.log('\n📝 Resumen:')
console.log('• Solo Tickets y Usuarios usan SearchInputStable (tenían el problema)')
console.log('• Los demás módulos mantienen Input normal (funcionaban bien)')
console.log('• Se preserva el funcionamiento original de los módulos que estaban bien')