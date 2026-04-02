import { prisma } from '@/lib/prisma'

/**
 * Prefijos por subtipo
 */
const SUBTYPE_PREFIX: Record<string, string> = {
  EQUIPMENT: 'EQ',
  MRO:       'MRO',
  LICENSE:   'LIC',
}

/**
 * Prefijos por modalidad de adquisición
 */
const MODE_PREFIX: Record<string, string> = {
  FIXED_ASSET: 'FA',
  RENTAL:      'RNT',
  LOAN:        'LOAN',
}

/**
 * Genera un código de activo automático con el formato:
 *   {FAMILIA_CODE}-{SUBTIPO}-{MODALIDAD}-{AÑO}-{SECUENCIAL 4 dígitos}
 *
 * Ejemplo: TECH-EQ-FA-2026-0001
 *
 * El secuencial se calcula contando los activos existentes de la misma
 * familia+subtipo en el año actual, por lo que es siempre único.
 */
export async function generateAssetCode(
  familyId: string,
  subtype: string,
  acquisitionMode: string | null | undefined
): Promise<string> {
  const year = new Date().getFullYear()

  // Obtener código de la familia y prefijo personalizado
  const family = await prisma.families.findUnique({
    where: { id: familyId },
    select: {
      code: true,
      formConfig: { select: { codePrefix: true } },
    },
  })

  const familyCode = family?.formConfig?.codePrefix?.trim()
    ? family.formConfig.codePrefix.trim().toUpperCase()
    : (family?.code ?? 'INV').slice(0, 6).toUpperCase()
  const subtypePrefix = SUBTYPE_PREFIX[subtype] ?? subtype.slice(0, 3).toUpperCase()
  const modePrefix = MODE_PREFIX[acquisitionMode ?? 'FIXED_ASSET'] ?? 'FA'

  // Contar activos existentes de esta familia+subtipo en el año para el secuencial
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`)
  const yearEnd   = new Date(`${year + 1}-01-01T00:00:00.000Z`)

  let count = 0
  if (subtype === 'EQUIPMENT') {
    count = await prisma.equipment.count({
      where: {
        type: { familyId },
        createdAt: { gte: yearStart, lt: yearEnd },
      },
    })
  } else if (subtype === 'MRO') {
    count = await prisma.consumables.count({
      where: {
        consumableType: { familyId },
        createdAt: { gte: yearStart, lt: yearEnd },
      },
    })
  } else if (subtype === 'LICENSE') {
    count = await prisma.software_licenses.count({
      where: {
        licenseType: { familyId },
        createdAt: { gte: yearStart, lt: yearEnd },
      },
    })
  }

  const seq = String(count + 1).padStart(4, '0')
  return `${familyCode}-${subtypePrefix}-${modePrefix}-${year}-${seq}`
}
