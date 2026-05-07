/**
 * Servicio de Generación de Códigos Secuenciales para Equipos
 * Genera códigos consecutivos para creación por lote de equipos
 *
 * Formato: {FAMILIA}-{TIPO}-{MODO}-{AÑO}-{SECUENCIA}
 * Ejemplo: TECH-LAP-OWN-2024-00001
 */

import prisma from '@/lib/prisma'

/**
 * Mapeo de tipos de propiedad a códigos de 3 letras
 */
const OWNERSHIP_MODE_MAP: Record<string, string> = {
  OWNED: 'OWN',
  LEASED: 'LEA',
  RENTED: 'REN',
  DONATED: 'DON',
}

/**
 * Genera N códigos secuenciales consecutivos para equipos
 *
 * Los códigos generados son únicos y consecutivos, garantizados por transacción atómica.
 * Utiliza un contador en base de datos para asegurar unicidad incluso en operaciones concurrentes.
 *
 * @param quantity - Cantidad de códigos a generar (1-100)
 * @param familyCode - Código de la familia (ej: "TECH", "MOBI")
 * @param typeCode - Código del tipo de equipo (ej: "LAP", "DESK")
 * @param ownershipType - Tipo de propiedad (OWNED, LEASED, RENTED, DONATED)
 * @param year - Año para los códigos (opcional, por defecto año actual)
 * @returns Array de códigos secuenciales únicos
 *
 * @throws Error si no se pueden generar los códigos
 *
 * @example
 * ```typescript
 * const codes = await generateSequentialCodes(10, 'TECH', 'LAP', 'OWNED', 2024)
 * // ['TECH-LAP-OWN-2024-00001', 'TECH-LAP-OWN-2024-00002', ..., 'TECH-LAP-OWN-2024-00010']
 * ```
 */
export async function generateSequentialCodes(
  quantity: number,
  familyCode: string,
  typeCode: string,
  ownershipType: 'OWNED' | 'LEASED' | 'RENTED' | 'DONATED',
  year?: number
): Promise<string[]> {
  // Validar cantidad
  if (quantity < 1 || quantity > 100) {
    throw new Error('La cantidad debe estar entre 1 y 100')
  }

  const currentYear = year ?? new Date().getFullYear()
  const modeCode = OWNERSHIP_MODE_MAP[ownershipType] || 'OWN'

  // Normalizar códigos (uppercase, máximo 6 caracteres)
  const normalizedFamilyCode = familyCode.toUpperCase().slice(0, 6)
  const normalizedTypeCode = typeCode.toUpperCase().slice(0, 6)

  try {
    // Usar transacción para garantizar atomicidad y unicidad
    const result = await prisma.$transaction(async tx => {
      // Clave única para el contador: familia + tipo + modo + año
      const counterKey = `${normalizedFamilyCode}-${normalizedTypeCode}-${modeCode}-${currentYear}`

      // Buscar o crear contador
      let counter = await tx.equipment_code_counters.findUnique({
        where: { counterKey },
      })

      if (!counter) {
        // Crear nuevo contador iniciando en quantity
        counter = await tx.equipment_code_counters.create({
          data: {
            counterKey,
            familyCode: normalizedFamilyCode,
            typeCode: normalizedTypeCode,
            ownershipMode: modeCode,
            year: currentYear,
            lastSequence: quantity,
          },
        })

        // Retornar secuencias desde 1 hasta quantity
        return { startSequence: 1, endSequence: quantity }
      } else {
        // Incrementar contador existente
        const startSequence = counter.lastSequence + 1
        const endSequence = counter.lastSequence + quantity

        await tx.equipment_code_counters.update({
          where: { counterKey },
          data: {
            lastSequence: endSequence,
          },
        })

        return { startSequence, endSequence }
      }
    })

    // Generar array de códigos
    const codes: string[] = []
    for (let seq = result.startSequence; seq <= result.endSequence; seq++) {
      const paddedSeq = seq.toString().padStart(5, '0')
      const code = `${normalizedFamilyCode}-${normalizedTypeCode}-${modeCode}-${currentYear}-${paddedSeq}`
      codes.push(code)
    }

    return codes
  } catch (error) {
    console.error('Error generando códigos secuenciales:', error)
    throw new Error('No se pudieron generar los códigos secuenciales')
  }
}

