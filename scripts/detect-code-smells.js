#!/usr/bin/env node

/**
 * DETECTOR DE CODE SMELLS
 *
 * Detecta anti-patrones, code smells y problemas de calidad
 * en el código TypeScript/JavaScript
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

// Definición de code smells a detectar
const codeSmells = {
  // Funciones muy largas
  longFunction: {
    name: 'Función muy larga',
    severity: 'medium',
    pattern: /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g,
    check: match => {
      const lines = match.split('\n').length
      return lines > 50 ? { lines } : null
    },
  },

  // Demasiados parámetros
  tooManyParameters: {
    name: 'Demasiados parámetros',
    severity: 'medium',
    pattern: /(?:function|=>)\s*\([^)]*\)/g,
    check: match => {
      const params = match.match(/\w+\s*:/g) || []
      return params.length > 5 ? { count: params.length } : null
    },
  },

  // Uso excesivo de any
  excessiveAny: {
    name: 'Uso excesivo de any',
    severity: 'high',
    pattern: /:\s*any\b/g,
    check: () => ({ found: true }),
  },

  // Console.log en producción
  consoleLog: {
    name: 'Console.log en código',
    severity: 'low',
    pattern: /console\.log\(/g,
    check: () => ({ found: true }),
  },

  // Código comentado
  commentedCode: {
    name: 'Código comentado',
    severity: 'low',
    pattern: /\/\/\s*(const|let|var|function|if|for|while)/g,
    check: () => ({ found: true }),
  },

  // Strings mágicos
  magicStrings: {
    name: 'Strings mágicos',
    severity: 'medium',
    pattern: /['"][^'"]{20,}['"]/g,
    check: match => {
      // Ignorar imports y algunos patrones comunes
      if (match.includes('import') || match.includes('from') || match.includes('http')) {
        return null
      }
      return { string: match.substring(0, 30) + '...' }
    },
  },

  // Números mágicos
  magicNumbers: {
    name: 'Números mágicos',
    severity: 'medium',
    pattern: /\b(?!0|1|2|10|100|1000)\d{3,}\b/g,
    check: match => ({ number: match }),
  },

  // Anidamiento profundo
  deepNesting: {
    name: 'Anidamiento profundo',
    severity: 'high',
    pattern: /\{[\s\S]*?\{[\s\S]*?\{[\s\S]*?\{[\s\S]*?\{/g,
    check: () => ({ found: true }),
  },

  // Duplicación de código
  duplicatedCode: {
    name: 'Posible duplicación',
    severity: 'medium',
    pattern: /(?:if|for|while)\s*\([^)]+\)\s*\{[\s\S]{50,200}\}/g,
    check: () => ({ found: true }),
  },

  // Manejo de errores faltante
  missingErrorHandling: {
    name: 'Manejo de errores faltante',
    severity: 'high',
    pattern: /await\s+[^;]+;/g,
    check: (match, content, index) => {
      // Buscar try-catch en el contexto
      const before = content.substring(Math.max(0, index - 200), index)
      const after = content.substring(index, Math.min(content.length, index + 200))

      if (!before.includes('try') && !after.includes('catch')) {
        return { found: true }
      }
      return null
    },
  },

  // Imports no utilizados
  unusedImports: {
    name: 'Imports potencialmente no utilizados',
    severity: 'low',
    pattern: /import\s+\{([^}]+)\}\s+from/g,
    check: (match, content) => {
      const imports = match.match(/\w+/g) || []
      const unused = imports.filter(imp => {
        const regex = new RegExp(`\\b${imp}\\b`, 'g')
        const matches = content.match(regex) || []
        return matches.length <= 1 // Solo aparece en el import
      })
      return unused.length > 0 ? { unused } : null
    },
  },
}

// Función para analizar un archivo
function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const relativePath = path.relative(process.cwd(), filePath)
    const issues = []

    Object.entries(codeSmells).forEach(([smellKey, smell]) => {
      const matches = content.matchAll(smell.pattern)

      for (const match of matches) {
        const result = smell.check(match[0], content, match.index)
        if (result) {
          issues.push({
            file: relativePath,
            line: content.substring(0, match.index).split('\n').length,
            smell: smell.name,
            severity: smell.severity,
            details: result,
          })
        }
      }
    })

    return issues
  } catch (error) {
    return []
  }
}

// Función para analizar directorio recursivamente
function analyzeDirectory(dirPath) {
  const allIssues = []

  function scanDirectory(currentPath) {
    try {
      const items = fs.readdirSync(currentPath)

      for (const item of items) {
        const fullPath = path.join(currentPath, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDirectory(fullPath)
        } else if (stat.isFile() && ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(item))) {
          const issues = analyzeFile(fullPath)
          allIssues.push(...issues)
        }
      }
    } catch (error) {
      // Ignorar errores de acceso
    }
  }

  scanDirectory(dirPath)
  return allIssues
}

// Función para generar reporte
function generateReport(issues) {
  logSection('📊 REPORTE DE CODE SMELLS')

  if (issues.length === 0) {
    log('✅ No se encontraron code smells significativos', 'green')
    return
  }

  // Agrupar por severidad
  const bySeverity = {
    high: issues.filter(i => i.severity === 'high'),
    medium: issues.filter(i => i.severity === 'medium'),
    low: issues.filter(i => i.severity === 'low'),
  }

  log(`🔍 Total de issues encontrados: ${issues.length}`, 'blue')
  log(`🔴 Alta prioridad: ${bySeverity.high.length}`, 'red')
  log(`🟡 Media prioridad: ${bySeverity.medium.length}`, 'yellow')
  log(`🟢 Baja prioridad: ${bySeverity.low.length}`, 'green')

  // Mostrar issues de alta prioridad
  if (bySeverity.high.length > 0) {
    console.log('\n🔴 ISSUES DE ALTA PRIORIDAD:')
    bySeverity.high.slice(0, 10).forEach(issue => {
      log(`  📁 ${issue.file}:${issue.line}`, 'white')
      log(`     ${issue.smell}`, 'red')
      if (issue.details.found) {
        log(`     Detectado en el código`, 'white')
      } else {
        log(`     ${JSON.stringify(issue.details)}`, 'white')
      }
    })
  }

  // Mostrar issues de media prioridad (primeros 5)
  if (bySeverity.medium.length > 0) {
    console.log('\n🟡 ISSUES DE MEDIA PRIORIDAD (muestra):')
    bySeverity.medium.slice(0, 5).forEach(issue => {
      log(`  📁 ${issue.file}:${issue.line} - ${issue.smell}`, 'yellow')
    })
  }

  // Estadísticas por tipo de smell
  console.log('\n📈 ESTADÍSTICAS POR TIPO:')
  const byType = {}
  issues.forEach(issue => {
    byType[issue.smell] = (byType[issue.smell] || 0) + 1
  })

  Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count]) => {
      log(`  ${type}: ${count}`, 'white')
    })

  // Archivos más problemáticos
  console.log('\n📁 ARCHIVOS MÁS PROBLEMÁTICOS:')
  const byFile = {}
  issues.forEach(issue => {
    byFile[issue.file] = (byFile[issue.file] || 0) + 1
  })

  Object.entries(byFile)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([file, count]) => {
      const color = count > 10 ? 'red' : count > 5 ? 'yellow' : 'white'
      log(`  ${file}: ${count} issues`, color)
    })
}

// Función para generar plan de refactoring
function generateRefactoringPlan(issues) {
  logSection('🔧 PLAN DE REFACTORING')

  const highPriorityIssues = issues.filter(i => i.severity === 'high')
  const mediumPriorityIssues = issues.filter(i => i.severity === 'medium')

  if (highPriorityIssues.length > 0) {
    console.log('\n🎯 FASE 1 - CRÍTICO (1-2 días):')
    const criticalTypes = [...new Set(highPriorityIssues.map(i => i.smell))]
    criticalTypes.forEach(type => {
      const count = highPriorityIssues.filter(i => i.smell === type).length
      log(`  • Corregir ${type} (${count} casos)`, 'red')
    })
  }

  if (mediumPriorityIssues.length > 0) {
    console.log('\n🎯 FASE 2 - IMPORTANTE (3-5 días):')
    const mediumTypes = [...new Set(mediumPriorityIssues.map(i => i.smell))]
    mediumTypes.slice(0, 5).forEach(type => {
      const count = mediumPriorityIssues.filter(i => i.smell === type).length
      log(`  • Refactorizar ${type} (${count} casos)`, 'yellow')
    })
  }

  console.log('\n🎯 FASE 3 - MEJORAS (1-2 semanas):')
  log('  • Implementar linting automático', 'green')
  log('  • Configurar pre-commit hooks', 'green')
  log('  • Añadir tests para código refactorizado', 'green')
  log('  • Documentar patrones y estándares', 'green')
}

// Función principal
async function main() {
  console.clear()
  log('🔍 DETECTOR DE CODE SMELLS', 'cyan')
  log('Análisis de calidad de código', 'blue')

  const srcPath = path.join(process.cwd(), 'src')

  if (!fs.existsSync(srcPath)) {
    log('❌ Directorio src no encontrado', 'red')
    process.exit(1)
  }

  log('🔄 Analizando código...', 'blue')
  const issues = analyzeDirectory(srcPath)

  generateReport(issues)
  generateRefactoringPlan(issues)

  logSection('✅ ANÁLISIS COMPLETADO')

  if (issues.filter(i => i.severity === 'high').length > 0) {
    log('⚠️  Se encontraron issues críticos que requieren atención inmediata', 'yellow')
  } else {
    log('✅ No se encontraron issues críticos', 'green')
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main()
}

module.exports = { main, analyzeFile, analyzeDirectory }
