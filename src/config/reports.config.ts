/**
 * Configuración Global del Módulo de Reportes
 * Centraliza todas las constantes y límites
 */

/**
 * Límites máximos de exportación por tipo de reporte
 * Previene sobrecarga del servidor y timeouts
 */
export const REPORT_LIMITS = {
  tickets: parseInt(process.env.MAX_TICKETS_EXPORT || '10000'),
  technicians: parseInt(process.env.MAX_TECHNICIANS_EXPORT || '2000'),
  categories: parseInt(process.env.MAX_CATEGORIES_EXPORT || '1000'),
} as const

/**
 * Límites de rate limiting
 * Previene abuso de endpoints costosos
 */
export const RATE_LIMITS = {
  // Exportaciones (costosas)
  reportsExport: {
    maxRequests: parseInt(process.env.RATE_LIMIT_REPORTS_EXPORT || '10'),
    windowMs: 60000, // 1 minuto
  },
  // Visualización de reportes (menos costoso)
  reportsView: {
    maxRequests: parseInt(process.env.RATE_LIMIT_REPORTS_VIEW || '30'),
    windowMs: 60000, // 1 minuto
  },
  // API general
  api: {
    maxRequests: parseInt(process.env.RATE_LIMIT_API || '100'),
    windowMs: 60000, // 1 minuto
  },
} as const

/**
 * Configuración de cache
 */
export const CACHE_CONFIG = {
  // TTL por defecto para reportes (5 minutos)
  defaultTTL: parseInt(process.env.CACHE_TTL_REPORTS || '300000'),
  // TTL para queries pesadas (10 minutos)
  heavyQueryTTL: parseInt(process.env.CACHE_TTL_HEAVY || '600000'),
  // TTL para datos de referencia (30 minutos)
  referenceTTL: parseInt(process.env.CACHE_TTL_REFERENCE || '1800000'),
  // Habilitar cache
  enabled: process.env.CACHE_ENABLED !== 'false',
} as const

/**
 * Formatos de exportación soportados
 */
export const EXPORT_FORMATS = ['csv', 'excel', 'pdf', 'json'] as const
export type ExportFormat = typeof EXPORT_FORMATS[number]

/**
 * Tipos de reportes disponibles
 */
export const REPORT_TYPES = ['tickets', 'technicians', 'categories'] as const
export type ReportType = typeof REPORT_TYPES[number]

/**
 * Configuración de paginación
 */
export const PAGINATION_CONFIG = {
  defaultPageSize: 50,
  maxPageSize: 100,
  pageSizeOptions: [25, 50, 100],
} as const

/**
 * Configuración de filtros
 */
export const FILTER_CONFIG = {
  // Rango de fechas por defecto (30 días)
  defaultDateRange: 30,
  // Máximo rango de fechas permitido (1 año)
  maxDateRange: 365,
} as const

/**
 * Mensajes de error estandarizados
 */
export const ERROR_MESSAGES = {
  unauthorized: 'No autorizado para acceder a reportes',
  forbidden: 'No tienes permisos para exportar reportes',
  rateLimitExceeded: 'Has excedido el límite de solicitudes. Intenta nuevamente más tarde.',
  invalidReportType: 'Tipo de reporte inválido',
  invalidFormat: 'Formato de exportación inválido',
  invalidDateRange: 'Rango de fechas inválido',
  exportError: 'Error al generar el archivo de exportación',
  serverError: 'Error interno del servidor',
} as const

/**
 * Configuración de auditoría
 */
export const AUDIT_CONFIG = {
  // Registrar todas las exportaciones
  logExports: true,
  // Registrar visualizaciones de reportes
  logViews: false,
  // Incluir detalles de filtros en auditoría
  includeFilters: true,
} as const

/**
 * Configuración de performance
 */
export const PERFORMANCE_CONFIG = {
  // Timeout para queries pesadas (30 segundos)
  queryTimeout: parseInt(process.env.QUERY_TIMEOUT || '30000'),
  // Tamaño de batch para streaming
  streamBatchSize: 1000,
  // Habilitar streaming para exportaciones grandes
  enableStreaming: process.env.ENABLE_STREAMING !== 'false',
  // Umbral para activar streaming (registros)
  streamingThreshold: 10000,
} as const

/**
 * Validación de configuración
 * Verifica que los valores sean válidos al iniciar
 */
export function validateConfig() {
  const errors: string[] = []

  // Validar límites
  if (REPORT_LIMITS.tickets < 100) {
    errors.push('MAX_TICKETS_EXPORT debe ser al menos 100')
  }
  if (REPORT_LIMITS.technicians < 10) {
    errors.push('MAX_TECHNICIANS_EXPORT debe ser al menos 10')
  }
  if (REPORT_LIMITS.categories < 10) {
    errors.push('MAX_CATEGORIES_EXPORT debe ser al menos 10')
  }

  // Validar rate limits
  if (RATE_LIMITS.reportsExport.maxRequests < 1) {
    errors.push('RATE_LIMIT_REPORTS_EXPORT debe ser al menos 1')
  }

  // Validar cache
  if (CACHE_CONFIG.defaultTTL < 1000) {
    errors.push('CACHE_TTL_REPORTS debe ser al menos 1000ms')
  }

  if (errors.length > 0) {
    console.error('❌ Errores de configuración de reportes:')
    errors.forEach(error => console.error(`  - ${error}`))
    throw new Error('Configuración de reportes inválida')
  }

  console.log('✅ Configuración de reportes validada correctamente')
}

// Validar configuración al importar (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  try {
    validateConfig()
  } catch (error) {
    console.warn('⚠️ Advertencia: Configuración de reportes tiene problemas')
  }
}
