#!/usr/bin/env node

/**
 * ANALIZADOR DE ARQUITECTURA
 *
 * Analiza la estructura del código, dependencias y patrones arquitectónicos
 * para identificar problemas de calidad y oportunidades de mejora
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
}

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log('\n' + '='.repeat(60))
  log(title, 'cyan')
  console.log('='.repeat(60))
}

// Función para contar líneas de código
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    const codeLines = lines.filter(line => {
      const trimmed = line.trim()
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*')
    })
    return {
      total: lines.length,
      code: codeLines.length,
      comments: lines.length - codeLines.length,
    }
  } catch (error) {
    return { total: 0, code: 0, comments: 0 }
  }
}

// Función para analizar dependencias
function analyzeDependencies() {
  logSection('📦 ANÁLISIS DE DEPENDENCIAS')

  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    const deps = Object.keys(packageJson.dependencies || {})
    const devDeps = Object.keys(packageJson.devDependencies || {})

    log(`📊 Dependencias de producción: ${deps.length}`, 'green')
    log(`🔧 Dependencias de desarrollo: ${devDeps.length}`, 'blue')

    // Analizar dependencias críticas
    const criticalDeps = [
      'next',
      'react',
      'prisma',
      '@prisma/client',
      'next-auth',
      'zod',
      'bcryptjs',
      'nodemailer',
    ]

    const missingCritical = criticalDeps.filter(dep => !deps.includes(dep))
    if (missingCritical.length > 0) {
      log(`⚠️  Dependencias críticas faltantes: ${missingCritical.join(', ')}`, 'yellow')
    } else {
      log('✅ Todas las dependencias críticas están presentes', 'green')
    }

    // Verificar dependencias de seguridad
    const securityDeps = deps.filter(
      dep => dep.includes('security') || dep.includes('auth') || dep.includes('crypto')
    )
    log(`🔒 Dependencias de seguridad: ${securityDeps.length}`, 'magenta')
  } catch (error) {
    log(`❌ Error analizando dependencias: ${error.message}`, 'red')
  }
}

// Función para analizar estructura de archivos
function analyzeFileStructure() {
  logSection('📁 ANÁLISIS DE ESTRUCTURA DE ARCHIVOS')

  const srcPath = path.join(process.cwd(), 'src')
  const stats = {
    totalFiles: 0,
    totalLines: 0,
    totalCodeLines: 0,
    filesByType: {},
    largestFiles: [],
    componentFiles: 0,
    apiFiles: 0,
    serviceFiles: 0,
    utilFiles: 0,
  }

  function analyzeDirectory(dirPath, relativePath = '') {
    try {
      const items = fs.readdirSync(dirPath)

      for (const item of items) {
        const fullPath = path.join(dirPath, item)
        const relativeItemPath = path.join(relativePath, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          analyzeDirectory(fullPath, relativeItemPath)
        } else if (stat.isFile()) {
          const ext = path.extname(item)
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            stats.totalFiles++

            // Contar por tipo de archivo
            stats.filesByType[ext] = (stats.filesByType[ext] || 0) + 1

            // Analizar líneas
            const lineStats = countLines(fullPath)
            stats.totalLines += lineStats.total
            stats.totalCodeLines += lineStats.code

            // Categorizar archivos
            if (relativeItemPath.includes('components')) stats.componentFiles++
            else if (relativeItemPath.includes('api')) stats.apiFiles++
            else if (relativeItemPath.includes('services')) stats.serviceFiles++
            else if (relativeItemPath.includes('lib') || relativeItemPath.includes('utils'))
              stats.utilFiles++

            // Rastrear archivos más grandes
            if (lineStats.code > 100) {
              stats.largestFiles.push({
                path: relativeItemPath,
                lines: lineStats.code,
              })
            }
          }
        }
      }
    } catch (error) {
      log(`⚠️  Error analizando directorio ${dirPath}: ${error.message}`, 'yellow')
    }
  }

  if (fs.existsSync(srcPath)) {
    analyzeDirectory(srcPath, 'src')
  }

  // Mostrar estadísticas
  log(`📊 Total de archivos: ${stats.totalFiles}`, 'green')
  log(`📏 Total de líneas: ${stats.totalLines}`, 'blue')
  log(`💻 Líneas de código: ${stats.totalCodeLines}`, 'blue')

  if (stats.totalFiles > 0) {
    log(
      `📈 Promedio líneas por archivo: ${Math.round(stats.totalCodeLines / stats.totalFiles)}`,
      'cyan'
    )
  }

  console.log('\n📋 Distribución por tipo:')
  Object.entries(stats.filesByType).forEach(([ext, count]) => {
    log(`  ${ext}: ${count} archivos`, 'white')
  })

  console.log('\n🏗️  Distribución por categoría:')
  log(`  Componentes: ${stats.componentFiles}`, 'white')
  log(`  APIs: ${stats.apiFiles}`, 'white')
  log(`  Servicios: ${stats.serviceFiles}`, 'white')
  log(`  Utilidades: ${stats.utilFiles}`, 'white')

  // Mostrar archivos más grandes
  if (stats.largestFiles.length > 0) {
    console.log('\n📏 Archivos más grandes (>100 líneas):')
    stats.largestFiles
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 10)
      .forEach(file => {
        const color = file.lines > 300 ? 'red' : file.lines > 200 ? 'yellow' : 'white'
        log(`  ${file.path}: ${file.lines} líneas`, color)
      })
  }
}

// Función para analizar patrones arquitectónicos
function analyzeArchitecturalPatterns() {
  logSection('🏛️  ANÁLISIS DE PATRONES ARQUITECTÓNICOS')

  const patterns = {
    'Repository Pattern': 0,
    'Service Layer': 0,
    'Factory Pattern': 0,
    'Singleton Pattern': 0,
    'Observer Pattern': 0,
    'Middleware Pattern': 0,
    'Validation Pattern': 0,
    'Error Handling Pattern': 0,
  }

  const srcPath = path.join(process.cwd(), 'src')

  function scanForPatterns(dirPath) {
    try {
      const items = fs.readdirSync(dirPath)

      for (const item of items) {
        const fullPath = path.join(dirPath, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          scanForPatterns(fullPath)
        } else if (stat.isFile() && ['.ts', '.tsx'].includes(path.extname(item))) {
          const content = fs.readFileSync(fullPath, 'utf8')

          // Detectar patrones
          if (content.includes('Repository') || content.includes('repository')) {
            patterns['Repository Pattern']++
          }
          if (content.includes('Service') || content.includes('service')) {
            patterns['Service Layer']++
          }
          if (
            content.includes('Factory') ||
            (content.includes('create') && content.includes('function'))
          ) {
            patterns['Factory Pattern']++
          }
          if (content.includes('getInstance') || content.includes('singleton')) {
            patterns['Singleton Pattern']++
          }
          if (
            content.includes('addEventListener') ||
            content.includes('observer') ||
            content.includes('subscribe')
          ) {
            patterns['Observer Pattern']++
          }
          if (content.includes('middleware') || content.includes('Middleware')) {
            patterns['Middleware Pattern']++
          }
          if (
            content.includes('validate') ||
            content.includes('schema') ||
            content.includes('zod')
          ) {
            patterns['Validation Pattern']++
          }
          if ((content.includes('try') && content.includes('catch')) || content.includes('Error')) {
            patterns['Error Handling Pattern']++
          }
        }
      }
    } catch (error) {
      // Ignorar errores de acceso a archivos
    }
  }

  if (fs.existsSync(srcPath)) {
    scanForPatterns(srcPath)
  }

  console.log('\n🎯 Patrones detectados:')
  Object.entries(patterns).forEach(([pattern, count]) => {
    const color = count > 5 ? 'green' : count > 2 ? 'yellow' : 'white'
    log(`  ${pattern}: ${count} usos`, color)
  })
}

// Función para generar recomendaciones
function generateRecommendations() {
  logSection('💡 RECOMENDACIONES DE MEJORA')

  const recommendations = [
    {
      category: '🔧 Configuración',
      items: [
        'Configurar ESLint con reglas de seguridad y calidad',
        'Implementar Prettier para formateo consistente',
        'Configurar pre-commit hooks con Husky',
        'Añadir análisis de dependencias vulnerables',
      ],
    },
    {
      category: '🏗️  Arquitectura',
      items: [
        'Implementar patrón Repository para acceso a datos',
        'Crear capa de servicios bien definida',
        'Implementar inyección de dependencias',
        'Separar lógica de negocio de controladores API',
      ],
    },
    {
      category: '🧪 Testing',
      items: [
        'Implementar tests unitarios con Jest',
        'Añadir tests de integración para APIs',
        'Configurar tests E2E con Playwright',
        'Implementar coverage reporting',
      ],
    },
    {
      category: '📊 Monitoreo',
      items: [
        'Implementar logging estructurado',
        'Añadir métricas de performance',
        'Configurar alertas de errores',
        'Implementar health checks completos',
      ],
    },
    {
      category: '🔒 Seguridad',
      items: [
        'Implementar rate limiting avanzado',
        'Añadir validación de entrada robusta',
        'Configurar headers de seguridad',
        'Implementar audit logging',
      ],
    },
  ]

  recommendations.forEach(category => {
    console.log(`\n${category.category}`)
    category.items.forEach(item => {
      log(`  • ${item}`, 'white')
    })
  })
}

// Función principal
async function main() {
  console.clear()
  log('🔍 ANALIZADOR DE ARQUITECTURA Y CALIDAD DE CÓDIGO', 'cyan')
  log('Sistema de Tickets - Análisis Completo', 'blue')

  try {
    analyzeDependencies()
    analyzeFileStructure()
    analyzeArchitecturalPatterns()
    generateRecommendations()

    logSection('✅ ANÁLISIS COMPLETADO')
    log('Revisa las recomendaciones y aplica las mejoras sugeridas', 'green')
  } catch (error) {
    log(`❌ Error durante el análisis: ${error.message}`, 'red')
    process.exit(1)
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main()
}

module.exports = { main }
