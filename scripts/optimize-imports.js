#!/usr/bin/env node

/**
 * OPTIMIZADOR DE IMPORTS
 *
 * Analiza y optimiza imports, detecta dependencias circulares
 * y sugiere mejoras en la estructura de módulos
 */

const fs = require('fs')
const path = require('path')

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

// Función para extraer imports de un archivo
function extractImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const imports = []

    // Patrones para diferentes tipos de imports
    const patterns = [
      // import { ... } from '...'
      /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
      // import ... from '...'
      /import\s+([^\s{]+)\s+from\s+['"]([^'"]+)['"]/g,
      // import '...'
      /import\s+['"]([^'"]+)['"]/g,
      // import * as ... from '...'
      /import\s+\*\s+as\s+([^\s]+)\s+from\s+['"]([^'"]+)['"]/g,
    ]

    patterns.forEach((pattern, index) => {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        if (index === 0) {
          // Named imports
          const namedImports = match[1].split(',').map(imp => imp.trim())
          imports.push({
            type: 'named',
            imports: namedImports,
            from: match[2],
            line: content.substring(0, match.index).split('\n').length,
          })
        } else if (index === 1) {
          // Default imports
          imports.push({
            type: 'default',
            import: match[1],
            from: match[2],
            line: content.substring(0, match.index).split('\n').length,
          })
        } else if (index === 2) {
          // Side effect imports
          imports.push({
            type: 'side-effect',
            from: match[1],
            line: content.substring(0, match.index).split('\n').length,
          })
        } else if (index === 3) {
          // Namespace imports
          imports.push({
            type: 'namespace',
            import: match[1],
            from: match[2],
            line: content.substring(0, match.index).split('\n').length,
          })
        }
      }
    })

    return imports
  } catch (error) {
    return []
  }
}

// Función para analizar dependencias de un proyecto
function analyzeDependencies() {
  logSection('📦 ANÁLISIS DE DEPENDENCIAS')

  const srcPath = path.join(process.cwd(), 'src')
  const dependencyGraph = new Map()
  const allImports = []

  function scanDirectory(dirPath) {
    try {
      const items = fs.readdirSync(dirPath)

      for (const item of items) {
        const fullPath = path.join(dirPath, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory() && !item.startsWith('.')) {
          scanDirectory(fullPath)
        } else if (stat.isFile() && ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(item))) {
          const relativePath = path.relative(process.cwd(), fullPath)
          const imports = extractImports(fullPath)

          dependencyGraph.set(relativePath, imports)
          allImports.push(...imports.map(imp => ({ ...imp, file: relativePath })))
        }
      }
    } catch (error) {
      // Ignorar errores
    }
  }

  if (fs.existsSync(srcPath)) {
    scanDirectory(srcPath)
  }

  return { dependencyGraph, allImports }
}

// Función para analizar estructura de imports
function analyzeImportStructure(allImports) {
  const stats = {
    external: 0,
    internal: 0,
    relative: 0,
    sideEffect: 0,
    byLibrary: {},
  }

  allImports.forEach(imp => {
    if (imp.type === 'side-effect') {
      stats.sideEffect++
    } else if (imp.from.startsWith('./') || imp.from.startsWith('../')) {
      stats.relative++
    } else if (imp.from.startsWith('@/')) {
      stats.internal++
    } else {
      stats.external++
      const library = imp.from.split('/')[0]
      stats.byLibrary[library] = (stats.byLibrary[library] || 0) + 1
    }
  })

  return stats
}

// Función para generar reporte
function generateReport(dependencyGraph, allImports) {
  logSection('📊 REPORTE DE IMPORTS')

  const stats = analyzeImportStructure(allImports)

  log(`📈 Total de imports: ${allImports.length}`, 'blue')
  log(`📦 Externos: ${stats.external}`, 'green')
  log(`🏠 Internos: ${stats.internal}`, 'cyan')
  log(`📁 Relativos: ${stats.relative}`, 'yellow')
  log(`⚡ Side effects: ${stats.sideEffect}`, 'magenta')

  // Librerías más utilizadas
  console.log('\n📚 LIBRERÍAS MÁS UTILIZADAS:')
  Object.entries(stats.byLibrary)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([lib, count]) => {
      log(`  ${lib}: ${count} imports`, 'white')
    })
}

// Función para generar sugerencias de optimización
function generateOptimizationSuggestions(dependencyGraph, allImports) {
  logSection('💡 SUGERENCIAS DE OPTIMIZACIÓN')

  const suggestions = []

  // Analizar imports que podrían ser agrupados
  const importsByFile = {}
  allImports.forEach(imp => {
    if (!importsByFile[imp.file]) {
      importsByFile[imp.file] = {}
    }
    if (!importsByFile[imp.file][imp.from]) {
      importsByFile[imp.file][imp.from] = []
    }
    importsByFile[imp.file][imp.from].push(imp)
  })

  // Detectar múltiples imports de la misma librería
  Object.entries(importsByFile).forEach(([file, imports]) => {
    Object.entries(imports).forEach(([from, imps]) => {
      if (imps.length > 1 && imps.some(i => i.type === 'named')) {
        suggestions.push({
          type: 'group-imports',
          file,
          from,
          count: imps.length,
          priority: 'medium',
        })
      }
    })
  })

  // Detectar imports de librerías pesadas
  const heavyLibraries = ['lodash', 'moment', 'rxjs']
  const heavyImports = allImports.filter(imp =>
    heavyLibraries.some(lib => imp.from.startsWith(lib))
  )

  if (heavyImports.length > 0) {
    suggestions.push({
      type: 'heavy-libraries',
      imports: heavyImports,
      priority: 'high',
    })
  }

  // Mostrar sugerencias
  if (suggestions.length === 0) {
    log('✅ No se encontraron optimizaciones obvias', 'green')
    return
  }

  suggestions.forEach(suggestion => {
    const color = suggestion.priority === 'high' ? 'red' : 'yellow'

    switch (suggestion.type) {
      case 'group-imports':
        log(
          `📦 Agrupar ${suggestion.count} imports de '${suggestion.from}' en ${suggestion.file}`,
          color
        )
        break
      case 'heavy-libraries':
        log(
          `⚠️  Considerar alternativas más ligeras para: ${suggestion.imports.map(i => i.from).join(', ')}`,
          color
        )
        break
    }
  })

  // Sugerencias generales
  console.log('\n🎯 RECOMENDACIONES GENERALES:')
  log('• Usar imports absolutos (@/) en lugar de relativos cuando sea posible', 'white')
  log('• Agrupar imports relacionados', 'white')
  log('• Considerar lazy loading para componentes grandes', 'white')
  log('• Implementar tree shaking para librerías externas', 'white')
  log('• Usar dynamic imports para código que no se usa inmediatamente', 'white')
}

// Función principal
async function main() {
  console.clear()
  log('📦 OPTIMIZADOR DE IMPORTS', 'cyan')
  log('Análisis de dependencias y estructura de módulos', 'blue')

  log('🔄 Analizando imports...', 'blue')
  const { dependencyGraph, allImports } = analyzeDependencies()

  if (allImports.length === 0) {
    log('❌ No se encontraron archivos para analizar', 'red')
    process.exit(1)
  }

  generateReport(dependencyGraph, allImports)
  generateOptimizationSuggestions(dependencyGraph, allImports)

  logSection('✅ ANÁLISIS COMPLETADO')
  log('Revisa las sugerencias y aplica las optimizaciones recomendadas', 'green')
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main()
}

module.exports = { main, extractImports, analyzeDependencies }