/**
 * Valida que un array de códigos manuales no existan en la base de datos
 *
 * @param codes - Array de códigos a validar
 * @returns Objeto con resultado de validación y códigos duplicados
 *
 * @example
 * ```typescript
 * const result = await validateManualCodes(['TECH-LAP-OWN-2024-00001', 'TECH-LAP-OWN-2024-00002'])
 * if (!result.valid) {
 *   console.log('Códigos duplicados:', result.duplicates)
 * }
 * ```
 */
export async function validateManualCodes(
  codes: string[]
): Promise<{ valid: boolean; duplicates: string[] }> {
  try {
    // Buscar equipos existentes con estos códigos
    const existingEquipment = await prisma.equipment.findMany({
      where: {
        code: {
          in: codes,
        },
      },
      select: {
        code: true,
      },
    })

    const duplicates = existingEquipment.map(e => e.code)

    return {
      valid: duplicates.length === 0,
      duplicates,
    }
  } catch (error) {
    console.error('Error validando códigos manuales:', error)
    throw new Error('No se pudieron validar los códigos')
  }
}

/**
 * Obtiene el último número de secuencia para una combinación específica
 * Útil para debugging y reportes
 *
 * @param familyCode - Código de la familia
 * @param typeCode - Código del tipo
 * @param ownershipType - Tipo de propiedad
 * @param year - Año
 * @returns Último número de secuencia usado, o 0 si no existe
 */
export async function getLastSequenceNumber(
  familyCode: string,
  typeCode: string,
  ownershipType: 'OWNED' | 'LEASED' | 'RENTED' | 'DONATED',
  year?: number
): Promise<number> {
  const currentYear = year ?? new Date().getFullYear()
  const modeCode = OWNERSHIP_MODE_MAP[ownershipType] || 'OWN'

  const normalizedFamilyCode = familyCode.toUpperCase().slice(0, 6)
  const normalizedTypeCode = typeCode.toUpperCase().slice(0, 6)

  const counterKey = `${normalizedFamilyCode}-${normalizedTypeCode}-${modeCode}-${currentYear}`

  try {
    const counter = await prisma.equipment_code_counters.findUnique({
      where: { counterKey },
    })

    return counter?.lastSequence || 0
  } catch (error) {
    console.error('Error obteniendo último número de secuencia:', error)
    return 0
  }
}

/**
 * Reinicia el contador de códigos para una combinación específica
 * SOLO para testing o mantenimiento administrativo
 *
 * @param familyCode - Código de la familia
 * @param typeCode - Código del tipo
 * @param ownershipType - Tipo de propiedad
 * @param year - Año
 */
export async function resetSequenceCounter(
  familyCode: string,
  typeCode: string,
  ownershipType: 'OWNED' | 'LEASED' | 'RENTED' | 'DONATED',
  year?: number
): Promise<void> {
  const currentYear = year ?? new Date().getFullYear()
  const modeCode = OWNERSHIP_MODE_MAP[ownershipType] || 'OWN'

  const normalizedFamilyCode = familyCode.toUpperCase().slice(0, 6)
  const normalizedTypeCode = typeCode.toUpperCase().slice(0, 6)

  const counterKey = `${normalizedFamilyCode}-${normalizedTypeCode}-${modeCode}-${currentYear}`

  try {
    await prisma.equipment_code_counters.upsert({
      where: { counterKey },
      update: {
        lastSequence: 0,
      },
      create: {
        counterKey,
        familyCode: normalizedFamilyCode,
        typeCode: normalizedTypeCode,
        ownershipMode: modeCode,
        year: currentYear,
        lastSequence: 0,
      },
    })
  } catch (error) {
    console.error('Error reiniciando contador de secuencia:', error)
    throw new Error('No se pudo reiniciar el contador')
  }
}
