#!/usr/bin/env node

/**
 * Script de Verificación de Estandarización de UI
 * 
 * Verifica que todos los módulos cumplan con los estándares definidos:
 * - Headers descriptivos
 * - Paginación estándar
 * - Componentes globales
 * - Separadores visuales
 */

const fs = require('fs');
const path = require('path');

// Colores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}\n`),
};

// Módulos a verificar
const modules = [
  {
    name: 'Técnicos',
    path: 'src/app/admin/technicians/page.tsx',
    views: ['CardView', 'ListView'],
    hasPagination: true,
    hasHeaders: true,
  },
  {
    name: 'Categorías',
    path: 'src/components/categories/categories-page.tsx',
    views: ['ListView', 'DataTable', 'CategoryTree'],
    hasPagination: true,
    hasHeaders: true,
  },
  {
    name: 'Departamentos',
    path: 'src/components/departments/departments-page.tsx',
    views: ['ListView', 'DataTable'],
    hasPagination: true,
    hasHeaders: true,
  },
  {
    name: 'Tickets',
    path: 'src/app/admin/tickets/page.tsx',
    views: ['DataTable'],
    hasPagination: true,
    hasHeaders: true,
  },
  {
    name: 'Usuarios',
    path: 'src/app/admin/users/page.tsx',
    views: ['UserTable'],
    hasPagination: true,
    hasHeaders: true,
  },
  {
    name: 'Reportes',
    path: 'src/components/reports/reports-page.tsx',
    views: ['Charts', 'DataTable'],
    hasPagination: true,
    hasHeaders: true,
  },
];

// Estándares a verificar
const standards = {
  paginationOptions: '[10, 20, 50, 100]',
  defaultPageSize: '20',
  headerFormat: 'Vista de',
  separatorClass: 'border-t pt-4',
  spacingClass: 'space-y-4',
};

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
let warnings = 0;

/**
 * Lee el contenido de un archivo
 */
function readFile(filePath) {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    log.error(`No se pudo leer el archivo: ${filePath}`);
    return null;
  }
}

/**
 * Verifica si un patrón existe en el contenido
 */
function checkPattern(content, pattern, description) {
  totalChecks++;
  const regex = new RegExp(pattern);
  const found = regex.test(content);
  
  if (found) {
    passedChecks++;
    log.success(description);
    return true;
  } else {
    failedChecks++;
    log.error(description);
    return false;
  }
}

/**
 * Verifica si un patrón existe (warning si no)
 */
function checkPatternWarning(content, pattern, description) {
  totalChecks++;
  const regex = new RegExp(pattern);
  const found = regex.test(content);
  
  if (found) {
    passedChecks++;
    log.success(description);
    return true;
  } else {
    warnings++;
    log.warning(description);
    return false;
  }
}

/**
 * Verifica un módulo completo
 */
function verifyModule(module) {
  log.section(`Verificando módulo: ${module.name}`);
  
  const content = readFile(module.path);
  if (!content) {
    log.error(`Archivo no encontrado: ${module.path}`);
    return;
  }
  
  // 1. Verificar componentes de vista globales
  log.info('1. Componentes de Vista Globales:');
  module.views.forEach(view => {
    if (view === 'CategoryTree' || view === 'UserTable' || view === 'Charts') {
      // Componentes específicos permitidos
      checkPatternWarning(
        content,
        view,
        `  Usa ${view} (componente específico)`
      );
    } else {
      checkPattern(
        content,
        `from ['"]@/components/common/views/${view.toLowerCase().replace('view', '-view')}`,
        `  Usa ${view} global`
      );
    }
  });
  
  // 2. Verificar headers descriptivos
  if (module.hasHeaders) {
    log.info('2. Headers Descriptivos:');
    checkPattern(
      content,
      'Vista de (Lista|Tabla|Tarjetas|Árbol|Gráficos)',
      '  Formato de header estándar ("Vista de...")'
    );
    
    checkPatternWarning(
      content,
      'header={{',
      '  Usa prop header en componentes'
    );
  }
  
  // 3. Verificar paginación estándar
  if (module.hasPagination) {
    log.info('3. Paginación Estándar:');
    
    checkPattern(
      content,
      'usePagination',
      '  Usa hook usePagination'
    );
    
    checkPattern(
      content,
      'pageSize:\\s*20',
      '  Default pageSize: 20'
    );
    
    checkPattern(
      content,
      '\\[10,\\s*20,\\s*50,\\s*100\\]',
      '  Opciones estándar: [10, 20, 50, 100]'
    );
    
    checkPattern(
      content,
      'border-t pt-4',
      '  Separador visual (border-t pt-4)'
    );
    
    checkPattern(
      content,
      'pagination\\.totalPages > 1',
      '  Paginación condicional (totalPages > 1)'
    );
  }
  
  // 4. Verificar estructura y espaciado
  log.info('4. Estructura y Espaciado:');
  checkPattern(
    content,
    'space-y-4',
    '  Usa espaciado estándar (space-y-4)'
  );
  
  checkPattern(
    content,
    '<Card>',
    '  Usa componente Card'
  );
  
  // 5. Verificar imports correctos
  log.info('5. Imports:');
  checkPattern(
    content,
    "from ['\"]\\.\\./\\.\\./hooks/common/use-pagination['\"]",
    '  Import correcto de usePagination'
  );
}

