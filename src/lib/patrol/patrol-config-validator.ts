/**
 * Validador de configuración de familia para el módulo de patrullas.
 * Función pura sin dependencias externas — apta para property-based testing.
 */

export interface PatrolFamilyConfigInput {
  // Numéricos — se validan contra rangos
  qrWindowMinutes?: number
  geofenceRadiusMeters?: number
  photoRetentionDays?: number
  photoCompressionQuality?: number
  photoMaxWidthPx?: number
  offlineSyncToleranceMinutes?: number
  alertCompletionThreshold?: number
  gracePeriodMinutes?: number
  reminderMinutesBefore?: number
  // Booleanos — solo se valida el tipo, no rangos
  patrolsEnabled?: boolean
  requirePhotoOnStart?: boolean
  requirePhotoOnEnd?: boolean
  strictTimeValidation?: boolean
  // Strings opcionales
  patrolIncidentCategoryId?: string | null
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

// El Record requiere todos los keys de PatrolFamilyConfigInput.
// Los campos booleanos (patrolsEnabled, requirePhotoOnStart, etc.) y
// patrolIncidentCategoryId no tienen rango numérico, se validan por separado.
// Para satisfacer el tipo se les asigna un rango dummy que nunca se usa.
const FIELD_RANGES: Record<keyof PatrolFamilyConfigInput, FieldRange> = {
  qrWindowMinutes: {
    min: 1,
    max: 60,
    label: 'Ventana QR (minutos)',
  },
  geofenceRadiusMeters: {
    min: 1,
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
  reminderMinutesBefore: {
    min: 1,
    max: 60,
    label: 'Recordatorio antes (minutos)',
  },
  // Campos booleanos y string — no tienen rango numérico.
  // Se incluyen para satisfacer el tipo Record<keyof PatrolFamilyConfigInput, FieldRange>
  // pero el loop de validación numérica los omite porque sus valores no son números.
  patrolsEnabled: { min: 0, max: 1, label: 'Rondas habilitadas' },
  requirePhotoOnStart: { min: 0, max: 1, label: 'Foto al inicio requerida' },
  requirePhotoOnEnd: { min: 0, max: 1, label: 'Foto al finalizar requerida' },
  strictTimeValidation: { min: 0, max: 1, label: 'Validación estricta de horario' },
  patrolIncidentCategoryId: { min: 0, max: 0, label: 'Categoría de incidentes de ronda' },
}

/**
 * Valida los valores de configuración de familia para el módulo de patrullas.
 * - Campos numéricos: validados contra rangos min/max.
 * - Campos booleanos: validados como typeof boolean.
 * - Campos ausentes/null: ignorados (actualización parcial).
 */
export function validatePatrolFamilyConfig(input: PatrolFamilyConfigInput): ConfigValidationResult {
  const errors: ConfigValidationError[] = []

  // ── Validación numérica ──────────────────────────────────────────────────
  for (const [field, range] of Object.entries(FIELD_RANGES) as [
    keyof typeof FIELD_RANGES,
    FieldRange,
  ][]) {
    const value = (input as any)[field]
    if (value === undefined || value === null) continue

    if (typeof value !== 'number' || isNaN(value)) {
      errors.push({ field, message: `${range.label} debe ser un número válido` })
      continue
    }
    if (value < range.min || value > range.max) {
      errors.push({
        field,
        message: `${range.label} debe estar entre ${range.min} y ${range.max} (recibido: ${value})`,
      })
    }
  }

  // ── Validación booleana ──────────────────────────────────────────────────
  const booleanFields: Array<keyof PatrolFamilyConfigInput> = [
    'patrolsEnabled',
    'requirePhotoOnStart',
    'requirePhotoOnEnd',
    'strictTimeValidation',
  ]
  for (const field of booleanFields) {
    const value = input[field]
    if (value === undefined || value === null) continue
    if (typeof value !== 'boolean') {
      errors.push({ field, message: `${field} debe ser verdadero o falso` })
    }
  }

  return { valid: errors.length === 0, errors }
}
