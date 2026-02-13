#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const module = process.argv[2] || 'tickets'

console.log(`🔍 Auditoría Profunda: ${module}\n`)

const adminPath = path.join(__dirname, '..', `src/app/admin/${module}/page.tsx`)

if (!fs.existsSync(adminPath)) {
  console.log('❌ Archivo no encontrado')
  process.exit(1)
}

const content = fs.readFileSync(adminPath, 'utf-8')
const lines = content.split('\n')

console.log('📊 ANÁLISIS DE CÓDIGO\n')

// 1. Manejo de errores
const hasTryCatch = content.includes('try') && content.includes('catch')
const hasErrorHandling = content.includes('error') || content.includes('Error')
console.log(`🛡️  Try/Catch: ${hasTryCatch ? '✅' : '❌ FALTA'}`)
console.log(`⚠️  Manejo de errores: ${hasErrorHandling ? '✅' : '❌ FALTA'}`)

// 2. Alertas/Toasts
const hasToast = content.includes('toast')
const toastCalls = (content.match(/toast\(/g) || []).length
console.log(`\n🔔 Sistema de alertas:`)
console.log(`   Toast implementado: ${hasToast ? '✅' : '❌ FALTA'}`)
console.log(`   Llamadas a toast: ${toastCalls}`)

// 3. Loading states
const hasLoading = content.includes('loading') || content.includes('Loading')
const hasSetLoading = content.includes('setLoading')
console.log(`\n⏳ Estados de carga:`)
console.log(`   Loading state: ${hasLoading ? '✅' : '❌ FALTA'}`)
console.log(`   setLoading: ${hasSetLoading ? '✅' : '❌ FALTA'}`)

// 4. Funciones async
const asyncFunctions = (content.match(/const\s+\w+\s*=\s*async/g) || []).length
const asyncArrowFunctions = (content.match(/=\s*async\s*\(/g) || []).length
console.log(`\n🔄 Funciones asíncronas:`)
console.log(`   Total: ${asyncFunctions + asyncArrowFunctions}`)

// 5. useEffect
const useEffects = (content.match(/useEffect\(/g) || []).length
console.log(`\n⚡ Hooks:`)
console.log(`   useEffect: ${useEffects}`)

// 6. Validaciones
const hasValidation = content.includes('validate') || content.includes('validation')
console.log(`\n✓ Validaciones: ${hasValidation ? '✅' : '⚠️  No detectadas'}`)

// 7. Permisos
const hasPermissions = content.includes('role') || content.includes('permission')
console.log(`🔐 Control de permisos: ${hasPermissions ? '✅' : '❌ FALTA'}`)

// 8. Problemas potenciales
console.log(`\n⚠️  PROBLEMAS POTENCIALES:\n`)

const issues = []

if (!hasTryCatch) {
  issues.push('❌ Falta manejo de errores con try/catch')
}

if (asyncFunctions + asyncArrowFunctions > 0 && !hasTryCatch) {
  issues.push('❌ Funciones async sin try/catch')
}

if (!hasToast && hasErrorHandling) {
  issues.push('⚠️  Maneja errores pero no notifica al usuario')
}

if (useEffects > 0 && !hasLoading) {
  issues.push('⚠️  useEffect sin loading state')
}

// Buscar funciones sin manejo de errores
const functionMatches = content.match(/const\s+(\w+)\s*=\s*async[^{]*{([^}]+)}/g) || []
functionMatches.forEach((func, i) => {
  if (!func.includes('try') && !func.includes('catch')) {
    const funcName = func.match(/const\s+(\w+)/)?.[1]
    if (funcName) {
      issues.push(`⚠️  Función '${funcName}' sin try/catch`)
    }
  }
})

if (issues.length === 0) {
  console.log('✅ No se detectaron problemas críticos')
} else {
  issues.forEach(issue => console.log(`   ${issue}`))
}

// 9. Recomendaciones
console.log(`\n💡 RECOMENDACIONES:\n`)

const recommendations = []

if (!hasTryCatch) {
  recommendations.push('1. Agregar try/catch a funciones async')
}

if (!hasToast) {
  recommendations.push('2. Implementar sistema de notificaciones (toast)')
}

if (!hasLoading) {
  recommendations.push('3. Agregar estados de carga (loading)')
}

if (recommendations.length === 0) {
  console.log('✅ El código sigue buenas prácticas')
} else {
  recommendations.forEach(rec => console.log(`   ${rec}`))
}

console.log(`\n📈 PUNTUACIÓN: ${Math.max(0, 100 - (issues.length * 10))}/100`)
