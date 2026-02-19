#!/usr/bin/env node

/**
 * Script para corregir errores de auditoría en bloques catch
 */

const fs = require('fs')
const path = require('path')

console.log('🔧 Corrigiendo errores de auditoría en bloques catch...\n')

// Archivos que pueden tener este problema
const filesToCheck = [
  'src/app/api/departments/[id]/route.ts',
  'src/app/api/departments/route.ts',
  'src/app/api/users/[id]/route.ts',
  'src/app/api/users/route.ts',
  'src/app/api/tickets/[id]/route.ts',
  'src/app/api/tickets/route.ts'
]

filesToCheck.forEach(file => {
  const fullPath = path.join(__dirname, file)
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⏭️  ${file} - No existe`)
    return
  }
  
  let content = fs.readFileSync(fullPath, 'utf8')
  let modified = false
  
  // Buscar y eliminar bloques de auditoría problemáticos en catch
  const auditPattern = /\/\/ Registrar auditoría[\s\S]*?} catch \(auditError\) \{[\s\S]*?}\s*return/g
  
  if (auditPattern.test(content)) {
    content = content.replace(auditPattern, 'return')
    modified = true
  }
  
  // También buscar patrones más específicos
  const specificPatterns = [
    /try \{[\s\S]*?await AuditServiceComplete\.log\([\s\S]*?\) \{[\s\S]*?console\.error\('\[AUDIT\] Error:'[\s\S]*?}\s*/g,
    /\/\/ Registrar auditoría[\s\S]*?} catch \(auditError\) \{[\s\S]*?}\s*/g
  ]
  
  specificPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '')
      modified = true
    }
  })
  
  if (modified) {
    fs.writeFileSync(fullPath, content)
    console.log(`✅ ${file} - Corregido`)
  } else {
    console.log(`✅ ${file} - Sin problemas`)
  }
})

console.log('\n🎉 Corrección completada!')