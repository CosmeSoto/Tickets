/**
 * Servicio de Creación por Lote de Equipos
 * Crea múltiples equipos idénticos en una sola operación atómica
 */

import prisma from '@/lib/prisma'
import { generateSequentialCodes, validateManualCodes } from './code-generator.service'
import { bulkEquipmentInputSchema } from '../validations/bulk-equipment'
import type { BulkEquipmentInput, BulkCreateResult } from '@/types/equipment-grouping'
import { EquipmentStatus } from '@prisma/client'

/**
 * Crea múltiples equipos idénticos en una sola operación
 *
 * Proceso:
 * 1. Valida el input con Zod
 * 2. Genera o valida códigos según el modo
 * 3. Valida números de serie si se proporcionan
 * 4. Verifica que no existan códigos duplicados
 * 5. Crea N equipos en una transacción atómica
 * 6. Retorna resultado con resumen
 *
 * @param input - Datos de entrada validados
 * @returns Resultado con equipos creados y resumen
 *
 * @throws Error si la validación falla
 * @throws Error si algún código ya existe (409)
 * @throws Error si hay problemas con la transacción
 *
 * @example
 * ```typescript
 * const result = await createBulkEquipment({
 *   quantity: 10,
 *   codeMode: 'auto',
 *   brand: 'Dell',
 *   model: 'Latitude 5420',
 *   typeId: 'uuid-tipo',
 *   departmentId: 'uuid-depto',
 *   condition: 'GOOD',
 *   ownershipType: 'OWNED'
 * })
 * // result.created.length === 10
 * // result.summary.message === "Se crearon 10 equipos exitosamente: TECH-LAP-OWN-2024-00001 a TECH-LAP-OWN-2024-00010"
 * ```
 */
export async function createBulkEquipment(input: BulkEquipmentInput): Promise<BulkCreateResult> {
  // 1. Validar input con Zod
  const validatedInput = bulkEquipmentInputSchema.parse(input)

  // 2. Obtener información del tipo de equipo para generar códigos
  const equipmentType = await prisma.equipment_types.findUnique({
    where: { id: validatedInput.typeId },
    include: {
      family: true,
    },
  })

  if (!equipmentType) {
    throw new Error('Tipo de equipo no encontrado')
  }

  if (!equipmentType.family) {
    throw new Error('El tipo de equipo debe tener una familia asignada')
  }

  // 3. Generar o validar códigos
  let codes: string[]

  if (validatedInput.codeMode === 'auto') {
    // Generar códigos automáticamente
    const familyCode = equipmentType.family.code
    const typeCode = equipmentType.code
    const year = new Date().getFullYear()

    codes = await generateSequentialCodes(
      validatedInput.quantity,
      familyCode,
      typeCode,
      validatedInput.ownershipType,
      year
    )
  } else {
    // Usar códigos manuales
    codes = validatedInput.manualCodes!

    // Validar que no existan códigos duplicados en la BD
    const validation = await validateManualCodes(codes)
    if (!validation.valid) {
      throw new Error(`Los siguientes códigos ya existen: ${validation.duplicates.join(', ')}`)
    }
  }

  // 4. Preparar números de serie
  const serialNumbers = validatedInput.serialNumbers || []
  const hasSerialNumbers = serialNumbers.length > 0 && serialNumbers.some(s => s.trim().length > 0)

  // 5. Crear equipos en transacción atómica
  try {
    const result = await prisma.$transaction(async tx => {
      // Crear array de datos para createMany
      const equipmentData = codes.map((code, index) => ({
        code,
        serialNumber: hasSerialNumbers ? serialNumbers[index] : '',
        brand: validatedInput.brand,
        model: validatedInput.model,
        typeId: validatedInput.typeId,
        departmentId: validatedInput.departmentId,
        status: EquipmentStatus.AVAILABLE,
        condition: validatedInput.condition,
        ownershipType: validatedInput.ownershipType,
        purchasePrice: validatedInput.purchasePrice || null,
        supplierId: validatedInput.supplierId || null,
        purchaseDate: validatedInput.purchaseDate || null,
        specifications: validatedInput.specifications || null,
        accessories: validatedInput.accessories || [],
        notes: validatedInput.notes || null,
        photoUrl: validatedInput.photoUrl || null,
        warehouseId: validatedInput.warehouseId || null,
        location: null,
        physicalLocation: null,
        saleListingPrice: null,
      }))

      // Crear todos los equipos
      await tx.equipment.createMany({
        data: equipmentData,
      })

      // Obtener los equipos creados para retornarlos
      const createdEquipment = await tx.equipment.findMany({
        where: {
          code: {
            in: codes,
          },
        },
        orderBy: {
          code: 'asc',
        },
      })

      return createdEquipment
    })

    // 6. Preparar resultado
    const created = result.map(eq => ({
      id: eq.id,
      code: eq.code,
      serialNumber: eq.serialNumber,
      brand: eq.brand,
      model: eq.model,
      status: eq.status,
      condition: eq.condition,
      createdAt: eq.createdAt,
    }))

    const summary = {
      total: created.length,
      firstCode: codes[0],
      lastCode: codes[codes.length - 1],
      message:
        created.length === 1
          ? `Se creó 1 equipo exitosamente: ${codes[0]}`
          : `Se crearon ${created.length} equipos exitosamente: ${codes[0]} a ${codes[codes.length - 1]}`,
    }

    return {
      created,
      summary,
    }
  } catch (error: any) {
    // Manejar errores específicos de Prisma
    if (error.code === 'P2002') {
      // Unique constraint violation
      throw new Error('Uno o más códigos ya existen en la base de datos')
    }

    console.error('Error creando equipos por lote:', error)
    throw new Error('No se pudieron crear los equipos. Por favor intenta nuevamente.')
  }
}

