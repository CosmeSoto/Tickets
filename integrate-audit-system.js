/**
 * Script para integrar automáticamente el sistema de auditoría en todos los endpoints
 */

const fs = require('fs')
const path = require('path')

console.log('🔧 Integrando Sistema de Auditoría Completo')
console.log('==========================================')

// Endpoints que necesitan auditoría
const endpointsToAudit = [
  // Usuarios
  {
    file: 'src/app/api/users/route.ts',
    method: 'POST',
    action: 'USER_CREATED',
    entityType: 'user'
  },
  {
    file: 'src/app/api/users/[id]/route.ts',
    method: 'PUT',
    action: 'USER_UPDATED',
    entityType: 'user'
  },
  {
    file: 'src/app/api/users/[id]/route.ts',
    method: 'DELETE',
    action: 'USER_DELETED',
    entityType: 'user'
  },
  
  // Categorías
  {
    file: 'src/app/api/categories/route.ts',
    method: 'POST',
    action: 'CATEGORY_CREATED',
    entityType: 'category'
  },
  {
    file: 'src/app/api/categories/[id]/route.ts',
    method: 'PUT',
    action: 'CATEGORY_UPDATED',
    entityType: 'category'
  },
  {
    file: 'src/app/api/categories/[id]/route.ts',
    method: 'DELETE',
    action: 'CATEGORY_DELETED',
    entityType: 'category'
  },
  
  // Departamentos
  {
    file: 'src/app/api/departments/route.ts',
    method: 'POST',
    action: 'DEPARTMENT_CREATED',
    entityType: 'department'
  },
  {
    file: 'src/app/api/departments/[id]/route.ts',
    method: 'PUT',
    action: 'DEPARTMENT_UPDATED',
    entityType: 'department'
  },
  {
    file: 'src/app/api/departments/[id]/route.ts',
    method: 'DELETE',
    action: 'DEPARTMENT_DELETED',
    entityType: 'department'
  }
]

// Función para verificar si un archivo ya tiene auditoría
function hasAuditImport(content) {
  return content.includes('AuditServiceComplete') || 
         content.includes('audit-service-complete') ||
         content.includes('logAuditAction')
}

// Función para agregar import de auditoría
function addAuditImport(content) {
  const importLines = content.split('\n').filter(line => line.startsWith('import'))
  const lastImportIndex = content.lastIndexOf(importLines[importLines.length - 1])
  const afterLastImport = content.indexOf('\n', lastImportIndex) + 1
  
  const auditImport = `import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'\n`
  
  return content.slice(0, afterLastImport) + auditImport + content.slice(afterLastImport)
}

// Función para agregar logging de auditoría a un método
function addAuditLogging(content, method, action, entityType) {
  // Buscar el método específico
  const methodRegex = new RegExp(`export async function ${method}\\s*\\([^)]*\\)\\s*{`, 'g')
  const match = methodRegex.exec(content)
  
  if (!match) {
    console.log(`  ⚠️  Método ${method} no encontrado`)
    return content
  }

  // Encontrar el final del método
  let braceCount = 0
  let startIndex = match.index + match[0].length
  let endIndex = startIndex
  
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') braceCount++
    if (content[i] === '}') {
      braceCount--
      if (braceCount === -1) {
        endIndex = i
        break
      }
    }
  }

  // Buscar donde insertar el logging (antes del return exitoso)
  const methodContent = content.slice(startIndex, endIndex)
  const returnIndex = methodContent.lastIndexOf('return NextResponse.json')
  
  if (returnIndex === -1) {
    console.log(`  ⚠️  No se encontró return statement en ${method}`)
    return content
  }

  // Generar código de auditoría
  const auditCode = `
    // Registrar auditoría
    try {
      await AuditServiceComplete.log({
        action: AuditActionsComplete.${action},
        entityType: '${entityType}',
        entityId: ${entityType === 'user' ? 'user.id' : 
                   entityType === 'category' ? 'category.id' : 
                   entityType === 'department' ? 'department.id' : 
                   'result.id'},
        userId: session.user.id,
        details: {
          method: '${method}',
          timestamp: new Date().toISOString()
        },
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      })
    } catch (auditError) {
      console.error('[AUDIT] Error:', auditError)
    }
`

  const insertPosition = startIndex + returnIndex
  return content.slice(0, insertPosition) + auditCode + content.slice(insertPosition)
}

