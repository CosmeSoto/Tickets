import { prisma } from '@/lib/prisma'
import type { SupplierQualificationThresholds } from './supplier-qualification-shared'

/**
 * Umbrales configurables de calificación de proveedores (system_settings,
 * mismo patrón que batch-alert-settings.ts). Solo servidor — los componentes
 * cliente deben importar de supplier-qualification-shared.ts en su lugar
 * para no arrastrar prisma al bundle del navegador.
 */
export * from './supplier-qualification-shared'

const DEFAULTS: SupplierQualificationThresholds = {
  minA: 25,
  minB: 19,
}

const KEYS = {
  minA: 'inventory.supplier_qualification_min_a',
  minB: 'inventory.supplier_qualification_min_b',
} as const

let cache: { value: SupplierQualificationThresholds; expiresAt: number } | null = null
const CACHE_MS = 60_000

export async function getSupplierQualificationThresholds(): Promise<SupplierQualificationThresholds> {
  if (cache && Date.now() < cache.expiresAt) return cache.value

  const rows = await prisma.system_settings.findMany({
    where: { key: { in: Object.values(KEYS) } },
  })
  const map = new Map(rows.map(r => [r.key, r.value]))

  const minA = parseInt(map.get(KEYS.minA) ?? '', 10) || DEFAULTS.minA
  const minB = parseInt(map.get(KEYS.minB) ?? '', 10) || DEFAULTS.minB
  const value: SupplierQualificationThresholds = { minA, minB }

  cache = { value, expiresAt: Date.now() + CACHE_MS }
  return value
}

export function invalidateSupplierQualificationThresholdsCache(): void {
  cache = null
}