/**
 * Valida que haya suficiente stock disponible para una solicitud
 * Útil para validar antes de crear solicitudes de activos
 *
 * @param typeId - ID del tipo de equipo
 * @param quantity - Cantidad solicitada
 * @returns Objeto con resultado de validación y cantidad disponible
 */
export async function validateAvailableStock(
  typeId: string,
  quantity: number
): Promise<{ valid: boolean; available: number; message?: string }> {
  try {
    const available = await prisma.equipment.count({
      where: {
        typeId,
        status: EquipmentStatus.AVAILABLE,
      },
    })

    if (available >= quantity) {
      return {
        valid: true,
        available,
      }
    }

    return {
      valid: false,
      available,
      message: `Solo hay ${available} unidades disponibles de este tipo. Solicitaste ${quantity} unidades.`,
    }
  } catch (error) {
    console.error('Error validando stock disponible:', error)
    throw new Error('No se pudo validar el stock disponible')
  }
}

/**
 * Obtiene información de stock para un modelo específico
 *
 * @param brand - Marca del equipo
 * @param model - Modelo del equipo
 * @param typeId - ID del tipo de equipo
 * @returns Información de stock por estado
 */
export async function getStockInfo(brand: string, model: string, typeId: string) {
  try {
    const equipment = await prisma.equipment.findMany({
      where: {
        brand,
        model,
        typeId,
      },
      select: {
        status: true,
      },
    })

    const statusCounts = {
      total: equipment.length,
      available: 0,
      assigned: 0,
      maintenance: 0,
      forSale: 0,
      sold: 0,
      retired: 0,
    }

    for (const eq of equipment) {
      switch (eq.status) {
        case EquipmentStatus.AVAILABLE:
          statusCounts.available++
          break
        case EquipmentStatus.ASSIGNED:
          statusCounts.assigned++
          break
        case EquipmentStatus.MAINTENANCE:
          statusCounts.maintenance++
          break
        case EquipmentStatus.FOR_SALE:
          statusCounts.forSale++
          break
        case EquipmentStatus.SOLD:
          statusCounts.sold++
          break
        case EquipmentStatus.RETIRED:
          statusCounts.retired++
          break
      }
    }

    return {
      ...statusCounts,
      isNewModel: equipment.length === 0,
      lastUpdated: new Date(),
    }
  } catch (error) {
    console.error('Error obteniendo información de stock:', error)
    throw new Error('No se pudo obtener la información de stock')
  }
}

/**
 * Cuenta equipos disponibles por tipo
 * Versión optimizada que solo cuenta sin traer todos los registros
 *
 * @param typeId - ID del tipo de equipo
 * @returns Cantidad de equipos disponibles
 */
export async function countAvailableByType(typeId: string): Promise<number> {
  try {
    return await prisma.equipment.count({
      where: {
        typeId,
        status: EquipmentStatus.AVAILABLE,
      },
    })
  } catch (error) {
    console.error('Error contando equipos disponibles:', error)
    return 0
  }
}
