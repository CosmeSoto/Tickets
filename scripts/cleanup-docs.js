#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

console.log('🧹 Limpiando documentación excesiva...\n')

// Archivos a mantener (esenciales)
const keep = [
  'README.md',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'next.config.ts',
  'tailwind.config.js',
  'postcss.config.mjs',
  'playwright.config.ts',
  'jest.config.js',
  'jest.setup.js',
  '.eslintrc.js',
  '.prettierrc',
  '.gitignore',
  '.dockerignore',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.prod.yml',
  'middleware.ts',
]

// Mover a archived-docs
const toArchive = []
const toDelete = []

const files = fs.readdirSync('.')

files.forEach(file => {
  if (file.startsWith('.')) return
  if (keep.includes(file)) return
  if (fs.statSync(file).isDirectory()) return
  
  if (file.endsWith('.md')) {
    // Mantener solo documentos recientes importantes
    if (file.includes('CORRECCION_ALERTAS') || 
        file.includes('QUICK_REFERENCE') ||
        file.includes('PROXIMOS_PASOS_ACTUALIZADOS')) {
      console.log(`✅ Mantener: ${file}`)
    } else {
      toArchive.push(file)
    }
  } else if (file.endsWith('.js') && !file.includes('node_modules')) {
    // Scripts temporales
    if (file.startsWith('test-') || 
        file.startsWith('debug-') || 
        file.startsWith('check-') ||
        file.startsWith('verify-') ||
        file.startsWith('verificar-') ||
        file.startsWith('simple-') ||
        file.startsWith('recreate-') ||
        file.startsWith('expert-')) {
      toDelete.push(file)
    }
  }
})

console.log(`\n📦 Archivos a archivar: ${toArchive.length}`)
console.log(`🗑️  Archivos a eliminar: ${toDelete.length}`)

// Mover a archived-docs
if (toArchive.length > 0) {
  console.log('\n📦 Moviendo a archived-docs...')
  toArchive.forEach(file => {
    const dest = path.join('archived-docs', 'old', file)
    try {
      fs.renameSync(file, dest)
      console.log(`   ✅ ${file}`)
    } catch (e) {
      console.log(`   ❌ ${file} - ${e.message}`)
    }
  })
}

// Eliminar scripts temporales
if (toDelete.length > 0) {
  console.log('\n🗑️  Eliminando scripts temporales...')
  toDelete.forEach(file => {
    try {
      fs.unlinkSync(file)
      console.log(`   ✅ ${file}`)
    } catch (e) {
      console.log(`   ❌ ${file} - ${e.message}`)
    }
  })
}

console.log('\n✅ Limpieza completada')
console.log(`📁 Archivos en raíz ahora: ${fs.readdirSync('.').filter(f => !f.startsWith('.') && !fs.statSync(f).isDirectory()).length}`)
