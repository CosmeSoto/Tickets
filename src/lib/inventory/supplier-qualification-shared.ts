/**
 * Constantes y cálculos de calificación de proveedores que son seguros para
 * usar en el cliente (sin tocar prisma). Ver supplier-qualification.ts para
 * la lectura de los umbrales configurables (solo servidor).
 */

export const QUALIFICATION_CRITERIA = [
  { key: 'quality', label: 'Calidad' },
  { key: 'creditTime', label: 'Tiempo de crédito' },
  { key: 'deliveryTime', label: 'Tiempo de entrega' },
  { key: 'price', label: 'Precio' },
  { key: 'references', label: 'Referencias' },
  { key: 'equipmentScore', label: 'Equipo' },
] as const

export type QualificationCriterionKey = (typeof QUALIFICATION_CRITERIA)[number]['key']

export const QUALIFICATION_SCORE_LABELS: Record<number, string> = {
  5: 'Excelente',
  4: 'Muy bueno',
  3: 'Bueno',
  2: 'Regular',
  1: 'Malo',
  0: 'No aplica',
}

export const QUALIFICATION_MAX_TOTAL = QUALIFICATION_CRITERIA.length * 5 // 30

export type SupplierClassification = 'A' | 'B' | 'C'

export const CLASSIFICATION_LABELS: Record<SupplierClassification, string> = {
  A: 'Clasificación A',
  B: 'Clasificación B',
  C: 'Clasificación C',
}

// Colores del "RANGO DE APROBACIÓN" del Excel: A verde, B amarillo, C rojo.
export const CLASSIFICATION_COLORS: Record<SupplierClassification, string> = {
  A: '#16a34a',
  B: '#ca8a04',
  C: '#dc2626',
}

export interface SupplierQualificationThresholds {
  /** Total mínimo (inclusive) para Clasificación A. */
  minA: number
  /** Total mínimo (inclusive) para Clasificación B; por debajo es C. */
  minB: number
}

export interface QualificationScores {
  quality: number
  creditTime: number
  deliveryTime: number
  price: number
  references: number
  equipmentScore: number
}

export function computeTotal(scores: QualificationScores): number {
  return (
    scores.quality +
    scores.creditTime +
    scores.deliveryTime +
    scores.price +
    scores.references +
    scores.equipmentScore
  )
}

export function classifyTotal(
  total: number,
  thresholds: SupplierQualificationThresholds
): SupplierClassification {
  if (total >= thresholds.minA) return 'A'
  if (total >= thresholds.minB) return 'B'
  return 'C'
}