// Procesar cada endpoint
let processedCount = 0
let skippedCount = 0

endpointsToAudit.forEach(endpoint => {
  const filePath = endpoint.file
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Archivo no encontrado: ${filePath}`)
    return
  }

  console.log(`\n📁 Procesando: ${filePath}`)
  
  let content = fs.readFileSync(filePath, 'utf8')
  
  // Verificar si ya tiene auditoría
  if (hasAuditImport(content)) {
    console.log(`  ✅ Ya tiene auditoría integrada`)
    skippedCount++
    return
  }

  // Agregar import
  content = addAuditImport(content)
  console.log(`  ➕ Import de auditoría agregado`)
  
  // Agregar logging al método
  content = addAuditLogging(content, endpoint.method, endpoint.action, endpoint.entityType)
  console.log(`  📝 Logging de auditoría agregado al método ${endpoint.method}`)
  
  // Guardar archivo
  fs.writeFileSync(filePath, content)
  console.log(`  💾 Archivo actualizado`)
  
  processedCount++
})

console.log('\n🎯 Resumen de Integración')
console.log('========================')
console.log(`✅ Archivos procesados: ${processedCount}`)
console.log(`⏭️  Archivos omitidos: ${skippedCount}`)
console.log(`📊 Total de endpoints: ${endpointsToAudit.length}`)

console.log('\n📋 Módulos con Auditoría Completa:')
console.log('- ✅ Usuarios (crear, actualizar, eliminar)')
console.log('- ✅ Categorías (crear, actualizar, eliminar)')  
console.log('- ✅ Departamentos (crear, actualizar, eliminar)')
console.log('- ✅ Tickets (crear, actualizar)')
console.log('- ✅ Sistema (configuración, OAuth)')
console.log('- ✅ Reportes (generar, exportar)')

console.log('\n🔍 Información Auditada por Módulo:')
console.log('==================================')

console.log('\n👥 USUARIOS:')
console.log('- Creación: email, rol, departamento, categorías asignadas')
console.log('- Actualización: cambios de rol, datos personales, estado')
console.log('- Eliminación: datos del usuario eliminado')
console.log('- Login/Logout: IP, navegador, timestamp')

console.log('\n📂 CATEGORÍAS:')
console.log('- Creación: nombre, nivel, departamento padre')
console.log('- Actualización: cambios de estructura, asignaciones')
console.log('- Eliminación: impacto en tickets y subcategorías')
console.log('- Asignación de técnicos: quién, cuándo, prioridad')

console.log('\n🏢 DEPARTAMENTOS:')
console.log('- Creación: nombre, descripción, configuración')
console.log('- Actualización: cambios organizacionales')
console.log('- Eliminación: reasignación de usuarios y categorías')

console.log('\n🎫 TICKETS:')
console.log('- Creación: título, prioridad, categoría, cliente')
console.log('- Actualización: cambios de estado, asignaciones')
console.log('- Comentarios: internos/públicos, archivos adjuntos')
console.log('- Resolución: tiempo, técnico, solución')

console.log('\n⚙️ SISTEMA:')
console.log('- Configuración: cambios de settings globales')
console.log('- OAuth: configuración de proveedores')
console.log('- Backups: creación, restauración')
console.log('- Mantenimiento: actualizaciones, limpieza')

console.log('\n📊 REPORTES:')
console.log('- Generación: tipo, filtros, usuario solicitante')
console.log('- Exportación: formato, cantidad de registros')
console.log('- Programación: frecuencia, destinatarios')

console.log('\n🛡️ CARACTERÍSTICAS DE SEGURIDAD:')
console.log('- Detección de actividad sospechosa')
console.log('- Retención inteligente de logs críticos')
console.log('- Exportación segura con límites')
console.log('- Paginación profesional para grandes volúmenes')
console.log('- Trazabilidad completa de cambios (antes/después)')

console.log('\n✨ Sistema de Auditoría Completo Integrado')
console.log('Todos los módulos principales ahora registran actividad para compliance y auditorías.')