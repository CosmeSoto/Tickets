/**
 * Validador de configuración de familia para el módulo de patrullas.
 * Función pura sin dependencias externas — apta para property-based testing.
 */

export interface PatrolFamilyConfigInput {
  qrWindowMinutes?: number
  geofenceRadiusMeters?: number
  photoRetentionDays?: number
  photoCompressionQuality?: number
  photoMaxWidthPx?: number
  offlineSyncToleranceMinutes?: number
  alertCompletionThreshold?: number
  gracePeriodMinutes?: number
}

export interface ConfigValidationError {
  field: string
  message: string
}

export interface ConfigValidationResult {
  valid: boolean
  errors: ConfigValidationError[]
}

interface FieldRange {
  min: number
  max: number
  label: string
}

const FIELD_RANGES: Record<keyof PatrolFamilyConfigInput, FieldRange> = {
  qrWindowMinutes: {
    min: 1,
    max: 60,
    label: 'Ventana QR (minutos)',
  },
  geofenceRadiusMeters: {
    min: 5,
    max: 5000,
    label: 'Radio de geofence (metros)',
  },
  photoRetentionDays: {
    min: 1,
    max: 3650,
    label: 'Retención de fotos (días)',
  },
  photoCompressionQuality: {
    min: 0.1,
    max: 1.0,
    label: 'Calidad de compresión de fotos',
  },
  photoMaxWidthPx: {
    min: 320,
    max: 4096,
    label: 'Ancho máximo de foto (px)',
  },
  offlineSyncToleranceMinutes: {
    min: 0,
    max: 1440,
    label: 'Tolerancia de sincronización offline (minutos)',
  },
  alertCompletionThreshold: {
    min: 0,
    max: 100,
    label: 'Umbral de alerta de completitud (%)',
  },
  gracePeriodMinutes: {
    min: 0,
    max: 120,
    label: 'Período de gracia (minutos)',
  },
}

/**
 * Valida los valores de configuración de familia para el módulo de patrullas.
 * Solo valida los campos presentes en el input (campos ausentes se ignoran).
 *
 * @param input - Objeto parcial con los valores a validar
 * @returns Resultado de validación con lista de errores por campo
 */
export function validatePatrolFamilyConfig(input: PatrolFamilyConfigInput): ConfigValidationResult {
  const errors: ConfigValidationError[] = []

  for (const [field, range] of Object.entries(FIELD_RANGES) as [
    keyof PatrolFamilyConfigInput,
    FieldRange,
  ][]) {
    const value = input[field]

    // Ignorar campos no presentes en el input
    if (value === undefined || value === null) continue

    if (typeof value !== 'number' || isNaN(value)) {
      errors.push({
        field,
        message: `${range.label} debe ser un número válido`,
      })
      continue
    }

    if (value < range.min || value > range.max) {
      errors.push({
        field,
        message: `${range.label} debe estar entre ${range.min} y ${range.max} (recibido: ${value})`,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
