export const MAX_IMPORT_ROWS = 100

export const IMPORT_MODES = ['add', 'update'] as const

export const VALID_CONDITIONS = ['NEW', 'USED', 'DAMAGED'] as const
export type ValidCondition = (typeof VALID_CONDITIONS)[number]

/** Alias adicionales aceptados en el archivo (español o inglés) */
export const CONDITION_ACCEPTED_ALIASES = 'NUEVO, USADO, DAÑADO, LIKE_NEW, GOOD'

/** Etiquetas en español para guías de usuario */
export function getConditionGuideText(): string {
  const labels: Record<ValidCondition, string> = {
    NEW: 'Nuevo',
    USED: 'Usado',
    DAMAGED: 'Dañado',
  }
  return VALID_CONDITIONS.map(c => labels[c]).join(', ')
}

export const VALID_ACQUISITION_MODES = ['FIXED_ASSET', 'RENTAL', 'LOAN'] as const

import { getImportFixedColumnDefs } from '@/lib/inventory/equipment-field-definitions'

/** Columnas fijas de la plantilla (clave técnica → alias en español/inglés) */
export const FIXED_COLUMNS = getImportFixedColumnDefs()

export const CONDITION_ALIASES: Record<string, ValidCondition> = {
  NEW: 'NEW',
  NUEVO: 'NEW',
  USED: 'USED',
  USADO: 'USED',
  LIKE_NEW: 'USED',
  GOOD: 'USED',
  FAIR: 'USED',
  POOR: 'USED',
  DAMAGED: 'DAMAGED',
  DAÑADO: 'DAMAGED',
  DANADO: 'DAMAGED',
}
