import { prisma } from '@/lib/prisma'

export class ValidationService {
  static async validateCodeUniqueness(
    code: string,
    excludeId?: string
  ): Promise<{ isValid: boolean; message?: string }> {
    const existing = await prisma.equipment.findFirst({
      where: {
        code,
        id: excludeId ? { not: excludeId } : undefined,
      },
      select: { id: true },
    })
    if (existing) return { isValid: false, message: `El código "${code}" ya está en uso` }
    return { isValid: true }
  }

  static async validateSerialUniqueness(
    serialNumber: string,
    excludeId?: string
  ): Promise<{ isValid: boolean; message?: string }> {
    if (!serialNumber?.trim()) return { isValid: true }

    const existing = await prisma.equipment.findFirst({
      where: {
        serialNumber,
        id: excludeId ? { not: excludeId } : undefined,
      },
      select: { id: true },
    })
    if (existing)
      return { isValid: false, message: `El número de serie "${serialNumber}" ya está en uso` }
    return { isValid: true }
  }

  static async validateBatchCodes(
    codes: string[]
  ): Promise<{ isValid: boolean; errors: Record<number, string> }> {
    const errors: Record<number, string> = {}

    // Duplicados internos
    const seen = new Set<string>()
    codes.forEach((code, i) => {
      if (seen.has(code)) errors[i] = 'Código duplicado en el lote'
      else seen.add(code)
    })

    // Duplicados en BD
    const existing = await prisma.equipment.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    })
    const existingSet = new Set(existing.map(e => e.code))
    codes.forEach((code, i) => {
      if (existingSet.has(code) && !errors[i]) errors[i] = 'Código ya existe en la base de datos'
    })

    return { isValid: Object.keys(errors).length === 0, errors }
  }

  static async validateBatchSerials(
    serials: (string | null | undefined)[]
  ): Promise<{ isValid: boolean; errors: Record<number, string> }> {
    const errors: Record<number, string> = {}
    const valid = serials.map((s, i) => ({ s: s?.trim(), i })).filter(({ s }) => s)

    if (valid.length === 0) return { isValid: true, errors: {} }

    // Duplicados internos
    const seen = new Set<string>()
    valid.forEach(({ s, i }) => {
      if (seen.has(s!)) errors[i] = 'Número de serie duplicado en el lote'
      else seen.add(s!)
    })

    // Duplicados en BD
    const existing = await prisma.equipment.findMany({
      where: { serialNumber: { in: valid.map(v => v.s!) } },
      select: { serialNumber: true },
    })
    const existingSet = new Set(existing.map(e => e.serialNumber))
    valid.forEach(({ s, i }) => {
      if (existingSet.has(s!) && !errors[i])
        errors[i] = 'Número de serie ya existe en la base de datos'
    })

    return { isValid: Object.keys(errors).length === 0, errors }
  }

  static async validateBatchDeletion(
    batchId: string
  ): Promise<{ canDelete: boolean; message?: string; assignedCount?: number }> {
    const [assignedCount, maintenanceCount] = await Promise.all([
      prisma.equipment.count({ where: { batchId, status: 'ASSIGNED' } }),
      prisma.equipment.count({ where: { batchId, status: 'MAINTENANCE' } }),
    ])

    if (assignedCount > 0) {
      return {
        canDelete: false,
        message: `No se puede eliminar: ${assignedCount} equipo(s) aún asignado(s). Devuélvelos primero.`,
        assignedCount,
      }
    }

    if (maintenanceCount > 0) {
      return {
        canDelete: false,
        message: `No se puede eliminar: ${maintenanceCount} equipo(s) en mantenimiento.`,
        assignedCount: maintenanceCount,
      }
    }

    return { canDelete: true }
  }

  /** Verifica que la cantidad registrada del lote coincida con equipos en BD */
  static async validateBatchIntegrity(batchId: string): Promise<{
    isConsistent: boolean
    recordedQuantity: number
    actualEquipmentCount: number
    message?: string
  }> {
    const batch = await prisma.equipment_batches.findUnique({
      where: { id: batchId },
      select: { quantity: true, batchCode: true },
    })
    if (!batch) {
      return {
        isConsistent: false,
        recordedQuantity: 0,
        actualEquipmentCount: 0,
        message: 'Lote no encontrado',
      }
    }

    const actualEquipmentCount = await prisma.equipment.count({ where: { batchId } })
    const isConsistent = batch.quantity === actualEquipmentCount

    return {
      isConsistent,
      recordedQuantity: batch.quantity,
      actualEquipmentCount,
      message: isConsistent
        ? undefined
        : `El lote ${batch.batchCode} registra ${batch.quantity} unidad(es) pero hay ${actualEquipmentCount} equipo(s) vinculado(s).`,
    }
  }
}
