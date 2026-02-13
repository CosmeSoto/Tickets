/**
 * PROTECCIÓN CONTRA INYECCIÓN SQL
 *
 * Utilidades para prevenir inyección SQL y validar queries
 * Aunque Prisma ya protege contra SQL injection, estas utilidades
 * proporcionan una capa adicional de seguridad
 */

import { Prisma } from '@prisma/client'

// Patrones peligrosos que podrían indicar intentos de inyección SQL
const DANGEROUS_PATTERNS = [
  // Comandos SQL básicos
  /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b/i,

  // Funciones del sistema
  /\b(xp_|sp_|sys\.|information_schema|pg_|mysql\.)/i,

  // Operadores y caracteres peligrosos
  /[';]|--|\*\/|\*\*|\/\*/,

  // Intentos de bypass
  /\b(UNION|OR|AND)\s+\d+\s*=\s*\d+/i,
  /\b(true|false)\s*=\s*\1/i,

  // Funciones de hash y encoding
  /\b(CHAR|ASCII|SUBSTRING|CONCAT|LOAD_FILE|INTO\s+OUTFILE)/i,

  // Comentarios SQL
  /\/\*[\s\S]*?\*\/|--[^\r\n]*/g,
]

// Caracteres que deben ser escapados o removidos
const DANGEROUS_CHARS = /[<>'"&\x00\x08\x09\x0a\x0d\x1a\x5c]/g

export class SqlProtection {
  /**
   * Detecta posibles intentos de inyección SQL en una cadena
   */
  static detectSqlInjection(input: string): {
    isSuspicious: boolean
    patterns: string[]
    risk: 'low' | 'medium' | 'high'
  } {
    if (!input || typeof input !== 'string') {
      return { isSuspicious: false, patterns: [], risk: 'low' }
    }

    const detectedPatterns: string[] = []

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.source)
      }
    }

    let risk: 'low' | 'medium' | 'high' = 'low'

    if (detectedPatterns.length > 0) {
      if (detectedPatterns.length >= 3) {
        risk = 'high'
      } else if (detectedPatterns.length >= 2) {
        risk = 'medium'
      } else {
        risk = 'low'
      }
    }

    return {
      isSuspicious: detectedPatterns.length > 0,
      patterns: detectedPatterns,
      risk,
    }
  }

  /**
   * Sanitiza entrada para búsquedas seguras
   */
  static sanitizeSearchInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return ''
    }

    return input
      .trim()
      .replace(DANGEROUS_CHARS, '') // Remover caracteres peligrosos
      .replace(/\s+/g, ' ') // Normalizar espacios
      .substring(0, 100) // Limitar longitud
  }

  /**
   * Valida parámetros para queries de Prisma
   */
  static validatePrismaParams(params: Record<string, any>): {
    isValid: boolean
    sanitized: Record<string, any>
    errors: string[]
  } {
    const errors: string[] = []
    const sanitized: Record<string, any> = {}

    for (const [key, value] of Object.entries(params)) {
      // Validar clave
      if (typeof key !== 'string' || key.length === 0) {
        errors.push(`Clave inválida: ${key}`)
        continue
      }

      // Sanitizar clave
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '')

      if (sanitizedKey !== key) {
        errors.push(`Clave contiene caracteres no permitidos: ${key}`)
        continue
      }

      // Validar y sanitizar valor
      if (typeof value === 'string') {
        const sqlCheck = this.detectSqlInjection(value)

        if (sqlCheck.isSuspicious && sqlCheck.risk === 'high') {
          errors.push(`Valor sospechoso de inyección SQL en ${key}: ${value}`)
          continue
        }

        sanitized[sanitizedKey] = this.sanitizeSearchInput(value)
      } else if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          errors.push(`Número inválido en ${key}: ${value}`)
          continue
        }
        sanitized[sanitizedKey] = value
      } else if (typeof value === 'boolean') {
        sanitized[sanitizedKey] = value
      } else if (value === null || value === undefined) {
        sanitized[sanitizedKey] = value
      } else if (Array.isArray(value)) {
        // Validar arrays recursivamente
        const arrayResult = this.validatePrismaParams(
          Object.fromEntries(value.map((v, i) => [i.toString(), v]))
        )

        if (!arrayResult.isValid) {
          errors.push(`Array inválido en ${key}: ${arrayResult.errors.join(', ')}`)
          continue
        }

        sanitized[sanitizedKey] = Object.values(arrayResult.sanitized)
      } else if (typeof value === 'object') {
        // Validar objetos recursivamente
        const objectResult = this.validatePrismaParams(value)

        if (!objectResult.isValid) {
          errors.push(`Objeto inválido en ${key}: ${objectResult.errors.join(', ')}`)
          continue
        }

        sanitized[sanitizedKey] = objectResult.sanitized
      } else {
        errors.push(`Tipo de dato no soportado en ${key}: ${typeof value}`)
      }
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors,
    }
  }

  /**
   * Wrapper seguro para queries de Prisma
   */
  static async executeSafeQuery<T>(
    queryFn: () => Promise<T>,
    params?: Record<string, any>
  ): Promise<T> {
    try {
      // Validar parámetros si se proporcionan
      if (params) {
        const validation = this.validatePrismaParams(params)

        if (!validation.isValid) {
          throw new Error(`Parámetros inválidos: ${validation.errors.join(', ')}`)
        }
      }

      // Ejecutar query
      return await queryFn()
    } catch (error) {
      // Log del error para monitoreo
      console.error('Error en query segura:', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        params,
        timestamp: new Date().toISOString(),
      })

      // Re-lanzar el error
      throw error
    }
  }

  /**
   * Valida queries raw de Prisma
   */
  static validateRawQuery(
    query: string,
    params: any[] = []
  ): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Verificar que la query no esté vacía
    if (!query || typeof query !== 'string') {
      errors.push('Query vacía o inválida')
      return { isValid: false, errors }
    }

    // Detectar patrones peligrosos
    const sqlCheck = this.detectSqlInjection(query)

    if (sqlCheck.isSuspicious) {
      errors.push(`Query contiene patrones sospechosos: ${sqlCheck.patterns.join(', ')}`)
    }

    // Verificar que use parámetros en lugar de concatenación
    if (query.includes("'") || query.includes('"')) {
      const parameterizedCount = (query.match(/\$\d+/g) || []).length
      const stringLiteralCount = (query.match(/['"][^'"]*['"]/g) || []).length

      if (stringLiteralCount > parameterizedCount) {
        errors.push('Query parece usar concatenación de strings en lugar de parámetros')
      }
    }

    // Validar parámetros
    if (params && params.length > 0) {
      for (let i = 0; i < params.length; i++) {
        const param = params[i]

        if (typeof param === 'string') {
          const paramCheck = this.detectSqlInjection(param)

          if (paramCheck.isSuspicious && paramCheck.risk === 'high') {
            errors.push(`Parámetro ${i + 1} contiene patrones sospechosos`)
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}

/**
 * Decorator para métodos que ejecutan queries de base de datos
 */
export function SafeQuery(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value

  descriptor.value = async function (...args: any[]) {
    try {
      // Validar argumentos
      const params = args.length > 0 ? args[0] : {}

      if (typeof params === 'object' && params !== null) {
        const validation = SqlProtection.validatePrismaParams(params)

        if (!validation.isValid) {
          throw new Error(
            `Parámetros inválidos en ${propertyName}: ${validation.errors.join(', ')}`
          )
        }
      }

      // Ejecutar método original
      return await method.apply(this, args)
    } catch (error) {
      // Log del error
      console.error(`Error en método seguro ${propertyName}:`, {
        error: error instanceof Error ? error.message : 'Error desconocido',
        args: args.length > 0 ? args[0] : null,
        timestamp: new Date().toISOString(),
      })

      throw error
    }
  }

  return descriptor
}

/**
 * Utilidades para logging de seguridad
 */
export class SecurityLogger {
  /**
   * Log de intento de inyección SQL detectado
   */
  static logSqlInjectionAttempt(
    input: string,
    userInfo: { id?: string; email?: string; ip?: string },
    context: string
  ): void {
    const logEntry = {
      type: 'SQL_INJECTION_ATTEMPT',
      input: input.substring(0, 200), // Limitar longitud para logs
      user: userInfo,
      context,
      timestamp: new Date().toISOString(),
      severity: 'HIGH',
    }

    console.warn('🚨 Intento de inyección SQL detectado:', logEntry)

    // TODO: Enviar a sistema de monitoreo/alertas
    // await sendSecurityAlert(logEntry);
  }

  /**
   * Log de query sospechosa
   */
  static logSuspiciousQuery(
    query: string,
    params: any[],
    userInfo: { id?: string; email?: string; ip?: string }
  ): void {
    const logEntry = {
      type: 'SUSPICIOUS_QUERY',
      query: query.substring(0, 200),
      paramCount: params.length,
      user: userInfo,
      timestamp: new Date().toISOString(),
      severity: 'MEDIUM',
    }

    console.warn('⚠️ Query sospechosa detectada:', logEntry)
  }
}
