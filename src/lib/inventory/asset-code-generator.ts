import { prisma } from '@/lib/prisma'

/**
 * Prefijos por subtipo
 */
const SUBTYPE_PREFIX: Record<string, string> = {
  EQUIPMENT: 'EQ',
  MRO: 'MRO',
  LICENSE: 'LIC',
}

/**
 * Prefijos por modalidad de adquisición
 */
const MODE_PREFIX: Record<string, string> = {
  FIXED_ASSET: 'FA',
  RENTAL: 'RNT',
  LOAN: 'LOAN',
}

/**
 * Genera un código de activo automático con el formato:
 *   {FAMILIA_CODE}-{SUBTIPO}-{MODALIDAD}-{AÑO}-{SECUENCIAL 4 dígitos}
 *
 * Ejemplo: TECH-EQ-FA-2026-0001
 *
 * El secuencial sale de un contador atómico en BD (`equipment_code_counters`,
 * vía `upsert` con `increment` — se traduce a un único `INSERT ... ON
 * CONFLICT DO UPDATE SET last_sequence = last_sequence + 1`, sin ventana de
 * carrera). Antes se calculaba contando activos existentes (`COUNT`): dos
 * creaciones concurrentes de la misma familia+subtipo+año leían el mismo
 * conteo y generaban el MISMO código, que solo se detectaba al chocar contra
 * el `@unique` de `equipment.code` — y ese choque llegaba como 500 genérico
 * en vez de una colisión limpia.
 */
export async function generateAssetCode(
  familyId: string,
  subtype: string,
  acquisitionMode: string | null | undefined
): Promise<string> {
  const year = new Date().getFullYear()

  // Obtener código de la familia y prefijo personalizado
  const family = familyId
    ? await prisma.families.findUnique({
        where: { id: familyId },
        select: {
          code: true,
          formConfig: { select: { codePrefix: true } },
        },
      })
    : null

  const familyCode = (
    family?.formConfig?.codePrefix?.trim()
      ? family.formConfig.codePrefix.trim().toUpperCase()
      : (family?.code ?? 'INV').toUpperCase()
  ).slice(0, 4)
  const subtypePrefix = SUBTYPE_PREFIX[subtype] ?? subtype.slice(0, 3).toUpperCase()
  const modePrefix = MODE_PREFIX[acquisitionMode ?? 'FIXED_ASSET'] ?? 'FA'

  const counterKey = `${familyCode}-${subtypePrefix}-${modePrefix}-${year}`
  const counter = await prisma.equipment_code_counters.upsert({
    where: { counterKey },
    update: { lastSequence: { increment: 1 } },
    create: {
      counterKey,
      familyCode,
      typeCode: subtypePrefix,
      ownershipMode: modePrefix,
      year,
      lastSequence: 1,
    },
  })

  const seq = String(counter.lastSequence).padStart(4, '0')
  return `${familyCode}-${subtypePrefix}-${modePrefix}-${year}-${seq}`
}
