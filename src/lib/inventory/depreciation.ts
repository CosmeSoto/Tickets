/**
 * Módulo de depreciación de activos — reutilizable para todas las familias de inventario.
 *
 * Métodos soportados:
 * - LINEAR (Línea Recta): estándar NIC 16, para infraestructura, mobiliario, seguridad
 * - DECLINING_BALANCE (Saldo Decreciente Doble): para tecnología con obsolescencia rápida
 * - UNITS_OF_PRODUCTION (Unidades de Producción): para equipos mecánicos con horas de uso
 *
 * Familias que NO deprecian: MAINTENANCE (MRO), SERVICES, ADMINISTRATIVE (contratos)
 * — son gastos operativos, no activos capitalizables.
 */

export type DepreciationMethod = 'LINEAR' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION'

export interface DepreciationInput {
  purchasePrice: number
  purchaseDate: Date
  usefulLifeYears: number
  residualValue?: number          // default: 0
  method?: DepreciationMethod     // default: LINEAR
  referenceDate?: Date            // default: hoy
  // Solo para UNITS_OF_PRODUCTION
  totalUnits?: number             // unidades totales de vida útil (ej: horas de operación)
  usedUnits?: number              // unidades consumidas hasta referenceDate
  // Solo para DECLINING_BALANCE
  decliningRate?: number          // tasa % anual (default: 2 / usefulLifeYears)
}

export interface DepreciationResult {
  method: DepreciationMethod
  annualDepreciation: number      // depreciación del año en curso
  accumulatedDepreciation: number
  bookValue: number
  yearsElapsed: number
  depreciationRate: number        // % anual efectivo
}

const round2 = (x: number) => Math.round(x * 100) / 100
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000

/**
 * Calcula la depreciación de un activo según el método especificado.
 * Función pura — no tiene efectos secundarios ni acceso a BD.
 */
export function calculateDepreciation(
  purchasePrice: number,
  purchaseDate: Date,
  usefulLifeYears: number,
  residualValue: number = 0,
  referenceDate: Date = new Date(),
  method: DepreciationMethod = 'LINEAR',
  options?: { totalUnits?: number; usedUnits?: number; decliningRate?: number }
): DepreciationResult {
  const yearsElapsed = round2(
    (referenceDate.getTime() - purchaseDate.getTime()) / MS_PER_YEAR
  )
  const cappedYears = Math.min(yearsElapsed, usefulLifeYears)
  const depreciableAmount = purchasePrice - residualValue

  switch (method) {
    case 'DECLINING_BALANCE': {
      // Doble saldo decreciente: tasa = 2 / vida_útil (o personalizada)
      const rate = options?.decliningRate ?? (2 / usefulLifeYears)
      let bookVal = purchasePrice
      let accumulated = 0
      let annualDep = 0
      const fullYears = Math.floor(cappedYears)

      for (let y = 0; y < fullYears; y++) {
        annualDep = round2(Math.max(bookVal - residualValue, 0) * rate)
        accumulated = round2(accumulated + annualDep)
        bookVal = round2(purchasePrice - accumulated)
      }
      // Fracción del año en curso
      const fraction = cappedYears - fullYears
      if (fraction > 0) {
        const partialDep = round2(Math.max(bookVal - residualValue, 0) * rate * fraction)
        accumulated = round2(accumulated + partialDep)
        bookVal = round2(purchasePrice - accumulated)
        annualDep = round2(Math.max(bookVal - residualValue, 0) * rate)
      }

      return {
        method,
        annualDepreciation: annualDep,
        accumulatedDepreciation: accumulated,
        bookValue: Math.max(bookVal, residualValue),
        yearsElapsed,
        depreciationRate: round2(rate * 100),
      }
    }

    case 'UNITS_OF_PRODUCTION': {
      // Depreciación proporcional a unidades usadas
      const total = options?.totalUnits ?? 1
      const used = Math.min(options?.usedUnits ?? 0, total)
      const ratePerUnit = depreciableAmount / total
      const accumulated = round2(ratePerUnit * used)
      const annualDep = round2(ratePerUnit * (total / usefulLifeYears)) // estimado anual

      return {
        method,
        annualDepreciation: annualDep,
        accumulatedDepreciation: accumulated,
        bookValue: round2(Math.max(purchasePrice - accumulated, residualValue)),
        yearsElapsed,
        depreciationRate: round2((used / total) * 100),
      }
    }

    case 'LINEAR':
    default: {
      const annualDepreciation = round2(depreciableAmount / usefulLifeYears)
      const accumulatedDepreciation = round2(annualDepreciation * cappedYears)
      const bookValue = round2(Math.max(purchasePrice - accumulatedDepreciation, residualValue))

      return {
        method: 'LINEAR',
        annualDepreciation,
        accumulatedDepreciation,
        bookValue,
        yearsElapsed,
        depreciationRate: round2((annualDepreciation / purchasePrice) * 100),
      }
    }
  }
}

/**
 * Determina si una familia de inventario soporta depreciación.
 * MRO (MAINTENANCE) y SERVICES son gastos operativos — no se deprecian.
 */
export function familySupportsDepreciation(familyCode: string): boolean {
  const NON_DEPRECIABLE = ['MAINTENANCE', 'SERVICES', 'ADMINISTRATIVE']
  return !NON_DEPRECIABLE.includes(familyCode)
}

/**
 * Método de depreciación recomendado por familia y tipo de activo.
 * Basado en NIC 16 y prácticas de facility management.
 */
export function getRecommendedDepreciationMethod(
  familyCode: string,
  assetTypeName?: string
): DepreciationMethod {
  if (familyCode === 'TECHNOLOGY') {
    // Tecnología: saldo decreciente por obsolescencia rápida
    return 'DECLINING_BALANCE'
  }
  if (familyCode === 'FIXED_ASSETS' && assetTypeName) {
    const lower = assetTypeName.toLowerCase()
    // Equipos mecánicos con horas de uso medibles
    if (lower.includes('hvac') || lower.includes('ascensor') || lower.includes('bomba') || lower.includes('generador')) {
      return 'UNITS_OF_PRODUCTION'
    }
  }
  // Default: lineal para todo lo demás
  return 'LINEAR'
}

/**
 * Vida útil estimada en años por familia (referencia NIC 16 / NIIF PYMES).
 * El usuario puede sobreescribir estos valores en el formulario.
 */
export const DEFAULT_USEFUL_LIFE_YEARS: Record<string, number> = {
  FIXED_ASSETS: 20,    // Infraestructura: 20-50 años
  TECHNOLOGY: 5,       // Tecnología: 3-7 años
  SECURITY: 10,        // Seguridad: 8-15 años
  COMMERCIAL: 10,      // Activos comerciales: 5-15 años
  GREEN_AREAS: 5,      // Equipos de jardinería: 3-8 años
  MAINTENANCE: 0,      // MRO: no deprecia
  SERVICES: 0,         // Servicios: no deprecia
  ADMINISTRATIVE: 0,   // Documentos: no deprecia
}