/**
 * Verifica componentes globales
 */
function verifyGlobalComponents() {
  log.section('Verificando Componentes Globales');
  
  const components = [
    {
      name: 'ListView',
      path: 'src/components/common/views/list-view.tsx',
      checks: [
        { pattern: 'interface ListViewProps', desc: 'Define ListViewProps' },
        { pattern: 'header\\?:', desc: 'Soporta prop header' },
        { pattern: 'pagination\\?:', desc: 'Soporta prop pagination' },
        { pattern: 'renderItem:', desc: 'Soporta renderItem personalizado' },
      ],
    },
    {
      name: 'DataTable',
      path: 'src/components/common/views/data-table.tsx',
      checks: [
        { pattern: 'interface DataTableProps', desc: 'Define DataTableProps' },
        { pattern: 'header\\?:', desc: 'Soporta prop header' },
        { pattern: 'pagination\\?:', desc: 'Soporta prop pagination' },
        { pattern: 'columns:', desc: 'Soporta columnas configurables' },
      ],
    },
    {
      name: 'CardView',
      path: 'src/components/common/views/card-view.tsx',
      checks: [
        { pattern: 'interface CardViewProps', desc: 'Define CardViewProps' },
        { pattern: 'header\\?:', desc: 'Soporta prop header' },
        { pattern: 'pagination\\?:', desc: 'Soporta prop pagination' },
        { pattern: 'renderCard:', desc: 'Soporta renderCard personalizado' },
      ],
    },
  ];
  
  components.forEach(component => {
    log.info(`\nComponente: ${component.name}`);
    const content = readFile(component.path);
    
    if (!content) {
      log.error(`  Archivo no encontrado: ${component.path}`);
      return;
    }
    
    component.checks.forEach(check => {
      checkPattern(content, check.pattern, `  ${check.desc}`);
    });
  });
}

/**
 * Verifica tipos TypeScript
 */
function verifyTypes() {
  log.section('Verificando Tipos TypeScript');
  
  const typesFile = 'src/types/views.ts';
  const content = readFile(typesFile);
  
  if (!content) {
    log.error(`Archivo de tipos no encontrado: ${typesFile}`);
    return;
  }
  
  log.info('Tipos Requeridos:');
  const requiredTypes = [
    'ViewHeader',
    'PaginationConfig',
    'EmptyState',
    'ColumnConfig',
    'ViewMode',
  ];
  
  requiredTypes.forEach(type => {
    checkPattern(
      content,
      `(interface|type)\\s+${type}`,
      `  Define tipo ${type}`
    );
  });
}

/**
 * Genera reporte final
 */
function generateReport() {
  log.section('Reporte Final de Verificación');
  
  const total = totalChecks;
  const passed = passedChecks;
  const failed = failedChecks;
  const warns = warnings;
  const percentage = ((passed / total) * 100).toFixed(1);
  
  console.log(`Total de verificaciones: ${total}`);
  console.log(`${colors.green}✓ Pasadas: ${passed}${colors.reset}`);
  console.log(`${colors.red}✗ Fallidas: ${failed}${colors.reset}`);
  console.log(`${colors.yellow}⚠ Advertencias: ${warns}${colors.reset}`);
  console.log(`\nPorcentaje de éxito: ${percentage}%`);
  
  if (percentage >= 90) {
    log.success('\n¡Excelente! La estandarización está completa.');
  } else if (percentage >= 75) {
    log.warning('\nBien, pero hay áreas de mejora.');
  } else {
    log.error('\nSe requiere más trabajo para completar la estandarización.');
  }
  
  // Guardar reporte
  const report = {
    timestamp: new Date().toISOString(),
    total,
    passed,
    failed,
    warnings: warns,
    percentage: parseFloat(percentage),
    modules: modules.map(m => m.name),
  };
  
  const reportPath = path.join(__dirname, '..', 'verification-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log.info(`\nReporte guardado en: verification-report.json`);
  
  return failed === 0;
}

/**
 * Main
 */
function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║   Verificación de Estandarización Global de UI            ║
║   Sistema de Tickets - Next.js                            ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  // Verificar componentes globales
  verifyGlobalComponents();
  
  // Verificar tipos
  verifyTypes();
  
  // Verificar cada módulo
  modules.forEach(verifyModule);
  
  // Generar reporte
  const success = generateReport();
  
  // Exit code
  process.exit(success ? 0 : 1);
}

// Ejecutar
main();
